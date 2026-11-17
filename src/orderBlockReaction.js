import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
import {measureOrderBlockPenetration} from './orderBlockPenetration.js';
import {m1FvgEntryCandidates} from './m1FvgEntrySelection.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult,m1FvgFullyFilled,priceRoundingTolerance} from './m1FvgEntrySequence.js';
import {m1GapCovered} from './goldWeekendGap.js';
import {reactionVerdict} from './orderBlockReactionVerdict.js';
import {barSecondsFor} from './timeframes.js';
import {berlinOffsetMinutes,formatDatedTime} from './berlinTime.js';

export const NEAR_TOUCH_FRACTION=.1;
// Philip wertet ≤ 2 % der OB-Höhe an beiden Kanten als Berührung (Pin 504 Kontakt, Pin 501 Gegenkante); kein Referenzpaar
// und kein Negativ-Pin ändert sich (analysis/dob/touch-tolerance.json). Gilt für Kontakt und Bruch bis Reaktion bzw. Entry b.
export const TOUCH_TOLERANCE_FRACTION=.02;
export const ENTRY_B_MAX_ORDER_BLOCK_DEPTH=.5;
// Lower-TF-OB-Kanten stammen aus Impulskerze und zwei Vorgängern (detectOrderBlocks), nicht aus beliebiger Preisüberlappung.
const M5_FORMATION_LOOKBACK=2*barSecondsFor('5m');

const sideOf=dir=>dir===1?'long':'short';
// Philip: nach 22:00 auf keinen Fall ein Entry, erst ab 02:00 wieder (Berliner Uhrzeit des Entry-Zeitpunkts, Grenzen inklusive).
const ENTRY_WINDOW_MINUTES=[2*60,22*60];
export function insideEntryWindow(sec) {
 const minute=((Math.floor(sec/60)+berlinOffsetMinutes(sec*1000))%1440+1440)%1440;
 return minute>=ENTRY_WINDOW_MINUTES[0]&&minute<=ENTRY_WINDOW_MINUTES[1];
}
// Philip (Q11): Gründe, die nur bei Datenfehlern oder Gleichstand entstehen, sind kein fachliches unknown, sondern ein Fehler.
// missingHistory (echte Kerzenlücke) bleibt unknown.
export class ReactionDataError extends Error {
 constructor(reason,orderBlock,at) {
  super(`OB-Reaktion ${reason} · M5-OB ${formatDatedTime(orderBlock.startTime)} · ${formatDatedTime(at)}`);
  this.name='ReactionDataError';this.reason=reason;
 }
}
const fail=(reason,orderBlock,at)=>{throw new ReactionDataError(reason,orderBlock,at);};
function firstIndex(items,predicate) {
 let lower=0,upper=items.length;
 while(lower<upper){const mid=(lower+upper)>>>1;if(predicate(items[mid]))upper=mid;else lower=mid+1;}
 return lower;
}

export function measureReactionContact(zone,candle,threshold=NEAR_TOUCH_FRACTION) {
 const m=measureOrderBlockPenetration(zone,sideOf(zone?.dir),[candle]);
 if(![-1,1].includes(zone?.dir)||m.status!=='ready')return 'unknown';
 if(candleTouchesOrderBlock(candle,zone))return 'touch';
 // Abstand > 0 = Annäherung von außen; eine Kerze, die die OB überspringt, ist kein Kontakt.
 const distance=zone.dir===1?candle.low-zone.top:zone.bottom-candle.high;
 if(!(distance>0))return 'none';
 return withinTouchTolerance(distance,zone)?'touch':withinTouchTolerance(distance,zone,threshold)?'nearTouch':'none';
}

// Preisabstand zur OB-Kante; die Rundungstoleranz verhindert, dass XAU-Preise genau auf der Grenze per Float herausfallen.
export function withinTouchTolerance(distance,zone,fraction=TOUCH_TOLERANCE_FRACTION) {
 return distance<=fraction*(zone.top-zone.bottom)+priceRoundingTolerance(zone);
}

// Bruch der fernen M5-Kante für Reaktion und Route b, mit derselben Toleranz wie der Kontakt.
export function reactionBreaksOrderBlock(candle,zone) {
 return withinTouchTolerance(zone.dir===1?candle.low-zone.bottom:zone.top-candle.high,zone);
}

// m1Candles müssen bereits auf geschlossene Kerzen bis evaluatedAt gefiltert sein (closedChecklistCandles).
// Reaktions-FVG = Entry-Kandidat aus m1FvgEntryCandidates, nicht orderBlockMitigationFvg: dieselbe FVG trägt die Entry-Routen und ihren M1-OB.
export function createOrderBlockReactionContext(m1Candles,evaluatedAt,instrument) {
 const candidates=m1FvgEntryCandidates(m1Candles,evaluatedAt,undefined,{orderBlockMinGap:0}),byKnownAt={long:new Map(),short:new Map()},byDirection={long:[],short:[]};
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
// Philip: „entweder M5-Kante oder Extrempunkt beim Retest“ – jede offene OB-FVG, auch teilweise überlappend, gibt die M5-Kante.
export function evaluateReactionStop(context,orderBlock,contact,entryAt) {
 const direction=sideOf(orderBlock.dir);
 let open=false,missing=false;
 for(const fvg of internalOrderBlockFvgs(context,orderBlock,contact.candleTime)){
  const state=openAt(fvgFill(context,fvg),entryAt);
  if(state===null)missing=true;else if(state)open=true;
 }
 if(open)return {status:'ready',anchor:'m5-edge',price:direction==='long'?orderBlock.bottom:orderBlock.top,reason:null};
 if(missing)fail('internalFvgHistoryMissing',orderBlock,entryAt);
 return {status:'ready',anchor:'retestExtreme',price:retestExtreme(context.rows,direction,contact.candleTime,entryAt),reason:null};
}

// Extrem von der Kontaktkerze bis einschließlich Entry-Kerze (entryAt = deren Schluss), ohne Puffer. Ignorierte Kerzen
// zählen nicht, wie bei Kontakt und M5-Bruch; jenseits der fernen M5-Kante kann es nicht liegen, sonst wäre die Reaktion false.
// Puffer- und Kantenvarianten sind gemessen (analysis/dob/stop-variants.json); der DOB bleibt Indikator, die SL-Wahl beim Trade.
function retestExtreme(rows,direction,from,entryAt) {
 let price=direction==='long'?Infinity:-Infinity;
 for(let i=firstIndex(rows,c=>c.time>=from);i<rows.length&&rows[i].time<entryAt;i++)
  if(!rows[i].ignored)price=direction==='long'?Math.min(price,rows[i].low):Math.max(price,rows[i].high);
 return price;
}

function reactionFvg(context,direction,contact,knownAt) {
 return context.byKnownAt[direction].get(knownAt)?.find(f=>f.candleTime>=contact.candleTime&&knownAt>contact.knownAt)??null;
}

// Gegen-FVGs seit der M5-OB bis zur Reaktion, auch gefüllte: spätere Füllung hebt eine damalige A-Ablehnung nicht auf (502).
function opposingFvgs(context,orderBlock,reactionAt,nose) {
 const list=context.byDirection[sideOf(-orderBlock.dir)],result=[];
 // Philip: Gegen-FVGs sind die, die sich seit der M5-OB gebildet haben; ältere (über Spread Hour/Marktschluss) zählen nicht.
 for(let i=firstIndex(list,f=>f.candleTime>=orderBlock.startTime);i<list.length;i++){
  const fvg=list[i];
  if(fvg.recognizedAt>reactionAt)break;
  const fill=fvgFill(context,fvg),openAtReaction=openAt(fill,reactionAt);
  result.push({fvg,openAtReaction,openNow:openAt(fill,context.evaluatedAt),filledAt:fill.filledAt,nearest:false,blocksEntryA:false});
 }
 // Philip: maßgeblich ist nur die preislich nächste Gegen-FVG vor der Entry-Nase (Bestätigungspreis), auch wenn sie schon
 // gefüllt ist (P11/P13/P7: zerstörte FVG gibt a frei). Kein Preisweg-Filter: U4s FVG 10:20 liegt davor, ohne berührt zu sein.
 const ahead=result.filter(x=>orderBlock.dir===1?x.fvg.top>nose:x.fvg.bottom<nose);
 const nearest=ahead.reduce((best,x)=>!best||(orderBlock.dir===1?x.fvg.bottom<best.fvg.bottom:x.fvg.top>best.fvg.top)?x:best,null);
 if(nearest){nearest.nearest=true;nearest.blocksEntryA=nearest.openAtReaction===true;}
 return result;
}

// A wird bei FVG-Bestätigung entschieden; nur ohne A-Entry läuft B bis Entry, Bruch, zu tiefem M1-OB oder Lücke.
function evaluateRoutes(context,orderBlock,contact,fvg,opponents) {
 const direction=sideOf(orderBlock.dir),routes={};
 const settle=(route,entry)=>{
  if(!insideEntryWindow(entry.entryTime)){routes[route]={status:'rejected',reason:'outsideEntryWindow',knownAt:entry.entryTime};return;}
  const stop=evaluateReactionStop(context,orderBlock,contact,entry.entryTime);
  if(!(direction==='long'?stop.price<entry.entryPrice:stop.price>entry.entryPrice))fail('stopNotBeyondEntry',orderBlock,entry.entryTime);
  routes[route]={status:'entry',entryTime:entry.entryTime,entryPrice:entry.entryPrice,stopLoss:stop.price,stopAnchor:stop.anchor,confirmationCandleTime:entry.confirmationCandleTime};
 };
 const immediate=m1FvgSequenceResult(m1FvgEntrySequence(fvg,'immediate',context.instrument));
 const nearest=opponents.find(x=>x.nearest);
 if(nearest?.openAtReaction===true)routes.a={status:'rejected',reason:'opposingFvgOpen',knownAt:fvg.recognizedAt};
 else if(nearest&&nearest.openAtReaction===null)fail('opposingFvgHistoryMissing',orderBlock,fvg.recognizedAt);
 else if(immediate.status==='ready')settle('a',immediate);else fail('entryUnavailable',orderBlock,fvg.recognizedAt);
 // Ein vollständiger Entry beendet die Reaktion (Philip/P14); spätere B-Ereignisse wären ein zweiter Einstieg.
 if(routes.a.status==='entry'){
  routes.b={status:'skipped',reason:'entryAlreadyFound',knownAt:routes.a.entryTime};
  return routes;
 }
 let entryFvg=fvg,sequence=m1FvgEntrySequence(fvg,'retestReaction',context.instrument),fullFill=false;
 const attempts=[];
 const finish=(status,reason,c)=>{
  const result={status,reason,knownAt:c.time+60};
  attempts.push({fvg:entryFvg,...result});
  routes.b={...result,entryFvg};
 };
 // Philip: M5-OBs vom Vortag werden nicht getradet; der erste Marktschluss beendet auch die Entry-Suche (nur das Outcome läuft weiter).
 const walk=walkM1(context,fvg.recognizedAt,c=>{
  if(!c.ignored){
   // Auch zwischen zwei Versuchen überwachen: eine spätere FVG darf die gebrochene M5-OB nicht wiederbeleben (504).
   if(reactionBreaksOrderBlock(c,orderBlock)){
    if(routes.b?.status!=='rejected')finish('rejected','m5OrderBlockBroken',c);
    return true;
   }
  }
  if(routes.b?.status==='rejected'){
   const next=context.byKnownAt[direction].get(c.time+60)?.find(candidate=>candidate.recognizedAt>routes.b.knownAt);
   if(next){
    entryFvg=next;sequence=m1FvgEntrySequence(next,'retestReaction',context.instrument);fullFill=false;
    routes.b={status:'pending',reason:'entryBPending',knownAt:next.recognizedAt,entryFvg};
   }
   return false;
  }
  if(!c.ignored){
   fullFill||=Boolean(entryFvg.orderBlock)&&m1FvgFullyFilled(c,entryFvg);
   // Die 50 % betreffen nur den M1-OB der Entry-b-FVG nach voller Füllung, nicht den M5-Retest.
   if(fullFill&&measureOrderBlockPenetration(entryFvg.orderBlock,direction,[c]).maxPenetrationFraction>ENTRY_B_MAX_ORDER_BLOCK_DEPTH){
    finish('rejected',candleInvalidatesOrderBlock(c,entryFvg.orderBlock)?'entryBOrderBlockBroken':'entryBOrderBlockTooDeep',c);
    return false;
   }
  }
  advanceM1FvgEntrySequence(sequence,c);
  if(!sequence.result)return false;
  if(sequence.result.status==='ready'){
   settle('b',sequence.result);
   attempts.push({fvg:entryFvg,...routes.b});
   routes.b.entryFvg=entryFvg;
  }
  else if(sequence.result.status==='invalid'){finish('rejected','entryBOrderBlockBroken',c);return false;}
  else fail('entryBUnknown',orderBlock,c.time+60);
  return true;
 },{bridgeClosures:false});
 if(walk.status==='closed'&&(!routes.b||routes.b.status==='pending')){
  // Der Schluss ist erst belegt, wenn die erste Minute danach ausbleibt (Knotenplan-Sprungziel = sichtbare Änderung).
  routes.b={status:'rejected',reason:'marketClosed',knownAt:walk.at+60};
  attempts.push({fvg:entryFvg,...routes.b});
 }
 routes.b??=walk.status==='gap'?{status:'unknown',reason:'missingHistory',knownAt:walk.at}:{status:'pending',reason:'entryBPending'};
 if(routes.b.status==='pending'&&walk.status==='gap')routes.b={status:'unknown',reason:'missingHistory',knownAt:walk.at};
 routes.b.entryFvg??=entryFvg;
 if(routes.b.status==='pending'||routes.b.status==='unknown'&&!attempts.some(a=>a.knownAt===routes.b.knownAt))
  attempts.push({fvg:entryFvg,...routes.b});
 // Die Lücke beendet nur die Retry-Suche als unbekannt; der abgeschlossene Versuch bleibt unverändert.
 if(routes.b.status==='rejected'&&walk.status==='gap')routes.b={...routes.b,status:'unknown',reason:'missingHistory',knownAt:walk.at};
 routes.b.attempts=attempts;
 return routes;
}

// Nach einer Reaktion ohne exakten Einstich (Near-Touch oder Touch in der 2-%-Toleranz) ist erst der spätere exakte Retest das Extrem, an dem der DOB-Hold gemessen wird
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
// XAU-Marktschluss nach seiner Erkennung nicht reagiert hat: false mit Grund marketClosed, auch während der Pause.
export function evaluateOrderBlockReaction(context,orderBlock,{nearTouch=false,bridgeClosures=false}={}) {
 let contact=null,contactIndex=-1,result=null;
 const unknown=reason=>({state:'unknown',reason,contact,fvg:null,knownAt:null,penetration:null,routes:null});
 const complete=reaction=>{
  reaction.structuralState=reaction.state;
  reaction.opponentFvgs??=[];
  reaction.verdict=reactionVerdict(reaction);
  reaction.state=['pending','unknown'].includes(reaction.verdict.state)?'unknown':reaction.verdict.state;
  return reaction;
 };
 if(![-1,1].includes(orderBlock?.dir)||!Number.isFinite(orderBlock.recognizedAt)||!(orderBlock.top>orderBlock.bottom))
  return complete(unknown('invalidOrderBlock'));
 const rows=context.rows,direction=sideOf(orderBlock.dir);
 const walk=walkM1(context,Math.ceil(orderBlock.recognizedAt/60)*60,(c,i)=>{
  if(c.ignored)return false;
  if(reactionBreaksOrderBlock(c,orderBlock)){
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
  const opponents=opposingFvgs(context,orderBlock,fvg.recognizedAt,fvg.confirmationPrice);
  result={state:'true',reason:null,contact,fvg,knownAt:fvg.recognizedAt,opponentFvgs:opponents,
   penetration:measureOrderBlockPenetration(orderBlock,direction,rows.slice(contactIndex,i+1)),routes:evaluateRoutes(context,orderBlock,contact,fvg,opponents)};
  return true;
 },{bridgeClosures});
 const reaction=result??unknown(walk.status==='closed'?'marketClosed':walk.status==='gap'?'missingHistory':contact?'awaitingFvg':'noContact');
 if(!result&&walk.status==='closed')reaction.knownAt=walk.at;
 return complete(reaction);
}

// Debugger-Sicht auf dieselbe Füllhistorie wie der SL: true offen, false gefüllt, null unbekannt (Lücke/verdeckte Kerze).
export const internalFvgOpenAt=(context,fvg,at)=>openAt(fvgFill(context,fvg),at);
// Chart, Liste und SL teilen die Formation der gewählten M5-OB; spätere FVGs sind keine nachträglichen OB-Bestandteile.
export function internalOrderBlockFvgs(context,orderBlock,knownBy=Infinity) {
 const list=context.byDirection[sideOf(orderBlock.dir)],result=[];
 const through=Math.min(knownBy,orderBlock.recognizedAt??knownBy);
 for(let i=firstIndex(list,f=>f.candleTime>=orderBlock.startTime-M5_FORMATION_LOOKBACK);i<list.length&&list[i].recognizedAt<=through;i++)
  if(candleTouchesOrderBlock({low:list[i].bottom,high:list[i].top},orderBlock))result.push(list[i]);
 return result;
}
export {firstIndex};

// Zentrale Stelle für Detektor und Debugger: ein Datenfehler überspringt nur dieses OB, statt die Auswertung abzubrechen.
export function reactionOrSkip(context,orderBlock,options) {
 try{return evaluateOrderBlockReaction(context,orderBlock,options);}
 catch(error){if(!(error instanceof ReactionDataError))throw error;console.error(error.message);return null;}
}
