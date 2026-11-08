import {describe,expect,it} from 'vitest';
import fixture from './fixtures/xauusd-dr121-exploratory-short.json';
import {assertNativeReferenceCandles} from './helpers/nativeReferenceFixture.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {obMinimum} from '../src/instrumentConfig.js';

const at=clock=>Date.parse(`2026-10-29T${clock}:00+01:00`)/1000;
const sweep=fixture.measured.sweep;
const goldObs=until=>detectOrderBlocks(closedChecklistCandles(fixture.candles.m5,'5m',until),'5m',true,obMinimum('XAUUSD','5m'));
const postSweep=zone=>zone.dir===-1&&zone.startTime>sweep.firstM1TouchTime;

// Schwaches exploratives Beispiel: keine neue Strategie und kein positiver Pflicht-Entry-Test.
describe('DR121 exploratory native reference with late M5 order block',()=>{
 it.each(['m1','m5','h1'])('preserves original %s data and hashes',bar=>assertNativeReferenceCandles(fixture,bar));
 it('keeps every native M1 minute and distinguishes M5 bucket from precise sweep minute',()=>{
  fixture.candles.m1.forEach((c,i)=>expect(c.time).toBe(at('10:10')+i*60));
  expect(sweep.m5ContainingBar).toBe(at('12:05'));expect(sweep.firstM1TouchTime).toBe(at('12:09'));
  const first=fixture.candles.m1.find(c=>c.time>=at('10:10')&&c.high>=sweep.price);
  expect(first).toEqual(sweep.m1TouchCandle);expect(first.high).toBe(4038.76);
 });
 it.each(['12:20','12:24'])('has no completed qualifying post-sweep bearish OB at entry %s',clock=>{
  expect(goldObs(at(clock)).filter(postSweep)).toEqual([]);
 });
 it('does not promote the late small positive gap into a qualifying Gold OB',()=>{
  const small=fixture.measured.orderBlocks.firstPositiveGapAfterSweep;
  expect(small).toMatchObject({impulseTime:at('12:35'),knownAt:at('12:45')});
  expect(small.gap).toBeCloseTo(.68,9);expect(obMinimum('XAUUSD','5m')).toBe(.75);
  const generic=detectOrderBlocks(closedChecklistCandles(fixture.candles.m5,'5m',small.knownAt),'5m');
  expect(generic.some(z=>z.dir===-1&&z.startTime===small.impulseTime)).toBe(true);
  expect(goldObs(small.knownAt).filter(postSweep)).toEqual([]);
 });
 it('makes the first qualifying bearish OB available at 13:00, after both entries and early exit',()=>{
  const late=fixture.measured.orderBlocks.firstGoldQualifiedAfterSweep;
  expect(late).toMatchObject({impulseTime:at('12:50'),knownAt:at('13:00'),top:4030.03,bottom:4026.64});
  expect(late.gap).toBeCloseTo(1.97,9);
  expect(goldObs(late.knownAt-1).filter(postSweep)).toEqual([]);
  expect(goldObs(late.knownAt).filter(postSweep).map(z=>z.startTime)).toEqual([late.impulseTime]);
  expect(late.knownAt).toBeGreaterThan(at('12:54'));
  expect(fixture.measured.orderBlocks.existingConfirmation.impulseTime).toBe(at('06:40'));
  expect(fixture.measured.orderBlocks.existingConfirmation.knownAt).toBe(at('06:50'));
 });
 it('preserves current journal exits separately from the initial relay and does not force detection',()=>{
  expect(fixture.philipAnnotations).toMatchObject({referenceUse:'exploratory-with-reservation',mustDetectAsPositive:false,algorithmAcceptance:'not-specified'});
  expect(fixture.journal.range[0]).toMatchObject({id:121,direction:'short',strategy_setup:'setup2',trade_setup_id:null});
  const p144=fixture.journal.positions.find(p=>p.id===144),p145=fixture.journal.positions.find(p=>p.id===145);
  expect(Date.parse(p144.exit_time)/1000).toBe(at('17:09'));expect(p144.exit_price).toBe(4015.42);
  expect(Date.parse(p145.exit_time)/1000).toBe(at('12:54'));expect(p145.exit_price).toBe(4023.07);
  expect(fixture.philipAnnotations.initiallyRelayedPositions.find(p=>p.id===144).exitTime).toBe(at('12:54'));
  expect(fixture.measured.targetTouches.map(t=>t.firstM1TouchTime)).toEqual([at('12:54'),at('17:09'),null]);
  for(const p of [p144,p145]){
   const entry=fixture.candles.m1.find(c=>c.time===Date.parse(p.triggered_at)/1000);
   expect(entry.low).toBeLessThanOrEqual(p.entry_price);expect(entry.high).toBeGreaterThanOrEqual(p.entry_price);
  }
  const evidence=fixture.journal.evidence.find(e=>e.id===371);
  const level=fixture.journal.liquidityLevels.find(l=>l.id===evidence.liquidity_level_id);
  expect(level.price).toBe(sweep.price);expect(level.touched).toBe(false);expect(evidence.touched_time).not.toBeNull();
 });
});
