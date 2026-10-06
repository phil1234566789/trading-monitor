import { collectNestedChain } from './marketStructureAnalysis';

export function entryPattern1Countertrend(primary, direction, evaluatedAt, state, stateKnownAt) {
  const check = primary?.checks?.m5Trend;
  if (!check?.structureState || !Number.isFinite(check.evaluatedAt) || check.evaluatedAt > evaluatedAt) return null;
  const current = collectNestedChain(check.structureState).at(-1);
  if (current.trend !== (direction === 'short' ? 'uptrend' : direction === 'long' ? 'downtrend' : null)) return null;
  const start = direction === 'short' ? 'low' : 'high';
  if (!Number.isFinite(current.currRange?.[start]?.pivotTime)) return null;
  const relevant = state ? collectNestedChain(state).findLast(level => level.trend === current.trend
    && level.currRange[start].pivotTime === current.currRange[start].pivotTime) : current;
  return relevant ? { trend: relevant.trend, range: relevant.currRange,
    recognizedAt: Math.max(check.evaluatedAt, stateKnownAt ?? check.evaluatedAt) } : null;
}

export function entryPattern1M5BosMatches(bos, countertrend, direction, evaluatedAt) {
  const origin = countertrend?.range?.[direction === 'short' ? 'high' : 'low'];
  return ['short', 'long'].includes(direction) && countertrend?.trend === (direction === 'short' ? 'uptrend' : 'downtrend')
    && Number.isFinite(countertrend?.recognizedAt) && countertrend.recognizedAt <= evaluatedAt
    && Number.isFinite(origin?.pivotTime) && bos?.originTime === origin.pivotTime
    && bos.type === 'BOS' && bos.direction === direction
    && Number.isFinite(bos.recognizedAt) && bos.recognizedAt <= evaluatedAt;
}

export function entryPattern1M5Bos(reaction, countertrend, direction, evaluatedAt) {
  // DR 9016: gleiche Richtung auf einer Parent-Ebene genügt nicht. Die bei D bekannte
  // innerste Countertrend-Range zählt. Ihr Endextrem kann kausal weitergezogen werden.
  return reaction?.levels?.find(bos => entryPattern1M5BosMatches(bos, countertrend, direction, evaluatedAt)) ?? null;
}
