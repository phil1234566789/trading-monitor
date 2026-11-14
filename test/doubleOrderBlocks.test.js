import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';

const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${name}.json`,import.meta.url),'utf8'));
const manifest=load('references'),days=new Map(manifest.days.map(day=>[day,load(day)]));
const policy=load('policy-v5-reference-expectations');
const results=new Map();
const run=day=>{
 if(!results.has(day)){const fixture=days.get(day);results.set(day,detectDoubleOrderBlocks({instrument:'XAUUSD',
  m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to}));}
 return results.get(day);
};

describe('double order blocks from native candles',()=>{
 it.each(manifest.pairs)('recognizes $id through OB detection and M1 mitigation, without pin IDs as algorithm input',pair=>{
  const [first,second]=pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));
  const dob=run(first.day).pairs.find(item=>item.firstOrderBlock.startTime===first.startTime
   &&item.secondOrderBlock.startTime===second.startTime);
  // Philips spätere 50%-Grenze für beide OBs ersetzt hier ausdrücklich die alte Positiv-Erwartung.
  if(policy.references.find(r=>r.id===pair.id).expected==='rejected'){
   expect(dob).toBeUndefined();
   const fixture=days.get(first.day),historical=detectDoubleOrderBlocks({m5Candles:fixture.candles.m5,
    m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to,maxRetestDepthFraction:1}).pairs
    .find(p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime);
   expect(historical).toBeDefined();expect(historical.secondPenetration.maxPenetrationFraction).toBeGreaterThan(.5);
   return;
  }
  expect(dob).toBeDefined();expect(dob.direction).toBe(first.dir===1?'long':'short');
  expect(dob.entries.a.status).toBe('ready');
  expect(dob.entries.a.entryTime).toBeGreaterThan(dob.secondRetest.recognizedAt);
  expect(dob.entries.a.stopPrice).toBe(first.dir===1?dob.secondOrderBlock.bottom:dob.secondOrderBlock.top);
  expect(dob.entries.a.targetPrice).toBeCloseTo(dob.entries.a.entryPrice
   +first.dir*2*Math.abs(dob.entries.a.entryPrice-dob.entries.a.stopPrice),8);
 });
 it('does not reveal a reference DOB before its M1 entry is known',()=>{
  const fixture=days.get('2026-10-08'),full=run('2026-10-08');
  const pair=manifest.pairs.find(p=>p.id==='P15'),refs=pair.pins.map(pin=>manifest.references.find(r=>r.pin===pin));
  const target=full.pairs.find(p=>p.firstOrderBlock.startTime===refs[0].startTime&&p.secondOrderBlock.startTime===refs[1].startTime);
  const before=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,
   m1Candles:fixture.candles.m1,evaluatedAt:target.recognizedAt-1});
  expect(before.pairs.some(p=>p.id===target.id)).toBe(false);
 });
 it('keeps the first M5 reaction comparison after later invalidation',()=>{
  const fixture=days.get('2026-11-11'),full=run('2026-11-11');
  for(const pair of full.pairs){
   const prefix=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,
    m1Candles:fixture.candles.m1,evaluatedAt:pair.recognizedAt}).pairs.find(p=>p.id===pair.id);
   if(prefix.firstM5ReactionKnownAt!=null)expect(pair.firstM5ReactionKnownAt).toBe(prefix.firstM5ReactionKnownAt);
  }
 });
 it('does not fabricate a pair without M1 reaction evidence or a second OB',()=>{
  const fixture=days.get('2026-10-08');
  expect(detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:[],
   evaluatedAt:fixture.provenance.query.to}).pairs).toEqual([]);
  expect(detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5.slice(0,4),
   m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to}).pairs).toEqual([]);
 });
 it('does not silently bridge missing minutes before the second reference mitigation',()=>{
  const fixture=days.get('2026-10-08'),ref=run('2026-10-08').pairs.find(p=>p.firstOrderBlock.startTime===manifest.references.find(r=>r.pin===467).startTime
   &&p.secondOrderBlock.startTime===manifest.references.find(r=>r.pin===468).startTime);
  const missing=fixture.candles.m1.filter(c=>c.time!==ref.secondRetest.candleTime);
  const result=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:missing,evaluatedAt:fixture.provenance.query.to});
  expect(result.pairs.some(p=>p.id===ref.id)).toBe(false);
 });
 it('does not pair an earlier OB that was wick-invalidated before the second retest',()=>{
  const fixture=days.get('2026-10-08'),ref=run('2026-10-08').pairs.find(p=>p.firstOrderBlock.startTime===manifest.references.find(r=>r.pin===467).startTime
   &&p.secondOrderBlock.startTime===manifest.references.find(r=>r.pin===468).startTime);
  const invalidAt=ref.secondRetest.candleTime-60;
  const changed=fixture.candles.m1.map(c=>c.time===invalidAt?{...c,low:ref.firstOrderBlock.bottom-1}:c);
  const result=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:changed,evaluatedAt:fixture.provenance.query.to});
  expect(result.pairs.some(p=>p.id===ref.id)).toBe(false);
 });
 it('keeps all confirmed pairs in the asserted direction and order, with independent entry variants',()=>{
  for(const day of manifest.days)for(const pair of run(day).pairs){
   const {firstOrderBlock:a,secondOrderBlock:b}=pair,sign=pair.direction==='long'?1:-1;
   expect(a.startTime).toBeLessThan(b.startTime);expect(a.dir).toBe(b.dir);
   expect((b.top-a.top)*sign).toBeGreaterThan(0);expect((b.bottom-a.bottom)*sign).toBeGreaterThan(0);
   expect(pair.firstReaction.recognizedAt).toBeLessThanOrEqual(pair.recognizedAt);
   expect(pair.secondRetest.recognizedAt).toBeLessThan(pair.recognizedAt);
   expect(pair.entries.b.variant).toBe('b');expect(pair.entries.a.variant).toBe('a');
  }
 });
 it('uses the latest matching first reaction before the second retest instead of every older partner',()=>{
  for(const day of manifest.days){
   const bySecond=new Map();
   for(const pair of run(day).pairs){
    expect(pair.firstReaction.recognizedAt).toBeLessThanOrEqual(pair.secondRetest.candleTime);
    const key=pair.secondOrderBlock.startTime;
    if(!bySecond.has(key))bySecond.set(key,new Set());
    bySecond.get(key).add(pair.firstReaction.recognizedAt);
   }
   for(const reactions of bySecond.values())expect(reactions.size).toBe(1);
  }
 });
});
