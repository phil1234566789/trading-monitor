import { expect, it } from 'vitest';
import { createIncrementalOrderBlockDetector } from '../src/incrementalOrderBlocks.js';
import { createSharedOrderBlockDetector } from '../src/sharedOrderBlocks.js';
import { reconstructObLifecycle } from '../supabase/functions/_shared/obReplayLifecycle.ts';
import { mergePinnedZones } from '../src/priceChartObZones.js';
import { orderBlockEndTime } from '../src/orderBlocks.js';
import { detectOrderBlocks as mcpDetect } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as edgeDetect } from '../supabase/functions/_shared/orderBlocks.ts';
import { detectOrderBlocks } from '../src/orderBlockDetection.js';

it.each(['1H', '4H'])('%s retains the first touch before a later invalidation, including replay rollback', async tf => {
  const duration = tf === '1H' ? 3600 : 14400;
  const row = { timeframe: tf, direction: 'short', top: 12, bottom: 10,
    start_time: new Date(0).toISOString(), end_time: new Date(8 * duration * 1000).toISOString(),
    touched: true, invalidated: true };
  const native = [0,1,2,3,4,5,6,7,8].map(i => ({time:i*duration, high:i===3?11:i===8?13:9,low:8}));
  const read = async bar => bar === '5m' ? [] : native;
  const [before] = await reconstructObLifecycle([row], 6*duration, read);
  expect(before).toMatchObject({touched:true,invalidated:false,end_time:new Date(3*duration*1000).toISOString()});
  const [after] = await reconstructObLifecycle([row], 9*duration, read);
  expect(after).toMatchObject({touched:true,invalidated:true,end_time:before.end_time});
});

it('uses closed M5 candles for separate contact and invalidation during the current native candle', async () => {
  const row = {timeframe:'1H',direction:'short',top:12,bottom:10,start_time:new Date(0).toISOString(),
    touched:true,invalidated:true,end_time:new Date(10800*1000).toISOString()};
  const read = async bar => bar === '5m'
    ? [{time:10800,low:9,high:11},{time:11100,low:9,high:13}]
    : [0,3600,7200].map(time=>({time,low:8,high:9}));
  const [zone] = await reconstructObLifecycle([row],11100,read);
  expect(zone).toMatchObject({touched:true,invalidated:false,end_time:new Date(10800*1000).toISOString()});
});

it('pins use canonical replay state even with indicator/history toggles disabled', () => {
  const pin={timeframe:'1H',dir:-1,startTime:100,top:12,bottom:10,touched:true,invalidated:true,endTime:90000};
  const canonical={...pin,invalidated:false,endTime:10000};
  const ctx={dbObZones:[canonical],m5Candles:[],symbol:'GBPUSD',replayUntil:20000,price:null};
  canonical.instrument='GBPUSD';
  expect(mergePinnedZones([], [pin], [], ctx)).toEqual([canonical]);
  expect(mergePinnedZones([], [pin], [], {...ctx,dbObZones:[]})).toEqual([]);
  expect(mergePinnedZones([], [pin], [], {...ctx,replayUntil:1000})).toEqual([]);
});

it.each(['5m','1H','4H'])('%s drawing ends at first contact after a later invalidation', tf => {
  const candles=[
    {time:0,open:1,close:1,low:0.9,high:1.1},
    {time:100,open:1,close:1,low:0.9,high:1.1},
    {time:200,open:1,close:1.3,low:0.95,high:1.4},
    {time:300,open:1.4,close:1.5,low:1.3,high:1.6},
    {time:400,open:1.2,close:1.2,low:1.05,high:1.3},
    {time:500,open:1,close:0.8,low:0.7,high:1.1},
  ];
  expect(mcpDetect(candles,tf)).toEqual(detectOrderBlocks(candles,tf));
  expect(edgeDetect(candles,tf)).toEqual(detectOrderBlocks(candles,tf));
  const zone=detectOrderBlocks(candles,tf).find(z=>z.startTime===200 && z.dir===1);
  expect(zone).toMatchObject({invalidated:true,touchedTime:400,endTime:500});
  expect(orderBlockEndTime(zone)).toBe(400);
  const pin={...zone,timeframe:tf==='5m'?'5M':tf,touched:false,invalidated:false,endTime:99999};
  const canonical={...zone,instrument:'GBPUSD',timeframe:pin.timeframe};
  const ctx={dbObZones:[canonical],m5Candles:candles,symbol:'GBPUSD',replayUntil:null,price:null};
  const [pinned]=mergePinnedZones([], [pin], [], ctx);
  expect(pinned).toMatchObject({invalidated:true,touchedTime:400});
  expect(orderBlockEndTime(pinned)).toBe(400);
  for (const create of [createIncrementalOrderBlockDetector, createSharedOrderBlockDetector]) {
    const detect = create(tf);
    for (const end of [4,5,6,4,6]) {
      const prefix = candles.slice(0,end);
      expect(detect(prefix)).toEqual(detectOrderBlocks(prefix,tf));
    }
  }
});

it.each([
  {start:1790838000,top:1.3266,bottom:1.32446,end:1790852400,invalidated:false,
    highs:[1.3266,1.32397,1.32276,1.32261,1.3249,1.32447,1.32356],
    lows:[1.32246,1.32094,1.31997,1.31923,1.32111,1.32271,1.32158]},
  {start:1791165600,top:1.32368,bottom:1.32315,end:1791187200,invalidated:true,
    highs:[1.32368,1.32073,1.32086,1.32118,1.32192,1.32296,1.32377,1.32386,1.32287,1.3232],
    lows:[1.31948,1.31895,1.31924,1.32034,1.32048,1.32084,1.32228,1.32186,1.32191,1.32155]},
])('reconstructs reported GBP native H1 history at 05 October 18:00: $start', async fixture=>{
  const row={timeframe:'1H',direction:'short',top:fixture.top,bottom:fixture.bottom,
    start_time:new Date(fixture.start*1000).toISOString(),touched:true,invalidated:true,
    end_time:'2026-10-06T11:00:00Z'};
  const candles=fixture.highs.map((high,i)=>({time:fixture.start+i*3600,high,low:fixture.lows[i]}));
  const [zone]=await reconstructObLifecycle([row],Date.parse('2026-10-05T18:00:00+02:00')/1000,
    async bar=>bar==='1h'?candles:[]);
  expect(zone).toMatchObject({touched:true,invalidated:fixture.invalidated,
    end_time:new Date(fixture.end*1000).toISOString()});
});

it('keeps old M5 pins outside the detection window and stops at partial contact',()=>{
  const pin={timeframe:'5M',dir:1,startTime:100,top:1.25,bottom:1.15,touched:null};
  const candles=[{time:200,low:1.2,high:1.3}];
  const ctx={symbol:'GBPUSD',m5Candles:[],dbObZones:[],replayUntil:null,price:null};
  expect(mergePinnedZones([], [pin], candles, ctx)[0]).toMatchObject({touched:true,endTime:200});
});
