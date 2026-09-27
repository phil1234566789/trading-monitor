import type { Pivot } from './range.type';

// Erst ab Ende des Ankerbalkens prüfen: dessen eigener Docht ist kein erneuter Touch.
export function firstTouchAfter(
  candles: { time: number; low: number; high: number }[], anchor: Pick<Pivot, 'pivotTime' | 'price'>,
  barSeconds: number, below: boolean,
): number | null {
  const from = (anchor.pivotTime ?? 0) + barSeconds;
  const c = candles.find(k => k.time >= from && (below ? k.low <= anchor.price : k.high >= anchor.price));
  return c ? c.time : null;
}
