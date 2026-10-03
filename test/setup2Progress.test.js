import {it,expect} from 'vitest';
import {evaluateCountertrendLifecycle} from '../src/countertrendLifecycle.js';
import {evaluateSimulation} from '../src/tradeSetupSimulation.js';
import {entryModel1RetestFvg} from '../src/countertrendEntryModel1.js';

const selection={status:'passed',selectedAt:0,direction:'short',target1:{price:1.29},target2:{price:1.28}};
const rows=Array.from({length:12},(_,i)=>({time:i*60,high:1.299,low:i<5?1.295:i<9?1.289:1.279,close:1.29}));
const entry={id:'entry',instrument:'GBPUSD',direction:'short',price:1.3,recognizedAt:0,stops:{wide:{price:1.302}}};
it('two-day lifecycle, exits and retest/FVG search match the complete oracle with jumps and rewind',()=>{
 const candles=Array.from({length:2880},(_,i)=>({time:i*60,open:1.3,close:1.3,high:1.299,
  low:i===2879?1.279:1.295}));
 const m1=candles.map((c,i)=>({...c,high:i%4===1?1.311:i%4===2?1.307:1.301,
  low:i%4===1?1.309:i%4===2?1.305:1.299}));
 const obs=[{dir:-1,startTime:0,recognizedAt:0,top:1.301,bottom:1.299}];
 const lifecycle={},simulation={},follow={};
 for(const evaluatedAt of [60,120,240,3600,86400,172800,600,172800]){
  const base={selection,invalidation:1.32,candles:[],m1Candles:candles,evaluatedAt,
   entries:[{entryTime:0,status:'open'}]};
  expect(evaluateCountertrendLifecycle({...base,progress:lifecycle})).toEqual(evaluateCountertrendLifecycle(base));
  const execution={entry,variant:'wide',target1:1.29,target2:1.28,candles,evaluatedAt};
  expect(evaluateSimulation({...execution,progress:simulation})).toEqual(evaluateSimulation(execution));
  expect(entryModel1RetestFvg(m1,obs,0,'short',evaluatedAt,follow))
   .toEqual(entryModel1RetestFvg(m1,obs,0,'short',evaluatedAt));
 }
});
it('filled history retries from the entry start without rewinding time',()=>{
 const progress={},base={entry,variant:'wide',target1:1.29,target2:1.28,evaluatedAt:720};
 expect(evaluateSimulation({...base,candles:rows.filter(c=>c.time!==180),progress}).reason).toBe('missingHistory');
 expect(evaluateSimulation({...base,candles:rows,progress})).toEqual(evaluateSimulation({...base,candles:rows}));
});
it('incremental lifecycle and entry exits equal full prefixes, including jumps and rewind',()=>{
 const lifecycle={},simulation={};
 for(const at of [60,120,300,600,720,180,720]){
  const base={selection,invalidation:1.32,candles:[],m1Candles:rows,evaluatedAt:at,
    entries:[{entryTime:0,status:'open'}]};
  expect(evaluateCountertrendLifecycle({...base,progress:lifecycle})).toEqual(evaluateCountertrendLifecycle(base));
  const execution={entry,variant:'wide',target1:1.29,target2:1.28,candles:rows,evaluatedAt:at};
  expect(evaluateSimulation({...execution,progress:simulation})).toEqual(evaluateSimulation(execution));
 }
});
it.each(['gap','both','ignored'])('incremental paths preserve %s and can recover a filled gap',mode=>{
 const changed=rows.map(c=>({...c}));
 if(mode==='gap')changed.splice(3,1);
 if(mode==='both'){changed[5].high=1.33;changed[5].low=1.27;}
 if(mode==='ignored')changed[5].ignored=true;
 const lifecycle={},simulation={};
 for(const candles of [changed,rows]) for(const at of [300,600,720]){
  const base={selection,invalidation:1.32,candles:[],m1Candles:candles,evaluatedAt:at};
  expect(evaluateCountertrendLifecycle({...base,progress:lifecycle})).toEqual(evaluateCountertrendLifecycle(base));
  const execution={entry,variant:'wide',target1:1.29,target2:1.28,candles,evaluatedAt:at};
  expect(evaluateSimulation({...execution,progress:simulation})).toEqual(evaluateSimulation(execution));
 }
});
