import { afterEach, expect, it, vi } from 'vitest';
import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
import { evaluateTradingHours, evaluateChecklistTime } from '../src/tradeSetupChecklistTime.js';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import * as checklist from '../src/tradeSetupChecklist.js';
import * as m1Checks from '../src/m1Checklist.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

assumeFixtureH1Direction('downtrend', true);
afterEach(() => vi.restoreAllMocks());
const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const windows = { weekday: [[587, 593]], saturday: [], sunday: [] };
const input = { instrument:'GBPUSD', h1Candles:h1.candles, m5Candles:m5, m1Candles:m1,
  settings:{rangesFixedStartActive:true,rangesFixedStartTime:h1.cutoff},sessionConfigs:config.sessions,
  tradingWindows:windows,fromTime:at('09:25'),toTime:at('09:55') };

it.each([
  ['2026-03-27T08:00:00Z','GBPUSD','passed'],
  ['2026-03-30T07:00:00Z','GBPUSD','passed'],
  ['2026-10-23T07:00:00Z','GBPUSD','passed'],
  ['2026-10-26T08:00:00Z','GBPUSD','passed'],
  ['2026-03-30T06:59:00Z','GBPUSD','blocked'],
  ['2026-03-30T08:00:00Z','GBPUSD','blocked'],
  ['2026-03-30T09:00:00Z','GBPUSD','passed'],
  ['2026-03-28T08:00:00Z','GBPUSD','blocked'],
  ['2026-03-29T07:00:00Z','GBPUSD','passed'],
  ['2026-03-30T07:00:00Z','EURUSD','blocked'],
])('uses Berlin boundaries, DST, weekday and instrument schedule at %s (%s)',(time,instrument,status)=>{
  const schedules={GBPUSD:{weekday:[[540,600],[660,720]],saturday:[],sunday:[[540,600]]},
    EURUSD:{weekday:[[600,660]],saturday:[],sunday:[]}};
  const args={instrument,evaluatedAt:Date.parse(time)/1000,tradingWindows:schedules[instrument]};
  expect(evaluateTradingHours(args).status).toBe(status);
  expect(evaluateChecklistTime({...args,sessions:[],news:[],newsLoadStatus:'ready'}).outsideTradingHours).toBe(status==='blocked');
});

it('fails explicitly before costly evaluation when historical schedules are missing or malformed',async()=>{
  const spy=vi.spyOn(checklist,'evaluateTradeSetupChecklist');
  for(const tradingWindows of [undefined,{weekday:[[0,1440]]},{...windows,sunday:[[1400,1500]]}])
    await expect(scanTradeSetup2Window({...input,tradingWindows})).rejects.toThrow('historical trading_windows: GBPUSD');
  expect(spy).not.toHaveBeenCalled();
});

it('does not call H1/M5 checklist or M1 search outside trading windows',async()=>{
  const expensive=vi.spyOn(checklist,'evaluateTradeSetupChecklist'),m1Spy=vi.spyOn(m1Checks,'evaluateM1Checklist');
  expect(await scanTradeSetup2Window({...input,tradingWindows:{weekday:[],saturday:[],sunday:[]}})).toEqual([]);
  expect(expensive).not.toHaveBeenCalled();expect(m1Spy).not.toHaveBeenCalled();
});

it('reopens within an M5 interval using the complete closed history and saves only permitted active stands',async()=>{
  const spy=vi.spyOn(checklist,'evaluateTradeSetupChecklist');
  const result=await scanTradeSetup2Window(input);
  expect(result.filter(s=>s.entry)).toHaveLength(1);
  expect(result.every(s=>s.knownAt>=at('09:47')&&s.knownAt<at('09:53'))).toBe(true);
  expect(result.filter(s=>!s.entry).every(s=>s.checklist.setup.primary.validity.state!=='ended')).toBe(true);
  expect(new Set(result.map(s=>s.id)).size).toBe(result.length);
  const first=spy.mock.calls[0][0];
  expect(first.evaluatedAt).toBe(at('09:47'));
  expect(first.m5Candles.some(c=>c.time<at('09:25'))).toBe(true);
  for(const [args] of spy.mock.calls){
    expect(evaluateTradingHours({...args,tradingWindows:windows}).status).toBe('passed');
    expect(args.h1Candles.every(c=>c.time+3600<=args.evaluatedAt)).toBe(true);
    expect(args.m5Candles.every(c=>c.time+300<=args.evaluatedAt)).toBe(true);
  }
  const prefix=await scanTradeSetup2Window({...input,toTime:at('09:50'),m1Candles:m1.filter(c=>c.time+60<=at('09:50'))});
  expect(prefix.filter(s=>s.entry)).toEqual(result.filter(s=>s.entry));
});
