import {expect,it,vi} from 'vitest';
vi.mock('../src/supabaseClient.js',()=>({supabase:{from:()=>({select:async()=>({data:[]})})}}));
import {renderSetup2Detail,renderSetup2Positions} from '../src/tradeSetup2Rendering.js';
import {restoreTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
import {chartColors} from '../src/chartColors.js';

it('renders legacy evidence with real colors and native projection, then clears on rewind',()=>{
  const snapshot=restoreTradeSetup2Snapshot({id:'old',instrument:'GBPUSD',knownAt:3000,entry:null,
    evidence:[
      {kind:'line',role:'sweep',timeframe:'1h',knownAt:3000,price:2,fromTime:2880,toTime:2940,styleKey:'liquiditySweep'},
      {kind:'zone',role:'reactionOB',timeframe:'5m',knownAt:3000,top:2,bottom:1,fromTime:2880,toTime:2940,styleKey:'obBear'},
      {kind:'segment',role:'structure',timeframe:'1m',knownAt:3000,fromPrice:2,toPrice:1,fromTime:2880,toTime:2940,styleKey:'m5RangeLiveDowntrend'},
    ]});
  const candles=[{time:2700},{time:3000}],primitives=[],entries=[];
  const scale={timeToCoordinate:time=>time===2700?100:120,options:()=>({barSpacing:20})};
  const chart={timeScale:()=>scale},series={priceToCoordinate:p=>p*10,detachPrimitive:vi.fn(),
    attachPrimitive:p=>p.attached({chart,series,requestUpdate:vi.fn()})};
  expect(snapshot.evidence.every(e=>chartColors[e.styleKey])).toBe(true);
  renderSetup2Detail(series,snapshot,primitives,entries,candles,'5m',3000);
  expect(primitives).toHaveLength(3);
  for(const p of primitives)p.updateAllViews();
  expect(primitives[0].paneViews()[0]._p1.x).toBe(112);
  expect(primitives[2].paneViews()[0]._points.map(p=>p.x)).toEqual([112,116]);
  renderSetup2Detail(series,snapshot,primitives,entries,candles,'5m',2940);
  expect(primitives).toHaveLength(0);
  expect(series.detachPrimitive).toHaveBeenCalledTimes(3);
});
it('allows selecting the middle of a compact native position line',()=>{
  const primitives=[],series={attachPrimitive:vi.fn(),detachPrimitive:vi.fn()},candles=[{time:2700},{time:3000}];
  renderSetup2Positions(series,[{snapshotId:'x',direction:'short',entryTime:2700,entryPrice:2,exitTime:3000,exitPrice:1}],primitives,candles,'5m');
  const p=primitives[0];
  p.attached({chart:{timeScale:()=>({timeToCoordinate:t=>t===2700?100:120,options:()=>({barSpacing:20})})},series:{priceToCoordinate:p=>p*10}});
  p.updateAllViews();
  expect(p.lineDistanceTo(110,15)).toBe(0);
  expect(p.lineDistanceTo(110,40)).toBeGreaterThan(10);
});
