import {detectSetupObs,detectTradeSetups,TRADE_SETUP_OB_SWEEP_PROFILE} from './tradeSetup.js';
import {detectLiquidityLevels} from './liquidityDetection.js';
import {TRADE_SETUP_M5_FRACTAL_PERIOD} from './priceChartConstants.js';
import {tradeSetupParameters} from './tradeSetupParameters.js';
import {obMinimum} from './instrumentConfig.js';

export function reconstructTradeSetup11Projection({setup,instrument,context}) {
 if(context.status!=='ready')return {status:'unknown',reason:context.reason};
 context.sourceLiquidity??=detectLiquidityLevels(context.candles,TRADE_SETUP_M5_FRACTAL_PERIOD);
 context.sourceObs??=detectSetupObs(context.rawCandles,obMinimum(instrument,'5m'));
 const own=setup.dir===1?context.sourceLiquidity.highs:context.sourceLiquidity.lows;
 // H1 bleibt der bestehende explizite Quellenvertrag; die neue Ablösung betrifft nur native M5-LS.
 const h1=(setup.sweeps??[]).filter(s=>s.timeframe==='1H').map(s=>({...s.level,dir:setup.dir}));
 const params={...tradeSetupParameters(instrument,context.rawCandles.at(-1).time),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 const native=detectTradeSetups(setup.dir,own,h1,own,context.sourceObs,params,context.candles,context.rawCandles)
  .find(row=>row.obStartTime===setup.obStartTime&&row.dir===setup.dir);
 if(!native)return {status:'unknown',reason:'nativeSourceProjectionMissing'};
 return {status:'ready',setup:{...native,historicalSourceProvenance:{sourceProfile:setup.sweepSourceProfile??null,
  detectorVersion:setup.detectorVersion??null,source:setup.source??null,createdAt:setup.createdAt??null,
  tradeSetupId:setup.tradeSetupId??setup.id??null}}};
}
