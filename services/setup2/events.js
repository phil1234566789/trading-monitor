import { entryPattern1StructureCategory, entryPattern1CategoryMetadata, entryPattern1ConditionsReady, ENTRY_PATTERN_1_VERSION } from '../../src/entryPattern1Conditions.js';
import { entryCategoryLabel } from '../../src/entryCategory.js';
import { evaluateTradingHours } from '../../src/tradeSetupChecklistTime.js';
import { sizeSimulation } from '../../src/tradeSetupSimulation.js';
import {isEntryPattern2,entryPattern2StructureReady,entryPattern2ConditionsReady} from '../../src/entryPattern2Conditions.js';

export const structureTrackingKey=({context,check})=>isEntryPattern2(check.entryPattern)?`${context.setupKey}:${check.entryPattern}`:context.setupKey;

export function structureReady(conditions,direction,at,version=ENTRY_PATTERN_1_VERSION) {
 return isEntryPattern2(version)?entryPattern2StructureReady(conditions,direction,at):entryPattern1StructureCategory(conditions,direction,at,version)!==null;
}
export function rememberStructure(minute,structures) {
 const {context,check,knownAt}=minute;
 const key=structureTrackingKey(minute);
 if(structureReady(check.conditions,context.direction,knownAt,check.entryPattern ?? ENTRY_PATTERN_1_VERSION)
  && !structures.has(key))structures.set(key,knownAt);
 return structures.get(key);
}
export function minuteAlarmEvents({context,check,knownAt,snapshot,structureFirstKnownAt},tradingWindows) {
 const {instrument,direction,setupKey}=context,conditions=check.conditions,version=check.entryPattern ?? ENTRY_PATTERN_1_VERSION;
 if(evaluateTradingHours({instrument,evaluatedAt:knownAt,tradingWindows}).status!=='passed')return [];
 const pattern2=isEntryPattern2(version);
 const category=pattern2?(entryPattern2StructureReady(conditions,direction,knownAt)?'full':null):entryPattern1StructureCategory(conditions,direction,knownAt,version);
 const ready=category!==null,events=[];
 const categoryData=entryPattern1CategoryMetadata(category);
 const label=entryCategoryLabel(categoryData);
 const event=(stage,key,at,payload)=>({id:`${setupKey}:${check.entryPattern ?? 'current'}:${stage}:${key}`,instrument,stage,setup_key:setupKey,
  direction,kind:'trading',signal_at:new Date(at*1000).toISOString(),payload});
 if(ready){
  const at=structureFirstKnownAt ?? (pattern2?Math.max(conditions.retest.recognizedAt,conditions.m1PivotBreak.recognizedAt,context.validatedAt ?? context.confirmedAt)
    :Math.max(category==='full'?conditions.m5Bos.recognizedAt:0,conditions.m5Countertrend.recognizedAt,conditions.m1PivotBreak.recognizedAt,context.validatedAt ?? context.confirmedAt));
  if(at===knownAt)events.push(event(1,'structure',at,{message:`${label} · ${pattern2?'Pattern 2 · M5-OB-Retest + M1-P2-Pivotbruch':category==='full'?'M5-BOS + M1-Pivotbruch':'M1-Pivotbruch · M5-BOS optional, nicht bestätigt'} · Vorwarnung`,...categoryData,conditions}));
  const retest=pattern2?conditions.fvgRetest:conditions.retest;
  // Ein früherer Retest wird bei späterem Strukturbruch ausdrücklich nicht nachgemeldet.
  if(retest?.recognizedAt===knownAt && retest.recognizedAt>at
   && (pattern2||retest.orderBlock?.dir===(direction==='short'?-1:1))
   && structureReady(conditions,direction,retest.recognizedAt,version))
   events.push(event(2,pattern2?retest.candleTime:retest.orderBlock.startTime,knownAt,{message:`${label} · ${pattern2?'M1-FVG-Retest nach Strukturfreigabe':'Neuer gültiger OB-Retest nach Strukturfreigabe'} · Vorwarnung`,...categoryData,conditions}));
 }
 if(snapshot?.entry && ready && snapshot.entry.direction===direction && snapshot.entry.recognizedAt===knownAt
  && (pattern2?entryPattern2ConditionsReady(snapshot.entry.conditions,direction,knownAt):entryPattern1ConditionsReady(snapshot.entry.conditions,direction,knownAt,version))){
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
