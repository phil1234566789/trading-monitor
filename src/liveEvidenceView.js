import {liveWatcherSnapshots,liveWatcherEntryResults} from './liveWatcherSnapshots.js';
import {liveSourceMode} from './liveWatcherMonth.js';
const seconds=value=>Date.parse(value)/1000;
function sourceSnapshot(row,runId){
 return {...row.snapshot,runId,source:'live-watcher',configurationId:row.configuration_id,evidenceRecordId:row.id,
  evaluationMode:row.evaluation_mode,evidenceCapturedAt:row.captured_at,evidenceEvaluatedThrough:row.evaluated_through};
}
function sameOriginalEntry(a,b){
 return a.id===b.id && a.recognizedAt===b.recognizedAt && a.price===b.price && a.entryCategory===b.entryCategory
  && a.stops?.wide?.price===b.stops?.wide?.price && a.stops?.narrow?.price===b.stops?.narrow?.price;
}
export function liveEvidenceView(events,rows,runId){
 const mode=liveSourceMode(runId),eventSnapshots=liveWatcherSnapshots(events,runId),byId=new Map(eventSnapshots.map(s=>[s.id,s])),latest=new Map();
 const ordered=rows.filter(row=>row.evaluation_mode===mode).toSorted((a,b)=>seconds(a.captured_at)-seconds(b.captured_at)||a.id.localeCompare(b.id));
 const chosen=new Set();
 for(const row of ordered){
  const snapshot=sourceSnapshot(row,runId),key=snapshot.setupKey;
  const previousObservation=latest.get(key);
  const hasObservation=row.hasObservation ?? Object.values(row.observation ?? {}).some(value=>value!=null);
  if(hasObservation && (!previousObservation || seconds(row.evaluated_through)>seconds(previousObservation.evaluated_through)
    || seconds(row.evaluated_through)===seconds(previousObservation.evaluated_through)&&seconds(row.captured_at)>seconds(previousObservation.captured_at)))latest.set(key,row);
  if(chosen.has(snapshot.id))continue;chosen.add(snapshot.id);
  const original=byId.get(snapshot.id);
  // Spätere Archivbelege dürfen den ursprünglichen Alarm-Entry nicht umdeuten.
  if(original?.entry && snapshot.entry && !sameOriginalEntry(original.entry,snapshot.entry))continue;
  byId.set(snapshot.id,{...snapshot,...(original?{liveEventId:original.liveEventId,liveDetectedAt:original.liveDetectedAt,liveMissedReason:original.liveMissedReason,
    liveObservation:original.liveObservation,...(original.entry?{entry:original.entry}:{})}:{} )});
 }
 return [...byId.values()].map(snapshot=>{
  const row=latest.get(snapshot.setupKey),observation=row?.observation;
  if(!observation)return snapshot;
  return {...snapshot,rangeCourse:observation.rangeCourse ?? snapshot.rangeCourse,priceObservation:observation.priceObservation ?? snapshot.priceObservation,
    ...(row.configuration_id===snapshot.configurationId && observation.checklistHistory?{checklistHistory:observation.checklistHistory}:{}),
    liveCoverage:observation.coverage,liveObservedThrough:Math.max(snapshot.knownAt,seconds(row.evaluated_through)),observationCapturedAt:row.captured_at,observationConfigurationId:row.configuration_id,observationRecordId:row.id};
 });
}
export function liveEvidenceResults(snapshots){
 return snapshots.flatMap(snapshot=>liveWatcherEntryResults({...snapshot,liveObservation:snapshot.liveObservation ?? {variants:[]}}));
}
