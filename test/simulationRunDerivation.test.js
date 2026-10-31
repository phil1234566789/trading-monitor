import {it,expect} from 'vitest';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createRunDerivation,rangeDerivationLabel} from '../src/simulationRunDerivation.js';
import {mergeDerivedSetups} from '../scripts/derivedBatchRun.mjs';
const contract=()=>createRunDerivation({parentRunId:'parent',parentSetupVersion:'v23',parentEntryPattern:'v10',targetSetupVersion:'v24',targetEntryPattern:'v11',inheritedSetupKeys:['a'],recomputedSetupKeys:['b']});
it('rejects duplicate/overlapping provenance and labels true per-DR versions',()=>{
 expect(()=>createRunDerivation({...contract(),recomputedSetupKeys:['a']})).toThrow(/disjoint/i);
 const run={provenance:{derivation:contract()}};expect(rangeDerivationLabel(run,'a')).toContain('v23');expect(rangeDerivationLabel(run,'b')).toContain('v24');expect(rangeDerivationLabel(run,'unknown')).toContain('nicht belegt');expect(rangeDerivationLabel({},'a')).toBe('');
});
it('copies inherited JSON bytes, replaces every replay-group snapshot and keeps validation order',async()=>{
 const d=await mkdtemp(path.join(tmpdir(),'derived-'));try{
 const a='{"id":"a0","setupKey":"a","knownAt":1,"entry":null,"checklist":{"entryPattern":"v10"},"fact":1.2300}',old='{ "id":"b0","setupKey":"b","knownAt":2,"entry":null,"checklist":{"entryPattern":"v10"}}',fresh='{"id":"b1","setupKey":"b","knownAt":3,"entry":null,"checklist":{"entryPattern":"v11"}}';
 await writeFile(path.join(d,'parent.json'),'['+a+','+old+']');await writeFile(path.join(d,'replay.json'),'['+fresh+']');
 const audit=await mergeDerivedSetups({parentFile:path.join(d,'parent.json'),replayFile:path.join(d,'replay.json'),outputFile:path.join(d,'out.json'),derivation:contract()});
 const text=await readFile(path.join(d,'out.json'),'utf8');expect(text).toBe('['+a+','+fresh+']');expect(audit.inherited).toBe(1);expect(audit.recomputed).toBe(1);
 await writeFile(path.join(d,'replay.json'),'['+old+']');await expect(mergeDerivedSetups({parentFile:path.join(d,'parent.json'),replayFile:path.join(d,'replay.json'),outputFile:path.join(d,'out.json'),derivation:contract()})).rejects.toThrow(/version/i);expect(await readFile(path.join(d,'out.json'),'utf8')).toBe(text);
 }finally{await rm(d,{recursive:true,force:true});}
});
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
it('refuses output inside the parent before creating or overwriting any run',async()=>{
 const d=await mkdtemp(path.join(tmpdir(),'derived-guard-'));try{
 await writeFile(path.join(d,'run.json'),'original');
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/tradeSetup2Derive.mjs',import.meta.url)),`--parent=${d}`,`--output=${d}`],{encoding:'utf8',timeout:10000});
 expect(result.status).toBe(1);expect(result.stderr).toContain('outside the parent');expect(await readFile(path.join(d,'run.json'),'utf8')).toBe('original');
 }finally{await rm(d,{recursive:true,force:true});}
});
it('does not commit an incomplete or overlapping merge',async()=>{
 const d=await mkdtemp(path.join(tmpdir(),'derived-incomplete-'));try{
 const parentFile=path.join(d,'parent.json'),replayFile=path.join(d,'replay.json'),outputFile=path.join(d,'out.json');
 await writeFile(parentFile,'[{"id":"a","setupKey":"a","knownAt":1,"checklist":{"entryPattern":"v10"}}]');await writeFile(replayFile,'[]');await writeFile(outputFile,'["previous-consistent"]');
 await expect(mergeDerivedSetups({parentFile,replayFile,outputFile,derivation:contract()})).rejects.toThrow('Missing derived DR group');expect(await readFile(outputFile,'utf8')).toBe('["previous-consistent"]');
 await writeFile(replayFile,'[{"id":"a","setupKey":"b","knownAt":2,"checklist":{"entryPattern":"v11"}}]');await expect(mergeDerivedSetups({parentFile,replayFile,outputFile,derivation:contract()})).rejects.toThrow('Duplicate');
 }finally{await rm(d,{recursive:true,force:true});}
});
import {assertT82ParentReference,T82_DERIVATION_REFERENCE} from '../scripts/t82DerivationReference.mjs';
it('rejects a shortened parent entry file even when its scanner/version are unchanged',()=>{
 const reference=T82_DERIVATION_REFERENCE,parent={id:reference.id,from:reference.from,to:reference.to};
 expect(()=>assertT82ParentReference(parent,reference.hashes)).not.toThrow();
 expect(()=>assertT82ParentReference(parent,{...reference.hashes,'GBPUSD-entries.json':'changed'})).toThrow('parent identity/hash differs');
 expect(()=>assertT82ParentReference({...parent,to:parent.to+60},reference.hashes)).toThrow();
});
