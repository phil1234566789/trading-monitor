import {pivotTimeOf,collectNestedChain} from './marketStructureAnalysis';
import {structureInWindow,dobTrendVerdict} from './dobM5Trend.js';
export {dobCounterDobs} from './dobCounterDob.js';

// Merkmal-Labor gegen DOB-Losses (Brain-Task Merkmal-Labor, Q24): je Trade zum Entscheidungszeitpunkt, nur geschlossene Kerzen.
// Reine Messfunktionen, noch keine Regel; Trend-Algo und DOB-Indikator bleiben unangetastet.
const tradeTrend=direction=>direction==='long'?'uptrend':'downtrend';

// 1. Äußerer Trend: oberste Ebene der Struktur (nicht die innerste wie v3, die misst die Rückholbewegung in die Zone).
// durationDays = seit dem Ursprung der äußeren Range (appliedPivots[0]).
export function dobOuterTrend(candles,at,direction,{windowDays,barSeconds}){
 const state=structureInWindow(candles,at,windowDays*86400,{barSeconds})?.state;
 const trend=state?.trend??'unknown',origin=state?.appliedPivots?.[0];
 return {trend,verdict:dobTrendVerdict(direction,trend),
  durationDays:trend!=='unknown'&&origin?+((at-pivotTimeOf(origin))/86400).toFixed(2):null,bosPivot:bosPivotOf(state)};
}

// Ebene der Struktur wählbar (Philip, Pin 528: sein Trend ist oft die innerste Ebene): outer = oberste, inner = innerste
// bestätigte, range = innerste Ebene, deren aktuelle Range den Preis enthält (sonst die oberste). Trend und BOS-Pivot dieser Ebene.
export function dobLevelTrend(candles,at,direction,{windowDays,barSeconds,level='outer',price=null}){
 const state=structureInWindow(candles,at,windowDays*86400,{barSeconds})?.state;
 if(!state||state.trend==='unknown')return {trend:'unknown',verdict:'unknown',bosPivot:null,depth:null};
 const chain=collectNestedChain(state);
 const inside=l=>price!=null&&l.currRange.low.price<=price&&price<=l.currRange.high.price;
 const pick=level==='inner'?chain.length-1:level==='range'?Math.max(0,chain.findLastIndex(inside)):0;
 const l=chain[pick];
 return {trend:l.trend,verdict:dobTrendVerdict(direction,l.trend),bosPivot:bosPivotOf(l),depth:pick};
}

// BOS-Pivot (Philip): der Pullback-Punkt, nach dem der äußere Trend zuletzt fortgesetzt wurde = protected-low/-high der
// äußeren Ebene. Schon per Close gebrochen = 'break-of-structure'; nur per Docht berührt degradiert der Algo ihn zu
// 'LQ-sweep' (im Uptrend sind das nur Tiefs, im Downtrend nur Hochs, siehe markLqSweeps). Jüngster Kandidat gewinnt.
function bosPivotOf(state){
 if(!state||state.trend==='unknown')return null;
 const side=state.trend==='uptrend'?'protected-low':'protected-high';
 const latest=types=>state.structurePivots.filter(p=>types.includes(p.type)).reduce((a,p)=>!a||pivotTimeOf(p)>pivotTimeOf(a)?p:a,null);
 const p=latest([side])??latest(['break-of-structure'])??latest(['LQ-sweep']);
 return p?{price:p.price,time:pivotTimeOf(p),type:p.type}:null;
}

// 1a = äußerer Trend mit dem Trade; 1b = dagegen, BOS-Pivot nicht gebrochen; 1c = dagegen, BOS-Pivot vor dem Entry in
// Trade-Richtung gebrochen (Close bzw. Docht, auf den übergebenen Kerzen, nur bis Entry geschlossen). Sonst unknown.
export function dobOuterTrendClass(outer,direction,candles,entryTime,barSeconds=300){
 if(outer.verdict==='with')return {cls:'1a'};
 if(outer.verdict!=='against'||!outer.bosPivot)return {cls:'unknown'};
 const {close,wick}=dobPivotBroken(outer.bosPivot.price,direction,candles,outer.bosPivot.time,entryTime,barSeconds);
 return {cls:close?'1c':'1b',clsWick:wick?'1c':'1b',closeBroken:close,wickBroken:wick};
}

// Bruch eines Preises in Trade-Richtung (Long: darüber) auf Kerzen, die nach fromTime beginnen und bis toTime geschlossen sind.
export function dobPivotBroken(price,direction,candles,fromTime,toTime,barSeconds=300){
 const long=direction==='long';
 let close=false,wick=false,lo=0,hi=candles.length;
 while(lo<hi){const m=(lo+hi)>>1;if(candles[m].time<=fromTime)lo=m+1;else hi=m;}
 for(let i=lo;i<candles.length;i++){
  const c=candles[i];
  if(c.time+barSeconds>toTime)break;
  if(c.ignored)continue;
  if(long?c.high>price:c.low<price)wick=true;
  if(long?c.close>price:c.close<price){close=true;break;}
 }
 return {close,wick};
}

// Gegnerischer BOS-Pivot (Philip): in der M5-Struktur zum Zeitpunkt at die innerste Ebene GEGEN die Trade-Richtung und deren
// BOS-Pivot (Long: protected-high des Abwärtstrends, dessen Bruch ihn beendet). null = keine Gegen-Ebene (Struktur läuft mit).
export function dobOpposingBosPivot(m5Candles,at,direction,{windowDays=5}={}){
 const state=structureInWindow(m5Candles,at,windowDays*86400)?.state;
 if(!state||state.trend==='unknown')return {trend:'unknown',pivot:null};
 const against=direction==='long'?'downtrend':'uptrend',level=collectNestedChain(state).filter(l=>l.trend===against).at(-1);
 return {trend:collectNestedChain(state).at(-1).trend,pivot:level?bosPivotOf(level):null};
}

// 2. M5-Struktur bestätigt die Trade-Richtung: Phasenwechsel (CHoCH/BOS/Trendwechsel/Fortsetzung) in Trade-Richtung,
// verarbeitet zwischen fromTime und Entry. Ein Trend, der schon vorher lief, zählt nicht als frische Bestätigung.
export function dobM5Confirmation(m5Candles,entryTime,direction,fromTime,{windowDays=2}={}){
 const built=structureInWindow(m5Candles,entryTime,windowDays*86400);
 const events=(built?.events??[]).filter(e=>e.trend===tradeTrend(direction)&&e.at>fromTime&&e.at<=entryTime).map(e=>({reason:e.reason,at:e.at}));
 return {confirmed:events.length>0,events,innerTrendAtEntry:built?built.phases.at(-1)?.trend??'unknown':'unknown'};
}

// 3. Gegen-DOBs: seit v3 im Setup (src/dobCounterDob.js), hier nur re-exportiert.

// 4. OB1 und OB2 in der Kraft-Zone: Preisabstand 0 (Überlappung), wie distanceUsd der Quelle.
const gap=(ob,zone)=>Math.max(0,zone.bottom-ob.top,ob.bottom-zone.top);
export function dobObsInSourceZone(chart,source){
 if(!source?.zone)return null;
 const ob1=gap(chart.firstOrderBlock,source.zone)===0,ob2=gap(chart.secondOrderBlock,source.zone)===0;
 return {ob1,ob2,both:ob1&&ob2};
}
