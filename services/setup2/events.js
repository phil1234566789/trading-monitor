import { entryPattern1M5BosMatches } from '../../src/entryPattern1M5Bos.js';
import { evaluateTradingHours } from '../../src/tradeSetupChecklistTime.js';
import { sizeSimulation } from '../../src/tradeSetupSimulation.js';

export function structureReady(conditions,direction,at) {
 const pivot=conditions?.m1PivotBreak;
 return entryPattern1M5BosMatches(conditions?.m5Bos,conditions?.m5Countertrend,direction,at)
  && pivot?.type==='pivot-break' && pivot.direction===direction && Number.isFinite(pivot.recognizedAt) && pivot.recognizedAt<=at;
}
export function minuteAlarmEvents({context,check,knownAt,snapshot,structureFirstKnownAt},tradingWindows) {
 const {instrument,direction,setupKey}=context,conditions=check.conditions;
 if(evaluateTradingHours({instrument,evaluatedAt:knownAt,tradingWindows}).status!=='passed')return [];
 const ready=structureReady(conditions,direction,knownAt),events=[];
 const event=(stage,key,at,payload)=>({id:`${setupKey}:${check.entryPattern ?? 'current'}:${stage}:${key}`,instrument,stage,setup_key:setupKey,
  direction,kind:'trading',signal_at:new Date(at*1000).toISOString(),payload});
 if(ready){
  const at=structureFirstKnownAt ?? Math.max(conditions.m5Bos.recognizedAt,conditions.m5Countertrend.recognizedAt,conditions.m1PivotBreak.recognizedAt,context.validatedAt ?? context.confirmedAt);
  if(at===knownAt)events.push(event(1,'structure',at,{message:'M5-BOS + M1-Pivotbruch bestätigt',conditions}));
  const retest=conditions.retest;
  // Ein früherer Retest wird bei späterem Strukturbruch ausdrücklich nicht nachgemeldet.
  if(retest?.recognizedAt===knownAt && structureReady(conditions,direction,retest.recognizedAt))
   events.push(event(2,retest.orderBlock.startTime,knownAt,{message:'Neuer gültiger OB-Retest nach Strukturfreigabe',conditions}));
 }
 if(snapshot?.entry){
  const entry=snapshot.entry;
  const variants=['wide','narrow'].map(variant=>({variant,...sizeSimulation(entry,variant)}))
   .filter(v=>v.status==='ready');
  if(variants.length)events.push(event(3,entry.id,knownAt,{message:'Ausführbarer Entry',entryPrice:entry.price,variants,entry}));
 }
 return events;
}

export function deliveryReason({signalAt,lastSuccess,nextDue,latestClosed,startup,now}) {
 if(startup)return 'Initialer Abgleich: Signal vor Aktivierung';
 if(signalAt<latestClosed)return 'Verpasste Auswertung: ältere geschlossene Minute';
 if(lastSuccess && nextDue && now>nextDue+120)return 'Auswertung nach Runner- oder Feed-Unterbrechung';
 return null;
}
