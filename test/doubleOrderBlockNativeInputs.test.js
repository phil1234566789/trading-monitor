import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {assertNativeReferenceCandles} from './helpers/nativeReferenceFixture.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {obMinimum} from '../src/instrumentConfig.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';

const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${name}.json`,import.meta.url),'utf8'));
const manifest=load('references');
const days=new Map(manifest.days.map(day=>[day,load(day)]));
const detected=day=>detectOrderBlocks(days.get(day).candles.m5,'5m',true,obMinimum('XAUUSD','5m'));

// Dies ist der native Eingabevertrag; eine DOB-Erkennung oder ein Entry wird hier nicht behauptet.
describe('DOB native candle inputs for the 16 pinned reference pairs',()=>{
 it('preserves 16 pairs and 32 distinct source pin identities',()=>{
  expect(manifest.pairs).toHaveLength(16);expect(manifest.references).toHaveLength(32);
  expect(new Set(manifest.references.map(r=>r.pin)).size).toBe(32);
  expect(manifest.pairs.flatMap(pair=>pair.pins).sort((a,b)=>a-b)).toEqual(manifest.references.map(r=>r.pin).sort((a,b)=>a-b));
 });
 it.each(manifest.pairs)('keeps $id as exactly two matching-instrument, same-day, same-direction OBs in chronological order',pair=>{
  expect(pair.pins).toHaveLength(2);
  const refs=pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));
  expect(refs.every(Boolean)).toBe(true);
  expect(refs.map(ref=>ref.instrument)).toEqual([manifest.instrument,manifest.instrument]);
  expect(refs[0].day).toBe(refs[1].day);expect(refs[0].dir).toBe(refs[1].dir);
  expect(refs[0].startTime).toBeLessThan(refs[1].startTime);
 });
 it.each(manifest.days)('preserves native OHLC, chronology and hashes for %s',day=>{
  for(const bar of ['m1','m5'])assertNativeReferenceCandles(days.get(day),bar);
 });
 it.each(manifest.references)('redetects pin $pin from original M5 candles',ref=>{
  const zone=detected(ref.day).find(z=>z.startTime===ref.startTime&&z.dir===ref.dir);
  expect(zone).toBeDefined();expect(zone.fvg).toBeGreaterThan(0);
  const expected=ref.pin===440?manifest.sourceDiscrepancy.nativeGeometry:ref.sourceGeometry;
  expect(zone.top).toBeCloseTo(expected.top,8);expect(zone.bottom).toBeCloseTo(expected.bottom,8);
 });
 it.each(manifest.references)('does not know pin $pin before the next actual M5 candle closes',ref=>{
  const rows=days.get(ref.day).candles.m5,knownAt=orderBlockRecognitionTimes(rows,'5m').get(ref.startTime);
  expect(knownAt).toBe(ref.knownAt);
  const zones=asOf=>detectOrderBlocks(closedChecklistCandles(rows,'5m',asOf),'5m',true,obMinimum('XAUUSD','5m'));
  expect(zones(knownAt-1).some(z=>z.startTime===ref.startTime&&z.dir===ref.dir)).toBe(false);
  expect(zones(knownAt).some(z=>z.startTime===ref.startTime&&z.dir===ref.dir)).toBe(true);
 });
 it('preserves the pin440 setup geometry discrepancy without changing the source or detector',()=>{
  const ref=manifest.references.find(r=>r.pin===440);
  expect(ref.obId).toBe(4590713);expect(ref.setupId).toBe(42644);
  expect(ref.sourceGeometry).toEqual({top:4066.88,bottom:4061.17});
  expect(manifest.sourceDiscrepancy).toMatchObject({pin:440,nativeGeometry:{top:4066.10,bottom:4061.17},status:'unresolved-source-discrepancy'});
  expect(ref.sourceGeometry.top).not.toBe(manifest.sourceDiscrepancy.nativeGeometry.top);
 });
});
