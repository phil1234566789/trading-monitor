export function scanWindowCandles(rows, dailyAnchors, from, to, warmupDays) {
  const anchors = dailyAnchors ? [dailyAnchors.findLast(anchor => anchor.knownAt <= from),
    ...dailyAnchors.filter(anchor => anchor.knownAt > from && anchor.knownAt < to)].filter(Boolean) : [];
  const start = Math.min(from - warmupDays * 86400, ...anchors.map(anchor => anchor.structureStartTime - 7 * 86400));
  const prefix = bar => rows[bar].filter(candle => candle.time >= start && candle.time < to);
  return { h1Candles: prefix('1h'), m5Candles: prefix('5m'), m1Candles: prefix('1m') };
}
