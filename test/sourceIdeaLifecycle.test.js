import {it,expect} from 'vitest';
import {evaluateCountertrendLifecycle} from '../src/countertrendLifecycle.js';
import {evaluateSourceIdeaLifecycles} from '../src/sourceIdeaLifecycle.js';
const candidate=(id,recognizedAt,target=90)=>({id,sourceFamilyKey:'same-geometry',recognizedAt,invalidation:110,direction:'short',
 targetSelection:{status:'passed',selectedAt:recognizedAt,direction:'short',instrument:'XAUUSD',target1:{price:target,knownAt:1200,id:'t'+target}}});
const signature=c=>c.sourceFamilyKey+':'+c.targetSelection.target1.price;
const run=(candidates,state,at,extra={})=>evaluateSourceIdeaLifecycles(candidates,{evaluatedAt:at,bindings:state,signature,outcomes:new Map(),
 candles:[{time:1800,high:105,low:89,close:95}],m1Candles:[{time:1800,high:105,low:89,close:95}],evaluateLifecycle:evaluateCountertrendLifecycle,...extra});
it('does not reactivate a matching target idea when its legacy alias appears after T1',()=>{
 const state=new Map();run([candidate('r2',1800)],state,1860);
 const restored=new Map(JSON.parse(JSON.stringify([...state]))),alias=candidate('legacy',2400);
 const result=run([alias],restored,2400)[0];
 expect(result.lifecycle.main).toMatchObject({state:'ended',reason:'target1',recognizedAt:1860});
 expect(result.recognizedAt).toBe(2400);expect(result.targetSelection.selectedAt).toBe(2400);
 expect(result.ideaBinding.selection.selectedAt).toBe(1800);
});
it('does not transfer earlier target endings to a different target plan',()=>{
 const state=new Map();run([candidate('r2',1800)],state,1860);
 const result=run([candidate('legacy',2400,80)],state,2400)[0];
 expect(result.ideaBinding.selection.selectedAt).toBe(2400);
 expect(result.lifecycle.main.reason).not.toBe('target1');
});
it('evaluates one known idea once using joint outcomes, not once per alias',()=>{
 let count=0;const outcomes=new Map([['same-geometry:90',[{entryId:'one-execution'}]]]);
 const result=run([candidate('r2',1800),candidate('legacy',2400)],new Map(),2400,{outcomes,
  evaluateLifecycle:input=>{count++;expect(input.entries).toHaveLength(1);return {main:{state:'active'},entrySearchAllowed:true};}});
 expect(count).toBe(1);expect(result[0].lifecycle).toBe(result[1].lifecycle);
});
it('retains a proven two-loss end across checkpoint even after old executions leave the active-source cache',()=>{
 const state=new Map(),outcomes=new Map([['same-geometry:90',[1800,1860].flatMap((entryTime,index)=>['wide','narrow'].map(variant=>({
  entryId:'loss'+index,entryTime,variant,status:'closed',outcome:'slBeforeT1',pnlUsd:-10,t1RecognizedAt:null,exitRecognizedAt:entryTime+60})))]]);
 const m1Candles=Array.from({length:6},(_,i)=>({time:1800+i*60,high:105,low:95,close:100}));
 const first=run([candidate('r2',1800)],state,2160,{outcomes,m1Candles})[0];
 expect(first.lifecycle.main).toMatchObject({state:'ended',reason:'twoConsecutiveJointLosses',recognizedAt:1920});
 const restored=new Map(JSON.parse(JSON.stringify([...state])));
 const later=run([candidate('legacy',2400)],restored,2400,{m1Candles})[0];
 expect(later.lifecycle.main).toMatchObject({state:'ended',reason:'twoConsecutiveJointLosses',recognizedAt:1920});
});

it('freezes the original retest across reverse alias order, removal and checkpoint restore',()=>{
 const original={...candidate('original',1800),sourceKind:'liquidity-sweep-existing-m5-ob-retest-v1',
  sourceRetest:{candleTime:1800,recognizedAt:2100},reactionOB:{dir:-1,top:110,bottom:100}};
 const alias={...original,id:'later',recognizedAt:2100,targetSelection:{...original.targetSelection,selectedAt:2100},
  sourceRetest:{candleTime:2100,recognizedAt:2400}};
 const m1Candles=Array.from({length:10},(_,i)=>({time:1800+i*60,high:i===6?106:105,low:95,close:100}));
 const state=new Map(),first=run([alias,original],state,2400,{m1Candles});
 expect(first.every(c=>c.lifecycle.main.reason==='retestExtremeBroken')).toBe(true);
 expect(first[0].lifecycle.sweepRetest).toMatchObject({retestTime:1800,price:105,recognizedAt:2220});
 const restored=new Map(JSON.parse(JSON.stringify([...state])));
 expect(run([alias],restored,2400,{m1Candles})[0].lifecycle.main).toEqual(first[0].lifecycle.main);
});
