import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {frozenBatchInputs} from '../scripts/batchRunInputs.mjs';
import {scanBatchInstrument} from '../scripts/batchInstrument.mjs';
it.each(['candles.json','tradeSetupRow.js'])('rejects changed frozen data or mapper code: %s',async name=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'batch-inputs-'));
 try{const file=path.join(directory,name);await writeFile(file,'[1]');const inputs=await frozenBatchInputs(directory);await inputs.seal([file]);await frozenBatchInputs(directory);await writeFile(file,'[2]');await expect(frozenBatchInputs(directory)).rejects.toThrow('Frozen batch input changed');expect(await readFile(file,'utf8')).toBe('[2]');}finally{await rm(directory,{recursive:true,force:true});}
});
it('does not scan a completed checkpoint again, including an empty source set',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'batch-empty-'));let scans=0;
 const core={scanTradeSetup2Window:async()=>{scans++;return[];},markCountertrendCandles:()=>[]};
 try{const options={core,directory,identity:{source:'empty'},input:{instrument:'GBPUSD',m5Candles:[],m1Candles:[],toTime:1}};await scanBatchInstrument(options);await scanBatchInstrument(options);expect(scans).toBe(1);expect(JSON.parse(await readFile(path.join(directory,'GBPUSD-setups.json'),'utf8'))).toEqual([]);}finally{await rm(directory,{recursive:true,force:true});}
});
