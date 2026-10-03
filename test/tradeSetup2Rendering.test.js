import {expect,it,vi} from 'vitest';
vi.mock('../src/supabaseClient.js',()=>({supabase:{from:()=>({select:async()=>({data:[]})})}}));
import {renderSetup2Detail,renderSetup2Positions} from '../src/tradeSetup2Rendering.js';
import {restoreTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
import {chartColors,cssColor} from '../src/chartColors.js';
import {renderStructurePivots,renderLowerStructure} from '../src/structureOverlay.js';

it('uses independent M1 colors in live and legacy snapshot drawing without changing evidence',()=>{
  const saved={...chartColors.m1RangeBreakOfStructure},marker={...chartColors.m1RangesMarker};
  try {
    chartColors.m1RangeBreakOfStructure={hex:'#123456',alpha:0.8};
    chartColors.m1RangesMarker={hex:'#abcdef',alpha:0.7};
    const series={attachPrimitive:vi.fn(),detachPrimitive:vi.fn()},candles=[{time:2700},{time:3000}];
    const result={state:{trend:'uptrend',currRange:{high:{pivotTime:2700,price:3,type:'high'},low:{pivotTime:2700,price:1,type:'low'}},structurePivots:[],closedRanges:[]},pivotsOuter:[{pivotTime:2700,price:2,type:'high'}],
      closeReaction:{levels:[{type:'BOS',direction:'long',price:2,pivotTime:2700,candleTime:3000}]}};
    const live=[],markers=[];
    renderLowerStructure(series,result,live,markers,candles,{symbol:'GBPUSD',show:true,debug:true,barSeconds:60,timeframe:'1m'});
    expect(live.at(-1)._options.color).toBe(cssColor('m1RangeBreakOfStructure'));
    expect(markers[0]._groups[0].color).toBe(cssColor('m1RangesMarker'));
    const evidence=['1m','5m'].map(timeframe=>({kind:'line',role:'BOS',timeframe,knownAt:3000,
      price:2,fromTime:2700,toTime:3000,styleKey:'m5RangeBreakOfStructure'}));
    const snapshot={instrument:'GBPUSD',knownAt:3000,evidence},before=JSON.stringify(snapshot),primitives=[];
    renderSetup2Detail(series,snapshot,primitives,[],candles,'5m',3000);
    expect(primitives.map(p=>p._options.color)).toEqual([cssColor('m1RangeBreakOfStructure'),cssColor('m5RangeBreakOfStructure')]);
    expect(JSON.stringify(snapshot)).toBe(before);
  } finally {
    chartColors.m1RangeBreakOfStructure=saved;chartColors.m1RangesMarker=marker;
  }
});

it('projects reconstructed pivots without deriving new levels from later chart candles',()=>{
  const pivot={pivotTime:2880,price:2,type:'high'},result={pivotsOuter:[pivot],events:[]};
  const markers=[],series={attachPrimitive:vi.fn(),detachPrimitive:vi.fn()};
  const before=JSON.stringify(result);
  renderStructurePivots(series,result,markers,[{time:2700,high:3},{time:3000,high:999}],{symbol:'GBPUSD',debug:true});
  expect(markers).toHaveLength(1);
  expect(markers[0]._groups[0].points).toEqual([pivot]);
  expect(JSON.stringify(result)).toBe(before);
  renderStructurePivots(series,result,markers,[],{symbol:'GBPUSD',debug:false});
  expect(markers).toHaveLength(0);
  expect(series.detachPrimitive).toHaveBeenCalledTimes(1);
});

it('renders clickable candidate bounds without creating a position marker',()=>{
  const primitives=[],candles=[{time:2700},{time:3000}];
  const chart={timeScale:()=>({timeToCoordinate:t=>t===2700?100:120,options:()=>({barSpacing:20})})};
  const series={priceToCoordinate:p=>p*10,detachPrimitive:vi.fn(),
    attachPrimitive:p=>p.attached({chart,series,requestUpdate:vi.fn()})};
  const candidate={kind:'candidate',snapshotId:'c',runId:'r',fromTime:2700,toTime:3000,
    candidateStatus:'ohne Entry · historischer Stand',bounds:[{price:2,label:'Invalidierung',styleKey:'tradeLoss'}]};
  renderSetup2Positions(series,[candidate],primitives,candles,'5m');
  expect(primitives).toHaveLength(1);
  const p=primitives[0];p.updateAllViews();
  expect(p.trade).toBeUndefined();
  expect(p.historyItem).toBe(candidate);
  expect(p.distanceTo(110,20)).toBe(0);
});

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
  expect(primitives[0]._options).toMatchObject({labelSide:'end-above',lenientLabels:true});
  expect(primitives[0]._options.label).toBe('1H LS 2 (1m)');
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

it('draws a native H1 sweep anchored before the first M5 bar after the weekend',()=>{
  const snapshot={instrument:'GBPUSD',knownAt:1800,evidence:[{kind:'line',role:'sweep',timeframe:'1h',knownAt:1800,
    price:1.3502,fromTime:600,toTime:1500,styleKey:'liquiditySweep1h'}]};
  const candles=[{time:0},{time:900},{time:1200},{time:1500}],primitives=[];
  const scale={timeToCoordinate:t=>candles.findIndex(c=>c.time===t)*10,options:()=>({barSpacing:10})};
  const series={priceToCoordinate:p=>p,detachPrimitive:vi.fn(),attachPrimitive:p=>p.attached({chart:{timeScale:()=>scale},series,requestUpdate:vi.fn()})};
  renderSetup2Detail(series,snapshot,primitives,[],candles,'5m',1800);
  primitives[0].updateAllViews();
  expect(primitives[0].paneViews()[0]._p1.x).toBe(10);
  expect(primitives[0].paneViews()[0]._p2.x).toBe(30);
  expect(snapshot.evidence[0].fromTime).toBe(600);
});
