import type { Pivot } from './range.type';

export function candleTouchesPrice(candle: { low: number; high: number }, price: number, below: boolean): boolean {
  return below ? candle.low <= price : candle.high >= price;
}

// Erst ab Ende des Ankerbalkens prüfen: dessen eigener Docht ist kein erneuter Touch.
export function firstTouchAfter(
  candles: { time: number; low: number; high: number }[], anchor: Pick<Pivot, 'pivotTime' | 'price'>,
  barSeconds: number, below: boolean,
): number | null {
  const from = (anchor.pivotTime ?? 0) + barSeconds;
  const c = candles.find(k => k.time >= from && candleTouchesPrice(k, anchor.price, below));
  return c ? c.time : null;
}
