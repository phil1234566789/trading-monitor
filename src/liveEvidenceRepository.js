import {evidenceReferences,hydrateEvidence} from '../services/setup2/evidencePayload.js';
import {fetchAllRows} from './dbReadPaging.js';
import {selectLiveEvidenceIndex} from './liveEvidenceIndex.js';
import {liveMonthBounds,liveSourceMonth} from './liveWatcherMonth.js';
import {simulationReviewMetadata,simulationReviewMetadataProjection} from './simulationReviewMetadata.js';
const ROW_FIELDS='id,snapshot_id,instrument,setup_key,known_at,evaluated_through,captured_at,configuration_id,evaluation_mode';
const FULL_FIELDS=ROW_FIELDS+',snapshot,observation';
const INDEX_FIELDS=ROW_FIELDS+',direction,entry_id,dr_version,dr_status,has_observation,has_history';
const M1_FIELDS=['evaluatedAt','instrument','entryPattern','trends','currentTrend','details','detailStatuses','sweepReaction','sweepPresentation','structureStart','conditions','retest','fvg','choch','bos'];
const MANIFEST_PAGE_SIZE=64;
function project(row,index){
 const {snapshot,observation}=row;
 const m1Check=Object.fromEntries(M1_FIELDS.map(key=>[key,snapshot.m1Check?.[key]]).filter(([,value])=>value!=null));
 return {...Object.fromEntries(ROW_FIELDS.split(',').map(key=>[key,row[key]])),direction:snapshot.direction,hasHistory:index?.has_history ?? observation.checklistHistory!=null,hasObservation:index?.has_observation ?? Object.values(observation).some(value=>value!=null),
  ...simulationReviewMetadataProjection({...snapshot,m1Check}),savedRangeCourse:observation.rangeCourse,
  savedPriceObservation:observation.priceObservation,savedCoverage:observation.coverage,observationVersion:observation.checklistHistory?.version};
}
function metadata(row,runId){
 return {...row,hasHistory:row.hasHistory ?? !!row.observationVersion,hasObservation:row.hasObservation ?? !!(row.savedRangeCourse || row.savedPriceObservation || row.savedCoverage || row.observationVersion),snapshot:simulationReviewMetadata({...row,id:row.snapshot_id,run_id:runId}),
  observation:{rangeCourse:row.savedRangeCourse,priceObservation:row.savedPriceObservation,coverage:row.savedCoverage}};
}
export function createLiveEvidenceRepository(db){
 const months=new Map(),full=new Map(),configs=new Map(),payloads=new Map();
 async function pages(build){const {data,error}=await fetchAllRows(build);if(error)throw error;return data;}
 async function hydrate(values){
  let missing=[...values.reduce((refs,value)=>evidenceReferences(value,refs),new Set())].filter(id=>!payloads.has(id));
  while(missing.length){
   const loaded=[];
   for(let i=0;i<missing.length;i+=100)loaded.push(...await pages((from,to)=>db.from('setup2_live_payloads').select('id,payload').in('id',missing.slice(i,i+100)).order('id').range(from,to)));
   const byId=new Map(loaded.map(row=>[row.id,row.payload]));
   for(const id of missing){if(!byId.has(id))throw new Error('Gespeicherter Live-Beleg fehlt: '+id);payloads.set(id,byId.get(id));}
   missing=[...loaded.reduce((refs,row)=>evidenceReferences(row.payload,refs),new Set())].filter(id=>!payloads.has(id));
  }
  return values.map(value=>hydrateEvidence(value,payloads));
 }
 return {
  async snapshotRecords(snapshotId){
   const rows=await pages((from,to)=>db.from('setup2_live_snapshots').select('id').eq('snapshot_id',snapshotId).order('id').range(from,to));
   return this.records(rows.map(row=>row.id));
  },
  async locate(snapshotId){
   const {data,error}=await db.from('setup2_live_snapshots').select('setup_key').eq('snapshot_id',snapshotId).order('id').limit(1);
   if(error)throw error;return data?.[0]?.setup_key ?? null;
  },
  async rangeKeys(runId){
   const bounds=liveMonthBounds(liveSourceMonth(runId));
   const rows=await pages((from,to)=>db.from('setup2_live_snapshot_index').select('setup_key').gte('evaluated_through',bounds.from).lt('known_at',bounds.to).order('captured_at').order('id').range(from,to));
   return rows.map(row=>row.setup_key);
  },
  async earliest(mode){let query=db.from('setup2_live_snapshot_index').select('known_at');if(mode)query=query.eq('evaluation_mode',mode);const {data,error}=await query.order('known_at').limit(1);if(error)throw error;return data?.[0]?.known_at;},
  async metadata(runId,setupKey){
   const month=liveSourceMonth(runId),bounds=liveMonthBounds(month);
   const scope=JSON.stringify([month,setupKey ?? null]);
   let cache=months.get(scope);if(!cache){cache={rows:new Map(),index:new Map(),keys:new Set(),cursor:null,pending:null};months.set(scope,cache);}
   if(cache.pending){await cache.pending;return selectLiveEvidenceIndex([...cache.index.values()]).map(row=>metadata(cache.rows.get(row.id),runId));}
   cache.pending=(async()=>{
    // Nur der kleine Index wird vollständig gelesen; Originalmanifeste folgen für die tatsächlich sichtbaren DR-Eckpunkte.
    const rows=await pages((from,to)=>{
     let query=db.from('setup2_live_snapshot_index').select(INDEX_FIELDS).gte('evaluated_through',bounds.from).lt('known_at',bounds.to).order('captured_at').order('id');
     if(setupKey)query=query.eq('setup_key',setupKey);
     if(cache.cursor)query=query.or(`captured_at.gt.${cache.cursor.at},and(captured_at.eq.${cache.cursor.at},id.gt.${cache.cursor.id})`);
     return query.range(from,to);
    });
    const newKeys=[...new Set(rows.map(row=>row.setup_key))].filter(key=>!cache.keys.has(key));
    for(let i=0;i<newKeys.length;i+=100){
     const keys=newKeys.slice(i,i+100);
     const context=await pages((from,to)=>db.from('setup2_live_snapshot_index').select(INDEX_FIELDS).in('setup_key',keys).lt('known_at',bounds.from).order('captured_at').order('id').range(from,to));
     for(const row of context)cache.index.set(row.id,row);
     keys.forEach(key=>cache.keys.add(key));
    }
    for(const row of rows)cache.index.set(row.id,row);
    const selected=selectLiveEvidenceIndex([...cache.index.values()]),missing=selected.filter(row=>!cache.rows.has(row.id)).map(row=>row.id);
    for(let i=0;i<missing.length;i+=MANIFEST_PAGE_SIZE){
     const ids=missing.slice(i,i+MANIFEST_PAGE_SIZE);
     const originals=await pages((from,to)=>db.from('setup2_live_snapshots').select(FULL_FIELDS).in('id',ids).order('id').range(from,to));
     if(originals.length!==ids.length)throw new Error('Gespeicherter Original-Liveprüfstand fehlt.');
     for(const row of await hydrate(originals.map(row=>project(row,cache.index.get(row.id)))))cache.rows.set(row.id,row);
    }
    if(rows.length)cache.cursor={at:rows.at(-1).captured_at,id:rows.at(-1).id};
    return selectLiveEvidenceIndex([...cache.index.values()]).map(row=>metadata(cache.rows.get(row.id),runId));
   })().finally(()=>{cache.pending=null;});
   return cache.pending;
  },
  async records(ids){
   const missing=[...new Set(ids)].filter(id=>!full.has(id));
   for(let i=0;i<missing.length;i+=100){
    const rows=await pages((from,to)=>db.from('setup2_live_snapshots').select(FULL_FIELDS).in('id',missing.slice(i,i+100)).order('id').range(from,to));
    for(const row of await hydrate(rows))full.set(row.id,row);
   }
   return ids.map(id=>full.get(id)).filter(Boolean);
  },
  async record(id){return (await this.records([id]))[0] ?? null;},
  async configuration(id){
   if(!configs.has(id))configs.set(id,(async()=>{const {data,error}=await db.from('setup2_live_configurations').select('id,configuration,captured_at').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Gespeicherte Live-Konfiguration fehlt.');return data.configuration;})().catch(error=>{configs.delete(id);throw error;}));
   return configs.get(id);
  }
 };
}
