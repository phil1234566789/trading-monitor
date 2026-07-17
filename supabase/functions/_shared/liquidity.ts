// Portiert aus src/liquidity.js (Williams-Fractal-Pivot-Erkennung + Touch-Check) für die
// Deno-Edge-Function-Laufzeit — nur die reine Erkennungslogik, kein Rendering (das bleibt
// Chart-only in PriceChart.vue). Bei Änderungen an der Fractal-/Touch-Logik in
// src/liquidity.js diese Kopie mitziehen.
import type { Candle } from "./orderBlocks.ts";

export interface LiquidityLevel {
  price: number;
  pivotTime: number;
  touched: boolean;
  touchedTime: number | null;
  endTime: number;
}

function isUpFractal(candles: Candle[], p: number, n: number): boolean {
  const pivot = candles[p].high;
  for (let i = 1; i <= n; i++) {
    if (!(candles[p + i].high < pivot)) return false;
  }
  let c0 = true, c1 = true, c2 = true, c3 = true, c4 = true;
  for (let i = 1; i <= n; i++) {
    c0 = c0 && candles[p - i].high < pivot;
    c1 = c1 && candles[p - 1].high <= pivot && candles[p - i - 1].high < pivot;
    c2 = c2 && candles[p - 1].high <= pivot && candles[p - 2].high <= pivot && candles[p - i - 2].high < pivot;
    c3 =
      c3 &&
      candles[p - 1].high <= pivot &&
      candles[p - 2].high <= pivot &&
      candles[p - 3].high <= pivot &&
      candles[p - i - 3].high < pivot;
    c4 =
      c4 &&
      candles[p - 1].high <= pivot &&
      candles[p - 2].high <= pivot &&
      candles[p - 3].high <= pivot &&
      candles[p - 4].high <= pivot &&
      candles[p - i - 4].high < pivot;
  }
  return c0 || c1 || c2 || c3 || c4;
}

function isDownFractal(candles: Candle[], p: number, n: number): boolean {
  const pivot = candles[p].low;
  for (let i = 1; i <= n; i++) {
    if (!(candles[p + i].low > pivot)) return false;
  }
  let c0 = true, c1 = true, c2 = true, c3 = true, c4 = true;
  for (let i = 1; i <= n; i++) {
    c0 = c0 && candles[p - i].low > pivot;
    c1 = c1 && candles[p - 1].low >= pivot && candles[p - i - 1].low > pivot;
    c2 = c2 && candles[p - 1].low >= pivot && candles[p - 2].low >= pivot && candles[p - i - 2].low > pivot;
    c3 =
      c3 &&
      candles[p - 1].low >= pivot &&
      candles[p - 2].low >= pivot &&
      candles[p - 3].low >= pivot &&
      candles[p - i - 3].low > pivot;
    c4 =
      c4 &&
      candles[p - 1].low >= pivot &&
      candles[p - 2].low >= pivot &&
      candles[p - 3].low >= pivot &&
      candles[p - 4].low >= pivot &&
      candles[p - i - 4].low > pivot;
  }
  return c0 || c1 || c2 || c3 || c4;
}

function buildLevel(candles: Candle[], p: number, period: number, dir: 1 | -1): LiquidityLevel {
  const price = dir === 1 ? candles[p].high : candles[p].low;
  let touched = false;
  let touchedTime: number | null = null;
  for (let i = p + period; i < candles.length; i++) {
    const c = candles[i];
    const cross = dir === 1 ? c.high >= price : c.low <= price;
    if (cross) {
      touched = true;
      touchedTime = c.time;
      break;
    }
  }
  return {
    price,
    pivotTime: candles[p].time,
    touched,
    touchedTime,
    endTime: touched ? touchedTime! : candles[candles.length - 1].time,
  };
}

export function detectLiquidityLevels(candles: Candle[], period: number): { highs: LiquidityLevel[]; lows: LiquidityLevel[] } {
  const highs: LiquidityLevel[] = [];
  const lows: LiquidityLevel[] = [];
  const minIdx = period + 4;
  const maxIdx = candles.length - 1 - period;

  for (let p = minIdx; p <= maxIdx; p++) {
    if (isUpFractal(candles, p, period)) highs.push(buildLevel(candles, p, period, 1));
    if (isDownFractal(candles, p, period)) lows.push(buildLevel(candles, p, period, -1));
  }
  return { highs, lows };
}
