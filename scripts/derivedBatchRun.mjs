import {createHash} from 'node:crypto';
import {atomicWriteFile,readJsonArray} from './batchJsonFiles.mjs';
export async function mergeDerivedSetups({parentFile,replayFile,outputFile,derivation}){
 const inherited=new Set(derivation.inheritedSetupKeys),recomputed=new Set(derivation.recomputedSetupKeys),seen=new Set(),groups=new Set(),parentGroups=new Set(),audit={inherited:0,recomputed:0,inheritedSnapshotHashes:{}};
 async function* records(file,mode){
  let previous=-Infinity;
  for await(const text of readJsonArray(file,{raw:true})){
   const value=JSON.parse(text),key=value.setupKey;
   if(mode==='inherited'&&!inherited.has(key)){if(!recomputed.has(key))throw new Error('Parent group outside derivation');continue;}
   if(mode==='recomputed'&&!recomputed.has(key))throw new Error('Replay group outside derivation');
   if(value.entry||value.checklist?.entryPattern!==(mode==='inherited'?derivation.parentEntryPattern:derivation.targetEntryPattern))throw new Error('Invalid derived snapshot version');
   if(!Number.isFinite(value.knownAt)||value.knownAt<previous)throw new Error('Derived snapshots must be chronological');previous=value.knownAt;
   yield {text,value,mode};
  }
 }
 async function* merged(){
  const left=records(parentFile,'inherited')[Symbol.asyncIterator](),right=records(replayFile,'recomputed')[Symbol.asyncIterator]();let a=await left.next(),b=await right.next(),first=true;
  try{yield '[';
   while(!a.done||!b.done){
    const chooseLeft=b.done||!a.done&&(a.value.value.knownAt<=b.value.value.knownAt),row=chooseLeft?a.value:b.value;
    if(!row.value.id||seen.has(row.value.id))throw new Error('Duplicate derived snapshot');seen.add(row.value.id);groups.add(row.value.setupKey);
    if(row.mode==='inherited'){parentGroups.add(row.value.setupKey);audit.inheritedSnapshotHashes[row.value.id]=createHash('sha256').update(row.text).digest('hex');}
    audit[row.mode]++;yield(first?'':',')+row.text;first=false;
    if(chooseLeft)a=await left.next();else b=await right.next();
   }
   if(groups.size!==inherited.size+recomputed.size||parentGroups.size!==inherited.size)throw new Error('Missing derived DR group');
   yield ']';
  }finally{await left.return?.();await right.return?.();}
 }
 // Die Original-JSON-Texte bleiben unveraendert, auch Dezimalschreibweisen und Versionsfelder.
 await atomicWriteFile(outputFile,merged());return audit;
}
