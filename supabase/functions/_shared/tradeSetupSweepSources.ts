// TS1.1-Sweep-Quellen: dieselben Regeln wie im Chart (src/tradeSetupSweepSources.js), nur typisiert.
import type {Candle} from './orderBlocks.ts';
import type {LiquidityLevel} from './liquidityDetection.ts';
import * as core from '../../../src/tradeSetupSweepSources.js';
import {orderBlockRecognitionTimes as recognitionTimes} from '../../../src/orderBlockRecognitionTime.js';
export {TRADE_SETUP_M5_FRACTAL_PERIOD} from '../../../src/priceChartConstants.js';
export const sweepSourceKey = core.sweepSourceKey;

export interface OrderBlockSweepSource extends LiquidityLevel {
 sourceKind:'orderBlock';sourceStartTime:number;sourceKnownAt:number;sourceDirection:1|-1;
 sourceTop:number;sourceBottom:number;
}
type SourceOb={dir:1|-1;top:number;bottom:number;startTime:number};
type SweepLevel=LiquidityLevel&{sourceKind?:string};

export const orderBlockRecognitionTimes = (candles:Candle[]):Map<number,number> => recognitionTimes(candles,'5m');
export const orderBlockSweepSources = core.orderBlockSweepSources as (obs:SourceOb[],candles:Candle[],dir:1|-1,evaluatedAt:number)=>OrderBlockSweepSource[];
export const evaluateSweepConfirmation = core.evaluateSweepConfirmation as (level:SweepLevel,candles:Candle[],evaluatedAt:number,timeframe?:string,liquidityLevels?:SweepLevel[])=>
 {status:string;validUntil?:number|null;reason?:string;[key:string]:unknown};
