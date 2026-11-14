import {fetchInitialCandles} from './forexCandles.js';
import {fetchCandlesCached} from './candleCache.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {barSecondsFor} from './timeframes.js';

export const TRADE_SETUP_11_CONTEXT_COUNTS={h1:2500,d1:300};

export function tradeSetup11RequestedBoundary({replayUntil,currentBar,now}){
  return replayUntil==null?now:Math.min(now,replayUntil+barSecondsFor(currentBar));
}

export async function loadTradeSetup11Context({symbol,evaluatedAt}) {
  if(!Number.isFinite(evaluatedAt)||evaluatedAt<=0)return {symbol,h1:[],d1:[]};
  // Ein H4-/D1-Chart darf keinen unbegrenzten feineren Datenabruf auslösen.
  const [h1,d1]=await Promise.all([
    fetchCandlesCached(fetchInitialCandles,symbol,'1h',TRADE_SETUP_11_CONTEXT_COUNTS.h1,evaluatedAt*1000),
    fetchCandlesCached(fetchInitialCandles,symbol,'1D',TRADE_SETUP_11_CONTEXT_COUNTS.d1,evaluatedAt*1000),
  ]);
  return {symbol,h1:closedChecklistCandles(h1,'1h',evaluatedAt),d1:closedChecklistCandles(d1,'1D',evaluatedAt)};
}
