import { entryPattern1StructureCategory, entryPattern1CategoryMetadata, ENTRY_PATTERN_1_VERSION } from '../../src/entryPattern1Conditions.js';
import { entryCategoryLabel } from '../../src/entryCategory.js';
import { evaluateTradingHours } from '../../src/tradeSetupChecklistTime.js';
import { sizeSimulation } from '../../src/tradeSetupSimulation.js';

export function structureReady(conditions,direction,at,version=ENTRY_PATTERN_1_VERSION) {
 return entryPattern1StructureCategory(conditions,direction,at,version)!==null;
}
export function minuteAlarmEvents({context,check,knownAt,snapshot,structureFirstKnownAt},tradingWindows) {
 const {instrument,direction,setupKey}=context,conditions=check.conditions;
 if(evaluateTradingHours({instrument,evaluatedAt:knownAt,tradingWindows}).status!=='passed')return [];
 const category=entryPattern1StructureCategory(conditions,direction,knownAt,check.entryPattern ?? ENTRY_PATTERN_1_VERSION);
 const ready=category!==null,events=[];
 const categoryData=entryPattern1CategoryMetadata(category);
 const label=entryCategoryLabel(categoryData);
 const event=(stage,key,at,payload)=>({id:`${setupKey}:${check.entryPattern ?? 'current'}:${stage}:${key}`,instrument,stage,setup_key:setupKey,
  direction,kind:'trading',signal_at:new Date(at*1000).toISOString(),payload});
 if(ready){
  const at=structureFirstKnownAt ?? Math.max(category==='full'?conditions.m5Bos.recognizedAt:0,conditions.m5Countertrend.recognizedAt,conditions.m1PivotBreak.recognizedAt,context.validatedAt ?? context.confirmedAt);
  if(at===knownAt)events.push(event(1,'structure',at,{message:`${label} · ${category==='full'?'M5-BOS + M1-Pivotbruch':'M1-Pivotbruch · M5-BOS optional, nicht bestätigt'} · Vorwarnung`,...categoryData,conditions}));
  const retest=conditions.retest;
  // Ein früherer Retest wird bei späterem Strukturbruch ausdrücklich nicht nachgemeldet.
  if(retest?.recognizedAt===knownAt && retest.recognizedAt>at
   && retest.orderBlock?.dir===(direction==='short'?-1:1)
   && structureReady(conditions,direction,retest.recognizedAt,check.entryPattern ?? ENTRY_PATTERN_1_VERSION))
   events.push(event(2,retest.orderBlock.startTime,knownAt,{message:`${label} · Neuer gültiger OB-Retest nach Strukturfreigabe · Vorwarnung`,...categoryData,conditions}));
 }
 if(snapshot?.entry){
  const entry=snapshot.entry;
  const variants=['wide','narrow'].map(variant=>({variant,...sizeSimulation(entry,variant)}))
   .filter(v=>v.status==='ready');
  if(variants.length)events.push(event(3,entry.id,knownAt,{message:`${entryCategoryLabel(entry)} · Ausführbarer Entry`,entryCategory:entry.entryCategory,optionalConditionsMissing:entry.optionalConditionsMissing,positionSizeFactor:entry.sizing?.positionSizeFactor,entryPrice:entry.price,variants,entry}));
 }
 return events;
}

export function deliveryReason({signalAt,lastSuccess,nextDue,latestClosed,startup,now}) {
 if(startup)return 'Initialer Abgleich: Signal vor Aktivierung';
 if(signalAt<latestClosed)return 'Verpasste Auswertung: ältere geschlossene Minute';
 if(lastSuccess && nextDue && now>nextDue+120)return 'Auswertung nach Runner- oder Feed-Unterbrechung';
 return null;
}
