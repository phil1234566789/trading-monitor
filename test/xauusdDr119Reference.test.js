import {describe,expect,it} from 'vitest';
import fixture from './fixtures/xauusd-dr119-trend-continuation.json';
import {detectOrderBlocks,candleTouchesOrderBlock} from '../src/orderBlockDetection.js';
import {orderBlockMitigationFvg} from '../src/orderBlockMitigation.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {tintM1FvgCandle} from '../src/fvgCandleTint.js';
import {assertNativeReferenceCandles} from './helpers/nativeReferenceFixture.js';

const at=clock=>Date.parse(`2026-09-16T${clock}:00+02:00`)/1000;
const candle=clock=>fixture.candles.m1.find(c=>c.time===at(clock));

// Datenreferenz und bestehende FVG-Geometrie prüfen; das neue Entry-Muster ist noch nicht definiert.
describe('DR119 native reference data, not a trend-continuation detector',()=>{
 it.each(['m1','m5','h1'])('keeps the original %s OHLC and explicit provenance intact',bar=>{
  assertNativeReferenceCandles(fixture,bar);
 });
 it('covers every M1 minute from the sweep through the target without inventing ticks',()=>{
  const rows=fixture.candles.m1.filter(c=>c.time>=at('10:11'));
  expect(rows).toHaveLength(320);
  rows.forEach((c,i)=>expect(c.time).toBe(at('10:11')+i*60));
  const first=rows.find(c=>c.low<=fixture.measured.targetPrice&&c.high>=fixture.measured.targetPrice);
  expect(first.time).toBe(at('15:13'));expect(first.high).toBe(4355.96);
  expect(candle('10:11').low).toBe(4322.81);
 });
 it.each(fixture.measured.signals)('preserves impulse $impulseBerlin and its later causal confirmation',signal=>{
  const before=closedChecklistCandles(fixture.candles.m1,'1m',signal.knownAt-1);
  expect(detectOrderBlocks(before,'1m').some(z=>z.startTime===signal.impulseTime)).toBe(false);
  const available=closedChecklistCandles(fixture.candles.m1,'1m',signal.knownAt);
  const zone=detectOrderBlocks(available,'1m').find(z=>z.startTime===signal.impulseTime);
  expect(zone).toMatchObject(signal.orderBlock);
  const end=available.findIndex(c=>c.time===signal.confirmationTime)+1;
  const fvg=orderBlockMitigationFvg(available,'long',end);
  expect(fvg).toMatchObject({candleTime:signal.impulseTime,recognizedAt:signal.knownAt});
  expect(fvg.gap).toBeCloseTo(signal.fvg.gap,9);
  const tinted=tintM1FvgCandle(available,fvg,'1m','#ffd54f');
  expect(tinted.filter(c=>c.color).map(c=>c.time)).toEqual([signal.impulseTime]);
 });
 it('records a full first fill and a partial second fill without pretending an exact OB touch',()=>{
  const[first,,second]=fixture.measured.signals;
  expect(first.firstFvgOverlapTime).toBe(at('10:47'));
  expect(first.firstFullFillTime).toBe(at('10:50'));
  expect(first.firstOrderBlockTouchTime).toBe(at('10:50'));
  const rows=fixture.candles.m1.filter(c=>c.time>=second.knownAt&&c.time<=at('11:30'));
  expect(second.firstFvgOverlapTime).toBe(at('11:27'));
  expect(rows.some(c=>candleTouchesOrderBlock(c,second.orderBlock))).toBe(false);
  expect(Math.min(...rows.map(c=>c.low))).toBe(4328.95);
  expect(4328.95-second.orderBlock.top).toBeCloseTo(.03,9);
  expect(second.firstFullFillTime).toBeNull();
 });
 it('keeps retrospective journal annotations separate from algorithm acceptance',()=>{
  const journal=fixture.journal;
  expect(journal.range[0]).toMatchObject({id:119,instrument:'XAUUSD',direction:'long',trade_setup_id:null});
  expect(journal.positions.map(p=>p.id)).toEqual([142,143]);
  expect(journal.positions.every(p=>p.dealing_range_id===119)).toBe(true);
  const entry=journal.positions.find(p=>p.id===142),signal=fixture.measured.signals[1];
  expect(Date.parse(entry.triggered_at)/1000).toBe(at('10:53'));
  expect(signal.knownAt).toBe(at('10:54'));
  expect(fixture.philipAnnotations.desiredFutureRegression).toMatchObject({algorithmStatus:'not-implemented',acceptanceDefinition:'pending'});
  expect(candle('11:30').low).toBeLessThanOrEqual(journal.positions[1].entry_price);
  expect(candle('11:30').high).toBeGreaterThanOrEqual(journal.positions[1].entry_price);
  const sweep=journal.evidence.find(e=>e.id===366),target=journal.targets.find(t=>t.id===157);
  expect(journal.liquidityLevels.find(l=>l.id===sweep.liquidity_level_id).price).toBe(sweep.price);
  expect(journal.liquidityLevels.find(l=>l.id===target.liquidity_level_id).price).toBe(target.price);
  expect(journal.liquidityLevels.find(l=>l.id===sweep.liquidity_level_id).touched).toBe(false);
  expect(sweep.touched_time).not.toBeNull();
 });
});
