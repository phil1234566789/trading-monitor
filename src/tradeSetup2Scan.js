import { m1ScanPrefix } from './m1ScanPrefix.js';
import { scanCountertrendWindow } from './countertrendScan.js';
import { evaluateTradeSetupChecklist } from './tradeSetupChecklist.js';
import { activeM1Context, buildM1Structure } from './m1Structure.js';
import { m1LoadStart } from './m1StructureStart.js';
import { evaluateM1Checklist } from './m1Checklist.js';
import { buildTradeSetup2Snapshot, buildTradeSetup2CandidateSnapshot } from './tradeSetup2Snapshot.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { historicalSettingsAt } from './tradeSetup2Anchors.js';
import { createCloseReactionCache } from './m5CloseReactionHistory.js';
import { evaluateChecklistTime, evaluateTradingHours, validTradingWindows } from './tradeSetupChecklistTime.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));

export { m1ScanPrefix } from './m1ScanPrefix.js';

// M5 bestimmt ABC/Anker; nur innerhalb eines aktiven ABC-Fensters wird M1 geprüft.
// Jeder Aufruf erhält ausschließlich seinen geschlossenen Präfix. Der Snapshot wird
// am ersten Entry-Schluss neu ausgewertet, nie aus einem späteren Endzustand datiert.
export async function scanTradeSetup2Window({ instrument, h1Candles, m5Candles, m1Candles,
  fromTime, toTime, settings = {}, sessionConfigs = [], tradingWindows, news, newsLoadStatus,
  signal, onProgress, onSnapshot, dailyAnchors = null, tradeSetups = null, loadM1Candles, existingEntries = [], useMemo=true,yieldEvery = 32, yieldControl = pause }) {
  signal?.throwIfAborted();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime) throw new Error('Invalid scan window');
  if (tradeSetups !== null) return scanCountertrendWindow({instrument,h1Candles,m5Candles,m1Candles,fromTime,toTime,settings,sessionConfigs,tradingWindows,news,newsLoadStatus,signal,onProgress,onSnapshot,dailyAnchors,tradeSetups,loadM1Candles,existingEntries,useMemo,yieldEvery,yieldControl});
  if (!validTradingWindows(tradingWindows)) throw new Error(`Missing or invalid historical trading_windows: ${instrument}`);
  const allowedAt = evaluatedAt => evaluateTradingHours({ instrument, evaluatedAt, tradingWindows }).status === 'passed';
  const sorted = rows => rows.slice().sort((a, b) => a.time - b.time);
  const h1 = sorted(h1Candles), m5 = sorted(m5Candles);
  const m1 = markIgnoredCandles(sorted(m1Candles), sessionConfigs.filter(s => s.instrument === instrument),
    sec => berlinOffsetMinutes(sec * 1000));
  const steps = m5.map(c => c.time + 300).filter(t => t >= Math.floor(fromTime / 300) * 300 && t <= toTime);
  const snapshots = [], seen = new Set(), seenSetups = new Map();
  const reactionCache = new Map();
  const closeReactionCache = createCloseReactionCache();
  const setupClassificationCache = new Map();
  const m1CloseReactionCache = createCloseReactionCache();
  let h1End = 0, m5End = 0, m1End = 0;
  let effectiveSettings = settings;
  // Der alte Countertrend-Scanner bleibt für seine gespeicherten Regeln erhalten.
  const evaluateChecklist = evaluateTradeSetupChecklist;
  const evaluateAt = evaluatedAt => evaluateChecklist({ instrument, evaluatedAt, tradeSetups, dailyAnchors,
    setupClassificationCache,
    h1Candles: h1.slice(0, h1End), m5Candles: m5.slice(0, m5End),
    settings: effectiveSettings, sessionConfigs, tradingWindows, news, newsLoadStatus, reactionCache, closeReactionCache, entryGates: true });
  async function saveCandidates(checklist) {
    for (const candidate of checklist?.setup?.candidates ?? []) {
      if (checklist.evaluatedAt < fromTime || candidate.validity?.state === 'ended'
        && !(checklist.model==='countertrend' && ['invalidation','both'].includes(candidate.validity.reason))) continue;
      const stage = evaluateDealingRange(checklist, candidate).status;
      if (stage === 'unconfirmed' && checklist.model!=='countertrend' || seenSetups.get(candidate.id) === stage) continue;
      const snapshot = buildTradeSetup2CandidateSnapshot({ checklist, candidate });
      if (!snapshot) continue;
      seenSetups.set(candidate.id, stage);
      snapshots.push(snapshot);
      await onSnapshot?.(snapshot);
    }
  }
  for (const [index, at] of steps.entries()) {
    signal?.throwIfAborted();
    while (h1End < h1.length && h1[h1End].time + 3600 <= at) h1End++;
    while (m5End < m5.length && m5[m5End].time + 300 <= at) m5End++;
    effectiveSettings = dailyAnchors ? historicalSettingsAt(settings, dailyAnchors, at) : settings;
    if (!effectiveSettings) continue;
    // Außerhalb der Handelszeiten nur die Präfix-Zeiger bewegen. Die nächste
    // erlaubte Bewertung bekommt trotzdem sämtliche inzwischen geschlossenen Kerzen.
    const checklist = allowedAt(at) ? evaluateAt(at) : null;
    await saveCandidates(checklist);
    let context = activeM1Context(checklist);
    let wasBlocked = !checklist || checklist.checks.time.status === 'blocked';
    const end = Math.min(at + 299, toTime);
    while (m1End < m1.length && m1[m1End].time + 60 < at) m1End++;
    while (m1End < m1.length && m1[m1End].time + 60 <= end) {
      const knownAt = m1[m1End++].time + 60;
      if (!allowedAt(knownAt)) { context = null; wasBlocked = true; continue; }
      if (evaluateChecklistTime({ instrument, evaluatedAt: knownAt, sessions: sessionConfigs,
        tradingWindows, news, newsLoadStatus }).status === 'blocked') { wasBlocked = true; continue; }
      // Eine News-/Sessiongrenze kann zwischen zwei M5-Schlüssen liegen.
      // Bei Freigabe den geschlossenen M5-Kontext sofort wiederherstellen.
      if (wasBlocked) {
        const resumed = evaluateAt(knownAt);
        context = activeM1Context(resumed);
        await saveCandidates(resumed);
        wasBlocked = false;
      }
      if (!context || knownAt < fromTime || seen.has(`${instrument}:${context.setupKey}`)) continue;
      const anchorTime = m1LoadStart(context);
      const rows = m1ScanPrefix(m1, anchorTime, m1End);
      const m1Structure = buildM1Structure(rows, context.anchor, knownAt);
      const m1Check = evaluateM1Checklist({ context, structure: m1Structure, candles: rows, evaluatedAt: knownAt,
        closeReactionCache: m1CloseReactionCache });
      if (m1Check.entry?.recognizedAt !== knownAt) continue;
      const snapshot = buildTradeSetup2Snapshot({ checklist: evaluateAt(knownAt), m1Check, m1Structure, m1Candles: rows });
      if (!snapshot) continue;
      seen.add(`${instrument}:${context.setupKey}`);
      snapshots.push(snapshot);
      await onSnapshot?.(snapshot);
    }
    await onProgress?.({ phase: 'scan', completed: index + 1, total: steps.length, evaluatedAt: at, entries: seen.size, setups: seenSetups.size });
    if ((index + 1) % yieldEvery === 0) await yieldControl();
  }
  return snapshots;
}
