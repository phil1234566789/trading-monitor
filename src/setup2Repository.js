import {createSimulationRepository} from './tradeSetupSimulationRepository.js';
import {createLiveWatcherRepository,isLiveWatcherMonth} from './liveWatcherMonth.js';
import {berlinDateStrFor} from './berlinTime.js';
import {liveWatcherRun,liveWatcherSnapshots,liveWatcherEntryResults} from './liveWatcherSnapshots.js';

// Beide Quellen teilen Review und Chart; nur der gespeicherte Lesevertrag unterscheidet sich.
export function createSetup2Repository(db) {
  const stored=createSimulationRepository(db),live=createLiveWatcherRepository(db),pending=new Map();
  const read=(run,refresh=false)=>{
    if(refresh)pending.delete(run);
    if(!pending.has(run))pending.set(run,live.events(run.slice('live-watcher:'.length))
      .then(events=>liveWatcherSnapshots(events,run)).catch(error=>{pending.delete(run);throw error;}));
    return pending.get(run);
  };
  const record=snapshot=>snapshot?{snapshot,results:liveWatcherEntryResults(snapshot)}:null;
  const assertStored=run=>{if(isLiveWatcherMonth(run))throw new Error('Live-Ereignisse dürfen nicht als Simulation neu gespeichert werden.');};
  const facade={...stored,
    async getLivePinSnapshot(eventId){
      const event=await live.event(eventId);if(!event)return null;
      const run='live-watcher:'+berlinDateStrFor(Date.parse(event.signal_at)/1000).slice(0,7);
      return liveWatcherSnapshots([event],run)[0] ?? null;
    },
    saveRun:run=>{assertStored(run.id);return stored.saveRun(run);},
    saveEntries:(run,records)=>{assertStored(run);return stored.saveEntries(run,records);},
    saveSetups:(run,records)=>{assertStored(run);return stored.saveSetups(run,records);},
    async listRuns(){const [runs,months]=await Promise.all([stored.listRuns(),live.months()]);return [...months.map(liveWatcherRun),...runs];},
    async getRun(run){return isLiveWatcherMonth(run)?liveWatcherRun({id:run}):stored.getRun(run);},
    async listReviewMetadata(run){return isLiveWatcherMonth(run)?read(run,true):stored.listReviewMetadata(run);},
    async listResults(options={}){
      if(!isLiveWatcherMonth(options.runId))return stored.listResults(options);
      return (await read(options.runId)).flatMap(liveWatcherEntryResults).filter(row=>(!options.instrument || row.instrument===options.instrument)
        && (!options.variant || row.variant===options.variant) && (!Number.isFinite(options.from) || row.entryTime>=options.from)
        && (!Number.isFinite(options.to) || row.entryTime<options.to) && (!Number.isFinite(options.asOf) || row.entryTime<=options.asOf));
    },
    async listRunDrCounts(ids){
      const counts=await stored.listRunDrCounts(ids.filter(id=>!isLiveWatcherMonth(id)));
      for(const id of ids.filter(isLiveWatcherMonth))counts.set(id,new Set((await read(id)).map(s=>s.setupKey)).size);
      return counts;
    },
    async getEntry(run,id){return isLiveWatcherMonth(run)?record((await read(run,true)).find(s=>s.id===id && s.entry)):stored.getEntry(run,id);},
    async getSnapshot(run,id){return isLiveWatcherMonth(run)?(await facade.getEntry(run,id))?.snapshot ?? null:stored.getSnapshot(run,id);},
    async getSetupSnapshot(run,id){return isLiveWatcherMonth(run)?(await read(run)).find(s=>s.id===id) ?? null:stored.getSetupSnapshot(run,id);},
    async getRangeEntries(run,key){return isLiveWatcherMonth(run)?(await read(run)).filter(s=>s.setupKey===key && s.entry).toSorted((a,b)=>a.knownAt-b.knownAt).map(record):stored.getRangeEntries(run,key);}
  };
  return facade;
}
