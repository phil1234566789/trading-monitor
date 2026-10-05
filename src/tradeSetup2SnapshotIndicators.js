import { activeM1Context, M1_STRUCTURE_PERIOD } from './m1Structure.js';
import {calculateSnapshotM1InWorker} from './snapshotM1Browser.js';
import { supportsSnapshotIndicators } from './tradeSetup2Configuration.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { collectNestedChain } from './marketStructureAnalysis';
import { computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { formatDatedTime } from './berlinTime.js';
import { M1_LOAD_LEAD_IN } from './m1StructureSettings.js';

export function snapshotOverlayTime(snapshot, replayUntil) {
  return Number.isFinite(replayUntil) ? Math.floor(replayUntil / 60) * 60 : snapshot.knownAt;
}

export function snapshotM5Anchor(snapshot) {
  const saved = snapshot.checklist?.checks?.m5Trend;
  const pivot = saved?.structureState?.appliedPivots?.[0];
  return saved?.structureStart ?? pivot?.pivotTime ?? pivot?.time;
}

export function buildSnapshotM5(candles, snapshot, config, at) {
  const anchor = snapshotM5Anchor(snapshot);
  if (!Number.isFinite(anchor) || candles[0]?.time > anchor) return null;
  const outer = config.m5StructurePeriod ?? 5, inner = config.m5Structure2Period ?? 2;
  const rows = closedChecklistCandles(candles, '5m', at).filter(c => !c.ignored);
  const pivotsOuter = computeRangesPivots(rows, outer, anchor), pivotsInner = computeRangesPivots(rows, inner, anchor);
  return { ...buildStructureWithPhases(pivotsOuter, pivotsInner, outer, inner, rows, 300, { closeEvaluation: true }), pivotsOuter, pivotsInner };
}

export const SNAPSHOT_INDICATOR_PROPS = ['showRanges', 'showM5Structure', 'showM1Structure',
  'showLiquidity', 'showObsM5', 'showObs1h', 'showObs4h', 'showHistoricalObs', 'showRsiDivergence', 'showRsiDivergenceHistory'];

export function snapshotChartCandleCount(snapshot, bar, minimum, at=snapshot?.knownAt) {
  const sources=snapshot?.entrySnapshots ?? [snapshot];
  const anchors = sources.flatMap(s=>(s?.evidence ?? []).filter(e => e.role === 'structure' && /Live|Choch/.test(e.styleKey))
    .flatMap(e => [e.fromTime, e.toTime]).concat(s?.entry?.candleTime ?? [])).filter(Number.isFinite);
  if (!anchors.length) return minimum;
  const seconds = { '1m': 60, '5m': 300 }[bar];
  if (!seconds) return minimum;
  // Beide echten Endpunkte laden; Preisanker am Rand zu verschieben verfälscht die Diagonale.
  return Math.min(50000, Math.max(minimum, Math.ceil((at - Math.min(...anchors)) / seconds) + 20));
}

export function snapshotStructureLevels(snapshot) {
  const result = [], at = snapshot.knownAt;
  for (const [tf, state] of [['1h', snapshot.checklist?.structure], ['5m', snapshot.checklist?.checks?.m5Trend?.structureState]]) {
    if (!state) continue;
    for (const level of collectNestedChain(state)) {
      const bounds = [level.currRange?.high, level.currRange?.low].filter(Boolean);
      const pivots = [...bounds, ...(level.structurePivots ?? []).filter(p =>
        ['protected-high', 'protected-low', 'LQ-sweep', 'break-of-structure'].includes(p.type))];
      for (const p of pivots) {
        if (!Number.isFinite(p.pivotTime) || !Number.isFinite(p.price)) continue;
        const base = bounds.includes(p) ? (p === level.currRange.high ? 'rangeHigh' : 'rangeLow')
          : p.type.startsWith('protected') ? 'rangeProtectedLow' : p.type === 'LQ-sweep' ? 'rangeLqSweep' : 'rangeBreakOfStructure';
        const touchedEnd = ['LQ-sweep', 'break-of-structure'].includes(p.type) && p.touched?.touchedTime;
        result.push({ kind: 'line', role: 'structureLevel', timeframe: tf, knownAt: at, price: p.price,
          fromTime: p.pivotTime, toTime: touchedEnd || at - 60,
          styleKey: tf === '1h' ? base : `m5${base[0].toUpperCase()}${base.slice(1)}`, label: `${tf} ${p.type}` });
      }
    }
  }
  return result;
}

export function snapshotEvidenceVisible(e, props = {}) {
  if (props.dynamicStructure?.includes(e.timeframe) && ['structure','structureLevel','CHoCH','BOS','internalSweep'].includes(e.role)) return false;
  if (props.snapshotView) return true;
  if (e.role === 'divergence') return props.showRsiDivergence !== false || props.showRsiDivergenceHistory === true;
  if (['reactionOB','entryOrderBlock'].includes(e.role)) return props.showObsM5 !== false;
  if (['sweep', 'target1', 'target2'].includes(e.role)) return props.showLiquidity !== false;
  const key = { '1h': 'showRanges', '5m': 'showM5Structure', '1m': 'showM1Structure' }[e.timeframe];
  if (key && props[key] === false) return false;
  return true;
}

// Maximal wenige Tage pro Auswahl; lange/alte Läufe lösen keinen Jahresscan aus.
const MAX_M1_CANDLES = 5000;
export function createSnapshotM1Reader(repository, fetchCandles) {
  const pending = new Map(),candles = new Map();
  return (runId, snapshot, at = snapshot.knownAt, {signal} = {}) => {
    signal?.throwIfAborted();
    const key = `${runId}:${snapshot.id}:${at}`;
    if (!pending.has(key)) {
      const request = load(runId, snapshot, at,signal).catch(error => { if(pending.get(key)===request)pending.delete(key); throw error; });
      pending.set(key, request);
      signal?.addEventListener('abort',()=>{if(pending.get(key)===request)pending.delete(key);},{once:true});
      if (pending.size > 8) pending.delete(pending.keys().next().value);
    }
    return pending.get(key);
  };
  async function load(runId, snapshot, at,signal) {
    const unavailable = message => ({ result: null, message });
    const context = activeM1Context(snapshot.checklist);
    if (!context || context.instrument !== snapshot.instrument
      || ![snapshot.knownAt, context.anchor.pivotTime, context.anchor.recognizedAt, context.anchor.price].every(Number.isFinite)
      || context.anchor.recognizedAt > snapshot.knownAt) {
      return unavailable('M1-Ergänzung nicht verfügbar: kein bestätigter gespeicherter Anker.');
    }
    const run = await repository.getRun(runId);
    signal?.throwIfAborted();
    const config = run?.configuration?.instruments?.find(c => c.instrument === snapshot.instrument) ?? run?.configuration;
    if (config?.instrument !== snapshot.instrument || !supportsSnapshotIndicators(config.setupVersion)
      || config.m1Period !== M1_STRUCTURE_PERIOD || !Array.isArray(config.sessions)) {
      return unavailable('M1-Ergänzung nicht verfügbar: passende Algorithmusversion oder gespeicherte Sessions fehlen.');
    }
    // Zusätzlicher Vorlauf überbrückt ignorierte Spread-Hour-Kerzen. Reicht er
    // nicht, bleibt der gespeicherte Beleg sichtbar statt eine Teilstruktur zu behaupten.
    const leadIn = M1_LOAD_LEAD_IN;
    const count = Math.ceil((at - context.anchor.pivotTime) / 60) + leadIn;
    if (!Number.isFinite(count) || count < leadIn || count > MAX_M1_CANDLES) {
      return unavailable('M1-Ergänzung nicht verfügbar: Anker außerhalb des begrenzten Archivfensters.');
    }
    const candleKey=`${snapshot.instrument}:${count}:${at}`;
    if(!candles.has(candleKey)) {
      candles.set(candleKey,fetchCandles(snapshot.instrument,count,at).catch(error=>{candles.delete(candleKey);throw error;}));
      if(candles.size>8)candles.delete(candles.keys().next().value);
    }
    const rows = closedChecklistCandles(await candles.get(candleKey), '1m', at);
    signal?.throwIfAborted();
    // Bei einer Lücke ab dem Anker ist die damalige Fraktalfolge nicht belegbar.
    if (rows.some((c, i) => i > 0 && c.time >= context.anchor.pivotTime && c.time - rows[i - 1].time > 60)) {
      return unavailable('M1-Ergänzung nicht verfügbar: unterbrochenes Archivfenster ab dem Anker.');
    }
    const result = await calculateSnapshotM1InWorker({rows,anchor:context.anchor,at,
      sessions:config.sessions,instrument:snapshot.instrument},{signal});
    if (result.status !== 'ready' || rows.at(-1)?.time + 60 !== at) {
      return unavailable('M1-Ergänzung nicht verfügbar: Archiv oder Fraktalvorlauf unvollständig.');
    }
    return { result, message: `M1-Struktur und Debug-Pivots aus historischen Kerzen berechnet · P5 · ${result.pivotsOuter.length} Pivots · bis zum Replay-Stand ${formatDatedTime(at)} · Checklist ${formatDatedTime(snapshot.knownAt)}` };
  }
}
