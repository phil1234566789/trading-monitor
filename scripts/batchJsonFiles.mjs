import {mkdir,open,rename} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export async function atomicWriteFile(file,data){
 await mkdir(path.dirname(file),{recursive:true});
 const handle=await open(file+'.tmp','w');
 try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}
 // Windows kann den Zielnamen während einer Fortschrittsanzeige kurz sperren.
 for(let attempt=0;;attempt++){
  try{await rename(file+'.tmp',file);break;}
  catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=9)throw error;await delay(100);}
 }
}

export function writeJsonArray(file,values){
 async function* records(){let first=true,index=0,chunk='[';for await(const row of values){const key=String(index++),encoded=JSON.stringify({[key]:row});chunk+=(first?'':',')+(encoded==='{}'?'null':encoded.slice(key.length+4,-1));if(first||chunk.length>=65536){yield chunk;chunk='';}first=false;}yield chunk+']';}
 return atomicWriteFile(file,records());
}
export function writeJson(file,value){
 // Ein Jahresergebnis kann Nodes Einzelstringlimit übersteigen; ein Datensatz nicht.
 return Array.isArray(value)&&typeof value.toJSON!=='function'?writeJsonArray(file,value):atomicWriteFile(file,JSON.stringify(value));
}

export async function* readJsonArray(file,{highWaterMark=65536}={}){
 let opened=false,ended=false,active=false,depth=0,quoted=false,escaped=false,expect='first',parts=[];
 for await(const text of createReadStream(file,{encoding:'utf8',highWaterMark})){
  let start=active?0:-1;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(!opened){if(/\s/.test(c))continue;if(c!=='[')throw new Error('Expected JSON array');opened=true;continue;}
   if(ended){if(!/\s/.test(c))throw new Error('Data after JSON array');continue;}
   if(!active){
    if(/\s/.test(c))continue;
    if(c===']'){if(expect==='value')throw new Error('Trailing JSON comma');ended=true;continue;}
    if(expect==='comma'){if(c!==',')throw new Error('Expected JSON comma');expect='value';continue;}
    active=true;start=i;
   }
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(depth===0&&(c===','||c===']')){
    parts.push(text.slice(start,i));yield JSON.parse(parts.join(''));parts=[];active=false;start=-1;expect=c===','?'value':'comma';if(c===']')ended=true;continue;
   }
   if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
  }
  if(active&&start>=0)parts.push(text.slice(start));
 }
 if(!opened||!ended||active||quoted||depth)throw new Error('Incomplete JSON array');
}
