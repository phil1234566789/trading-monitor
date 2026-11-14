import {readFileSync} from 'node:fs';
import {expect,it,vi,afterEach} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';
import * as measurement from '../src/orderBlockPenetration.js';

const load=day=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
const refs=load('references');
afterEach(()=>vi.restoreAllMocks());
it.each([1,-1])('limits the second retest symmetrically at 50 percent for direction %s',direction=>{
 const example=refs.pairs.find(p=>refs.references.find(r=>r.pin===p.pins[0]).dir===direction);
 const [first,second]=example.pins.map(pin=>refs.references.find(r=>r.pin===pin)),fixture=load(first.day);
 const input={m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to};
 const match=p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime;
 const original=measurement.measureOrderBlockPenetration;let depth=.5;
 vi.spyOn(measurement,'measureOrderBlockPenetration').mockImplementation((ob,...args)=>ob.startTime===second.startTime
  ?{...original(ob,...args),status:depth===null?'unknown':'ready',maxPenetrationFraction:depth}:original(ob,...args));
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(true);
 depth=.500001;expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
 depth=null;expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
});
