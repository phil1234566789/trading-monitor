import {detectDoubleOrderBlocks} from './doubleOrderBlocks.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {m1GapCovered} from './goldWeekendGap.js';

// v0 = DOB + TP 2R. Quelle der Kraft fehlt bewusst (eigener Task), Guardrail 22:00–02:00 setzt der Indikator selbst.
export const DOB_TRADE_SETUP_VERSION='dob-setup-v0';

// Phase je Setup für Alarm-Zeitpunkt und Dedup (id+phase): ob2Recognized = Route b wartet auf den Entry (Alarm vor dem Entry, Q3),
// entry = Trade läuft, danach der Ausgang. Frühere Phasen (OB1 berührt/reagiert) kennt v0 nicht, ein Setup entsteht erst mit dem OB2-Paar.
// invalid/skipped/unknown-Routen tragen keinen Trade.
const OUTCOME_PHASE={success:'win',loss:'loss',open:'entry',ambiguous:'ambiguous',unknown:'unknown'};
function phaseOf(pair,entry){
 if(entry.status!=='ready')return {phase:'ob2Recognized',phaseSince:entry.knownAt??pair.recognizedAt};
 const phase=OUTCOME_PHASE[entry.outcome?.status]??'unknown';
 return {phase,phaseSince:phase==='entry'?entry.entryTime:entry.outcome.recognizedAt??entry.outcome.unavailableAt??entry.entryTime};
}

function setupOf(pair,route,entry){
 const ready=entry.status==='ready';
 return {id:`${pair.id}:${route}`,pairId:pair.id,instrument:pair.instrument,direction:pair.direction,route,...phaseOf(pair,entry),
  recognizedAt:pair.recognizedAt,
  entryTime:ready?entry.entryTime:null,entryPrice:ready?entry.entryPrice:null,stopPrice:ready?entry.stopPrice:null,
  stopAnchor:ready?entry.stopAnchor:null,targetPrice:ready?entry.targetPrice:null,
  outcome:ready?{status:entry.outcome.status,recognizedAt:entry.outcome.recognizedAt,exitPrice:entry.outcome.exitPrice,reason:entry.outcome.reason}:null,
  chart:{firstOrderBlockStart:pair.firstOrderBlock.startTime,secondOrderBlockStart:pair.secondOrderBlock.startTime,
   firstRetestTime:pair.firstRetest.candleTime,secondRetestTime:pair.secondRetest.candleTime,time:ready?entry.entryTime:pair.recognizedAt}};
}

// Eingabe wie detectDoubleOrderBlocks (über doubleOrderBlockInput gebaut); Ausgang und 2R kommen aus evaluateDoubleOrderBlockOutcome.
export function checkDobTradeSetup(input){
 const dob=detectDoubleOrderBlocks(input);
 // liveFrom (dobLiveWindowInput): Paare aus dem Vorlauf vor dem Schluss gehören zur Vorsession.
 const setups=dob.pairs.filter(pair=>pair.recognizedAt>=(input.liveFrom??-Infinity)).flatMap(pair=>Object.entries(pair.entries)
  .filter(([,entry])=>entry.status==='ready'||entry.status==='pending').map(([route,entry])=>setupOf(pair,route,entry)));
 return {version:DOB_TRADE_SETUP_VERSION,dobVersion:dob.version,status:dob.status,evaluatedAt:input.evaluatedAt,setups,stats:dob.stats};
}

// Erste M1-Zeit nach dem letzten XAU-Marktschluss vor evaluatedAt (evaluatedAt selbst, solange der Markt zu ist).
// Ein OB verfällt am ersten Schluss nach seiner Erkennung und Retests müssen am selben Berliner Tag liegen,
// deshalb ändern ältere Kerzen kein Setup, dessen Entry noch kommen kann. Ohne Schluss im Input: -Infinity.
export function dobLiveWindowStart(m1Candles,instrument,evaluatedAt){
 const rows=closedChecklistCandles(m1Candles,'1m',evaluatedAt);
 let next=Math.floor(evaluatedAt/60)*60;
 for(let i=rows.length-1;i>=0;i--){
  const end=rows[i].time+60;
  if(end<next&&m1GapCovered(instrument,end,next))return next;
  next=rows[i].time;
 }
 return -Infinity;
}

// Kerzen vor dem Schluss, die ein M5-OB/M1-FVG direkt nach dem Reopen als Vorgänger braucht: ohne sie fehlten
// über 2026 13 Setups, die das Dashboard-Fenster zeigt. ponytail: fest 1 h, mehr nur, falls die Gegenprobe wieder abweicht.
const LIVE_LOOKBACK_BARS={m5:12,m1:60};
const fromIndex=(rows,isLive)=>{const i=rows.findIndex(isLive);return i<0?rows.length:i;};

// Live-Schnitt (~290 M5 / ~1450 M1): laufende Trades von vor dem Schluss fallen heraus, ihr Ausgang braucht das volle Fenster.
export function dobLiveWindowInput(input){
 const {evaluatedAt}=input,start=dobLiveWindowStart(input.m1Candles,input.instrument,evaluatedAt);
 const m1=closedChecklistCandles(input.m1Candles,'1m',evaluatedAt),m5=closedChecklistCandles(input.m5Candles,'5m',evaluatedAt);
 if(start===Math.floor(evaluatedAt/60)*60)return {...input,liveFrom:start,m1Candles:[],m5Candles:[]};
 return {...input,liveFrom:start,m1Candles:m1.slice(Math.max(0,fromIndex(m1,c=>c.time>=start)-LIVE_LOOKBACK_BARS.m1)),
  m5Candles:m5.slice(Math.max(0,fromIndex(m5,c=>c.time+300>start)-LIVE_LOOKBACK_BARS.m5))};
}
