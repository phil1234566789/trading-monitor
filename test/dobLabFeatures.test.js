import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {detectDoubleOrderBlocks} from '../src/doubleOrderBlocks.js';
import {dobObsInSourceZone,dobCounterDobs} from '../src/dobLabFeatures.js';
import {createDobCounterDobGate} from '../src/dobCounterDob.js';

describe('DOB-Merkmal-Labor',()=>{
 const zone={top:110,bottom:100};
 it('beide OBs in der Kraft-Zone nur bei Überlappung beider',()=>{
  expect(dobObsInSourceZone({firstOrderBlock:{top:105,bottom:102},secondOrderBlock:{top:101,bottom:95}},{zone})).toEqual({ob1:true,ob2:true,both:true});
  expect(dobObsInSourceZone({firstOrderBlock:{top:105,bottom:102},secondOrderBlock:{top:99,bottom:95}},{zone})).toMatchObject({ob2:false,both:false});
  expect(dobObsInSourceZone({firstOrderBlock:{top:1,bottom:0},secondOrderBlock:{top:1,bottom:0}},null)).toBeNull();
 });
 it('Gegen-DOBs: nur Gegenrichtung im Fenster, je OB2 einmal',()=>{
  const pair=(direction,recognizedAt,ob2)=>({direction,recognizedAt,secondOrderBlock:{startTime:ob2}});
  const dob={pairs:[pair('short',150,1),pair('short',160,1),pair('short',170,2),pair('long',150,3),pair('short',90,4),pair('short',210,5)]};
  expect(dobCounterDobs(dob,'long',100,200)).toMatchObject({count:2});
  expect(dobCounterDobs({pairs:[]},'long',100,200)).toMatchObject({count:0});
 });
});

// Philips Pins (scripts/dobLabPinFixtures.mjs): 526 „bärische DOBs direkt gegen den Long“ und 522 tragen Gegen-DOBs seit dem
// Quellen-Retest, 521 (Loss aus anderem Grund) nicht. Zahlen wie im Labor-Lauf (detectDoubleOrderBlocks auf 2 Tagen bis Entry).
const {cases}=JSON.parse(readFileSync(new URL('./fixtures/dob-native/lab-pins.json',import.meta.url),'utf8'));
const candles=rows=>rows.map(([time,open,high,low,close,ignored])=>({time,open,high,low,close,...(ignored?{ignored:true}:{})}));
const COUNTS={521:0,522:6,526:1};
describe('DOB-Merkmal-Labor: Gegen-DOB an Philips Pins',()=>{
 it.each(cases)('Pin $pin ($expected, $direction)',c=>{
  const dob=detectDoubleOrderBlocks({instrument:'XAUUSD',evaluatedAt:c.entryTime,m5Candles:candles(c.m5),m1Candles:candles(c.m1),options:{retests:false}});
  expect(dobCounterDobs(dob,c.direction,c.sourceRetestAt,c.entryTime).count).toBe(COUNTS[c.pin]);
 });
 // v3-Gate auf denselben Kerzen: gleiche Zählung, Sperre je nach Modus.
 it.each(cases)('Pin $pin: Gate wie die Labor-Zählung',c=>{
  const m5=candles(c.m5),m1=candles(c.m1),setup={direction:c.direction,entryTime:c.entryTime,
   chart:{firstOrderBlockStart:c.sourceRetestAt+3600},sourceOfStrength:{retestAgeSeconds:3600}};
  const all=createDobCounterDobGate({m5Candles:m5,m1Candles:m1})(setup);
  expect(all).toMatchObject({count:COUNTS[c.pin],rejectReason:COUNTS[c.pin]?'counterDob':null});
  const live=createDobCounterDobGate({m5Candles:m5,m1Candles:m1},{mode:'live_only'})(setup);
  expect(live.liveCount).toBeLessThanOrEqual(all.count);
  expect(live.rejectReason).toBe(live.liveCount?'counterDob':null);
  expect(createDobCounterDobGate({m5Candles:m5,m1Candles:m1})({...setup,entryTime:null})).toBeNull();
  // Kombi: lebende sperren, nur tote → TP 5R (Pin 522: 6 Gegen-DOBs, alle tot).
  const combo=createDobCounterDobGate({m5Candles:m5,m1Candles:m1},{mode:'live_block_dead_5r'})(setup);
  expect(combo).toMatchObject(live.liveCount?{rejectReason:'counterDob'}:all.count?{rejectReason:null,tpR:5}:{rejectReason:null});
  if(!all.count)expect(combo.tpR).toBeUndefined();
 });
});
