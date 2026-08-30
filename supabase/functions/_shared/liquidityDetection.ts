// Periodenagnostische Williams-Fractal-Pivot-Erkennung, index-basiert (keine Stunden-Arithmetik)
// — funktioniert für beliebige Kerzen-Timeframes (M5/1H/4H/1D) mit beliebiger Periode. Verschoben
// aus trading-monitor-mcp/liquidityDetection.js (Task "Market-Structure-Startpunkt:
// 1D-Periode-4-Pivots", 2026-08-30) nach _shared/, damit die neue daily-structure-pivots-Funktion
// (1D-Periode-4-Pivots) dieselbe Erkennung nutzt wie marketStructureAnalysis.ts (1H-Periode-5/2)
// statt eines vierten Ports. trading-monitor-mcp/marketStructureAnalysis.ts,
// findTargetCandidates.js, tools/dataExport.ts und scripts/backfillLiquidityLevels.ts importieren
// seitdem von hier statt der gelöschten lokalen Kopie. src/liquidityDetection.js (Frontend) bleibt
// unangetastet — bewusste FE/BE-Duplizierung (siehe CLAUDE.md).
//
// dir bleibt Teil des zurückgegebenen Levels (anders als _shared/liquidity.ts' buildLevel, das dir
// NICHT zurückgibt, weil poi-watcher highs/lows getrennt behandelt und direction erst nachträglich
// anhängt) — computeRangesPivots (marketStructureAnalysis.ts) liest `p.dir` direkt.
import type { Candle } from "./orderBlocks.ts";

export const LIQUIDITY_FRACTAL_PERIOD = 5; // Williams-Fractal-Periode, siehe fractals.pine
export const LIQUIDITY_MAX_RELEVANT = 10; // je Richtung, siehe liqMaxRelevant in inputs.pine
const RECENT_SWEEP_COUNT = 2; // siehe markTopKRecentTouches in liquidity.pine

export interface LiquidityLevel {
  price: number;
  dir: 1 | -1;
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
    dir,
    pivotTime: candles[p].time,
    touched,
    touchedTime,
    endTime: touched ? touchedTime! : candles[candles.length - 1].time,
  };
}

export function detectLiquidityLevels(candles: Candle[], period: number): { highs: LiquidityLevel[]; lows: LiquidityLevel[] } {
  const highs: LiquidityLevel[] = [];
  const lows: LiquidityLevel[] = [];
  const minIdx = period + 4; // Kaskaden-Logik braucht bis zu period+4 Kerzen davor
  const maxIdx = candles.length - 1 - period; // braucht `period` Kerzen danach zur Bestätigung

  for (let p = minIdx; p <= maxIdx; p++) {
    if (isUpFractal(candles, p, period)) highs.push(buildLevel(candles, p, period, 1));
    if (isDownFractal(candles, p, period)) lows.push(buildLevel(candles, p, period, -1));
  }
  return { highs, lows };
}

// Relevanz-Filter (eine Richtung) — siehe trading-monitor-mcp/liquidityDetection.js (vorher) für
// die volle Begründung: neuestes Level (solange unberührt), alle noch unberührten älteren Level,
// die RECENT_SWEEP_COUNT zeitlich zuletzt berührten, insgesamt höchstens maxRelevant.
export function filterRelevantLevels(levels: LiquidityLevel[], maxRelevant: number, onlyRelevant: boolean): LiquidityLevel[] {
  const n = levels.length;
  if (n === 0) return [];

  const newestActive = !levels[n - 1].touched;

  const recentSweepIdx = new Set<number>();
  levels
    .map((lvl, i) => ({ i, t: lvl.touchedTime }))
    .filter((x): x is { i: number; t: number } => x.t != null)
    .sort((a, b) => b.t - a.t)
    .slice(0, RECENT_SWEEP_COUNT)
    .forEach((x) => recentSweepIdx.add(x.i));

  const result: LiquidityLevel[] = [];
  let relevantCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    const lvl = levels[i];
    const isNewest = newestActive && i === n - 1;
    const isRecentSweep = recentSweepIdx.has(i);
    const baseRelevant = !onlyRelevant || isNewest || !lvl.touched || isRecentSweep;
    if (baseRelevant) {
      if (relevantCount < maxRelevant) result.push(lvl);
      relevantCount += 1;
    }
  }
  return result;
}
