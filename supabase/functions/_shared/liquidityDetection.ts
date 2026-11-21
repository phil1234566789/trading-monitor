// Williams-Fraktal-Erkennung der Backend-Seite: derselbe Kern wie im Chart (src/liquidityDetection.js),
// hier nur typisiert weitergereicht. Vorher stand er dreimal im Repo (hier, _shared/liquidity.ts und
// im Frontend) und durfte jede Kopie für sich driften (test/setup1ParityGuard.test.js).
import type { Candle } from "./orderBlocks.ts";
import * as core from "../../../src/liquidityDetection.js";

export { LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "../../../src/liquidityDetection.js";

export interface LiquidityLevel {
  price: number;
  dir: 1 | -1;
  pivotTime: number;
  touched: boolean;
  touchedTime: number | null;
  endTime: number;
}

export interface OrderBlockLiquidityLevel extends LiquidityLevel {
  sourceKind: "orderBlock"; sourceStartTime: number; sourceKnownAt: number; sourceDirection: 1 | -1;
  sourceTop: number; sourceBottom: number;
}
type SourceOb = { dir: 1 | -1; top: number; bottom: number; startTime: number };

export const liquidityTouch = core.liquidityTouch as (candle: Candle, price: number, dir: 1 | -1) => boolean;
export const detectLiquidityLevels = core.detectLiquidityLevels as (rohKerzen: Candle[], period: number) => { highs: LiquidityLevel[]; lows: LiquidityLevel[] };
export const filterRelevantLevels = core.filterRelevantLevels as (levels: LiquidityLevel[], maxRelevant: number, onlyRelevant: boolean) => LiquidityLevel[];
export const detectOrderBlockLiquidityLevels = core.detectOrderBlockLiquidityLevels as (obs: SourceOb[], candles: Candle[], dir: 1 | -1, evaluatedAt: number) => OrderBlockLiquidityLevel[];
