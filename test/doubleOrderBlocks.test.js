import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {detectDoubleOrderBlocks,firstRetestHoldAnchor,reactionOptionsFor} from '../src/doubleOrderBlocks.js';
import {orderBlockRetestHoldHistory,orderBlockRetestHoldAt} from '../src/orderBlockRetestHold.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,exactRetestAnchor} from '../src/orderBlockReaction.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {m1FvgFullyFilled} from '../src/m1FvgEntrySequence.js';

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

// Unveränderte v9-Kandidaten vor Wiederherstellung des Gegner-Gates; Tupel = [Zeit, Preis, optional Retest-SL].
const PRE_OPPONENT_CANDIDATES={
 P1:{a:[1794387840,4056.71,4059.69],b:'pending'},P2:{a:[1794217980,4097.82],b:[1794218520,4098.01]},P3:{a:[1793988960,4061.44],b:[1793997000,4063.99]},
 P4:{a:[1793908560,4112.9],b:'pending'},P5:{a:[1793769540,3953.11],b:'pending'},P6:{a:[1793694300,3908.58],b:[1793694420,3908.5]},
 P7:{a:[1793672220,3945.18],b:'invalid'},P8:{a:[1793606700,3903.21,3905.28],b:[1793606880,3900.06,3905.28]},
 P9:{a:[1793363880,3964.07],b:'pending'},P10:{a:[1793352180,3991.07,3994.79],b:[1793352300,3990.96,3994.79]},
 P11:{a:[1792691460,4045.14],b:'invalid'},P12:{a:[1792638060,4113.81],b:'pending'},P13:{a:[1792578000,4114.94,4111.63],b:'invalid'},
 // P14/Pin 500: SL = High der M1-Kerze 16.10. 14:35 Berlin.
 P14:{a:[1792154280,4177.28,4181.45],b:[1792158360,4175.33,4181.45]},P15:{a:[1791466380,4127.93],b:[1791466620,4125.29]},
 P16:{a:[1792557120,4120.27],b:[1792557540,4117.62]},
};

// Native Einzelbelege: Mittelkerze, knownAt, Unter-/Oberkante, erste Vollfüllung bekannt (null = nicht im Archiv).
// Diese Tabelle begründet die A-Ablehnungen, keine Rangfolge oder Stärke mehrerer Gegner.
const OPPOSING_SOURCES={
 P1:[1794387420,1794387540,4055.95,4056.89,1794387900],
 P4:[1793907840,1793907960,4112.13,4113.52,1793908620],
 P5:[1793756700,1793756820,3954.47,3958.29,1793770200],
 P6:[1793693460,1793693580,3907.28,3908.22,1793695200],
 P7:[1793671920,1793672040,3944,3944.67,1793672280],
 P10:[1793349960,1793350080,3989.48,3992.52,1793352540],
 P12:[1792637520,1792637640,4113.07,4113.65,1792638120],
 P15:[1791462600,1791462720,4123.19,4130.06,1791467340],
 P16:[1792556820,1792556940,4119.06,4121.59,1792557180],
 P17:[1792480620,1792480740,4129.16,4130.27,null],
};

function assertOpposingEvidence(fixture,ob,candidate,evidence){
 const [candleTime,recognizedAt,bottom,top,filledAt]=evidence,at=candidate[0];
 const rows=closedChecklistCandles(fixture.candles.m1,'1m',at),context=createOrderBlockReactionContext(rows,at,'XAUUSD');
 const r=evaluateOrderBlockReaction(context,ob),sources=context.byDirection[ob.dir===1?'short':'long'];
 const fvg=sources.find(f=>f.candleTime===candleTime);
 expect(fvg).toMatchObject({candleTime,recognizedAt,bottom,top});
 expect(recognizedAt).toBeLessThanOrEqual(at);
 expect(r.fvg).toMatchObject({recognizedAt:at,confirmationPrice:candidate[1]});
 const path=rows.filter(c=>c.time>=r.contact.candleTime),low=Math.min(...path.map(c=>c.low)),high=Math.max(...path.map(c=>c.high));
 const active=sources.filter(f=>f.recognizedAt<=at&&f.bottom<=high&&f.top>=low&&!rows.some(c=>c.time>=f.recognizedAt&&m1FvgFullyFilled(c,f)));
 expect(active).toEqual([fvg]);
 const fill=fixture.candles.m1.find(c=>c.time>=recognizedAt&&m1FvgFullyFilled(c,fvg));
 expect(fill?fill.time+60:null).toBe(filledAt);
 if(filledAt!=null)expect(filledAt).toBeGreaterThan(at);
 expect(r.routes.a).toMatchObject({status:'rejected',reason:'opposingFvgOpen',knownAt:at});
 return r;
}

describe('double order blocks from native candles',()=>{
 // P16 war unter v6 wegen >50 % OB2-Tiefe abgelehnt; Entry b trifft den Handoff-Fall Pin 502 (06:39, 4117,62, SL 4112,95).
 it.each(manifest.pairs)('recognizes $id with its expected route statuses',pair=>{
  const [first,second]=refs(pair),dob=find(first.day,first,second),historical=PRE_OPPONENT_CANDIDATES[pair.id];
  expect(dob,pair.id).toBeDefined();
  const expected={...historical};
  if(OPPOSING_SOURCES[pair.id]){
   assertOpposingEvidence(days.get(first.day),dob.secondOrderBlock,historical.a,OPPOSING_SOURCES[pair.id]);
   expected.a='invalid';
   expect(dob.entries.a).toMatchObject({reason:'opposingFvgOpen',knownAt:historical.a[0]});
  }
  // Bestätigter Retry-Vertrag: der verworfene erste Versuch bleibt in attempts, nur die öffentliche Route folgt dem Nachfolger.
  if(pair.id==='P7')expected.b=[1793673300,3943.16];
  if(pair.id==='P11')expected.b='pending';
  expect(dob.direction).toBe(first.dir===1?'long':'short');
  expect(dob.firstReaction.recognizedAt).toBeLessThanOrEqual(dob.secondRetest.candleTime);
  expect(dob.recognizedAt).toBe(dob.secondReaction.recognizedAt);
  for(const [route,want] of Object.entries(expected)){
   const entry=dob.entries[route];
   if(typeof want==='string'){expect(entry.status).toBe(want);continue;}
   expect(entry).toMatchObject({status:'ready',entryTime:want[0],entryPrice:want[1],stopAnchor:want[2]?'retestExtreme':'m5-edge',
    stopPrice:want[2]??(first.dir===1?dob.secondOrderBlock.bottom:dob.secondOrderBlock.top)});
   expect(entry.targetPrice).toBeCloseTo(entry.entryPrice+first.dir*2*Math.abs(entry.entryPrice-entry.stopPrice),8);
  }
  if(pair.id==='P7'||pair.id==='P11'){
   const fixture=days.get(first.day),at=fixture.candles.m1.at(-1).time+60;
   const r=evaluateOrderBlockReaction(createOrderBlockReactionContext(fixture.candles.m1,at,'XAUUSD'),dob.secondOrderBlock);
   expect(r.routes.b.attempts).toHaveLength(2);
   expect(r.routes.b.attempts[0]).toMatchObject({status:'rejected',knownAt:pair.id==='P7'?1793672760:1792691760});
   expect(r.routes.b.attempts[1]).toMatchObject({status:pair.id==='P7'?'entry':'pending',
    fvg:{candleTime:pair.id==='P7'?1793673000:1792692000,recognizedAt:pair.id==='P7'?1793673120:1792692120}});
  }
 });
 it.each(manifest.pairs)('keeps $id at its causal confirmation without later candles changing OB1',pair=>{
  const [first,second]=refs(pair),fixture=days.get(first.day),full=find(first.day,first,second);
  const input={instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1};
  const prefix=detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt}).pairs.find(p=>p.id===full.id);
  expect(prefix.firstReaction).toEqual(full.firstReaction);expect(prefix.firstRetestHold.status).toBe('passed');
  expect(detectDoubleOrderBlocks({...input,evaluatedAt:full.recognizedAt-1}).pairs.some(p=>p.id===full.id)).toBe(false);
 });
 it('recognizes positive DOB P17 (Pins 505/506), while its open 09:17 opponent blocks A and B stays pending',()=>{
  const fixture=load('2026-10-20-p17');
  const dob=detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,
   evaluatedAt:fixture.candles.m1.at(-1).time+60}).pairs.find(p=>p.id===fixture.provenance.key);
  expect(dob).toBeDefined();
  assertOpposingEvidence(fixture,dob.secondOrderBlock,[1792481460,4130.55,4136.58],OPPOSING_SOURCES.P17);
  expect(dob.entries.a).toMatchObject({status:'invalid',reason:'opposingFvgOpen',knownAt:1792481460});
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
 it('anchors the OB1 hold on its exact retest only when that retest is known before the OB2 retest',()=>{
  const fixture=days.get('2026-11-11'),[first]=refs(manifest.pairs.find(p=>p.id==='P1'));
  const zone=detectOrderBlocks(fixture.candles.m5,'5m',true,0).find(z=>z.startTime===first.startTime&&z.dir===first.dir);
  const ob={...zone,recognizedAt:orderBlockRecognitionTimes(fixture.candles.m5,'5m').get(first.startTime),timeframe:'5M'};
  const context=createOrderBlockReactionContext(fixture.candles.m1,fixture.provenance.query.to,'XAUUSD');
  const reaction=evaluateOrderBlockReaction(context,ob,{nearTouch:true}),exact=exactRetestAnchor(context,ob,reaction);
  // Near-Reaktion 1794384120, exakter Retest erst mit seiner FVG 1794387000 belegt.
  expect(reaction.contact.status).toBe('nearTouch');expect(exact).toEqual({fromTime:1794387000,price:4061.66});
  expect(firstRetestHoldAnchor(exact,1794387600)).toBe('exact');
  expect(firstRetestHoldAnchor(exact,1794386940)).toBe('near');
  expect(firstRetestHoldAnchor(false,1794387600)).toBe('near');
 });
 it('derives the reaction options of both roles from one validated source',()=>{
  expect(reactionOptionsFor('first')).toEqual({nearTouch:false,bridgeClosures:false});
  expect(reactionOptionsFor('second')).toEqual({nearTouch:false,bridgeClosures:false});
  expect(reactionOptionsFor('first',{nearTouch:'second'}).nearTouch).toBe(false);
  expect(reactionOptionsFor('second',{nearTouch:'second',bridgeClosures:true})).toEqual({nearTouch:true,bridgeClosures:true});
  expect(()=>reactionOptionsFor('first',{nearTouch:'sometimes'})).toThrow(RangeError);
  expect(()=>reactionOptionsFor('third')).toThrow(RangeError);
  expect(()=>detectDoubleOrderBlocks({evaluatedAt:1,options:{nearTouch:true}})).toThrow(RangeError);
  // P14: Near-Touch auf OB2 reagiert früher, dort ist die interne FVG noch offen (M5-Kante); exakt bleibt das Retest-Extrem.
  const [first,second]=refs(manifest.pairs.find(p=>p.id==='P14')),fixture=days.get(first.day);
  const stop=options=>detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,
   evaluatedAt:fixture.provenance.query.to,options}).pairs.find(p=>p.firstOrderBlock.startTime===first.startTime&&p.secondOrderBlock.startTime===second.startTime).entries.a;
  expect(stop({})).toMatchObject({stopAnchor:'retestExtreme',stopPrice:4181.45});
  expect(stop({nearTouch:'second'})).toMatchObject({stopAnchor:'m5-edge',stopPrice:4181.98});
 });
});

describe('XAU daily market closure (W1: bridgeClosures false)',()=>{
 // 05./06.11.: OB1 vom 05.11. reagiert erst nach der Tagespause 23:00–00:01 Berlin.
 const [d1,d2]=['2026-11-05','2026-11-06'].map(load);
 const m5=[...d1.candles.m5,...d2.candles.m5],m1=[...d1.candles.m1,...d2.candles.m1],evaluatedAt=d2.provenance.query.to;
 const key='dob:XAUUSD:1:1793838000:1793921100',pauseFrom=1793916060,pauseTo=1793919660;
 const detect=(at,options)=>detectDoubleOrderBlocks({instrument:'XAUUSD',m5Candles:m5,m1Candles:m1,evaluatedAt:at,options});
 const ob1=()=>{const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1793838000);
  return {...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793838000),timeframe:'5M'};};
 it('keeps the pair only when the reaction may bridge the closure',()=>{
  expect(m1.filter(c=>c.time>=pauseFrom&&c.time<pauseTo).length).toBeLessThan(10);
  expect(detect(evaluatedAt,{bridgeClosures:true}).pairs.map(p=>p.id)).toContain(key);
  expect(detect(evaluatedAt).pairs.map(p=>p.id)).not.toContain(key);
 });
 it('lets the open OB expire as marketClosed, during the pause and afterwards, instead of missingHistory',()=>{
  for(const at of [pauseFrom+1800,evaluatedAt]){
   const context=createOrderBlockReactionContext(m1.filter(c=>c.time+60<=at),at,'XAUUSD');
   expect(evaluateOrderBlockReaction(context,ob1(),reactionOptionsFor('first'))).toMatchObject({state:'false',structuralState:'unknown',reason:'marketClosed'});
   expect(evaluateOrderBlockReaction(context,ob1(),{bridgeClosures:true}).reason).not.toBe('marketClosed');
  }
  const bridged=createOrderBlockReactionContext(m1,evaluatedAt,'XAUUSD');
  expect(evaluateOrderBlockReaction(bridged,ob1(),{bridgeClosures:true})).toMatchObject({structuralState:'true',knownAt:1793920920});
 });
 it('treats a first-retest hold across the closure as unknown (counted as firstHoldUnknown)',()=>{
  // Das Retest-Tag-Gate fängt solche Paare im Detektor meist vorher ab; der Hold selbst darf die Pause nicht bestätigen.
  const hold=instrument=>orderBlockRetestHoldAt(orderBlockRetestHoldHistory({candles:m1,direction:'long',anchorPrice:1,
   fromTime:pauseFrom-600,evaluatedAt:pauseTo+600,instrument}),pauseTo+600);
  expect(hold(null)).toMatchObject({status:'unknown',reason:'missingHistory'});
  expect(hold('XAUUSD').status).toBe('passed');
 });
});
