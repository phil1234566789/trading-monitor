import {describe,it,expect} from 'vitest';
import {validateTargetAllocation,targetDraftAllocation} from '../supabase/functions/trading-monitor-mcp/targetPlanContract.js';
const position={volume:.01,type:0,price_open:2000,sl:1990,tp:0};
const quote={minimum_volume:.01,volume_step:.01,maximum_volume:100,bid:2001,ask:2001.1,point:.01,stops_level:1};
describe('broker TP allocations',()=>{
 it('rejects imaginary partial lots in the .01 pilot',()=>{
  expect(()=>validateTargetAllocation([{price:2010,volume:.005},{price:2020,volume:.005}],position,quote,2000,1990)).toThrow('invalid_target_volume');
 });
 it('does not silently distribute an unrepresentable percent remainder',()=>{
  const draft=targetDraftAllocation([{price:2010,percent:50},{price:2020,percent:50}],.01,.01);
  expect(draft.targets.map(t=>t.volume)).toEqual([0,0]);expect(draft.remainder).toBe(.01);
 });
 it('keeps fill/initialSL RR while the current broker SL changes',()=>{
  const plan=validateTargetAllocation([{price:2010,volume:.01}],{...position,sl:2000},quote,2000,1990);
  expect(plan.targets[0].rr).toBe(1);expect(plan.native_tp).toBe(2010);expect(plan.remainder).toBe(0);
 });
 it('supports up to five representable lots and leaves a protected remainder',()=>{
  const plan=validateTargetAllocation([{price:2010,volume:.01},{price:2020,volume:.02}],{...position,volume:.05},quote,2000,1990);
  expect(plan.remainder).toBeCloseTo(.02);expect(plan.native_tp).toBe(0);
  expect(()=>validateTargetAllocation(Array(6).fill({price:2010,volume:.01}),{...position,volume:.1},quote,2000,1990)).toThrow('invalid_target_count');
 });
 it('rejects oversizing, crossed targets, and an untradeable remaining volume',()=>{
  expect(()=>validateTargetAllocation([{price:2010,volume:.02}],position,quote,2000,1990)).toThrow('target_volume_exceeds_position');
  expect(()=>validateTargetAllocation([{price:2000,volume:.01}],position,quote,2000,1990)).toThrow('invalid_target_price');
  expect(()=>validateTargetAllocation([{price:2010,volume:.02}],{...position,volume:.025},quote,2000,1990)).toThrow();
 });
});
