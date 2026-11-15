import {closedChecklistCandles,closedReplayEvaluationTime} from './tradeSetupChecklistTimeBasis.js';
import {candleTouchesOrderBlock} from './orderBlockDetection.js';

export function journalTpLines(trade) {
 // Legacy-Ziele ohne Chartquelle werden auch vom bestehenden Target-Renderer ausgelassen.
 const lines=(trade?.targets??[]).filter(t=>t.sourceTime!=null).map(t=>({key:`target:${t.id}`,label:`Target #${t.id}`,price:t.price,sourceTime:t.sourceTime}));
 if(trade?.invalidation!=null)lines.push({key:'invalidation',label:'Invalidierung',price:trade.invalidation});
 return lines.filter(line=>Number.isFinite(line.price)&&line.price>0);
}
export function journalTpContext(trade) {
 return JSON.stringify([trade?.id,trade?.cardKey,trade?.dealingRangeId,trade?.instrument,trade?.direction,
  trade?.entryPrice,trade?.entryTime,journalTpLines(trade)]);
}
export function journalTpHits(candles,trade,evaluatedAt) {
 if(!Number.isFinite(trade?.entryTime)||!Number.isFinite(trade?.entryPrice)||trade.entryPrice<=0)return [];
 const lines=journalTpLines(trade),hits=[];
 for(const candle of closedChecklistCandles(candles,'1m',evaluatedAt)) {
  // Bei Entry innerhalb einer Minute ist aus OHLC keine Reihenfolge vor/nach Entry bekannt.
  if(candle.ignored||candle.time<trade.entryTime)continue;
  const touched=lines.filter(line=>(line.sourceTime==null||candle.time>line.sourceTime)
   &&candleTouchesOrderBlock(candle,{top:line.price,bottom:line.price}));
  if(touched.length)hits.push({time:candle.time,lines:touched});
 }
 return hits;
}
export function journalTpPrefill(result,lineKey,armed,trade,symbol) {
 if(!armed||!trade||!result?.target||symbol!==trade.instrument
  ||result.target.draftToken!==armed.draftToken||journalTpContext(result.target)!==journalTpContext(armed)
  ||journalTpContext(armed)!==journalTpContext(trade)||!Number.isFinite(result.time)||result.time<trade.entryTime)return null;
 const line=result.lines?.find(line=>line.key===lineKey);
 if(!line||!journalTpLines(trade).some(current=>current.key===line.key&&current.price===line.price))return null;
 return {exitPrice:line.price,exitTime:result.time};
}
export function createJournalTpChartSelection(read) {
 function context(){
  const input=read();
  if(input.bar!=='1m'||!input.selection)return null;
  const evaluatedAt=closedReplayEvaluationTime(input.replayUntil,input.nowSec,input.candles,'1m');
  return {...input,hits:journalTpHits(input.candles,input.selection,evaluatedAt)};
 }
 return {
  paint(candles,color){
   const c=context();if(!c||!color)return candles;
   const times=new Set(c.hits.map(hit=>hit.time));
   return candles.map(candle=>times.has(candle.time)?{...candle,color,wickColor:color,borderColor:color}:candle);
  },
  select(time,price){
   const c=context(),candle=c?.candles.find(row=>row.time===time);
   if(!candle||!Number.isFinite(price)||!candleTouchesOrderBlock(candle,{top:price,bottom:price}))return null;
   const hit=c.hits.find(hit=>hit.time===time);
   return hit?{...hit,target:{...c.selection}}:null;
  },
 };
}
