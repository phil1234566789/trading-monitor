import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {readJsonArray} from './batchJsonFiles.mjs';
import {decodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

export const PUBLICATION_READ_BATCH_SIZE=5;
function tableFor(kind){assert(['setups','entries'].includes(kind),'Unknown publication kind');return 'trade_setup_simulation_'+kind;}
const snapshotOf=(record,kind)=>kind==='entries'?record.snapshot:record;

export async function readPublicationCatalog(db,kind,runId,{includeStorage=true}={}){
 const ids=new Set(),rawIds=new Set();let offset=0;
 for(;;){
  const {data,error}=await db.from(tableFor(kind)).select(includeStorage?'id,structureStorage:snapshot->structureStorage->>version':'id')
   .eq('run_id',runId).order('id').range(offset,offset+499);
  if(error)throw error;assert(Array.isArray(data),'Invalid publication catalog response');
  if(!data.length)return {ids,rawIds};
  for(const row of data){assert(!ids.has(row.id),'Duplicate remote snapshot identity');ids.add(row.id);if(includeStorage&&!row.structureStorage)rawIds.add(row.id);}
  offset+=data.length;
 }
}

async function readRows(db,kind,runId,ids){
 const rows=new Map();if(!ids.length)return rows;
 let offset=0;
 while(rows.size<ids.length){
  const {data,error}=await db.from(tableFor(kind)).select(kind==='entries'?'id,snapshot,outcomes':'id,snapshot')
   .eq('run_id',runId).in('id',ids).order('id').range(offset,offset+PUBLICATION_READ_BATCH_SIZE-1);
  if(error)throw error;assert(Array.isArray(data),'Invalid publication snapshot response');
  if(!data.length)break;
  for(const row of data){assert(ids.includes(row.id)&&!rows.has(row.id),'Unexpected remote snapshot identity');rows.set(row.id,row);}
  offset+=data.length;
 }
 return rows;
}

async function* recordGroups(file){
 let group=[];
 for await(const record of readJsonArray(file)){group.push(record);if(group.length===PUBLICATION_READ_BATCH_SIZE){yield group;group=[];}}
 if(group.length)yield group;
}

export async function savePublicationRecords({db,runId,kind,file,existingIds=new Set(),batchSize,save,onProgress}){
 assert(Number.isInteger(batchSize)&&batchSize>=1&&batchSize<=100,'Invalid publication write batch size');
 const progress={records:0,skipped:0,written:0};let pending=[];
 async function flush(){if(!pending.length)return;await save(pending);progress.written+=pending.length;pending=[];await onProgress?.({...progress});}
 for await(const records of recordGroups(file)){
  const ids=records.map(r=>snapshotOf(r,kind).id),stored=await readRows(db,kind,runId,ids.filter(id=>existingIds.has(id)));
  for(const record of records){
   const snapshot=snapshotOf(record,kind),remote=stored.get(snapshot.id);progress.records++;
   // Nur der vollständige Originalpayload belegt einen sicheren Skip; geänderte Verläufe gehen weiter durch den RPC.
   if(remote&&isDeepStrictEqual(remote.snapshot,snapshot)&&(kind!=='entries'||isDeepStrictEqual(remote.outcomes,record.outcomes))){progress.skipped++;continue;}
   pending.push(record);if(pending.length===batchSize)await flush();
  }
  await onProgress?.({...progress});
 }
 await flush();return progress;
}

export async function verifyPublicationRecords({db,runId,directory,instruments,onProgress}){
 const progress={setups:0,entries:0,outcomes:0};
 for(const kind of ['setups','entries']){
  const ids=new Set();
  for(const instrument of instruments)for await(const records of recordGroups(path.join(directory,`${instrument}-${kind}.json`))){
   const stored=await readRows(db,kind,runId,records.map(r=>snapshotOf(r,kind).id));
   for(const record of records){
    const snapshot=snapshotOf(record,kind),remote=stored.get(snapshot.id);
    assert(!ids.has(snapshot.id),'Duplicate local snapshot identity');ids.add(snapshot.id);
    assert(remote&&isDeepStrictEqual(decodeSnapshotStructures(remote.snapshot),decodeSnapshotStructures(snapshot)),`Snapshot roundtrip failed: ${snapshot.id}`);
    if(kind==='entries'){assert(isDeepStrictEqual(remote.outcomes,record.outcomes),`Outcome roundtrip failed: ${snapshot.id}`);progress.outcomes+=record.outcomes.length;}
    progress[kind]++;
   }
   await onProgress?.({...progress});
  }
  const remote=await readPublicationCatalog(db,kind,runId,{includeStorage:false});
  assert.deepEqual(remote.ids,ids,`Publication ID set mismatch: ${kind}`);
 }
 return progress;
}
