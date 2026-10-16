import {createSimulationRepository} from './tradeSetupSimulationRepository.js';
import {createLiveWatcherRepository,isLiveWatcherMonth,liveMonthOptions,liveSourceMonth,liveMonthViewId} from './liveWatcherMonth.js';
import {berlinDateStrFor} from './berlinTime.js';
import {liveWatcherRun} from './liveWatcherSnapshots.js';
import {createLiveEvidenceRepository} from './liveEvidenceRepository.js';
import {liveEvidenceView,liveEvidenceResults} from './liveEvidenceView.js';

// Ein Monatsmodell bündelt beide Quellen; ihre Originalkontexte bleiben unverändert.
export function createSetup2Repository(db){
 const stored=createSimulationRepository(db),live=createLiveWatcherRepository(db),evidence=createLiveEvidenceRepository(db),pending=new Map();
 const read=(run,refresh=false,setupKey)=>{
  run=liveMonthViewId(run);
  const month=pending.get(JSON.stringify([run,null]));
  if(setupKey&&!refresh&&month)return month.promise.then(data=>({...data,events:data.events.filter(event=>event.setup_key===setupKey),rows:data.rows.filter(row=>row.setup_key===setupKey),snapshots:data.snapshots.filter(snapshot=>snapshot.setupKey===setupKey)}));
  const key=JSON.stringify([run,setupKey ?? null]);
  const cached=pending.get(key);
  if(refresh&&!cached?.loading)pending.delete(key);
  if(!pending.has(key)){
   const state={loading:true};
   state.promise=Promise.all([live.events(liveSourceMonth(run),setupKey),evidence.metadata(run,setupKey)])
    .then(([events,rows])=>({events,rows,snapshots:liveEvidenceView(events,rows,run)}))
    .catch(error=>{if(pending.get(key)===state)pending.delete(key);throw error;})
    .finally(()=>{state.loading=false;});
   pending.set(key,state);
  }
  return pending.get(key).promise;
 };
 const materializeMany=async(run,snapshots)=>{
  const ids=[...new Set(snapshots.flatMap(snapshot=>[snapshot.evidenceRecordId,snapshot.observationRecordId,snapshot.checklistHistoryRecordId,...(snapshot.additionalChecks ?? []).map(check=>check.evidenceRecordId)]).filter(Boolean))];
  if(!ids.length)return snapshots;
  const {events}=await read(run,false,snapshots[0]?.setupKey),rows=await evidence.records(ids);
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
  async listRunOptions(){return [...liveMonthOptions().map(liveWatcherRun),...await stored.listRunOptions()];},
  async listLiveRuns(){
   const [oldMonths,first]=await Promise.all([live.months(),evidence.earliest()]);
   return [...new Map([...oldMonths,...(first?liveMonthOptions(first):[])].map(option=>[option.id,option])).values()].map(liveWatcherRun);
  },
  async listRuns(){
   const [runs,months]=await Promise.all([stored.listRuns(),facade.listLiveRuns()]);
   return [...months,...runs];
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
  async listRunDrCounts(ids){
   const counts=await stored.listRunDrCounts(ids.filter(id=>!isLiveWatcherMonth(id)));
   for(const id of ids.filter(isLiveWatcherMonth)){
    const cached=pending.get(JSON.stringify([liveMonthViewId(id),null]));
    const keys=cached?(await cached.promise).snapshots.map(snapshot=>snapshot.setupKey)
     :(await Promise.all([evidence.rangeKeys(id),live.rangeKeys(liveSourceMonth(id))])).flat();
    counts.set(id,new Set(keys).size);
   }
   return counts;
  },
  async getEntry(run,id){
   if(!isLiveWatcherMonth(run))return stored.getEntry(run,id);
   const key=await evidence.locate(id) ?? (await live.entryEvent(id))?.setup_key;
   return key?record(run,(await read(run,true,key)).snapshots.find(s=>s.id===id&&s.entry)):null;
  },
  async getSnapshot(run,id){return isLiveWatcherMonth(run)?(await facade.getEntry(run,id))?.snapshot ?? null:stored.getSnapshot(run,id);},
  async getSetupSnapshot(run,id){
   if(!isLiveWatcherMonth(run))return stored.getSetupSnapshot(run,id);
   const key=await evidence.locate(id);
   if(!key)return null;
   const data=await read(run,false,key),listed=data.snapshots.find(s=>s.id===id);
   if(listed)return materialize(run,listed);
   const originals=await evidence.snapshotRecords(id);
   return materialize(run,liveEvidenceView(data.events,[...data.rows,...originals],run).find(s=>s.id===id) ?? null);
  },
  async getRangeEntries(run,key){
   if(!isLiveWatcherMonth(run))return stored.getRangeEntries(run,key);
   const snapshots=(await read(run,false,key)).snapshots.filter(s=>s.setupKey===key&&s.entry).toSorted((a,b)=>a.knownAt-b.knownAt);
   return (await materializeMany(run,snapshots)).map(snapshot=>({snapshot,results:liveEvidenceResults([snapshot])}));
  },
  async getLivePinSnapshot(eventId){const event=await live.event(eventId);if(!event)return null;const run='live-watcher:'+berlinDateStrFor(Date.parse(event.signal_at)/1000).slice(0,7);return liveEvidenceView([event],[],run)[0] ?? null;},
  async getLiveSnapshotPin(recordId){const row=await evidence.record(recordId);if(!row)return null;const run='live-watcher:'+berlinDateStrFor(Date.parse(row.known_at)/1000).slice(0,7);return liveEvidenceView([],[row],run)[0] ?? null;},
 };
 return facade;
}
