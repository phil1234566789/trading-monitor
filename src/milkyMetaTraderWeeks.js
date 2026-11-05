import {berlinTradeParts} from './milkyMetaTraderStatistics.js';
const DAY=86400000,WEEK=7*DAY;
const date=ms=>new Date(ms).toISOString().slice(0,10);
function monday(day){return day-((new Date(day).getUTCDay()+6)%7)*DAY;}

export function tradeCalendarWeeks(trades){
 const groups=new Map();
 for(const trade of trades){
  // Kalenderdaten statt echter UTC-Wochen: Berliner Sonntag bleibt auch beim Sommerzeitwechsel Sonntag.
  const start=monday(Date.parse(berlinTradeParts(trade.closed_at).date));
  if(!groups.has(start))groups.set(start,[]);
  groups.get(start).push(trade);
 }
 if(!groups.size)return [];
 const starts=[...groups.keys()],weeks=[];
 const first=Math.min(...starts),last=Math.max(...starts);
 for(let start=last;start>=first;start-=WEEK){
  // Das ISO-Wochenjahr folgt dem Donnerstag, auch wenn der Montag noch im Vorjahr liegt.
  const year=new Date(start+3*DAY).getUTCFullYear();
  const number=Math.round((start-monday(Date.UTC(year,0,4)))/WEEK)+1;
  weeks.push({key:date(start),start:date(start),end:date(start+6*DAY),year,number,
   trades:[...(groups.get(start)??[])].sort((a,b)=>b.closed_at-a.closed_at||b.id.localeCompare(a.id))});
 }
 return weeks;
}
