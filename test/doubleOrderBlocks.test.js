import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';

const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${name}.json`,import.meta.url),'utf8'));
const manifest=load('references'),days=new Map(manifest.days.map(day=>[day,load(day)]));
const results=new Map();
const run=day=>{
 if(!results.has(day)){const fixture=days.get(day);results.set(day,detectDoubleOrderBlocks({instrument:'XAUUSD',
  m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:fixture.provenance.query.to}));}
 return results.get(day);
};
const find=(day,first,second)=>run(day).pairs.find(p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime);
const refs=pair=>pair.pins.map(pin=>manifest.references.find(ref=>ref.pin===pin));

describe('double order blocks from native candles',()=>{
 // P14/P16 waren unter v6 wegen >50 % OB2-Tiefe abgelehnt; die tragfähige M1-Reaktion ersetzt dieses Gate.
 it.each(manifest.pairs)('recognizes $id through OB detection and M1 reaction, without pin IDs as algorithm input',pair=>{
  const [first,second]=refs(pair),dob=find(first.day,first,second);
  expect(dob).toBeDefined();expect(dob.direction).toBe(first.dir===1?'long':'short');
  expect(dob.firstReaction.recognizedAt).toBeLessThanOrEqual(dob.secondRetest.candleTime);
  expect(dob.recognizedAt).toBe(dob.secondReaction.recognizedAt);
  for(const entry of Object.values(dob.entries)){
   expect(['ready','pending','invalid']).toContain(entry.status);
   if(entry.status!=='ready')continue;
   expect(entry.entryTime).toBeGreaterThan(dob.secondRetest.recognizedAt);
   expect(entry.stopPrice).toBe(first.dir===1?dob.secondOrderBlock.bottom:dob.secondOrderBlock.top);
   expect(entry.targetPrice).toBeCloseTo(entry.entryPrice+first.dir*2*Math.abs(entry.entryPrice-entry.stopPrice),8);
  }
 });
 it.each(manifest.pairs)('keeps $id at its causal confirmation without later candles changing OB1',pair=>{
  const [first,second]=refs(pair),fixture=days.get(first.day),full=find(first.day,first,second);
  const input={instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1};
  const prefix=detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt}).pairs.find(p=>p.id===full.id);
  expect(prefix.firstReaction).toEqual(full.firstReaction);expect(prefix.firstRetestHold.status).toBe('passed');
  expect(detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt-1}).pairs.some(p=>p.id===full.id)).toBe(false);
 });
 it('recognizes the additional positive reference P17 (Pins 505/506) with an M5-edge entry on OB2',()=>{
  const fixture=load('2026-10-20-p17');
  const dob=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,
   evaluatedAt:fixture.candles.m1.at(-1).time+60}).pairs.find(p=>p.id===fixture.provenance.key);
  expect(dob.entries.a).toMatchObject({status:'ready',entryTime:1792481460,entryPrice:4130.55,stopPrice:4136.58});
  expect(dob.entries.b.status).toBe('pending');
 });
 it('does not reveal a reference DOB before its M1 reaction is known',()=>{
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
