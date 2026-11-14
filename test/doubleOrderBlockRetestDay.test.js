import {readFileSync} from 'node:fs';
import {expect,it,vi,afterEach} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';
import * as dayPolicy from '../src/doubleOrderBlockRetestDay.js';
import {evaluateDoubleOrderBlockRetestDay} from '../src/doubleOrderBlockRetestDay.js';
const t=iso=>Date.parse(iso)/1000;
afterEach(()=>vi.restoreAllMocks());
it.each([
 ['CEST midnight','2026-10-21T21:59:00Z','2026-10-21T22:00:00Z','rejected'],
 ['CET midnight','2026-11-09T22:59:00Z','2026-11-09T23:00:00Z','rejected'],
 ['same CEST day across UTC dates','2026-10-20T22:05:00Z','2026-10-21T21:55:00Z','passed'],
 ['same CET day across UTC dates','2026-11-08T23:05:00Z','2026-11-09T22:55:00Z','passed'],
 ['DST fallback same calendar date','2026-10-25T00:30:00Z','2026-10-25T22:30:00Z','passed']
])('%s uses Berlin calendar date rather than UTC date or elapsed hours',(_,a,b,status)=>{
 expect(evaluateDoubleOrderBlockRetestDay(t(a),t(b)).status).toBe(status);
});
it('keeps invalid retest times unknown',()=>{
 expect(evaluateDoubleOrderBlockRetestDay(null,1).status).toBe('unknown');
 expect(evaluateDoubleOrderBlockRetestDay(1,NaN).status).toBe('unknown');
});
it.each([1,-1])('enforces the retest-day policy in the detector for direction %s',direction=>{
 const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${name}.json`,import.meta.url),'utf8'));
 const refs=load('references'),example=refs.pairs.find(p=>refs.references.find(r=>r.pin===p.pins[0]).dir===direction);
 const [first,second]=example.pins.map(pin=>refs.references.find(r=>r.pin===pin)),fixture=load(first.day);
 const input={m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to};
 const match=p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime;
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(true);
 vi.spyOn(dayPolicy,'evaluateDoubleOrderBlockRetestDay').mockReturnValue({status:'rejected',reason:'differentRetestDays'});
 expect(detectDoubleOrderBlocks(input).pairs.some(match)).toBe(false);
});
