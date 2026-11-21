// TS1.1-Sweep-Bestätigung: dieselben Regeln wie im Chart (src/tradeSetupSweepSources.js), nur typisiert.
// Die OB-Kanten-Level selbst kommen aus dem LQ-Algo (_shared/liquidityDetection.ts).
import type {Candle} from './orderBlocks.ts';
import type {LiquidityLevel} from './liquidityDetection.ts';
import * as core from '../../../src/tradeSetupSweepSources.js';
import {orderBlockRecognitionTimes as recognitionTimes} from '../../../src/orderBlockRecognitionTime.js';
export {TRADE_SETUP_M5_FRACTAL_PERIOD} from '../../../src/priceChartConstants.js';
export const sweepSourceKey = core.sweepSourceKey;

type SweepLevel=LiquidityLevel&{sourceKind?:string};

export const orderBlockRecognitionTimes = (candles:Candle[]):Map<number,number> => recognitionTimes(candles,'5m');
export const evaluateSweepConfirmation = core.evaluateSweepConfirmation as (level:SweepLevel,candles:Candle[],evaluatedAt:number,timeframe?:string,liquidityLevels?:SweepLevel[])=>
 {status:string;validUntil?:number|null;reason?:string;[key:string]:unknown};
