import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {readJsonArray,writeJsonArray,writeJson} from './batchJsonFiles.mjs';
import {fileHash} from './batchRunInputs.mjs';
import {encodeSnapshotStructures,decodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';

export async function openPublicationPostgres(modulePath=process.env.SIMULATION_PGLITE_MODULE){
 // Derselbe lokale PostgreSQL/WASM-Auditor wie beim T82-Vorflug, ohne Schemaänderung remote.
 const moduleUrl=modulePath?pathToFileURL(path.resolve(modulePath)).href:new URL('../.debug/simulation-postgres/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).href;
 const {PGlite}=await import(moduleUrl).catch(error=>{throw new Error('Local PostgreSQL auditor required: set SIMULATION_PGLITE_MODULE',{cause:error});});
 const db=new PGlite();
 return {close:()=>db.close(),async measure(value){const {rows:[row]}=await db.query('SELECT pg_column_size($1::jsonb) AS bytes',[JSON.stringify(value)]);return row.bytes;}};
}

export async function prepareSimulationPublication({directory,manifest,run,rawIds={},compactStructures=true,measureJsonbSize,onProgress}){
 const output=path.join(directory,'.publication'),inputs={},outputs={};await mkdir(output,{recursive:true});
 const names=manifest.instruments.flatMap(instrument=>['setups','entries'].map(kind=>`${instrument}-${kind}.json`));
 for(const name of ['run.json','manifest.json',...names])inputs[name]=await fileHash(path.join(directory,name));
 assert.deepEqual(JSON.parse(await readFile(path.join(directory,'run.json'),'utf8')),run,'Run metadata changed before preflight');
 assert.deepEqual(JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8')),manifest,'Manifest changed before preflight');
 const audit={runId:run.id,records:0,outcomes:0,maxSnapshotBytes:0,maxOutcomeBytes:0,runBytes:0,files:{}};
 async function size(value,limit,id){const bytes=await measureJsonbSize(value);assert(Number.isInteger(bytes)&&bytes>=0&&bytes<=limit,`PostgreSQL JSONB size exceeds ${limit}: ${id} (${bytes})`);return bytes;}
 audit.runBytes=await size(run,1000000,run.id);
 const runningRun={...run,status:'running',progress:{phase:'publish'}};
 audit.runningRunBytes=await size(runningRun,1000000,run.id+' running');
 for(const instrument of manifest.instruments)for(const kind of ['setups','entries']){
  const name=`${instrument}-${kind}.json`;let count=0;
  async function* records(){for await(const record of readJsonArray(path.join(directory,name))){
   const snapshot=kind==='entries'?record.snapshot:record;assert(snapshot?.id,'Missing snapshot identity');
   const original=decodeSnapshotStructures(snapshot);
   // Bereits persistierte rohe Snapshots sind unveränderlich; neue teilen ihre Belegstrukturen.
   const stored=rawIds[kind]?.has(snapshot.id)?original:compactStructures?encodeSnapshotStructures(snapshot):snapshot;
   assert.deepEqual(decodeSnapshotStructures(stored),original,`Lossy snapshot storage: ${snapshot.id}`);
   audit.maxSnapshotBytes=Math.max(audit.maxSnapshotBytes,await size(stored,1000000,snapshot.id));
   if(kind==='entries'){audit.maxOutcomeBytes=Math.max(audit.maxOutcomeBytes,await size(record.outcomes,100000,snapshot.id+' outcomes'));audit.outcomes++;}
   audit.records++;count++;if(audit.records%25===0)await onProgress?.({...audit,file:name,count});
   yield kind==='entries'?{...record,snapshot:stored}:stored;
  }}
  await writeJsonArray(path.join(output,name),records());audit.files[name]=count;outputs[name]=await fileHash(path.join(output,name));
 }
 async function verify(){for(const [name,expected]of Object.entries(inputs))assert.equal(await fileHash(path.join(directory,name)),expected,`Publication input changed: ${name}`);for(const [name,expected]of Object.entries(outputs))assert.equal(await fileHash(path.join(output,name)),expected,`Publication transport changed: ${name}`);}
 await verify();await writeJson(path.join(output,'preflight.json'),{...audit,inputHashes:inputs,transportHashes:outputs});
 return {directory:output,audit,verify,runningRun};
}
