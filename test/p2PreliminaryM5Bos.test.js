import {describe,it,expect} from 'vitest';
import {p2PreliminaryM5Bos} from '../src/p2PreliminaryM5Bos.js';

const low={price:10,pivotTime:300},high={price:15,pivotTime:1200};
const level={trend:'uptrend',currRange:{low:{price:8,pivotTime:0},high},structurePivots:[{type:'protected-low',price:9,pivotTime:0}],innerStructurePivots:[{type:'low',...low}]};
function fixture(){
 const candles=Array.from({length:8},(_,i)=>({time:i*300,open:12,high:14,low:i===1?10:11,close:i===6?9.5:12}));
 const deps={detectLiquidityLevels:()=>({highs:[],lows:[low]}),computeRangesPivots:()=>[],buildMarketStructureState:()=>level,entryPattern1CountertrendState:()=>level};
 return {candles,deps,primary:{},countertrend:{trend:'uptrend',range:level.currRange},direction:'short',evaluatedAt:2400,anchor:0,periodOuter:5,periodInner:2};
}
describe('isolated P2 preliminary BOS experiment',()=>{
 it('uses only a closed break after both P2 confirmation and range origin',()=>{const x=fixture();const result=p2PreliminaryM5Bos(x);expect(result).toMatchObject({price:10,pivotTime:300,originTime:1200,candleTime:1800,recognizedAt:2100,pivotKnownAt:1200,evidenceType:'P2-preliminary-close-break'});});
 it('never uses a later close or a wick-only breach',()=>{let x=fixture();x.evaluatedAt=2099;expect(p2PreliminaryM5Bos(x)).toBeNull();x=fixture();x.candles[6].close=11;expect(p2PreliminaryM5Bos(x)).toBeNull();});
 it('rejects foreign countertrend origins and levels outside the prior D state',()=>{let x=fixture();x.deps.entryPattern1CountertrendState=()=>({...level,currRange:{...level.currRange,high:{...high,pivotTime:900}}});expect(p2PreliminaryM5Bos(x)).toBeNull();x=fixture();x.deps.entryPattern1CountertrendState=()=>({...level,innerStructurePivots:[]});expect(p2PreliminaryM5Bos(x)).toBeNull();});
 it('rejects unconfirmed P2, later origins and post-break origin reclaim',()=>{let x=fixture();x.periodInner=7;expect(p2PreliminaryM5Bos(x)).toBeNull();x=fixture();x.countertrend.range={...level.currRange,high:{...high,pivotTime:2100}};expect(p2PreliminaryM5Bos(x)).toBeNull();x=fixture();x.candles[7].close=16;expect(p2PreliminaryM5Bos(x)).toBeNull();});
 it('retains the prior causal P2 proof after a later P5 migration in the same D range',()=>{
  const x=fixture();const later={...level,structurePivots:[{type:'protected-low',price:11,pivotTime:600}],innerStructurePivots:[]};
  x.currentState=later;x.deps.entryPattern1CountertrendState=(_p,_d,_at,state)=>state??level;
  expect(p2PreliminaryM5Bos(x)).toMatchObject({price:10,recognizedAt:2100});
 });
 it('mirrors long direction without changing the countertrend origin',()=>{
  const x=fixture(),mirror=p=>({...p,price:30-p.price});
  const longLevel={...level,trend:'downtrend',currRange:{high:mirror(level.currRange.low),low:mirror(high)},
   structurePivots:[{type:'protected-high',price:21,pivotTime:0}],innerStructurePivots:[{type:'high',...mirror(low)}]};
  x.direction='long';x.countertrend={trend:'downtrend',range:longLevel.currRange};
  x.candles=x.candles.map(c=>({...c,open:30-c.open,high:30-c.low,low:30-c.high,close:30-c.close}));
  x.deps={...x.deps,detectLiquidityLevels:()=>({highs:[mirror(low)],lows:[]}),buildMarketStructureState:()=>longLevel,entryPattern1CountertrendState:()=>longLevel};
  expect(p2PreliminaryM5Bos(x)).toMatchObject({direction:'long',price:20,originTime:1200,recognizedAt:2100});
 });
});
