import path from 'node:path';
import {writeJsonArray,readJsonArray} from './batchJsonFiles.mjs';

export async function finalizeBatchResults({store,core,instrument,directory,m5Candles,m1Candles,to,sessionConfigs=[]}){
 const groups=new Map(),snapshots=[];
 for await(const record of store.records()){
  if(!groups.has(record.key))groups.set(record.key,{snapshots:[],history:[]});
  const group=groups.get(record.key);
  if(record.kind==='snapshot'){group.snapshots.push(record.ref);snapshots.push({key:record.key,ref:record.ref,entry:!!record.value.entry,id:record.value.id});}
  else if(record.kind==='history')group.history.push(record.ref);
 }
 const m5=core.markCountertrendCandles(m5Candles,instrument,sessionConfigs);
 let cachedKey,cached;
 async function groupResults(key){
  if(cachedKey===key)return cached;
  const group=groups.get(key),rows=[],history=[];
  for(const ref of group.snapshots)rows.push((await store.readRecord(ref)).value);
  for(const ref of group.history)history.push((await store.readRecord(ref)).value);
  cachedKey=key;cached=new Map(core.completeCountertrendSnapshots(rows,m5,to-1,()=>history).map(s=>[s.id,s]));return cached;
 }
 async function* results(entry){
  for(const ref of snapshots){if(ref.entry!==entry)continue;const snapshot=(await groupResults(ref.key)).get(ref.id);
   if(!entry){yield snapshot;continue;}
   yield{snapshot,outcomes:['wide','narrow'].map(variant=>core.evaluateSimulation({entry:snapshot.entry,variant,candles:m1Candles,evaluatedAt:to,target1:snapshot.checklist.setup.primary.targetSelection?.target1?.price,target2:snapshot.checklist.setup.primary.targetSelection?.target2?.price??null}))};
  }
 }
 await writeJsonArray(path.join(directory,`${instrument}-setups.json`),results(false));
 await writeJsonArray(path.join(directory,`${instrument}-entries.json`),results(true));
 return{setups:snapshots.filter(s=>!s.entry).length,entries:snapshots.filter(s=>s.entry).length};
}

export async function publishBatchRecords(repository,method,runId,file,batchSize=100){
 let batch=[];for await(const row of readJsonArray(file)){batch.push(row);if(batch.length===batchSize){await repository[method](runId,batch);batch=[];}}
 if(batch.length)await repository[method](runId,batch);
}
