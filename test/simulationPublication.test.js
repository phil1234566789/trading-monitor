import {it,expect} from 'vitest';
import {mkdtemp,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {writeJson,readJsonArray} from '../scripts/batchJsonFiles.mjs';
import {prepareSimulationPublication} from '../scripts/simulationPublication.mjs';
import {decodeSnapshotStructures} from '../src/tradeSetupSnapshotStorage.js';
async function fixture(rows){const directory=await mkdtemp(path.join(tmpdir(),'simulation-publication-'));await writeJson(path.join(directory,'run.json'),{id:'test'});await writeJson(path.join(directory,'manifest.json'),{instruments:['GBPUSD']});await writeJson(path.join(directory,'GBPUSD-setups.json'),rows);await writeJson(path.join(directory,'GBPUSD-entries.json'),[]);return directory;}
it('fails the entire preflight on the last PostgreSQL-oversized record, without changing sources',async()=>{
 const rows=[{id:'first'},{id:'last',tooLarge:true}],directory=await fixture(rows),before=await readFile(path.join(directory,'GBPUSD-setups.json'),'utf8');let measured=0;
 await expect(prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},measureJsonbSize:async value=>{measured++;return value.tooLarge?1000001:100;}})).rejects.toThrow('last');
 expect(measured).toBe(4);expect(await readFile(path.join(directory,'GBPUSD-setups.json'),'utf8')).toBe(before);
 await expect(stat(path.join(directory,'.publication','preflight.json'))).rejects.toThrow();
});
it.each([['run.json',{id:'changed'},'Run metadata'],['manifest.json',{instruments:['EURUSD']},'Manifest']])('rejects changed %s before accepting older parsed metadata',async(file,value,message)=>{
 const directory=await fixture([]);await writeJson(path.join(directory,file),value);let measured=0;
 await expect(prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},measureJsonbSize:async()=>{measured++;return 100;}})).rejects.toThrow(message);
 expect(measured).toBe(0);
});
it('measures and returns the exact initial running payload',async()=>{
 const directory=await fixture([]);
 await expect(prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},measureJsonbSize:async value=>value.status==='running'?1000001:100})).rejects.toThrow('test running');
 const prepared=await prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},measureJsonbSize:async()=>100});
 expect(prepared.runningRun).toEqual({id:'test',status:'running',progress:{phase:'publish'}});
});
it('automatically shares structures, preserves already raw rows, and audits both outcome variants',async()=>{
 const structure={bars:Array.from({length:500},(_,time)=>({time,price:1.23}))},snapshot=id=>({id,dealingRange:{status:'validated'},checklist:{structure,entryPattern:'v10'},m1Check:{structure}}),rows=[snapshot('raw'),snapshot('compact')],directory=await fixture(rows);
 const entry={snapshot:snapshot('entry'),outcomes:[{variant:'wide'},{variant:'narrow'}]};await writeJson(path.join(directory,'GBPUSD-entries.json'),[entry]);
 const prepared=await prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},rawIds:{setups:new Set(['raw'])},measureJsonbSize:async()=>100});
 const stored=[];for await(const row of readJsonArray(path.join(prepared.directory,'GBPUSD-setups.json')))stored.push(row);
 expect(stored[0]).toEqual(rows[0]);expect(stored[1].structureStorage).toBeTruthy();expect(stored.map(decodeSnapshotStructures)).toEqual(rows);
 expect(prepared.audit.records).toBe(3);expect(prepared.audit.outcomes).toBe(1);await prepared.verify();
 await writeJson(path.join(directory,'GBPUSD-entries.json'),[]);await expect(prepared.verify()).rejects.toThrow('changed');
});
it('checks PostgreSQL outcome-array size before returning any publication',async()=>{
 const directory=await fixture([]);await writeJson(path.join(directory,'GBPUSD-entries.json'),[{snapshot:{id:'entry'},outcomes:[{variant:'wide'},{variant:'narrow'}]}]);
 await expect(prepareSimulationPublication({directory,manifest:{instruments:['GBPUSD']},run:{id:'test'},measureJsonbSize:async value=>Array.isArray(value)?100001:100})).rejects.toThrow('entry outcomes');
 await expect(stat(path.join(directory,'.publication','preflight.json'))).rejects.toThrow();
});
