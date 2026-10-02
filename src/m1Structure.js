import { collectNestedChain, computeRangesPivots } from './marketStructureAnalysis';
import { buildStructureWithPhases } from './trendPhases.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { hasConfirmedChecklistAbc } from './tradeSetupChecklistGates.js';

export const M1_STRUCTURE_PERIOD = 5;

export function m1AnchorFromM5(state, reaction, direction, evaluatedAt) {
  if (!state || !direction) return null;
  const short = direction === 'short';
  const current = reaction?.direction === direction ? reaction : null;
  const bos = current?.bos?.recognizedAt <= evaluatedAt ? current.bos : null;
  const signal = bos ?? current?.choch;
  const protectedType = short ? 'protected-low' : 'protected-high';
  const levels = collectNestedChain(state).filter(s => s.trend === (short ? 'uptrend' : 'downtrend')
    && (signal ? s.currRange[short ? 'high' : 'low'].pivotTime === signal.originTime
      : s.structurePivots.some(p => p.type === protectedType)));
  if (levels.length !== 1) return null;
  const pivot = levels[0].structurePivots.find(p => p.type === protectedType);
  // Der geschlossene M5-Präfix hat die Schutzfunktion bereits bestätigt. Kein späterer
  // BOS ist nötig; frühere Replay-Stände rekonstruieren ihre eigene Pivotidentität.
  return pivot ? { pivotTime: pivot.pivotTime, price: pivot.price, recognizedAt: evaluatedAt } : bos;
}

export function m1PrerequisiteReason(checklist) {
  if (!checklist || checklist.status !== 'ready') return 'prerequisites';
  if (checklist.checks?.time?.status === 'blocked') return 'time';
  if (checklist.setup?.primary?.validity?.state === 'ended') return 'ended';
  if (!checklist.setup?.primary || !hasConfirmedChecklistAbc(checklist.checks)) return 'abc';
  if (checklist.dealingRange && checklist.dealingRange.status !== 'validated') return 'validation';
  if (!checklist.checks.m5Trend?.m1Anchor) return 'anchor';
  return null;
}

export function activeM1Context(checklist) {
  if (m1PrerequisiteReason(checklist)) return null;
  const anchor = checklist.checks.m5Trend?.m1Anchor;
  return anchor ? { instrument: checklist.instrument, anchor, evaluatedAt: checklist.evaluatedAt,
    direction: checklist.setup.primary.direction ?? checklist.direction, primary: checklist.setup.primary,
    setupKey: checklist.setup.primary.id ?? checklist.setup.primary.key } : null;
}

export function buildM1Structure(rows, anchor, evaluatedAt) {
  const empty = { state: null, pivotsOuter: [], pivotsInner: [], events: [], status: 'waiting' };
  if (!anchor || anchor.recognizedAt > evaluatedAt) return empty;
  const candles = closedChecklistCandles(rows, '1m', evaluatedAt).filter(c => !c.ignored);
  // Vorlauf zählt echte Kerzen, damit ein Wochenende keine Fraktalbestätigung vortäuscht.
  if (candles.filter(c => c.time < anchor.pivotTime).length < M1_STRUCTURE_PERIOD) {
    return { ...empty, status: 'missing' };
  }
  const pivotsOuter = computeRangesPivots(candles, M1_STRUCTURE_PERIOD, anchor.pivotTime);
  // M1-P2 lieferte Fehlsignale: auch Nested/CHoCH/BOS dürfen nur P5 verarbeiten.
  // Leere Inner-Liste nutzt den bestehenden Kern ohne doppelte Pivot-Einspeisung.
  const pivotsInner = [];
  return { ...buildStructureWithPhases(pivotsOuter, pivotsInner, M1_STRUCTURE_PERIOD, M1_STRUCTURE_PERIOD, candles, 60),
    pivotsOuter, pivotsInner, status: 'ready' };
}
