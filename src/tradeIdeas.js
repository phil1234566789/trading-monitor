import {formatDatedTime} from './berlinTime.js';
const positive=n=>Number.isFinite(n)&&n>0;
export const chartInstrument=symbol=>symbol?.split('.')[0];
export function validTradeIdea(idea) {
 return idea&&['long','short'].includes(idea.direction)&&positive(idea.time)&&positive(idea.endTime)&&idea.endTime>idea.time&&positive(idea.entry)&&positive(idea.sl)
  &&(idea.direction==='long'?idea.sl<idea.entry:idea.sl>idea.entry)
  &&(idea.tp==null||(positive(idea.tp)&&(idea.direction==='long'?idea.tp>idea.entry:idea.tp<idea.entry)));
}
export function makeTradeIdea(direction,entry,stop,target) {
 const idea={direction,time:entry.time,endTime:Math.max(entry.time+60,stop.time,target?.time??0),entry:entry.price,sl:stop.price,tp:target?.price??null};
 if(!validTradeIdea(idea))throw new Error('SL und optionales Ziel müssen auf der richtigen Seite des Ideen-Ankers liegen.');
 return {title:`${direction==='long'?'Long':'Short'}-Idee · ${formatDatedTime(entry.time)}`,annotations:[{
  type:'line',from:{time:formatDatedTime(entry.time),price:entry.price},to:{time:formatDatedTime(stop.time),price:stop.price},
  text:'Idee · kein Broker-Entry',tradeIdea:idea,
 }]};
}
export function nearestTradeIdea(annotations,time) {
 if(!positive(time))return {idea:null,reason:'loading'};
 const ideas=annotations.map(a=>a.tradeIdea).filter(validTradeIdea).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time));
 if(!ideas.length)return {idea:null,reason:'missing'};
 if(ideas[1]&&Math.abs(ideas[0].time-time)===Math.abs(ideas[1].time-time))return {idea:null,reason:'tie'};
 return {idea:ideas[0],reason:null};
}
export function brokerIdeaMetrics(idea,quote,now) {
 if(!idea||!quote||now-quote.time>5||quote.time>now+1)return null;
 const long=idea.direction==='long',price=long?quote.ask:quote.bid;
 const loss=long?quote.loss_per_unit_long:quote.loss_per_unit_short;
 const distance=long?price-idea.sl:idea.sl-price;
 if(!positive(price)||!positive(distance)||!positive(loss)||!positive(quote.minimum_volume))return null;
 const reward=idea.tp==null?null:long?idea.tp-price:price-idea.tp;
 return {price,volume:quote.minimum_volume,risk:distance*loss,rr:positive(reward)?reward/distance:null};
}
export function confirmedOrderTrade(order,entryTime) {
 if(order.status!=='executed'||!positive(order.result?.price)||!positive(entryTime))return null;
 const life=order.result.position_lifecycle,closed=life?.state==='closed';
 return {id:`mmt:${order.id}`,instrument:chartInstrument(order.intent.symbol),direction:order.intent.direction,
  entryTime,entryPrice:order.result.price,stopLoss:order.intent.stop_loss,
  exitTime:closed?life.closed_at_sec:null,exitPrice:closed?life.exit_price:null,
  outcome:closed?(life.net_profit>0?'win':life.net_profit<0?'loss':'open'):'open'};
}
