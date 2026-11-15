import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {m1FvgEntryCandidates} from './m1FvgEntrySelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult,m1FvgFullyFilled,priceRoundingTolerance} from './m1FvgEntrySequence.js';
import {m1GapCovered} from './goldWeekendGap.js';

export const NEAR_TOUCH_FRACTION=.1;
export const ENTRY_B_MAX_ORDER_BLOCK_DEPTH=.5;
// Interne FVGs entstehen in oder kurz vor der M5-OB-Formation; ältere Historie darf den SL nicht verändern.
export const INTERNAL_FVG_LOOKBACK_SECONDS=900;

const sideOf=dir=>dir===1?'long':'short';
function firstIndex(items,predicate) {
 let lower=0,upper=items.length;
 while(lower<upper){const mid=(lower+upper)>>>1;if(predicate(items[mid]))upper=mid;else lower=mid+1;}
 return lower;
}

export function measureReactionContact(zone,candle,threshold=NEAR_TOUCH_FRACTION) {
 const m=measureOrderBlockPenetration(zone,sideOf(zone?.dir),[candle]);
 if(![-1,1].includes(zone?.dir)||m.status!=='ready')return 'unknown';
 if(candleTouchesOrderBlock(candle,zone))return 'touch';
 const height=zone.top-zone.bottom,approach=zone.dir===1?candle.low>zone.top:candle.high<zone.bottom;
 return approach&&-m.maxPenetrationFraction*height<=threshold*height+priceRoundingTolerance(zone)?'nearTouch':'none';
}

// m1Candles müssen bereits auf geschlossene Kerzen bis evaluatedAt gefiltert sein (closedChecklistCandles).
// Reaktions-FVG = Entry-Kandidat aus m1FvgEntryCandidates, nicht orderBlockMitigationFvg: dieselbe FVG trägt die Entry-Routen und ihren M1-OB.
export function createOrderBlockReactionContext(m1Candles,evaluatedAt,instrument) {
 const candidates=m1FvgEntryCandidates(m1Candles,evaluatedAt),byKnownAt={long:new Map(),short:new Map()},byDirection={long:[],short:[]};
 for(const fvg of candidates){
  byDirection[fvg.direction].push(fvg);
  const map=byKnownAt[fvg.direction];if(!map.has(fvg.recognizedAt))map.set(fvg.recognizedAt,[]);map.get(fvg.recognizedAt).push(fvg);
 }
 return {rows:m1Candles,evaluatedAt,instrument,byKnownAt,byDirection,fills:new Map()};
}

// Gemeinsamer Vorwärtslauf ab from: Einstieg per Binärsuche, Abbruch bei Lücke oder wenn step true liefert.
// Ohne bridgeClosures endet der Lauf an einem XAU-Marktschluss mit status 'closed' statt 'gap'.
function walkM1(context,from,step,{bridgeClosures=true}={}) {
 const rows=context.rows,instrument=bridgeClosures?context.instrument:null;
 const stop=(to,at)=>m1GapCovered(instrument,at,to)?null:{status:m1GapCovered(context.instrument,at,to)?'closed':'gap',at};
 let next=from;
 for(let i=firstIndex(rows,c=>c.time>=from);i<rows.length;i++){
  const c=rows[i],gap=stop(c.time,next);
  if(gap)return gap;
  next=c.time+60;
  if(step(c,i))return {status:'stopped',at:c.time};
 }
 return stop(Math.max(next,Math.floor(context.evaluatedAt/60)*60),next)??{status:'end',at:next};
}

// Erste volle Füllung; eine Lücke oder verdeckte (ignorierte) Kerze davor macht jeden späteren Zustand unbekannt.
function fvgFill(context,fvg) {
 if(context.fills.has(fvg))return context.fills.get(fvg);
 let filledAt=null;
 const walk=walkM1(context,fvg.recognizedAt,c=>{
  if(c.ignored)return true;
  if(m1FvgFullyFilled(c,fvg))filledAt=c.time+60;
  return filledAt!=null;
 });
 const result={filledAt,gapAt:filledAt==null&&walk.status!=='end'?walk.at:null};
 context.fills.set(fvg,result);
 return result;
}
const openAt=(fill,at)=>fill.filledAt!=null&&fill.filledAt<=at?false:fill.gapAt!=null&&fill.gapAt<at?null:true;

// SL zum Entry-Zeitpunkt: nur vor dem Retest bekannte interne FVGs zählen, die Reaktions-FVG nicht.
export function evaluateReactionStop(context,orderBlock,contact,entryAt) {
 const direction=sideOf(orderBlock.dir),list=context.byDirection[direction];
 let inside=false,overlapping=false,missing=false;
 for(let i=firstIndex(list,f=>f.candleTime>=orderBlock.startTime-INTERNAL_FVG_LOOKBACK_SECONDS);
  i<list.length&&list[i].recognizedAt<=contact.candleTime;i++){
  const fvg=list[i];
  if(!candleTouchesOrderBlock({low:fvg.bottom,high:fvg.top},orderBlock))continue;
  const open=openAt(fvgFill(context,fvg),entryAt);
  if(open===null)missing=true;
  else if(open&&fvg.bottom>=orderBlock.bottom&&fvg.top<=orderBlock.top)inside=true;
  else if(open)overlapping=true;
 }
 if(inside)return {status:'ready',anchor:'m5-edge',price:direction==='long'?orderBlock.bottom:orderBlock.top,reason:null};
 // ponytail: Retest-Extrem-SL braucht eine allgemeine Retest-Episode; bis sie spezifiziert ist, unknown statt geraten.
 return {status:'unknown',price:null,reason:missing?'internalFvgHistoryMissing':overlapping?'partialOverlapOpen':'retestEpisodeUnresolved'};
}

function reactionFvg(context,direction,contact,knownAt) {
 return context.byKnownAt[direction].get(knownAt)?.find(f=>f.candleTime>=contact.candleTime&&knownAt>contact.knownAt)??null;
}

// Route a steht mit der FVG fest; Route b läuft einmal vorwärts bis Entry, Bruch, zu tiefem M1-OB oder Lücke.
function evaluateRoutes(context,orderBlock,contact,fvg) {
 const direction=sideOf(orderBlock.dir),routes={};
 const settle=(route,entry)=>{
  const stop=evaluateReactionStop(context,orderBlock,contact,entry.entryTime);
  routes[route]=stop.status==='ready'&&(direction==='long'?stop.price<entry.entryPrice:stop.price>entry.entryPrice)
   ?{status:'entry',entryTime:entry.entryTime,entryPrice:entry.entryPrice,stopLoss:stop.price,stopAnchor:stop.anchor,confirmationCandleTime:entry.confirmationCandleTime}
   // Ohne belegten SL gibt es keinen Entry; spätere Kerzen machen daraus weder warte noch einen M5-Bruch.
   :{status:'unknown',reason:stop.reason??'stopNotBeyondEntry',knownAt:entry.entryTime,entryCandidate:{entryTime:entry.entryTime,entryPrice:entry.entryPrice}};
 };
 const immediate=m1FvgSequenceResult(m1FvgEntrySequence(fvg,'immediate',context.instrument));
 if(immediate.status==='ready')settle('a',immediate);else routes.a={status:'unknown',reason:'entryUnavailable',knownAt:fvg.recognizedAt};
 const sequence=m1FvgEntrySequence(fvg,'retestReaction',context.instrument);
 const finish=(status,reason,c)=>(routes.b={status,reason,knownAt:c.time+60},true);
 let fullFill=false;
 const walk=walkM1(context,fvg.recognizedAt,c=>{
  if(!c.ignored){
   if(candleInvalidatesOrderBlock(c,orderBlock))return finish('rejected','m5OrderBlockBroken',c);
   fullFill||=Boolean(fvg.orderBlock)&&m1FvgFullyFilled(c,fvg);
   // Die 50 % betreffen nur den M1-OB der Entry-b-FVG nach voller Füllung, nicht den M5-Retest.
   if(fullFill&&measureOrderBlockPenetration(fvg.orderBlock,direction,[c]).maxPenetrationFraction>ENTRY_B_MAX_ORDER_BLOCK_DEPTH)
    return finish('rejected',candleInvalidatesOrderBlock(c,fvg.orderBlock)?'entryBOrderBlockBroken':'entryBOrderBlockTooDeep',c);
  }
  advanceM1FvgEntrySequence(sequence,c);
  if(!sequence.result)return false;
  if(sequence.result.status==='ready')settle('b',sequence.result);
  else if(sequence.result.status==='invalid')finish('rejected','entryBOrderBlockBroken',c);
  else finish('unknown','entryBUnknown',c);
  return true;
 });
 routes.b??=walk.status==='gap'?{status:'unknown',reason:'missingHistory',knownAt:walk.at}:{status:'pending',reason:'entryBPending'};
 return routes;
}

// Nach einer Near-Touch-Reaktion ist erst der spätere exakte Retest das Extrem, an dem der DOB-Hold gemessen wird
// (sonst schwemmt dieser Retest den Near-Anker aus, siehe Referenzpaare P1/P3/P4/P11/P13/P16).
export function exactRetestAnchor(context,orderBlock,reaction,{bridgeClosures=false}={}) {
 // Ein exakter Touch innerhalb des Reaktionsfensters ist bereits dieser Retest.
 if(reaction.penetration.maxPenetrationFraction>=0)return {fromTime:reaction.fvg.recognizedAt,price:reaction.penetration.extremePrice};
 const rows=context.rows,direction=sideOf(orderBlock.dir);
 let touch=-1,anchor=null;
 walkM1(context,reaction.fvg.recognizedAt,(c,i)=>{
  if(c.ignored)return false;
  if(candleInvalidatesOrderBlock(c,orderBlock))return true;
  if(touch<0){if(candleTouchesOrderBlock(c,orderBlock))touch=i;return false;}
  const fvg=reactionFvg(context,direction,{candleTime:rows[touch].time,knownAt:rows[touch].time+60},c.time+60);
  if(fvg)anchor={fromTime:fvg.recognizedAt,price:measureOrderBlockPenetration(orderBlock,direction,rows.slice(touch,i+1)).extremePrice};
  return Boolean(fvg);
 },{bridgeClosures});
 return anchor;
}

// Reaktion true: erste gleichgerichtete M1-FVG nach dem ersten (Near-)Touch; false: M5-Gegenkante vorher gebrochen.
// Defaults = Produkt (reactionOptionsFor in doubleOrderBlocks.js). Ohne bridgeClosures verfällt ein OB, der bis zum ersten
// XAU-Marktschluss nach seiner Erkennung nicht reagiert hat: unknown mit Grund marketClosed, auch während der Pause.
export function evaluateOrderBlockReaction(context,orderBlock,{nearTouch=false,bridgeClosures=false}={}) {
 let contact=null,contactIndex=-1,result=null;
 const unknown=reason=>({state:'unknown',reason,contact,fvg:null,knownAt:null,penetration:null,routes:null});
 if(![-1,1].includes(orderBlock?.dir)||!Number.isFinite(orderBlock.recognizedAt)||!(orderBlock.top>orderBlock.bottom))
  return unknown('invalidOrderBlock');
 const rows=context.rows,direction=sideOf(orderBlock.dir);
 const walk=walkM1(context,Math.ceil(orderBlock.recognizedAt/60)*60,(c,i)=>{
  if(c.ignored)return false;
  if(candleInvalidatesOrderBlock(c,orderBlock)){
   const rejected={status:'rejected',reason:'reactionFalse',knownAt:c.time+60};
   result={state:'false',reason:'m5OrderBlockBroken',contact,fvg:null,knownAt:c.time+60,penetration:null,routes:{a:rejected,b:rejected}};
   return true;
  }
  if(!contact){
   const status=measureReactionContact(orderBlock,c);
   if(status==='touch'||nearTouch&&status==='nearTouch'){contact={status,candleTime:c.time,knownAt:c.time+60};contactIndex=i;}
   return false;
  }
  const fvg=reactionFvg(context,direction,contact,c.time+60);
  if(!fvg)return false;
  result={state:'true',reason:null,contact,fvg,knownAt:fvg.recognizedAt,
   penetration:measureOrderBlockPenetration(orderBlock,direction,rows.slice(contactIndex,i+1)),routes:evaluateRoutes(context,orderBlock,contact,fvg)};
  return true;
 },{bridgeClosures});
 return result??unknown(walk.status==='closed'?'marketClosed':walk.status==='gap'?'missingHistory':contact?'awaitingFvg':'noContact');
}

// Debugger-Sicht auf dieselbe Füllhistorie wie der SL: true offen, false gefüllt, null unbekannt (Lücke/verdeckte Kerze).
export const internalFvgOpenAt=(context,fvg,at)=>openAt(fvgFill(context,fvg),at);
// Interne FVGs einer OB wie in evaluateReactionStop: Lookback ab OB-Start, Preisüberlappung, bekannt bis knownBy.
export function internalOrderBlockFvgs(context,orderBlock,knownBy=Infinity) {
 const list=context.byDirection[sideOf(orderBlock.dir)],result=[];
 for(let i=firstIndex(list,f=>f.candleTime>=orderBlock.startTime-INTERNAL_FVG_LOOKBACK_SECONDS);i<list.length&&list[i].recognizedAt<=knownBy;i++)
  if(candleTouchesOrderBlock({low:list[i].bottom,high:list[i].top},orderBlock))result.push(list[i]);
 return result;
}
export {firstIndex};
