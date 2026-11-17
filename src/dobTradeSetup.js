import {detectDoubleOrderBlocks} from './doubleOrderBlocks.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {m1GapCovered} from './goldWeekendGap.js';
import {dobSourceContext,nearestHtfSource,sourceOfStrengthPassed,sourceMaxDistanceAtr,dobSourceZoneAgeSeconds} from './dobSourceOfStrength.js';
import {dobZoneAgeBlocked,dobEntryRule,dobCounterDobBlocked,dobCounterDobTpR,dobCounterCandlesBlocked,dobPartialPlan,DOB_DEFAULT_TP_R} from './dobGuardrails.js';
import {dobTradeFeatures} from './dobTradeFeatures.js';
import {evaluateDoubleOrderBlockOutcome} from './doubleOrderBlockOutcome.js';

// v2 = Quelle der Kraft (aktive H1/H4-OB-Zone ≤ k H1-ATR von OB1, k je Instrument, vor OB1 retestet; dobSourceOfStrength.js)
// + DOB + TP 2R. Den Retest verlangt Philip fachlich (Q17), auch wenn er die Winrate nicht hebt; sourceOptions.requireRetest=false
// rechnet nur den historischen v1-Lauf nach. Einziger Guardrail bleibt das Entry-Verbot 22:00–02:00 im Indikator; LS-Quelle kommt später.
export const DOB_TRADE_SETUP_VERSION='dob-setup-v2';
// v3 = v2 + Gegen-DOB-Gate (input.counterDobGate, src/dobCounterDob.js).
export const DOB_TRADE_SETUP_V3_VERSION='dob-setup-v3';

// Phasen für Alarm-Zeitpunkt und Dedup (pairId+phase): ob2Retest = OB2 berührt, Reaktion steht aus (Alarm, Q3);
// ob2Recognized = OB2-Reaktion da, Route b wartet auf den Entry; entry = Trade läuft, danach der Ausgang.
// invalid/skipped/unknown-Routen tragen keinen Trade.
const OUTCOME_PHASE={success:'win',loss:'loss',open:'entry',ambiguous:'ambiguous',unknown:'unknown'};
function phaseOf(pair,entry){
 if(entry.status!=='ready')return {phase:'ob2Recognized',phaseSince:entry.knownAt??pair.recognizedAt};
 const phase=OUTCOME_PHASE[entry.outcome?.status]??'unknown';
 return {phase,phaseSince:phase==='entry'?entry.entryTime:entry.outcome.recognizedAt??entry.outcome.unavailableAt??entry.entryTime};
}

const zoneOf=ob=>({top:ob.top,bottom:ob.bottom});
const chartOf=(pair,time)=>({firstOrderBlockStart:pair.firstOrderBlock.startTime,secondOrderBlockStart:pair.secondOrderBlock.startTime,
 firstRetestTime:pair.firstRetest.candleTime,secondRetestTime:pair.secondRetest.candleTime,time,
 firstOrderBlock:zoneOf(pair.firstOrderBlock),secondOrderBlock:zoneOf(pair.secondOrderBlock)});
function setupOf(pair,route,entry){
 const ready=entry.status==='ready';
 return {id:`${pair.id}:${route}`,pairId:pair.id,instrument:pair.instrument,direction:pair.direction,route,...phaseOf(pair,entry),
  recognizedAt:pair.recognizedAt,
  entryTime:ready?entry.entryTime:null,entryPrice:ready?entry.entryPrice:null,stopPrice:ready?entry.stopPrice:null,
  stopAnchor:ready?entry.stopAnchor:null,targetPrice:ready?entry.targetPrice:null,
  outcome:ready?{status:entry.outcome.status,recognizedAt:entry.outcome.recognizedAt,exitPrice:entry.outcome.exitPrice,reason:entry.outcome.reason}:null,
  chart:chartOf(pair,ready?entry.entryTime:pair.recognizedAt)};
}
const retestOf=pair=>({id:`${pair.id}:retest`,pairId:pair.id,instrument:pair.instrument,direction:pair.direction,route:null,
 phase:'ob2Retest',phaseSince:pair.recognizedAt,recognizedAt:pair.recognizedAt,entryTime:null,entryPrice:null,stopPrice:null,
 stopAnchor:null,targetPrice:null,outcome:null,chart:chartOf(pair,pair.recognizedAt)});

// Eingabe wie detectDoubleOrderBlocks (über doubleOrderBlockInput gebaut) plus htfCandles {'1h','4h'} (markHtfObCandles) oder ein
// vorberechneter sourceContext (Statistik: einmal über die ganze Historie). Ausgang und 2R kommen aus evaluateDoubleOrderBlockOutcome.
// sourceOptions: {requireRetest} (Standard true). trendGate (optional, v3-Experiment): Funktion setup → {trend, verdict, rejectReason}
// aus createDobM5TrendGate; wird vom Aufrufer hereingereicht, damit der Trend-Algo nicht im Watcher-Bundle landet.
// guardrails (optional, dobGuardrailsFromRow): Zonenalter und Entry-Stunde → rejected 'blockedZoneAge'/'blockedEntryHour'; den Monat
// prüft der Watcher vorab. Ein Entry außerhalb der Sperre bekommt tpRule {tpR, window} und Ziel/Ausgang zu diesem R.
// counterDobGate (optional, v3): setup → {count, liveCount, status} aus createDobCounterDobGate; ohne guardrails nur am Setup
// vermerkt (Statistik speichert alle Status), mit guardrails entscheidet counterDobMode über Sperre bzw. TP 5R. setups = mit Quelle der Kraft; rejected = dieselben DOB-Setups mit Grund, damit nichts still verschwindet.
// Der Indikator rechnet Ziel und Ausgang mit 2R; ein anderes R aus der Fensterregel rechnet dieselbe Ausgangslogik nach.
function withTarget(pair,setup,rule,{m1Candles,evaluatedAt}){
 const tpRule={tpR:rule.tpR,window:rule.window,...(rule.source?{source:rule.source}:{})};
 if(rule.tpR===DOB_DEFAULT_TP_R)return {tpRule};
 const outcome=evaluateDoubleOrderBlockOutcome({direction:setup.direction,entryTime:setup.entryTime,entryPrice:setup.entryPrice,stopPrice:setup.stopPrice,
  candles:m1Candles,evaluatedAt,instrument:setup.instrument,rMultiple:rule.tpR});
 return {tpRule,targetPrice:outcome.targetPrice,...phaseOf(pair,{status:'ready',entryTime:setup.entryTime,outcome}),
  outcome:{status:outcome.status,recognizedAt:outcome.recognizedAt,exitPrice:outcome.exitPrice,reason:outcome.reason}};
}

export function checkDobTradeSetup(input){
 const dob=detectDoubleOrderBlocks({...input,options:{...input.options,retests:true}});
 const context=input.sourceContext??(input.htfCandles?dobSourceContext({htfCandles:input.htfCandles,m5Candles:input.m5Candles,instrument:input.instrument}):null);
 const sources=new Map(),maxAtr=sourceMaxDistanceAtr(input.instrument);
 const sourceOf=pair=>{
  const key=`${pair.direction}:${pair.firstOrderBlock.startTime}`;
  if(!sources.has(key))sources.set(key,context&&nearestHtfSource(context,{firstOrderBlock:pair.firstOrderBlock,direction:pair.direction,m5Candles:input.m5Candles},
   {requireRetest:input.sourceOptions?.requireRetest??true}));
  return sources.get(key);
 };
 // liveFrom (dobLiveWindowInput): Paare aus dem Vorlauf vor dem Schluss gehören zur Vorsession.
 const live=pair=>pair.recognizedAt>=(input.liveFrom??-Infinity);
 const candidates=[
  ...(dob.retests??[]).filter(live).map(pair=>[pair,retestOf(pair)]),
  ...dob.pairs.filter(live).flatMap(pair=>Object.entries(pair.entries)
   .filter(([,entry])=>entry.status==='ready'||entry.status==='pending').map(([route,entry])=>[pair,setupOf(pair,route,entry)]))];
 const setups=[],rejected=[];
 const guardrails=input.guardrails;
 for(const [pair,setup] of candidates){
  const sourceOfStrength=sourceOf(pair);
  if(!sourceOfStrengthPassed(sourceOfStrength,maxAtr)){
   rejected.push({...setup,sourceOfStrength,reason:maxAtr==null?'noSourceOfStrengthConfig':context?'noSourceOfStrength':'missingHtfCandles'});
   continue;
  }
  // Zonenalter sperrt schon den Retest (kein Alarm); die Entry-Stunde erst den Entry, der Retest-Alarm ist da schon raus (Q23).
  if(guardrails&&dobZoneAgeBlocked(guardrails,dobSourceZoneAgeSeconds(sourceOfStrength,pair.firstOrderBlock.startTime))){
   rejected.push({...setup,sourceOfStrength,reason:'blockedZoneAge'});continue;
  }
  const rule=guardrails&&setup.entryTime!=null?dobEntryRule(guardrails,setup.entryTime):null;
  if(rule?.action==='block'){rejected.push({...setup,sourceOfStrength,reason:'blockedEntryHour'});continue;}
  const counterDob=input.counterDobGate?.({...setup,sourceOfStrength})??null;
  if(counterDob)setup.counterDob=counterDob;
  if(guardrails&&counterDob&&dobCounterDobBlocked(guardrails,counterDob.status)){rejected.push({...setup,sourceOfStrength,reason:'counterDob'});continue;}
  // Konfig-Merkmale am Entry (src/dobTradeFeatures.js), die letzten M5 vor dem Entry liegen im Live-Fenster (Vorlauf 12 M5).
  if(setup.entryTime!=null)setup.features=dobTradeFeatures({m5Candles:input.m5Candles,entryTime:setup.entryTime,direction:setup.direction});
  if(guardrails&&setup.features&&dobCounterCandlesBlocked(guardrails,setup.features)){rejected.push({...setup,sourceOfStrength,reason:'counterCandles'});continue;}
  const deadTpR=guardrails&&counterDob?dobCounterDobTpR(guardrails,counterDob.status):null;
  if(rule)Object.assign(setup,withTarget(pair,setup,deadTpR?{tpR:deadTpR,window:null,source:'deadCounterDob'}:rule,input));
  // Teilprofit nur für den Alarmtext (TP1/TP2); Ziel und Ausgang des Setups bleiben beim Konfig-TP.
  const partial=setup.tpRule&&dobPartialPlan(guardrails,setup.tpRule.tpR);
  if(partial)setup.tpRule={...setup.tpRule,partial};
  // Anti-Gate erst nach der Quelle: Trend nur für die wenigen Kandidaten, Grund bleibt im rejected sichtbar.
  const m5Trend=input.trendGate?.({...setup,sourceOfStrength});
  if(m5Trend?.rejectReason)rejected.push({...setup,sourceOfStrength,m5Trend,reason:m5Trend.rejectReason});
  else setups.push({...setup,sourceOfStrength,...(m5Trend?{m5Trend}:{})});
 }
 return {version:input.counterDobGate?DOB_TRADE_SETUP_V3_VERSION:DOB_TRADE_SETUP_VERSION,dobVersion:dob.version,status:dob.status,evaluatedAt:input.evaluatedAt,setups,rejected,stats:dob.stats};
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
