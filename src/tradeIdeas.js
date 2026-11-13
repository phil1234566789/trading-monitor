import {riskMarket} from '../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {formatDatedTime} from './berlinTime.js';
const positive=n=>Number.isFinite(n)&&n>0;
export const chartInstrument=symbol=>symbol?riskMarket(symbol):undefined;
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
export function editTradeIdea(annotation,level,point) {
 if(!point||!['entry','sl','tp'].includes(level))return null;
 const idea={...annotation.tradeIdea,[level]:point.price};
 if(level==='entry')idea.time=Math.round(point.time);
 else idea.endTime=Math.round(point.time);
 if(!validTradeIdea(idea))return null;
 return {...annotation,from:{...annotation.from,time:formatDatedTime(idea.time),price:idea.entry},
  to:{...annotation.to,time:formatDatedTime(idea.endTime),price:idea.sl},tradeIdea:idea};
}
