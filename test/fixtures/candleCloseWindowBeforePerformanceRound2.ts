type CloseCandle = { time: number; close: number };
const orderedCalls = new WeakMap<CloseCandle[], boolean>();

// Nur während eines synchronen Pivot-Schritts wiederverwenden: Aufrufer dürfen
// dieselben Candle-Arrays zwischen Schritten verändern (auch über onStep).
export function withCandleCloseWindow<T>(candles: CloseCandle[], run: () => T): T {
  if (orderedCalls.has(candles)) return run();
  orderedCalls.set(candles, candles.every((c, i) => Number.isFinite(c.time)
    && (i === 0 || candles[i - 1].time <= c.time)));
  try { return run(); } finally { orderedCalls.delete(candles); }
}

export function closesPastLevel(candles: CloseCandle[], from: number, to: number, price: number, above: boolean): boolean {
  if (candles.length === 0) return true;
  if (!orderedCalls.get(candles)) {
    return candles.some(c => c.time > from && c.time <= to && (above ? c.close > price : c.close < price));
  }
  if (!(from < to)) return false;
  let lo = 0, hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (candles[mid].time <= from) lo = mid + 1; else hi = mid;
  }
  for (let i = lo; i < candles.length && candles[i].time <= to; i++) {
    if (above ? candles[i].close > price : candles[i].close < price) return true;
  }
  return false;
}
