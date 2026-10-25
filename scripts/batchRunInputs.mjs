import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {writeJson} from './batchJsonFiles.mjs';
export async function fileHash(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function frozenBatchInputs(directory){
 const file=path.join(directory,'input-files.json');let inputs={};
 try{inputs=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 async function verify(){for(const [name,expected] of Object.entries(inputs))if(await fileHash(name)!==expected)throw new Error(`Frozen batch input changed: ${name}`);}
 await verify();
 return{verify,async seal(files){await verify();for(const name of files)inputs[path.resolve(name)]=await fileHash(name);await writeJson(file,inputs);return Object.fromEntries(files.map(name=>[path.resolve(name),inputs[path.resolve(name)]]));}};
}
