import { evaluateTradeSetupChecklist } from './tradeSetupChecklist.js';
import { activeM1Context, buildM1Structure, M1_STRUCTURE_PERIOD } from './m1Structure.js';
import { evaluateM1Checklist } from './m1Checklist.js';
import { buildTradeSetup2Snapshot, buildTradeSetup2CandidateSnapshot } from './tradeSetup2Snapshot.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { historicalSettingsAt } from './tradeSetup2Anchors.js';
import { createCloseReactionCache } from './m5CloseReactionHistory.js';
import { evaluateChecklistTime } from './tradeSetupChecklistTime.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));

export function m1ScanPrefix(candles, anchorTime, end) {
  let lower = 0, upper = candles.length;
  while (lower < upper) {
    const mid = (lower + upper) >>> 1;
    if (candles[mid].time < anchorTime) lower = mid + 1; else upper = mid;
  }
  // Spread-Hour-Kerzen zählen nicht zum P5-Vorlauf. Im Präfix bleiben sie
  // trotzdem enthalten, weil Retest/FVG ihren eigenen Umgang damit haben.
  let usable = 0;
  while (lower > 0 && usable < M1_STRUCTURE_PERIOD * 2 + 1) {
    lower--;
    if (!candles[lower].ignored) usable++;
  }
  return candles.slice(lower, end);
}

// M5 bestimmt ABC/Anker; nur innerhalb eines aktiven ABC-Fensters wird M1 geprüft.
// Jeder Aufruf erhält ausschließlich seinen geschlossenen Präfix. Der Snapshot wird
// am ersten Entry-Schluss neu ausgewertet, nie aus einem späteren Endzustand datiert.
export async function scanTradeSetup2Window({ instrument, h1Candles, m5Candles, m1Candles,
  fromTime, toTime, settings = {}, sessionConfigs = [], tradingWindows, news, newsLoadStatus,
  signal, onProgress, onSnapshot, dailyAnchors = null, yieldEvery = 32, yieldControl = pause }) {
  signal?.throwIfAborted();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime) throw new Error('Invalid scan window');
  const sorted = rows => rows.slice().sort((a, b) => a.time - b.time);
  const h1 = sorted(h1Candles), m5 = sorted(m5Candles);
  const m1 = markIgnoredCandles(sorted(m1Candles), sessionConfigs.filter(s => s.instrument === instrument),
    sec => berlinOffsetMinutes(sec * 1000));
  const steps = m5.map(c => c.time + 300).filter(t => t >= Math.floor(fromTime / 300) * 300 && t <= toTime);
  const snapshots = [], seen = new Set(), seenSetups = new Map();
  const reactionCache = new Map();
  const closeReactionCache = createCloseReactionCache();
  const m1CloseReactionCache = createCloseReactionCache();
  let h1End = 0, m5End = 0, m1End = 0;
  let effectiveSettings = settings;
  const evaluateAt = evaluatedAt => evaluateTradeSetupChecklist({ instrument, evaluatedAt,
    h1Candles: h1.slice(0, h1End), m5Candles: m5.slice(0, m5End),
    settings: effectiveSettings, sessionConfigs, tradingWindows, news, newsLoadStatus, reactionCache, closeReactionCache, entryGates: true });
  for (const [index, at] of steps.entries()) {
    signal?.throwIfAborted();
    while (h1End < h1.length && h1[h1End].time + 3600 <= at) h1End++;
    while (m5End < m5.length && m5[m5End].time + 300 <= at) m5End++;
    effectiveSettings = dailyAnchors ? historicalSettingsAt(settings, dailyAnchors, at) : settings;
    if (!effectiveSettings) continue;
    const checklist = evaluateAt(at);
    for (const candidate of checklist.setup?.candidates ?? []) {
      if (at < fromTime) continue;
      const stage = evaluateDealingRange(checklist, candidate).status;
      if (stage === 'unconfirmed' || seenSetups.get(candidate.id) === stage) continue;
      const snapshot = buildTradeSetup2CandidateSnapshot({ checklist, candidate });
      if (!snapshot) continue;
      seenSetups.set(candidate.id, stage);
      snapshots.push(snapshot);
      await onSnapshot?.(snapshot);
    }
    let context = activeM1Context(checklist);
    let wasBlocked = checklist.checks.time.status === 'blocked';
    const end = Math.min(at + 299, toTime);
    while (m1End < m1.length && m1[m1End].time + 60 < at) m1End++;
    while (m1End < m1.length && m1[m1End].time + 60 <= end) {
      const knownAt = m1[m1End++].time + 60;
      if (evaluateChecklistTime({ instrument, evaluatedAt: knownAt, sessions: sessionConfigs,
        tradingWindows, news, newsLoadStatus }).status === 'blocked') { wasBlocked = true; continue; }
      // Eine News-/Sessiongrenze kann zwischen zwei M5-Schlüssen liegen.
      // Bei Freigabe den geschlossenen M5-Kontext sofort wiederherstellen.
      if (wasBlocked) { context = activeM1Context(evaluateAt(knownAt)); wasBlocked = false; }
      if (!context || knownAt < fromTime || seen.has(`${instrument}:${context.setupKey}`)) continue;
      const anchorTime = Math.min(context.anchor.pivotTime, context.primary.reactionRecognizedAt ?? context.anchor.pivotTime);
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
