import fs from 'node:fs';
import {mkdir,readFile,readdir,unlink,open} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {isDeepStrictEqual} from 'node:util';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {atomicWriteFile,writeJson} from './batchJsonFiles.mjs';

const VERSION='batch-checkpoint-v1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function json(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function lock(directory){
 const file=path.join(directory,'writer.lock'),owner={pid:process.pid,token:randomUUID()};
 for(;;){
  try{const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(owner));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}break;}
  catch(error){
   if(error.code!=='EEXIST')throw error;
   const previous=await json(file);if(!Number.isSafeInteger(previous?.pid)||previous.pid<=0)throw new Error('Invalid batch writer lock');
   let alive=true;try{process.kill(previous.pid,0);}catch(probe){if(probe.code==='ESRCH')alive=false;else throw probe;}
   if(alive)throw new Error(`Batch writer already active: ${previous.pid}`);
   await unlink(file);
  }
 }
 return async()=>{const current=await json(file);if(current?.token===owner.token)await unlink(file);};
}
async function verifyJournal(directory,record){
 if(!/^journal-[0-9a-f-]+\.ndjson$/.test(record.file)||!Number.isSafeInteger(record.bytes)||record.bytes<0)throw new Error('Invalid batch journal reference');
 const file=path.join(directory,record.file),stat=await fs.promises.stat(file);
 if(stat.size<record.bytes)throw new Error('Committed batch journal was truncated');
 const hash=createHash('sha256');if(record.bytes)for await(const bytes of fs.createReadStream(file,{end:record.bytes-1}))hash.update(bytes);
 if(hash.digest('hex')!==record.hash)throw new Error('Committed batch journal checksum mismatch');
}

export async function openBatchCheckpoint(directory,identity){
 await mkdir(directory,{recursive:true});const release=await lock(directory);
 try{
  let checkpoint=await json(path.join(directory,'checkpoint.json'));
  if(checkpoint&&(checkpoint.version!==VERSION||!isDeepStrictEqual(checkpoint.identity,identity)))throw new Error('Batch checkpoint identity differs from frozen inputs/code');
  checkpoint??={version:VERSION,identity,generation:0,journals:[],state:null};
  for(const record of checkpoint.journals)await verifyJournal(directory,record);
  let state=null;
  if(checkpoint.state){
   if(!/^state-\d+\.bin$/.test(checkpoint.state.file))throw new Error('Invalid batch state reference');
   const bytes=await readFile(path.join(directory,checkpoint.state.file));
   if(digest(bytes)!==checkpoint.state.hash)throw new Error('Batch scanner state checksum mismatch');
   state=deserialize(bytes);
  }
  const previousJournals=checkpoint.journals,file='journal-'+randomUUID()+'.ndjson',segmentFile=path.join(directory,file),fd=fs.openSync(segmentFile,'wx'),hash=createHash('sha256');
  let written=0,closed=false;
  const append=(kind,key,value)=>{
   if(closed)throw new Error('Batch checkpoint writer is closed');
   const data=Buffer.from(JSON.stringify({kind,key,value})+'\n'),offset=written;
   let at=0;while(at<data.length)at+=fs.writeSync(fd,data,at,data.length-at);
   hash.update(data);written+=data.length;return{file,offset,bytes:data.length};
  };
  const commit=async value=>{
   if(closed)throw new Error('Batch checkpoint writer is closed');
   // Erst Ergebnisbytes, dann Zustand und zuletzt den gemeinsamen Zeiger veröffentlichen.
   fs.fsyncSync(fd);
   const generation=checkpoint.generation+1,stateFile=`state-${generation}.bin`,bytes=serialize(value);
   await atomicWriteFile(path.join(directory,stateFile),bytes);
   const next={version:VERSION,identity,generation,journals:[...previousJournals,...(written?[{file,bytes:written,hash:hash.copy().digest('hex')}]:[])],state:{file:stateFile,hash:digest(bytes),bytes:bytes.length}};
   if(checkpoint.state)await writeJson(path.join(directory,'checkpoint.previous.json'),checkpoint);
   await writeJson(path.join(directory,'checkpoint.json'),next);
   const keep=new Set([next.state.file,checkpoint.state?.file]);checkpoint=next;state=deserialize(bytes);
   // Alte Ergebnisse/Journale bleiben erhalten; nur überholte interne Zustandskopien entfallen.
   for(const name of await readdir(directory))if(/^state-\d+\.bin$/.test(name)&&!keep.has(name))await unlink(path.join(directory,name));
  };
  async function* records(){
   for(const part of checkpoint.journals){
    if(!part.bytes)continue;let offset=0;
    const stream=fs.createReadStream(path.join(directory,part.file),{end:part.bytes-1,encoding:'utf8'}),lines=createInterface({input:stream,crlfDelay:Infinity});
    try{for await(const line of lines){const bytes=Buffer.byteLength(line)+1;if(offset+bytes>part.bytes)throw new Error('Incomplete committed batch journal line');yield{...JSON.parse(line),ref:{file:part.file,offset,bytes}};offset+=bytes;}}
    finally{lines.close();stream.destroy();}
    if(offset!==part.bytes)throw new Error('Incomplete committed batch journal');
   }
  }
  const readRecord=async ref=>{
   const part=checkpoint.journals.find(p=>p.file===ref.file);
   if(!part||!Number.isSafeInteger(ref.offset)||!Number.isSafeInteger(ref.bytes)||ref.offset<0||ref.bytes<1||ref.offset+ref.bytes>part.bytes)throw new Error('Invalid committed record reference');
   const handle=await open(path.join(directory,part.file),'r'),buffer=Buffer.alloc(ref.bytes);
   try{let at=0;while(at<buffer.length){const {bytesRead}=await handle.read(buffer,at,buffer.length-at,ref.offset+at);if(!bytesRead)throw new Error('Truncated committed record');at+=bytesRead;}}
   finally{await handle.close();}
   return JSON.parse(buffer.toString('utf8'));
  };
  return{get state(){return state;},segmentFile,append,commit,records,readRecord,get checkpoint(){return checkpoint;},async close(){if(!closed){closed=true;fs.closeSync(fd);await release();}}};
 }catch(error){await release();throw error;}
}
