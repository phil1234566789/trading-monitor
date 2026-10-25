import {it,expect} from 'vitest';import {serialize,deserialize} from 'node:v8';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';import {buildHistoricalDailyAnchors} from '../src/tradeSetup2Anchors.js';import {setup1RecognitionTime} from '../src/setup1RecognitionTime.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';import minutes from './fixtures/gbpusd-m1-entry-pattern1-97.json';
const setup=fixture.setups[0],at=setup1RecognitionTime(setup),input={instrument:'GBPUSD',tradeSetups:[setup],dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),m5Candles:fixture.m5Candles,h1Candles:fixture.h1Candles,m1Candles:minutes,sessionConfigs:sessions.sessions,tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},fromTime:at,toTime:Math.floor(at/86400)*86400+12*3600,checkpointIdentity:'frozen-reference-97',onSnapshot:()=>{}};
const clone=value=>deserialize(serialize(value));
it('resumes after a complete outer step with identical entries and history, without replaying earlier steps',async()=>{
 const baseline=[],history=[];await scanTradeSetup2Window({...input,onSnapshot:s=>baseline.push(structuredClone(s)),onHistory:(key,entry)=>history.push({key,entry:structuredClone(entry)})});
 expect(baseline.filter(s=>s.entry)).toHaveLength(2);
 const actual=[],changes=[],abort=new AbortController();let checkpoint,rowsAtCommit=0,changesAtCommit=0;
 await expect(scanTradeSetup2Window({...input,collectSnapshots:false,signal:abort.signal,onSnapshot:s=>actual.push(structuredClone(s)),onHistory:(key,entry)=>changes.push({key,entry:structuredClone(entry)}),onCheckpoint:async(progress,getState)=>{if(progress.completed===3){checkpoint=clone(getState());rowsAtCommit=actual.length;changesAtCommit=changes.length;abort.abort();}}})).rejects.toMatchObject({name:'AbortError'});
 expect(checkpoint.nextStep).toBe(3);actual.length=rowsAtCommit;changes.length=changesAtCommit;const progress=[];
 await scanTradeSetup2Window({...input,collectSnapshots:false,resumeState:checkpoint,onProgress:p=>progress.push(p),onSnapshot:s=>actual.push(structuredClone(s)),onHistory:(key,entry)=>changes.push({key,entry:structuredClone(entry)})});
 expect(progress[0].completed).toBe(4);expect(actual).toEqual(baseline);expect(changes).toEqual(history);expect(new Set(actual.map(s=>s.id)).size).toBe(actual.length);
 expect(JSON.stringify(checkpoint)).not.toContain('h1Candles');expect(JSON.stringify(checkpoint)).not.toContain('m5Candles');
},90000);
it('rejects changed scan identities and incompatible windows',async()=>{
 let state;await expect(scanTradeSetup2Window({...input,collectSnapshots:false,onCheckpoint:async(p,getState)=>{state=clone(getState());throw new Error('stop');}})).rejects.toThrow('stop');
 await expect(scanTradeSetup2Window({...input,collectSnapshots:false,resumeState:state,checkpointIdentity:'changed'})).rejects.toThrow(/checkpoint/i);
 await expect(scanTradeSetup2Window({...input,collectSnapshots:false,resumeState:state,toTime:input.toTime-60})).rejects.toThrow(/checkpoint/i);
},30000);
it('persists the first real execution and resumes the next entry search without duplicating it',async()=>{
 const baseline=[];await scanTradeSetup2Window({...input,onSnapshot:s=>baseline.push(structuredClone(s))});
 const found=[],abort=new AbortController();let state,savedRows=0;
 await expect(scanTradeSetup2Window({...input,collectSnapshots:false,signal:abort.signal,onSnapshot:s=>found.push(structuredClone(s)),onCheckpoint:async(p,getState)=>{if(found.some(s=>s.entry)){state=clone(getState());savedRows=found.length;abort.abort();}}})).rejects.toMatchObject({name:'AbortError'});
 expect(state.entryCount).toBe(1);expect(state.entries).toHaveLength(1);expect(state.searchThrough.length).toBeGreaterThan(0);found.length=savedRows;
 await scanTradeSetup2Window({...input,collectSnapshots:false,resumeState:state,onSnapshot:s=>found.push(structuredClone(s))});
 expect(found).toEqual(baseline);expect(found.filter(s=>s.entry)).toHaveLength(2);
},90000);
import {mkdtemp,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import * as scanCore from '../src/tradeSetup2Scan.js';import {evaluateSimulation} from '../src/tradeSetupSimulation.js';import {openBatchCheckpoint} from '../scripts/batchCheckpoint.mjs';import {finalizeBatchResults} from '../scripts/batchScanResults.mjs';
it('recovers journal-backed results and completes identical snapshots and outcomes after interruption',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'batch-reference-'));
 let store;
 try{
  const baseline=await scanTradeSetup2Window(input),core={...scanCore,evaluateSimulation};
  store=await openBatchCheckpoint(directory,{source:'fixture97'});
  const abort=new AbortController();
  const callbacks=()=>({collectSnapshots:false,onSnapshot:s=>store.append('snapshot',s.setupKey,s),onHistory:(key,entry)=>store.append('history',key,entry),onCheckpoint:async(p,getState)=>{await store.commit(getState());if(store.state.entryCount===1)abort.abort();}});
  await expect(scanTradeSetup2Window({...input,...callbacks(),signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});
  await store.close();store=await openBatchCheckpoint(directory,{source:'fixture97'});
  await scanTradeSetup2Window({...input,...callbacks(),resumeState:store.state});
  await finalizeBatchResults({store,core,instrument:'GBPUSD',directory,m5Candles:input.m5Candles,m1Candles:input.m1Candles,to:input.toTime+1,sessionConfigs:input.sessionConfigs});
  const setups=JSON.parse(await readFile(path.join(directory,'GBPUSD-setups.json'),'utf8'));
  const entries=JSON.parse(await readFile(path.join(directory,'GBPUSD-entries.json'),'utf8'));
  expect(setups).toEqual(baseline.filter(s=>!s.entry));expect(entries.map(r=>r.snapshot)).toEqual(baseline.filter(s=>s.entry));
  for(const record of entries)expect(record.outcomes).toEqual(['wide','narrow'].map(variant=>evaluateSimulation({entry:record.snapshot.entry,variant,candles:input.m1Candles,evaluatedAt:input.toTime+1,target1:record.snapshot.checklist.setup.primary.targetSelection?.target1?.price,target2:record.snapshot.checklist.setup.primary.targetSelection?.target2?.price??null})));
  let replayed=0;await scanTradeSetup2Window({...input,collectSnapshots:false,resumeState:store.state,onSnapshot:()=>{replayed++;}});expect(replayed).toBe(0);
 }finally{await store?.close();await rm(directory,{recursive:true,force:true});}
},90000);
import minutes105 from './fixtures/gbpusd-m1-entry-pattern1-105.json';
it('preserves multiple DRs across retirement and a later source on resume',async()=>{
 const later=setup1RecognitionTime(fixture.setups[1]),multi={...input,tradeSetups:fixture.setups,m1Candles:[...minutes,...minutes105].sort((a,b)=>a.time-b.time),toTime:Math.floor(later/86400)*86400+12*3600};
 const baseline=[],expectedHistory=[];await scanTradeSetup2Window({...multi,onSnapshot:s=>baseline.push(structuredClone(s)),onHistory:(key,entry)=>expectedHistory.push({key,entry:structuredClone(entry)})});
 const actual=[],history=[],abort=new AbortController();let state,count,historyCount;
 await expect(scanTradeSetup2Window({...multi,collectSnapshots:false,signal:abort.signal,onSnapshot:s=>actual.push(structuredClone(s)),onHistory:(key,entry)=>history.push({key,entry:structuredClone(entry)}),onCheckpoint:async(p,getState)=>{if(p.evaluatedAt>=later){state=clone(getState());count=actual.length;historyCount=history.length;abort.abort();}}})).rejects.toMatchObject({name:'AbortError'});
 actual.length=count;history.length=historyCount;
 await scanTradeSetup2Window({...multi,collectSnapshots:false,resumeState:state,onSnapshot:s=>actual.push(structuredClone(s)),onHistory:(key,entry)=>history.push({key,entry:structuredClone(entry)})});
 expect(actual).toEqual(baseline);expect(history).toEqual(expectedHistory);expect(new Set(actual.map(s=>s.setupKey)).size).toBe(2);
},90000);
