import { buildMarketStructureState, collectNestedChain, computeRangesPivots } from './marketStructureAnalysis';

const candidateKey = level => {
  const seeds = level.nestedTrend?.appliedPivots;
  return seeds?.length >= 2 ? `${level.trend}:${seeds[0].pivotTime}:${seeds[1].pivotTime}` : null;
};
const originOf = level => level.currRange[level.trend === 'uptrend' ? 'high' : 'low'];
const sourceKey = level => `${level.trend}:${originOf(level).pivotTime}`;
const closesPast = (candle, price, short) => short ? candle.close < price : candle.close > price;
const event = (type, candle, pivot, direction, depth, originTime, barSeconds) => ({
  type, direction, depth, originTime, price: pivot.price, pivotTime: pivot.pivotTime,
  candleTime: candle.time, recognizedAt: candle.time + barSeconds,
});

// Die heutigen Pivot-Typen enthalten spätere Brüche. Jeder Signalzeitpunkt wird deshalb
// mit dem damaligen Kerzenpräfix geprüft; die bestehende Struktur entscheidet über die Level.
// Nur die aktuelle Nested-Kette zählt, keine beliebige alte CHoCH-/BOS-Reaktion.
export function deriveM5CloseReaction(state, outer, inner, periodOuter, periodInner, candles, barSeconds) {
  const empty = { trend: 'unknown', direction: null, choch: null, bos: null, levels: [] };
  if (!state || state.trend === 'unknown') return empty;
  const chain = collectNestedChain(state);
  const result = { ...empty, trend: chain.at(-1).trend };
  const cache = new Map([[candles.length - 1, state]]);
  const stateAt = index => {
    if (!cache.has(index)) {
      const prefix = candles.slice(0, index + 1);
      cache.set(index, buildMarketStructureState(
        computeRangesPivots(prefix, periodOuter, outer?.[0]?.pivotTime ?? Infinity),
        computeRangesPivots(prefix, periodInner, inner?.[0]?.pivotTime ?? Infinity),
        periodOuter, periodInner, prefix, { barSeconds }));
    }
    return cache.get(index);
  };
  const chainAt = index => {
    const snapshot = stateAt(index);
    return snapshot ? collectNestedChain(snapshot) : [];
  };
  for (const parent of chain) {
    const key = candidateKey(parent);
    const origin = originOf(parent);
    const seed = parent.nestedTrend?.appliedPivots[1];
    const short = parent.trend === 'uptrend';
    const direction = short ? 'short' : 'long';
    const parentAt = index => chainAt(index).find(level => sourceKey(level) === sourceKey(parent));
    const makeEvent = (type, index, pivot) => event(type, candles[index], pivot, direction,
      chainAt(index - 1).findIndex(level => sourceKey(level) === sourceKey(parent)), origin.pivotTime, barSeconds);
    const chochIndex = !key ? -1 : candles.findIndex((candle, i) => candle.time > seed.pivotTime
      && closesPast(candle, seed.price, short) && candidateKey(parentAt(i - 1) ?? {}) === key);
    const choch = chochIndex >= 0 ? makeEvent('CHoCH', chochIndex, seed) : null;
    const protectedType = short ? 'protected-low' : 'protected-high';
    const knownProtected = (index, pivot) => {
      const known = parentAt(index - 1);
      if (!known) return false;
      const p = known.structurePivots.find(p => p.pivotTime === pivot.pivotTime);
      if (p?.type === protectedType) return true;
      // Ein Docht degradiert im Bestand protected zu LQ-sweep. Die vorher bekannte
      // Schutzfunktion bleibt bis zum Close-Bruch oder einem neu geschützten Punkt bestehen.
      if (p?.type !== 'LQ-sweep' || known.structurePivots.some(p => p.type === protectedType)) return false;
      const touchIndex = candles.findIndex(c => c.time === p.touched?.touchedTime);
      return touchIndex > 0 && parentAt(touchIndex - 1)?.structurePivots.some(p => p.pivotTime === pivot.pivotTime && p.type === protectedType);
    };
    let bos = null;
    for (const pivot of parent.structurePivots.filter(p => [protectedType, 'break-of-structure', 'LQ-sweep'].includes(p.type))) {
      const index = candles.findIndex((c, i) => c.time > origin.pivotTime && c.time > pivot.pivotTime
        && closesPast(c, pivot.price, short) && knownProtected(i, pivot));
      if (index >= 0 && (!bos || candles[index].time < bos.candleTime)) bos = makeEvent('BOS', index, pivot);
    }
    const startedAt = Math.min(choch?.candleTime ?? Infinity, bos?.candleTime ?? Infinity);
    // Ein Schluss jenseits des Ursprungs widerlegt diese Drehung. Ein späterer
    // Rücklauf unter/über denselben Seed darf den alten Haken nicht wiederbeleben.
    if (candles.some(c => c.time > startedAt && closesPast(c, origin.price, !short))) continue;
    const pending = (type, pivot) => ({ type, direction, price: pivot.price, pivotTime: pivot.pivotTime,
      originTime: origin.pivotTime, candleTime: null, recognizedAt: null });
    if (seed) result.levels.push(choch ?? pending('CHoCH', seed));
    if (bos) result.levels.push(bos);
    // Auch nach einem Docht bleibt das bekannte Schutzlevel offen. Ein inzwischen
    // neu geschützter Pivot ersetzt es; derselbe Schlusskursprüfer entscheidet beides.
    const protectedPivot = parent.structurePivots.find(p => knownProtected(candles.length, p));
    if (protectedPivot && protectedPivot.pivotTime !== bos?.pivotTime) result.levels.push(pending('BOS', protectedPivot));
    if (!choch && !bos) continue;
    const previousStart = Math.min(result.choch?.candleTime ?? Infinity, result.bos?.candleTime ?? Infinity);
    if (result.direction && previousStart >= startedAt) continue;
    result.direction = direction;
    result.choch = choch;
    result.bos = bos;
  }
  return result;
}
