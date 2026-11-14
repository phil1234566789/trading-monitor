import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/dob-native/pin471-regression.json',import.meta.url),'utf8'));
const source=readFileSync(new URL(`./fixtures/dob-native/${provenance.sourceFixture}`,import.meta.url),'utf8');
const fixture=JSON.parse(source);
const firstStart=provenance.firstStartTime,secondStart=provenance.secondStartTime,confirmation=provenance.confirmationKnownAt;
const input={instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1};
const match=pair=>pair.firstOrderBlock.startTime===firstStart&&pair.secondOrderBlock.startTime===secondStart;

it('rejects the native pinned pair when OB1 reaction extreme was swept before OB2 confirmed',()=>{
 expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sourceFileSha256);
 const sweep=fixture.candles.m1.find(c=>c.time===1794221520);
 expect(sweep.low).toBe(4094.89);expect(sweep.low).toBeLessThan(4094.97);expect(sweep.low).toBeGreaterThan(4093.35);
 expect(detectDoubleOrderBlocks({...input,evaluatedAt:confirmation}).pairs.some(match)).toBe(false);
});

it('would retain the same native geometry if the later wick only equalled the fixed reaction extreme',()=>{
 const m1Candles=input.m1Candles.map(c=>c.time>=1794220440&&c.time+60<=confirmation?{...c,low:Math.max(c.low,4094.97)}:c);
 const pair=detectDoubleOrderBlocks({...input,m1Candles,evaluatedAt:confirmation}).pairs.find(match);
 expect(pair).toBeDefined();expect(pair.firstPenetration.extremePrice).toBe(4094.97);
 expect(pair.firstRetestHold).toMatchObject({status:'passed',checkedFrom:1794220440,checkedThrough:confirmation});
 const missing=m1Candles.filter(c=>c.time!==1794220800);
 const unknown=detectDoubleOrderBlocks({...input,m1Candles:missing,evaluatedAt:confirmation});
 expect(unknown.pairs.some(match)).toBe(false);expect(unknown.stats.firstHoldUnknown).toBeGreaterThan(0);
});
