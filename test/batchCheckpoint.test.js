import {it,expect,afterEach,vi} from 'vitest';import {mkdtemp,readFile,appendFile,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {openBatchCheckpoint} from '../scripts/batchCheckpoint.mjs';import * as jsonFiles from '../scripts/batchJsonFiles.mjs';
const directories=[];const identity={codeHash:'code-a',inputHash:'frozen-a'};async function directory(){const d=await mkdtemp(join(tmpdir(),'batch-checkpoint-'));directories.push(d);return d;}
afterEach(async()=>{vi.restoreAllMocks();for(const d of directories.splice(0))await rm(d,{recursive:true,force:true});});
it('commits records and Map/Set scanner state at one consistent watermark',async()=>{
 const d=await directory();const store=await openBatchCheckpoint(d,identity);store.append('snapshot','dr-a',{id:'first'});await store.commit({nextStep:3,seen:new Set(['first']),progress:new Map([['a',{next:60}]])});await store.close();
 const resumed=await openBatchCheckpoint(d,identity);expect(resumed.state).toEqual({nextStep:3,seen:new Set(['first']),progress:new Map([['a',{next:60}]])});expect(await Array.fromAsync(resumed.records())).toMatchObject([{kind:'snapshot',key:'dr-a',value:{id:'first'}}]);await resumed.close();
});
it('ignores a corrupt uncommitted tail, preserves its bytes, and resumes without duplicates',async()=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);store.append('snapshot','a',{id:'one'});await store.commit({nextStep:1});store.append('snapshot','a',{id:'uncommitted'});const tail=store.segmentFile;await store.close();await appendFile(tail,'{"broken":');const before=await readFile(tail);
 const resumed=await openBatchCheckpoint(d,identity);expect((await Array.fromAsync(resumed.records())).map(r=>r.value.id)).toEqual(['one']);resumed.append('snapshot','a',{id:'two'});await resumed.commit({nextStep:2});await resumed.close();expect(await readFile(tail)).toEqual(before);
 const third=await openBatchCheckpoint(d,identity);expect((await Array.fromAsync(third.records())).map(r=>r.value.id)).toEqual(['one','two']);expect(third.state.nextStep).toBe(2);await third.close();
});
it('retains the previous commit when the process fails between state and pointer writes',async()=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);store.append('snapshot','a',{id:'one'});await store.commit({nextStep:1});store.append('snapshot','a',{id:'two'});
 const original=jsonFiles.writeJson,spy=vi.spyOn(jsonFiles,'writeJson').mockImplementation(async(file,value)=>{if(file.endsWith('checkpoint.json'))throw new Error('simulated crash');return original(file,value);});
 await expect(store.commit({nextStep:2})).rejects.toThrow('simulated crash');spy.mockRestore();await store.close();
 const resumed=await openBatchCheckpoint(d,identity);expect(resumed.state.nextStep).toBe(1);expect((await Array.fromAsync(resumed.records())).map(r=>r.value.id)).toEqual(['one']);await resumed.close();
});
it.each([{codeHash:'different',inputHash:'frozen-a'},{codeHash:'code-a',inputHash:'different'}])('rejects changed frozen identity without modifying originals',async changed=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);await store.commit({nextStep:1});await store.close();const before=await readFile(join(d,'checkpoint.json'));await expect(openBatchCheckpoint(d,changed)).rejects.toThrow(/identity/i);expect(await readFile(join(d,'checkpoint.json'))).toEqual(before);
});
it('rejects a damaged committed record instead of silently restarting',async()=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);store.append('snapshot','a',{id:'one'});await store.commit({nextStep:1});const file=store.segmentFile;await store.close();await writeFile(file,'damaged');await expect(openBatchCheckpoint(d,identity)).rejects.toThrow(/journal/i);
});
import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {readdir} from 'node:fs/promises';
it('recovers a child-process crash and its stale lock without replaying committed results',async()=>{
 const d=await directory(),module=pathToFileURL(join(process.cwd(),'scripts/batchCheckpoint.mjs')).href;
 const source=`import {openBatchCheckpoint} from ${JSON.stringify(module)};const s=await openBatchCheckpoint(${JSON.stringify(d)},${JSON.stringify(identity)});s.append('snapshot','a',{id:'one'});await s.commit({nextStep:7});s.append('snapshot','a',{id:'lost-after-commit'});process.exit(17);`;
 const crashed=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8',timeout:10000});expect(crashed.status).toBe(17);
 const store=await openBatchCheckpoint(d,identity);expect(store.state.nextStep).toBe(7);expect((await Array.fromAsync(store.records())).map(r=>r.value.id)).toEqual(['one']);await store.close();
});
it('keeps only two internal scanner-state generations and leaves historical journals intact',async()=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);for(let n=1;n<=5;n++){store.append('history','a',{n});await store.commit({nextStep:n});}expect(store.state.nextStep).toBe(5);expect((await readdir(d)).filter(f=>/^state-\d+\.bin$/.test(f))).toHaveLength(2);expect(await Array.fromAsync(store.records())).toHaveLength(5);await store.close();
});
it('rejects another active writer and damaged committed scanner state',async()=>{
 const d=await directory(),store=await openBatchCheckpoint(d,identity);await expect(openBatchCheckpoint(d,identity)).rejects.toThrow('already active');await store.commit({nextStep:1});const stateFile=store.checkpoint.state.file;await store.close();await writeFile(join(d,stateFile),'corrupt');await expect(openBatchCheckpoint(d,identity)).rejects.toThrow('state checksum');
});
import fs from 'node:fs';
it('never publishes a partial owner file when lock preparation is interrupted',async()=>{
 const d=await directory(),original=fs.writeFileSync;
 const spy=vi.spyOn(fs,'writeFileSync').mockImplementation((file,data,...args)=>{if(typeof data==='string'&&data.includes('"token"')){original(file,'{');throw new Error('lock preparation crash');}return original(file,data,...args);});
 await expect(openBatchCheckpoint(d,identity)).rejects.toThrow('lock preparation crash');spy.mockRestore();
 await expect(readFile(join(d,'writer.lock'))).rejects.toMatchObject({code:'ENOENT'});
 const store=await openBatchCheckpoint(d,identity);await store.commit({nextStep:2});await store.close();
});
it('allows only one of two simultaneous stale-lock recoveries to become writer',async()=>{
 const d=await directory();await writeFile(join(d,'writer.lock'),JSON.stringify({pid:2147483647,token:'00000000-0000-0000-0000-000000000000'}));
 const attempts=await Promise.allSettled([openBatchCheckpoint(d,identity),openBatchCheckpoint(d,identity)]);
 const winners=attempts.filter(r=>r.status==='fulfilled');expect(winners).toHaveLength(1);
 expect(attempts.filter(r=>r.status==='rejected')[0].reason.message).toMatch(/already active/);
 await winners[0].value.commit({nextStep:9});await winners[0].value.close();
 const store=await openBatchCheckpoint(d,identity);expect(store.state.nextStep).toBe(9);await store.close();
});
