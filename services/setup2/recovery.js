import {createLiveEvidence} from './evidence.js';
import {scanTradeSetup2Window} from '../../src/tradeSetup2Scan.js';
import {setup1RecognitionTime} from '../../src/setup1RecognitionTime.js';
import {ENTRY_PATTERN_1_VERSION} from '../../src/entryPattern1Conditions.js';
import {SETUP2_VERSION} from '../../src/tradeSetup2Configuration.js';
import {minuteAlarmEvents,rememberStructure} from './events.js';
const seconds=value=>typeof value==='number'?value:Date.parse(value)/1000;
const iso=value=>new Date(value*1000).toISOString();

export function suspendedResumeTime(range) {
 const saved=seconds(range.evaluatedThrough);
 return Number.isFinite(saved)?saved:setup1RecognitionTime(range.source)-60;
}
export function partitionLiveSources(sources,suspended=[]) {
 const excluded=new Set((suspended ?? []).map(range=>range.setupKey));
 return [...new Map(sources.filter(source=>!excluded.has(`${source.instrument}:setup1:${source.tradeSetupId}`))
  .map(source=>[`${source.instrument}:${source.tradeSetupId}`,source])).values()];
}
export function refreshRecoveredHistory(cache,state) {
 const revision=state.nativeHistoryRevision ?? 0;
 if((cache.historyRevision ?? 0)===revision)return false;
 // Unter der frischen Livelease neu laden; keine laufenden Arrays vom Nachholjob aus verändern.
 delete cache['1m'];delete cache['5m'];delete cache.m1Start;delete cache.m5Start;
 cache.scanMemo={};cache.historyRevision=revision;return true;
}
export function continuousHistory(rows,start,end,duration) {
 let next=Math.ceil(start/duration)*duration;
 const until=Math.floor(end/duration)*duration;
 for(const candle of rows) {
  if(candle.time<next)continue;
  if(candle.time>=until)break;
  if(candle.time!==next || ![candle.high,candle.low].every(Number.isFinite) || candle.low>candle.high)return false;
  next+=duration;
 }
 return next>=until;
}
const fingerprint=(range,state)=>JSON.stringify([range?.source,range?.evaluatedThrough,range?.historyStart,state.configFingerprint,state.version]);
export function recoveryConfig(sessions,windows,news) {
 return JSON.stringify([sessions,windows,news,ENTRY_PATTERN_1_VERSION,SETUP2_VERSION]);
}
export function recoveryMatches(row,range,expected) {
 const current=row?.state?.suspendedRanges?.find(item=>item.setupKey===range.setupKey);
 return row?.enabled===true && !!current && fingerprint(current,row.state)===expected;
}
export async function recoverSuspendedRange({row,range,sessions,schedules,news,cache,yieldControl,
 candles,readState,readConfig,acquire,checkpoint,release}) {
 if(!range.source || !row.state.configFingerprint)return;
 const instrument=row.instrument,tradingWindows=schedules.find(s=>s.instrument===instrument)?.trading_windows;
 if(recoveryConfig(sessions,tradingWindows,news)!==row.state.configFingerprint)return;
 const expected=fingerprint(range,row.state),source=structuredClone(range.source);
 const anchors=structuredClone(cache.anchors),h1=structuredClone(cache.h1);
 const anchor=anchors.findLast(a=>a.knownAt<=setup1RecognitionTime(source));
 if(!anchor)return;
 await yieldControl();
 const from=Math.min(anchor.structureStartTime,source.obStartTime,source.ls.touchedTime)-131*60;
 const m1=await candles(instrument,'1m',from);
 const historyStart=range.historyStart ?? setup1RecognitionTime(source);
 const probeThrough=seconds(range.historyProbeThrough ?? range.suspendedAt);
 // Erst echte Nachlieferung prüfen; unveränderte Lücken dürfen keinen Mehrtages-Rescan starten.
 if(!Number.isFinite(probeThrough) || !continuousHistory(m1,historyStart,probeThrough,60))return;
 const m5=await candles(instrument,'5m',anchor.structureStartTime);
 if(!continuousHistory(m5,historyStart,probeThrough,300))return;
 let through=m1.at(-1)?.time+60;
 if(!Number.isFinite(through))return;
 const entries=new Map((row.state.entries ?? []).filter(item=>item.setupKey===range.setupKey).map(item=>[item.entry.id,structuredClone(item)]));
 const structures=new Map(Object.entries(row.state.structureKnownAt ?? {}));
 const events=new Map();let snapshot=null;
 const input={instrument,tradeSetups:[source],m1Candles:m1,m5Candles:m5,h1Candles:h1,dailyAnchors:anchors,
  sessionConfigs:structuredClone(sessions),tradingWindows:structuredClone(tradingWindows),
  news:news.map(n=>({...n,eventTime:seconds(n.event_time)})),newsLoadStatus:'ready',settings:{},scanMemo:{},yieldControl,
  loadM1Candles:async({structureFromTime})=>{
   if(structureFromTime-131*60<m1[0]?.time){const rows=await candles(instrument,'1m',structureFromTime-131*60);m1.splice(0,m1.length,...rows);}
   return m1;
  },onSnapshot:value=>{if(value.entry)entries.set(value.entry.id,{setupKey:value.setupKey,entry:value.entry});else snapshot=value;},
  onMinuteCheck:minute=>{
   rememberStructure(minute,structures);
   for(const event of minuteAlarmEvents({...minute,structureFirstKnownAt:structures.get(minute.context.setupKey)},tradingWindows)){
    event.missed_reason='Historische DR-Nachholung nach nativer Daten-Nachlieferung';events.set(event.id,event);
   }
  }};
 const evidenceBatches=[];let evidencePriceObservations=row.state.evidencePriceObservations;
 const scan=async(fromTime,toTime)=>{
  const evidence=createLiveEvidence({instrument,version:row.state.version,sessions,tradingWindows,news,settings:{},dailyAnchors:anchors},
   {fromTime,toTime,startedAt:Date.now()/1000,mode:'catchup'});
  const finalized=await scanTradeSetup2Window({...input,existingEntries:[...entries.values()],fromTime,toTime,
   onSnapshot:s=>{input.onSnapshot(s);evidence.record(s);},onMinuteCheck:m=>{input.onMinuteCheck(m);evidence.recordMinute(m);}});
  const {priceState,...batch}=evidence.complete(finalized,{m5Candles:m5,previous:evidencePriceObservations});evidencePriceObservations=priceState;if(batch.snapshots.length)evidenceBatches.push(batch);
  for(const event of events.values())event.payload={...event.payload,provenance:{evaluationMode:'catchup',configurationId:evidence.configurationId}};
 };
 await scan(suspendedResumeTime(range)+60,through);
 await yieldControl();
 if(!snapshot || !await acquire())return;
 try {
  const current=await readState();
  if(!recoveryMatches(current,range,expected))return;
  if(readConfig && await readConfig()!==row.state.configFingerprint)return;
  const liveThrough=seconds(current.state.evaluatedThrough);
  if(liveThrough>through) {
   // Die Liveprüfung kann während der Nachholung weiterlaufen; keine Race-Minuten verlieren.
   const tail=await candles(instrument,'1m',m1.at(-1).time+1);m1.push(...tail);
   if((m1.at(-1)?.time+60)<liveThrough)return;
   const bars=await candles(instrument,'5m',m5.at(-1).time+1);m5.push(...bars);
   await scan(through+60,liveThrough);through=liveThrough;
  }
  const state=structuredClone(current.state),unknown=snapshot.rangeCourse?.lifecycle?.main?.state==='unknown';
  state.evidencePriceObservations={...state.evidencePriceObservations,...(evidencePriceObservations?.[range.setupKey]?{[range.setupKey]:evidencePriceObservations[range.setupKey]}:{})};
  state.nativeHistoryRevision=(state.nativeHistoryRevision ?? 0)+1;
  state.entries=[...new Map([...(state.entries ?? []),...entries.values()].map(item=>[item.entry.id,item])).values()];
  state.suspendedRanges=state.suspendedRanges.filter(item=>item.setupKey!==range.setupKey);
  if(unknown)state.suspendedRanges.push({...range,historyProbeThrough:iso(through)});
  else if(snapshot.dealingRange?.status==='validated' && snapshot.rangeCourse?.lifecycle?.main?.state!=='ended') {
   state.activeRanges=[...state.activeRanges.filter(item=>item.setupKey!==range.setupKey),
    {setupKey:range.setupKey,direction:snapshot.direction,source,structureReady:false,lastM1Time:through-60}];
  }
  const knownAt=structures.get(range.setupKey);
  if(knownAt!=null)state.structureKnownAt={...state.structureKnownAt,[range.setupKey]:knownAt};
  await checkpoint(state,[...events.values()],evidenceBatches);
  console.log(JSON.stringify({instrument,source:'range-recovery',setupKey:range.setupKey,through:iso(through),unknown,events:events.size}));
 } finally {await release();}
}
