type CloseCandle = { time: number; close: number };
type CloseQuery = {to: number; price: number; above: boolean; result: boolean};
const orderedCalls = new WeakMap<CloseCandle[], {ordered: boolean; queries?: Map<number, CloseQuery>}>();

// Nur während eines synchronen Fensters wiederverwenden: Aufrufer dürfen
// dieselben Candle-Arrays zwischen Schritten verändern (auch über onStep).
export function withCandleCloseWindow<T>(candles: CloseCandle[], run: () => T, {cacheCloses = false} = {}): T {
  if (orderedCalls.has(candles)) return run();
  orderedCalls.set(candles, {ordered: candles.every((c, i) => Number.isFinite(c.time)
    && (i === 0 || candles[i - 1].time <= c.time)), queries: cacheCloses ? new Map() : undefined});
  try { return run(); } finally { orderedCalls.delete(candles); }
}

export function closesPastLevel(candles: CloseCandle[], from: number, to: number, price: number, above: boolean): boolean {
  if (candles.length === 0) return true;
  const window = orderedCalls.get(candles);
  if (!window?.ordered) {
    return candles.some(c => c.time > from && c.time <= to && (above ? c.close > price : c.close < price));
  }
  if (!(from < to)) return false;
  // Ein Level wird pro Pivot erneut geprüft; nur explizit unveränderliche Fenster teilen Resultate.
  const cached = window.queries?.get(from);
  if (cached && cached.to === to && cached.price === price && cached.above === above) return cached.result;
  let lo = 0, hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (candles[mid].time <= from) lo = mid + 1; else hi = mid;
  }
  let result = false;
  for (let i = lo; i < candles.length && candles[i].time <= to; i++) {
    if (above ? candles[i].close > price : candles[i].close < price) {result = true; break;}
  }
  window.queries?.set(from, {to, price, above, result});
  return result;
}
