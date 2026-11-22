import {fetchInitialCandles} from './forexCandles.js';
import {fetchCandlesCached} from './candleCache.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {barSecondsFor} from './timeframes.js';
import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from './priceChartConstants.js';

export const LS_REACTION_CONTEXT_COUNTS={h1:2500,d1:300};
// ponytail: fester Deckel (~7 Handelswochen); ein noch älterer Anker bleibt ehrlich "unbekannt".
export const LS_REACTION_MAX_M5_HISTORY=15000;

export function lsReactionRequestedBoundary({replayUntil,currentBar,now}){
  return replayUntil==null?now:Math.min(now,replayUntil+barSecondsFor(currentBar));
}

// Das Chart-M5-Fenster (2500 Kerzen) reicht oft nicht bis zum Strukturstart des D1-Ankers zurück;
// dann wäre jedes Setup m5AnchorHistoryMissing. Der Anker gilt ab dem ältesten Setup im Fenster,
// dessen Beginn hier über die H1-Kerzen geschätzt wird (12 M5 je H1, Wochenenden fehlen in beiden).
function m5HistoryCount(h1,d1){
  const windowStart=h1.at(-Math.ceil(TRADE_SETUP_M5_CANDLE_COUNT/12)-24)?.time;
  if(windowStart==null)return 0;
  const anchor=buildHistoricalDailyAnchors(d1,h1).findLast(a=>a.knownAt<=windowStart);
  if(!anchor)return 0;
  const count=h1.filter(c=>c.time>=anchor.structureStartTime-3600).length*12;
  return count>TRADE_SETUP_M5_CANDLE_COUNT?Math.min(count,LS_REACTION_MAX_M5_HISTORY):0;
}

export async function loadLsReactionContext({symbol,evaluatedAt}) {
  if(!Number.isFinite(evaluatedAt)||evaluatedAt<=0)return {symbol,h1:[],d1:[]};
  // Ein H4-/D1-Chart darf keinen unbegrenzten feineren Datenabruf auslösen.
  const [h1,d1]=await Promise.all([
    fetchCandlesCached(fetchInitialCandles,symbol,'1h',LS_REACTION_CONTEXT_COUNTS.h1,evaluatedAt*1000),
    fetchCandlesCached(fetchInitialCandles,symbol,'1D',LS_REACTION_CONTEXT_COUNTS.d1,evaluatedAt*1000),
  ]);
  const context={symbol,h1:closedChecklistCandles(h1,'1h',evaluatedAt),d1:closedChecklistCandles(d1,'1D',evaluatedAt)};
  const count=m5HistoryCount(context.h1,context.d1);
  if(!count)return context;
  const m5=await fetchCandlesCached(fetchInitialCandles,symbol,'5m',count,evaluatedAt*1000);
  return {...context,m5:closedChecklistCandles(m5,'5m',evaluatedAt)};
}
