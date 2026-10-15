import {liveWatcherSnapshots,liveWatcherEntryResults} from './liveWatcherSnapshots.js';
import {liveMonthViewId} from './liveWatcherMonth.js';
import {liveEvidenceOriginalOrder} from './liveEvidenceIndex.js';
const seconds=value=>Date.parse(value)/1000;
const identity=snapshot=>snapshot.entry?.id ?? snapshot.id;
function sourceSnapshot(row,runId){
 return {...row.snapshot,runId,source:'live-watcher',configurationId:row.configuration_id,evidenceRecordId:row.id,
  evaluationMode:row.evaluation_mode,evidenceCapturedAt:row.captured_at,evidenceEvaluatedThrough:row.evaluated_through};
}
// JSONB-Schlüsselreihenfolge ist kein anderer gespeicherter Stop.
const storedSignature=value=>JSON.stringify(value,(_,child)=>child && typeof child==='object' && !Array.isArray(child)?Object.fromEntries(Object.entries(child).sort(([a],[b])=>a.localeCompare(b))):child);
function sameOriginalEntry(a,b){
 return a.id===b.id && a.recognizedAt===b.recognizedAt && a.price===b.price && a.entryCategory===b.entryCategory
  && storedSignature(a.stops)===storedSignature(b.stops);
}
export function liveEvidenceView(events,rows,runId){
 runId=liveMonthViewId(runId);
 const eventSnapshots=liveWatcherSnapshots(events,runId),byId=new Map(eventSnapshots.map(s=>[identity(s),s])),latest=new Map(),histories=new Map();
 const ordered=rows.toSorted(liveEvidenceOriginalOrder);
 const remember=(map,key,row)=>{
  const previous=map.get(key);
  if(!previous || seconds(row.evaluated_through)>seconds(previous.evaluated_through)
   || seconds(row.evaluated_through)===seconds(previous.evaluated_through)&&seconds(row.captured_at)>seconds(previous.captured_at))map.set(key,row);
 };
 const historyKey=snapshot=>JSON.stringify([snapshot.setupKey,snapshot.configurationId,snapshot.evaluationMode]);
 const chosen=new Set(),additional=new Map();
 const supplement=(original,snapshot)=>{
  const key=`${snapshot.evaluationMode}:${snapshot.configurationId}`,checks=additional.get(identity(original)) ?? new Map();
  const previous=checks.get(key);
  if(!previous || seconds(snapshot.evidenceEvaluatedThrough)>seconds(previous.evidenceEvaluatedThrough))checks.set(key,snapshot);
  additional.set(identity(original),checks);
 };
 for(const row of ordered){
  const snapshot=sourceSnapshot(row,runId),key=snapshot.setupKey;
  const hasObservation=row.hasObservation ?? Object.values(row.observation ?? {}).some(value=>value!=null);
  if(hasObservation)remember(latest,key,row);
  if(row.hasHistory ?? !!row.observation?.checklistHistory)remember(histories,historyKey(snapshot),row);
  const original=byId.get(identity(snapshot)),replacesLate=original?.evaluationMode==='catchup' && snapshot.evaluationMode==='live';
  if(chosen.has(identity(snapshot)) || original?.evaluationMode==='live' && snapshot.evaluationMode==='catchup'){if(original)supplement(original,snapshot);continue;}
  chosen.add(identity(snapshot));
  // Spätere Archivbelege dürfen den ursprünglichen Alarm-Entry nicht umdeuten.
  if(original && !replacesLate && (original.instrument!==snapshot.instrument || original.direction!==snapshot.direction || original.setupKey!==snapshot.setupKey || original.entry && snapshot.entry && !sameOriginalEntry(original.entry,snapshot.entry))){supplement(original,snapshot);continue;}
  if(replacesLate)supplement(snapshot,original);
  byId.set(identity(snapshot),{...snapshot,...(original?.evaluationMode===snapshot.evaluationMode?{liveEventId:original.liveEventId,liveDetectedAt:original.liveDetectedAt,liveMissedReason:original.liveMissedReason,
    liveObservation:original.liveObservation,...(original.entry?{entry:original.entry}:{})}:{} )});
 }
 return [...byId.values()].map(original=>{
  const history=histories.get(historyKey(original));
  const snapshot={...original,...(history?{checklistHistoryRecordId:history.id,...(history.observation.checklistHistory?{checklistHistory:history.observation.checklistHistory}:{})}:{}),additionalChecks:[...additional.get(identity(original))?.values() ?? []]};
  const row=latest.get(snapshot.setupKey),observation=row?.observation;
  if(!observation)return snapshot;
  return {...snapshot,rangeCourse:observation.rangeCourse ?? snapshot.rangeCourse,priceObservation:observation.priceObservation ?? snapshot.priceObservation,
    liveCoverage:observation.coverage,liveObservedThrough:Math.max(snapshot.knownAt,seconds(row.evaluated_through)),observationCapturedAt:row.captured_at,observationEvaluatedThrough:row.evaluated_through,observationConfigurationId:row.configuration_id,observationEvaluationMode:row.evaluation_mode,observationRecordId:row.id};
 });
}
export function liveEvidenceResults(snapshots){
 return snapshots.flatMap(snapshot=>liveWatcherEntryResults({...snapshot,liveObservation:snapshot.liveObservation ?? {variants:[]}}));
}
