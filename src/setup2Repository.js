import {createSimulationRepository} from './tradeSetupSimulationRepository.js';
import {createLiveWatcherRepository,isLiveWatcherMonth,liveMonthOptions,liveSourceMonth,liveMonthViewId} from './liveWatcherMonth.js';
import {berlinDateStrFor} from './berlinTime.js';
import {liveWatcherRun} from './liveWatcherSnapshots.js';
import {createLiveEvidenceRepository} from './liveEvidenceRepository.js';
import {liveEvidenceView,liveEvidenceResults} from './liveEvidenceView.js';

// Ein Monatsmodell bündelt beide Quellen; ihre Originalkontexte bleiben unverändert.
export function createSetup2Repository(db){
 const stored=createSimulationRepository(db),live=createLiveWatcherRepository(db),evidence=createLiveEvidenceRepository(db),pending=new Map();
 const read=(run,refresh=false)=>{
  run=liveMonthViewId(run);
  if(refresh)pending.delete(run);
  if(!pending.has(run))pending.set(run,Promise.all([live.events(liveSourceMonth(run)),evidence.metadata(run)])
   .then(([events,rows])=>({events,rows,snapshots:liveEvidenceView(events,rows,run)})).catch(error=>{pending.delete(run);throw error;}));
  return pending.get(run);
 };
 const materializeMany=async(run,snapshots)=>{
  const ids=[...new Set(snapshots.flatMap(snapshot=>[snapshot.evidenceRecordId,snapshot.observationRecordId,snapshot.checklistHistoryRecordId,...(snapshot.additionalChecks ?? []).map(check=>check.evidenceRecordId)]).filter(Boolean))];
  if(!ids.length)return snapshots;
  const {events}=await read(run),rows=await evidence.records(ids);
  if(ids.some(id=>!rows.some(row=>row.id===id)))throw new Error('Gespeicherter Original-Liveprüfstand fehlt.');
  const complete=new Map(liveEvidenceView(events,rows,run).map(snapshot=>[snapshot.id,snapshot]));
  return snapshots.map(snapshot=>complete.get(snapshot.id) ?? snapshot);
 };
 const materialize=async(run,snapshot)=>snapshot?(await materializeMany(run,[snapshot]))[0]:null;
 const record=async(run,snapshot)=>{const complete=await materialize(run,snapshot);return complete?{snapshot:complete,results:liveEvidenceResults([complete])}:null;};
 const assertStored=run=>{if(isLiveWatcherMonth(run))throw new Error('Live-Ereignisse dürfen nicht als Simulation neu gespeichert werden.');};
 const facade={...stored,
  saveRun:run=>{assertStored(run.id);return stored.saveRun(run);},
  saveEntries:(run,records)=>{assertStored(run);return stored.saveEntries(run,records);},
  saveSetups:(run,records)=>{assertStored(run);return stored.saveSetups(run,records);},
  async listRuns(){
   const [runs,oldMonths,first]=await Promise.all([stored.listRuns(),live.months(),evidence.earliest()]);
   const months=new Map([...oldMonths,...(first?liveMonthOptions(first):[])].map(option=>[option.id,option]));
   return [...[...months.values()].map(liveWatcherRun),...runs];
  },
  async getRun(run,configurationId){
   if(!isLiveWatcherMonth(run))return stored.getRun(run);
   const source=liveWatcherRun({id:run});return configurationId?{...source,configuration:await evidence.configuration(configurationId)}:source;
  },
  async listReviewMetadata(run){return isLiveWatcherMonth(run)?(await read(run,true)).snapshots:stored.listReviewMetadata(run);},
  async listResults(options={}){
   if(!isLiveWatcherMonth(options.runId))return stored.listResults(options);
   return liveEvidenceResults((await read(options.runId)).snapshots).filter(row=>(!options.instrument||row.instrument===options.instrument)
    &&(!options.variant||row.variant===options.variant)&&(!Number.isFinite(options.from)||row.entryTime>=options.from)
    &&(!Number.isFinite(options.to)||row.entryTime<options.to)&&(!Number.isFinite(options.asOf)||row.entryTime<=options.asOf));
  },
  async listRunDrCounts(ids){const counts=await stored.listRunDrCounts(ids.filter(id=>!isLiveWatcherMonth(id)));for(const id of ids.filter(isLiveWatcherMonth))counts.set(id,new Set((await read(id)).snapshots.map(s=>s.setupKey)).size);return counts;},
  async getEntry(run,id){return isLiveWatcherMonth(run)?record(run,(await read(run,true)).snapshots.find(s=>s.id===id&&s.entry)):stored.getEntry(run,id);},
  async getSnapshot(run,id){return isLiveWatcherMonth(run)?(await facade.getEntry(run,id))?.snapshot ?? null:stored.getSnapshot(run,id);},
  async getSetupSnapshot(run,id){return isLiveWatcherMonth(run)?materialize(run,(await read(run)).snapshots.find(s=>s.id===id) ?? null):stored.getSetupSnapshot(run,id);},
  async getRangeEntries(run,key){
   if(!isLiveWatcherMonth(run))return stored.getRangeEntries(run,key);
   const snapshots=(await read(run)).snapshots.filter(s=>s.setupKey===key&&s.entry).toSorted((a,b)=>a.knownAt-b.knownAt);
   return (await materializeMany(run,snapshots)).map(snapshot=>({snapshot,results:liveEvidenceResults([snapshot])}));
  },
  async getLivePinSnapshot(eventId){const event=await live.event(eventId);if(!event)return null;const run='live-watcher:'+berlinDateStrFor(Date.parse(event.signal_at)/1000).slice(0,7);return liveEvidenceView([event],[],run)[0] ?? null;},
  async getLiveSnapshotPin(recordId){const row=await evidence.record(recordId);if(!row)return null;const run='live-watcher:'+berlinDateStrFor(Date.parse(row.known_at)/1000).slice(0,7);return liveEvidenceView([],[row],run)[0] ?? null;},
 };
 return facade;
}
