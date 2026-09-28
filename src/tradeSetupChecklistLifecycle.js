import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { evaluateChecklistTargets } from './tradeSetupChecklistTargets.js';
import { candleTouchesPrice } from './structurePivotTime';

export const CHECKLIST_RULE_VERSION = 'session-targets-at-c-m5-sweep-v2';

export function fixChecklistTargets({ candidate, instrument, candles, sessionConfigs }) {
  const selectedAt = candidate.reactionRecognizedAt;
  if (candidate.checks.reaction.status !== 'passed' || !Number.isFinite(selectedAt)) return null;
  const prefix = closedChecklistCandles(candles, '5m', selectedAt);
  // Referenz ist der damals geschlossene Kurs; spätere Kurse verschieben keine Auswahl.
  const referencePrice = prefix.findLast(c => !c.ignored)?.close;
  if (prefix.at(-1)?.time + 300 !== selectedAt) return null;
  return evaluateChecklistTargets({ instrument, direction: candidate.direction, evaluatedAt: selectedAt,
    referencePrice, m5Candles: prefix, sessionConfigs });
}

/** T1 beendet das Hauptsetup; T2 wird unabhängig davon bis zur Invalidierung beobachtet. */
export function evaluateChecklistLifecycle({ selection, invalidation, candles, evaluatedAt }) {
  let main = { state: 'unknown', reason: 'missingSelection', endedAt: null, recognizedAt: null };
  let target2 = { status: selection?.target2 ? 'unknown' : 'notApplicable', reason: 'missingSelection', hitAt: null, endedAt: null, recognizedAt: null };
  const result = () => ({ main, target2, evaluatedAt });
  if (selection?.status !== 'passed' || !selection.target1 || !Number.isFinite(invalidation)
    || !Number.isFinite(evaluatedAt) || evaluatedAt < selection.selectedAt) return result();
  main = { ...main, state: 'active', reason: null };
  target2 = { ...target2, status: selection.target2 ? 'open' : 'notApplicable', reason: null };
  const short = selection.direction === 'short';
  const rows = closedChecklistCandles(candles, '5m', evaluatedAt).filter(c => c.time >= selection.selectedAt);
  let next = selection.selectedAt;
  const missing = () => {
    if (main.state === 'active') main = { ...main, state: 'unknown', reason: 'missingHistory' };
    if (target2.status === 'open') target2 = { ...target2, status: 'unknown', reason: 'missingHistory' };
  };
  for (const c of rows) {
    if (main.state === 'ended' && target2.status !== 'open') break;
    // Schon eine Lücke vor dem Ereignis lässt dessen Reihenfolge unbelegt.
    if (c.time !== next || !Number.isFinite(c.high) || !Number.isFinite(c.low)) { missing(); return result(); }
    next += 300;
    if (c.ignored) continue;
    const invalid = candleTouchesPrice(c, invalidation, !short);
    const t1 = candleTouchesPrice(c, selection.target1.price, short);
    if (main.state === 'active' && (invalid || t1)) main = { state: 'ended', reason: invalid && t1 ? 'both' : invalid ? 'invalidation' : 'target1', endedAt: c.time, recognizedAt: next };
    if (target2.status === 'open') {
      const t2 = candleTouchesPrice(c, selection.target2.price, short);
      if (invalid || t2) target2 = { status: invalid && t2 ? 'unknown' : invalid ? 'notReached' : 'reached',
        reason: invalid && t2 ? 'sameCandle' : invalid ? 'invalidation' : 'target2',
        hitAt: t2 && !invalid ? c.time : null, endedAt: c.time, recognizedAt: next };
    }
  }
  if (next < Math.floor(evaluatedAt / 300) * 300) missing();
  return result();
}
