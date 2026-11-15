import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {m1FvgEntryCandidates} from './m1FvgEntrySelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult} from './m1FvgEntrySequence.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {closedCandleEnd} from './closedCandlePrefix.js';
import {m1GapCovered} from './goldWeekendGap.js';

export const NEAR_TOUCH_FRACTION=.1;
export const ENTRY_B_MAX_ORDER_BLOCK_DEPTH=.5;

const sideOf=dir=>dir===1?'long':'short';
// Erster Index mit time >= t (ganzzahlige Sekunden): Einstieg per Binärsuche statt Filter über die Historie.
const indexAt=(rows,t)=>closedCandleEnd(rows,1,t);

// Gleiche Rundungstoleranz wie qualifiedFvgRetest, kein fachlicher Preis-Puffer.
export function measureReactionContact(zone,candle,threshold=NEAR_TOUCH_FRACTION) {
 const m=measureOrderBlockPenetration(zone,sideOf(zone?.dir),[candle]);
 if(![-1,1].includes(zone?.dir)||m.status!=='ready')return 'unknown';
 if(candleTouchesOrderBlock(candle,zone))return 'touch';
 const height=zone.top-zone.bottom,approach=zone.dir===1?candle.low>zone.top:candle.high<zone.bottom;
 const rounding=Number.EPSILON*Math.max(Math.abs(zone.top),Math.abs(zone.bottom),1)*8;
 return approach&&-m.maxPenetrationFraction*height<=threshold*height+rounding?'nearTouch':'none';
}

// Einmal pro Auswertung: Kandidaten nach Bekanntwerden indiziert, Füllstände je FVG gemerkt.
export function createOrderBlockReactionContext(m1Candles,evaluatedAt,instrument) {
 const rows=closedChecklistCandles(m1Candles,'1m',evaluatedAt),byKnownAt={long:new Map(),short:new Map()};
 const candidates=m1FvgEntryCandidates(rows,evaluatedAt);
 for(const fvg of candidates){const map=byKnownAt[fvg.direction];if(!map.has(fvg.recognizedAt))map.set(fvg.recognizedAt,[]);map.get(fvg.recognizedAt).push(fvg);}
 return {rows,evaluatedAt,instrument,candidates,byKnownAt,fills:new Map()};
}

// Erste volle Füllung bis zur fernen Kante; eine Lücke davor macht jeden späteren Zustand unbekannt.
function fvgFill(context,fvg) {
 if(context.fills.has(fvg))return context.fills.get(fvg);
 const rows=context.rows,result={filledAt:null,gapAt:null};
 for(let i=indexAt(rows,fvg.recognizedAt),next=fvg.recognizedAt;i<rows.length;next=rows[i].time+60,i++){
  const c=rows[i];
  if(!m1GapCovered(context.instrument,next,c.time)){result.gapAt=next;break;}
  if(!c.ignored&&(fvg.direction==='long'?c.low<=fvg.bottom:c.high>=fvg.top)){result.filledAt=c.time+60;break;}
 }
 context.fills.set(fvg,result);
 return result;
}
const openAt=(fill,at)=>fill.filledAt!=null&&fill.filledAt<=at?false:fill.gapAt!=null&&fill.gapAt<at?null:true;

// SL zum Entry-Zeitpunkt: nur vor dem Retest bekannte interne FVGs zählen, die Reaktions-FVG nicht.
export function evaluateReactionStop(context,orderBlock,contact,entryAt) {
 const direction=sideOf(orderBlock.dir);
 let inside=false,overlapping=false;
 for(const fvg of context.candidates){
  if(fvg.recognizedAt>contact.candleTime)break;
  if(fvg.direction!==direction||!candleTouchesOrderBlock({low:fvg.bottom,high:fvg.top},orderBlock))continue;
  const open=openAt(fvgFill(context,fvg),entryAt);
  if(open===false)continue;
  if(open===null)return {status:'unknown',price:null,reason:'internalFvgHistoryMissing'};
  if(fvg.bottom>=orderBlock.bottom&&fvg.top<=orderBlock.top)inside=true;else overlapping=true;
 }
 if(inside)return {status:'ready',anchor:'m5-edge',price:direction==='long'?orderBlock.bottom:orderBlock.top,reason:null};
 // ponytail: Retest-Extrem-SL braucht eine allgemeine Retest-Episode; bis sie spezifiziert ist, unknown statt geraten.
 return {status:'unknown',price:null,reason:overlapping?'partialOverlapOpen':'retestEpisodeUnresolved'};
}

function reactionFvg(context,direction,contact,knownAt) {
 return context.byKnownAt[direction].get(knownAt)?.find(f=>f.candleTime>=contact.candleTime&&knownAt>contact.knownAt)??null;
}

// Ein Vorwärtslauf ab dem gemeinsamen FVG-Index: Entry-Sequenzen, M5-Bruch und Entry-b-OB-Tiefe.
function evaluateRoutes(context,orderBlock,contact,fvg,start) {
 const rows=context.rows,direction=sideOf(orderBlock.dir),routes={};
 const sequences=Object.fromEntries([['a','immediate'],['b','retestReaction']].map(([route,variant])=>[route,m1FvgEntrySequence(fvg,variant,context.instrument)]));
 const finish=(route,result)=>{routes[route]=result;};
 const settleEntry=route=>{
  const entry=m1FvgSequenceResult(sequences[route]);
  const stop=evaluateReactionStop(context,orderBlock,contact,entry.entryTime);
  if(stop.status==='ready'&&(direction==='long'?stop.price<entry.entryPrice:stop.price>entry.entryPrice))
   return finish(route,{status:'entry',entryTime:entry.entryTime,entryPrice:entry.entryPrice,stopLoss:stop.price,
    stopAnchor:stop.anchor,confirmationCandleTime:entry.confirmationCandleTime});
  // Unbekannter SL bleibt warte; ein später bekannter M5-Bruch beendet die Route noch.
  routes[route]={status:'pending',reason:stop.reason??'stopNotBeyondEntry',entryCandidate:{entryTime:entry.entryTime,entryPrice:entry.entryPrice}};
 };
 if(sequences.a.result?.status==='ready')settleEntry('a');else finish('a',{status:'pending',reason:'entryUnavailable'});
 let fullFill=false,gap=false;
 for(let i=start,next=fvg.recognizedAt;i<rows.length;next=rows[i].time+60,i++){
  const open=['a','b'].filter(r=>!routes[r]||routes[r].status==='pending');
  if(!open.length)break;
  const c=rows[i];
  if(!m1GapCovered(context.instrument,next,c.time)){gap=true;break;}
  if(!c.ignored&&candleInvalidatesOrderBlock(c,orderBlock)){
   for(const r of open)finish(r,{status:'rejected',reason:'m5OrderBlockBroken',knownAt:c.time+60});
   break;
  }
  if(routes.b)continue;
  const seq=sequences.b;
  if(!c.ignored&&fvg.orderBlock&&!fullFill)fullFill=direction==='long'?c.low<=fvg.bottom:c.high>=fvg.top;
  // Die 50 % betreffen nur den M1-OB der Entry-b-FVG nach voller Füllung, nicht den M5-Retest.
  if(fullFill&&!c.ignored&&measureOrderBlockPenetration(fvg.orderBlock,direction,[c]).maxPenetrationFraction>ENTRY_B_MAX_ORDER_BLOCK_DEPTH){
   finish('b',{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:c.time+60});continue;
  }
  advanceM1FvgEntrySequence(seq,c);
  if(seq.result?.status==='ready')settleEntry('b');
  else if(seq.result?.status==='invalid')finish('b',{status:'rejected',reason:'entryBOrderBlockBroken',knownAt:c.time+60});
  else if(seq.result)finish('b',{status:'pending',reason:'entryBUnknown'});
 }
 routes.b??={status:'pending',reason:gap?'missingHistory':'entryBPending'};
 return routes;
}

// Nach einer Near-Touch-Reaktion ist erst der spätere exakte Retest das Extrem, an dem der DOB-Hold gemessen wird
// (sonst schwemmt dieser Retest den Near-Anker aus, siehe Referenzpaare P1/P3/P4/P11/P13/P16).
export function exactRetestAnchor(context,orderBlock,reaction) {
 // Ein exakter Touch innerhalb des Reaktionsfensters ist bereits dieser Retest.
 if(reaction.penetration.maxPenetrationFraction>=0)return {fromTime:reaction.fvg.recognizedAt,price:reaction.penetration.extremePrice};
 const rows=context.rows,direction=sideOf(orderBlock.dir);
 let touch=-1;
 for(let i=indexAt(rows,reaction.fvg.recognizedAt),next=reaction.fvg.recognizedAt;i<rows.length;next=rows[i].time+60,i++){
  const c=rows[i];
  if(!m1GapCovered(context.instrument,next,c.time)||(!c.ignored&&candleInvalidatesOrderBlock(c,orderBlock)))return null;
  if(c.ignored)continue;
  if(touch<0){if(candleTouchesOrderBlock(c,orderBlock))touch=i;continue;}
  const fvg=reactionFvg(context,direction,{candleTime:rows[touch].time,knownAt:rows[touch].time+60},c.time+60);
  if(fvg)return {fromTime:fvg.recognizedAt,price:measureOrderBlockPenetration(orderBlock,direction,rows.slice(touch,i+1)).extremePrice};
 }
 return null;
}

// Reaktion true: erste gleichgerichtete M1-FVG nach dem ersten (Near-)Touch; false: M5-Gegenkante vorher gebrochen.
export function evaluateOrderBlockReaction(context,orderBlock) {
 let contact=null;
 const unknown=reason=>({state:'unknown',reason,contact,fvg:null,knownAt:null,penetration:null,routes:null});
 if(![-1,1].includes(orderBlock?.dir)||!Number.isFinite(orderBlock.recognizedAt)||!(orderBlock.top>orderBlock.bottom))
  return unknown('invalidOrderBlock');
 const rows=context.rows,direction=sideOf(orderBlock.dir),begin=Math.ceil(orderBlock.recognizedAt/60)*60;
 let contactIndex=-1;
 for(let i=indexAt(rows,begin),next=begin;i<rows.length;next=rows[i].time+60,i++){
  const c=rows[i];
  if(!m1GapCovered(context.instrument,next,c.time))return unknown('missingHistory');
  if(c.ignored)continue;
  if(candleInvalidatesOrderBlock(c,orderBlock))
   return {state:'false',reason:'m5OrderBlockBroken',contact,fvg:null,knownAt:c.time+60,penetration:null,
    routes:{a:{status:'rejected',reason:'reactionFalse',knownAt:c.time+60},b:{status:'rejected',reason:'reactionFalse',knownAt:c.time+60}}};
  if(!contact){
   const status=measureReactionContact(orderBlock,c);
   if(status==='touch'||status==='nearTouch'){contact={status,candleTime:c.time,knownAt:c.time+60};contactIndex=i;}
   continue;
  }
  const fvg=reactionFvg(context,direction,contact,c.time+60);
  if(fvg){
   const penetration=measureOrderBlockPenetration(orderBlock,direction,rows.slice(contactIndex,i+1));
   return {state:'true',reason:null,contact,fvg,knownAt:fvg.recognizedAt,penetration,
    routes:evaluateRoutes(context,orderBlock,contact,fvg,i+1)};
  }
 }
 const through=Math.floor(context.evaluatedAt/60)*60;
 return unknown(rows.length&&!m1GapCovered(context.instrument,rows.at(-1).time+60,Math.max(rows.at(-1).time+60,through))?'missingHistory':contact?'awaitingFvg':'noContact');
}
