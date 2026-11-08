import {it,expect} from 'vitest';
import {knownSourceIdeaKey,executionSignature,SOURCE_IDEA_EXIT_POLICY} from '../src/setupSourceIdeaIdentity.js';
const target=(price,id)=>({id,price,sourceTime:60,timeframe:'5m',source:'sessionLiquidity',knownAt:120,selectedAt:180});
const idea=()=>({instrument:'XAUUSD',sourceFamilyKey:'geometry',direction:'short',invalidation:110,recognizedAt:120,
 exitPolicy:SOURCE_IDEA_EXIT_POLICY,targetSelection:{instrument:'XAUUSD',status:'passed',selectedAt:180,target1:target(90,'one'),target2:target(80,'two')}});
const entry=()=>({instrument:'XAUUSD',direction:'short',recognizedAt:300,price:100,
 stops:{wide:{price:110},narrow:{price:105}},scales:{wide:{targets:[{price:90},{price:80}]},narrow:{targets:[{price:90},{price:80}]}}});
it('joins only the same known POI, targets, invalidation and exit policy regardless of alias time',()=>{
 const first=idea(),later=idea();later.tradeSetupId=77;later.targetSelection.selectedAt=240;later.targetSelection.target1.selectedAt=240;
 expect(knownSourceIdeaKey(first,300)).toBe(knownSourceIdeaKey(later,300));
 for(const mutate of [x=>x.targetSelection.target1.price=91,x=>x.targetSelection.target1.id='other',x=>x.invalidation=111,x=>x.exitPolicy='different-policy',x=>x.sourceFamilyKey='other']){
  const changed=idea();mutate(changed);expect(knownSourceIdeaKey(changed,300)).not.toBe(knownSourceIdeaKey(first,300));
 }
});
it('never accepts unknown or future target/selection/policy provenance',()=>{
 for(const mutate of [x=>x.targetSelection.selectedAt=301,x=>x.targetSelection.target1.knownAt=181,x=>x.targetSelection.target2.selectedAt=301,x=>delete x.targetSelection.target1.knownAt,x=>delete x.exitPolicy,x=>x.targetSelection.instrument='GBPUSD',x=>x.recognizedAt=301]){
  const changed=idea();mutate(changed);expect(knownSourceIdeaKey(changed,300)).toBeNull();
 }
});
it('accepts a target exactly when known and uses complete geometric provenance when no target ID exists',()=>{
 const x=idea();x.targetSelection.selectedAt=120;delete x.targetSelection.target1.id;delete x.targetSelection.target1.selectedAt;
 delete x.targetSelection.target2.selectedAt;
 expect(knownSourceIdeaKey(x,120)).not.toBeNull();expect(knownSourceIdeaKey(x,119)).toBeNull();
 delete x.targetSelection.target1.sourceTime;expect(knownSourceIdeaKey(x,120)).toBeNull();
});
it('preserves direction and optional target2 identity without mutating snapshots',()=>{
 const x=idea(),before=structuredClone(x);expect(knownSourceIdeaKey(x,300)).not.toBeNull();expect(x).toEqual(before);
 const one=idea();one.targetSelection.target2=null;expect(knownSourceIdeaKey(one,300)).not.toBe(knownSourceIdeaKey(x,300));
 const long=idea();long.direction='long';expect(knownSourceIdeaKey(long,300)).not.toBe(knownSourceIdeaKey(x,300));
});
it('deduplicates pattern aliases only for an identical actual execution and known idea',()=>{
 const key=knownSourceIdeaKey(idea(),300),a=entry(),b={...entry(),id:'different-pattern',entryPattern:'pattern2'};
 expect(executionSignature(a,key)).toBe(executionSignature(b,key));
 for(const mutate of [x=>x.price=101,x=>x.recognizedAt=301,x=>x.direction='long',x=>x.stops.narrow.price=106,x=>x.scales.wide.targets[0].price=91,x=>x.exitPolicy='different']){
  const changed=entry();mutate(changed);expect(executionSignature(changed,key)).not.toBe(executionSignature(a,key));
 }
 expect(executionSignature(a)).toBeNull();expect(executionSignature({...a,stops:{wide:{price:110}}},key)).toBeNull();
});
