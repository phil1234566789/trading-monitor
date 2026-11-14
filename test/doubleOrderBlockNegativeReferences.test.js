import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import {measureOrderBlockPenetration} from '../src/orderBlockPenetration.js';
import {evaluateDoubleOrderBlockDepth} from '../src/doubleOrderBlockDepth.js';
import {evaluateDoubleOrderBlockRetestDay} from '../src/doubleOrderBlockRetestDay.js';
import {orderBlockRetestHoldHistory,orderBlockRetestHoldAt} from '../src/orderBlockRetestHold.js';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {obMinimum} from '../src/instrumentConfig.js';
import {evaluateDoubleOrderBlockPriceGap} from '../src/doubleOrderBlockPriceGap.js';

const directory=new URL('./fixtures/dob-native/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('negative-references.json',directory),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=ob=>readFileSync(new URL(ob.sourceFixture,directory),'utf8');
const nativeRows=(example,timeframe='m1')=>[...new Map([
 ...[example.first,example.second].flatMap(ob=>JSON.parse(source(ob)).candles[timeframe]),
 ...(example.additionalSources??[]).flatMap(entry=>{
  const text=readFileSync(new URL(entry.file,directory),'utf8');expect(hash(text)).toBe(entry.sourceFileSha256);
  return JSON.parse(text).candles[timeframe];
 })].map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);

it('retains every supplied negative pin in the versioned regression inventory',()=>{
 expect(manifest.inventoryPinIds).toEqual([471,472,473,474,475,476]);
 expect(manifest.cases.map(c=>c.pin)).toEqual(manifest.inventoryPinIds);
 expect(new Set(manifest.cases.map(c=>c.key)).size).toBe(manifest.cases.length);
});
it.each(manifest.cases)('preserves native OHLC, source snapshot and exact rejection cause for pin $pin',example=>{
 for(const ob of [example.first,example.second]){
  expect(hash(source(ob))).toBe(ob.sourceFileSha256);
  const rows=JSON.parse(source(ob)).candles.m1.filter(c=>c.time>=ob.touch&&c.time+60<=ob.knownAt);
  expect(rows).toEqual(ob.nativeM1Window);expect(hash(JSON.stringify(rows))).toBe(ob.nativeM1WindowSha256);
  expect(rows[0].time).toBe(ob.touch);expect(rows.at(-1).time+60).toBe(ob.knownAt);
  rows.slice(1).forEach((c,i)=>expect(c.time).toBe(rows[i].time+60));
 }
 expect(example.note.length).toBeGreaterThan(0);expect(example.sourceEngineVersion).toMatch(/v[25]$/);
 const first=measureOrderBlockPenetration(example.first,example.direction,example.first.nativeM1Window);
 const second=measureOrderBlockPenetration(example.second,example.direction,example.second.nativeM1Window);
 const depth=evaluateDoubleOrderBlockDepth(first,second);
 const day=evaluateDoubleOrderBlockRetestDay(example.first.touch,example.second.touch);
 const priceGap=evaluateDoubleOrderBlockPriceGap(example.first,example.second,example.direction==='long'?1:-1,'XAUUSD');
 const hold=orderBlockRetestHoldAt(orderBlockRetestHoldHistory({candles:nativeRows(example),direction:example.direction,
  anchorPrice:first.extremePrice,fromTime:example.first.knownAt,evaluatedAt:example.second.knownAt}),example.second.knownAt);
 const isolated=example.expectedRejectionReason==='secondRetestTooDeep'?depth
  :example.expectedRejectionReason==='differentRetestDays'?day
  :example.expectedRejectionReason==='priceGapTooWide'?priceGap:hold;
 expect(isolated.reason).toBe(example.expectedRejectionReason);
 expect(isolated.status).not.toBe('passed');
 if(example.pin===472){expect(first.maxPenetrationFraction).toBeCloseTo(.36166924265843176,10);expect(second.maxPenetrationFraction).toBeCloseTo(.9885057471263935,10);}
 if(example.pin===471)expect(hold.firstSweepTime).toBe(1794221520);
 if(example.pin===474)expect(hold.firstSweepTime).toBe(1793733900);
 if(example.pin===475)expect(priceGap.positiveZoneGap).toBeCloseTo(51.43,8);
 if(example.pin===476)expect(priceGap.positiveZoneGap).toBeCloseTo(51.83,8);
});

it.each(['GBPUSD','EURUSD'])('keeps the price-gap policy unconfigured for %s in the actual detector',instrument=>{
 const example=manifest.cases.find(c=>c.pin===475);
 const result=detectDoubleOrderBlocks({instrument,m5Candles:nativeRows(example,'m5'),m1Candles:nativeRows(example),evaluatedAt:example.second.knownAt});
 expect(result.policy.maxPositiveZoneGap).toBeNull();
 expect(result.pairs.some(pair=>pair.firstOrderBlock.startTime===example.first.startTime&&pair.secondOrderBlock.startTime===example.second.startTime)).toBe(true);
});

it.each(manifest.cases)('does not confirm pin $pin through native M5 OB detection and M1 qualification',example=>{
 const m5Candles=nativeRows(example,'m5'),m1Candles=nativeRows(example);
 const nativeZones=detectOrderBlocks(m5Candles.filter(c=>c.time+300<=example.second.knownAt),'5m',true,obMinimum('XAUUSD','5m'));
 for(const ob of [example.first,example.second]){
  const zone=nativeZones.find(z=>z.startTime===ob.startTime);
  expect(zone).toBeDefined();expect(zone.dir).toBe(example.direction==='long'?1:-1);
  expect(zone.top).toBe(ob.top);expect(zone.bottom).toBe(ob.bottom);
 }
 const result=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles,m1Candles,evaluatedAt:example.second.knownAt});
 expect(result.pairs.some(pair=>pair.id===example.key)).toBe(false);
});

it.each(['first','second'])('keeps unknown %s depth unknown rather than confirming',role=>{
 const known={status:'ready',maxPenetrationFraction:.5},unknown={status:'unknown',maxPenetrationFraction:null};
 expect(evaluateDoubleOrderBlockDepth(role==='first'?unknown:known,role==='second'?unknown:known))
  .toEqual({status:'unknown',reason:`${role}RetestDepthUnknown`});
});
