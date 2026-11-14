import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';
import * as penetration from '../src/orderBlockPenetration.js';

const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${name}.json`,import.meta.url),'utf8'));
const manifest=load('references');
const policy=load('policy-v5-reference-expectations');
afterEach(()=>vi.restoreAllMocks());
const sample=direction=>{
 const reference=manifest.pairs.find(p=>manifest.references.find(r=>r.pin===p.pins[0]).dir===direction);
 const [first,second]=reference.pins.map(pin=>manifest.references.find(r=>r.pin===pin));
 const fixture=load(first.day),input={m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to};
 const match=p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime;
 return {first,second,input,match};
};

it.each([1,-1])('allows exactly 50 percent and rejects a deeper first retest in direction %s',direction=>{
 const {first,input,match}=sample(direction),original=penetration.measureOrderBlockPenetration;
 let depth=.5;
 vi.spyOn(penetration,'measureOrderBlockPenetration').mockImplementation((ob,...args)=>ob.startTime===first.startTime
  ?{...original(ob,...args),maxPenetrationFraction:depth}:original(ob,...args));
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(true);
 depth=.500001;
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
 expect(detectDoubleOrderBlocks({...input,maxRetestDepthFraction:.6}).pairs.some(match)).toBe(true);
});

it('also rejects an overly deep OB2 under the explicitly extended policy',()=>{
 const {second,input,match}=sample(1),original=penetration.measureOrderBlockPenetration;
 vi.spyOn(penetration,'measureOrderBlockPenetration').mockImplementation((ob,...args)=>ob.startTime===second.startTime
  ?{...original(ob,...args),maxPenetrationFraction:.8}:original(ob,...args));
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
});

it('does not confirm a pair with unknown first depth',()=>{
 const {first,input,match}=sample(1),original=penetration.measureOrderBlockPenetration;
 vi.spyOn(penetration,'measureOrderBlockPenetration').mockImplementation((ob,...args)=>ob.startTime===first.startTime
  ?{status:'unknown',maxPenetrationFraction:null}:original(ob,...args));
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
});

it.each([NaN,Infinity,-.1,1.1])('rejects an invalid depth setting %s',maxRetestDepthFraction=>{
 expect(()=>detectDoubleOrderBlocks({maxRetestDepthFraction})).toThrow(RangeError);
});

it.each(manifest.pairs)('keeps $id at its causal confirmation without later candles affecting OB1 depth',reference=>{
 const [first,second]=reference.pins.map(pin=>manifest.references.find(r=>r.pin===pin)),fixture=load(first.day);
 const input={m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to};
 const match=p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime;
 const full=detectDoubleOrderBlocks(input).pairs.find(match);
 if(policy.references.find(r=>r.id===reference.id).expected==='rejected'){
  expect(full).toBeUndefined();
  const historical=detectDoubleOrderBlocks({...input,maxRetestDepthFraction:1}).pairs.find(match);
  expect(historical.secondPenetration.maxPenetrationFraction).toBeGreaterThan(.5);
  return;
 }
 expect(full).toBeDefined();expect(full.firstPenetration.maxPenetrationFraction).toBeLessThanOrEqual(.5);
 const prefix=detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt}).pairs.find(match);
 expect(prefix.firstPenetration).toEqual(full.firstPenetration);
 expect(detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt-1}).pairs.some(match)).toBe(false);
});
