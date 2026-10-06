import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/chartColors.js', () => ({ cssColor: key => key }));
vi.mock('../src/chartLineWidths.js', () => ({ lineWidth: () => 1 }));
import { M1EntryPrimitive, renderM1Entry } from '../src/m1EntryRendering.js';
import { entryRiskScale } from '../src/entryRisk.js';
import original from './fixtures/gbpusd-short-20260921-narrow-only.json';

const entry = { id: 'GBPUSD:setup:entry-1', label: 'Entry 1', instrument: 'GBPUSD', candleTime: 2940, recognizedAt: 3000, price: 1.35,
  scales: { wide: entryRiskScale(1.35,1.3506,[{ label:'T1', price:1.3472 }],'GBPUSD','short'),
    narrow: entryRiskScale(1.35,1.3503,[{ label:'T1', price:1.3472 }],'GBPUSD','short') } };
describe('M1 entry annotation', () => {
  it.each(['countertrend-entry-model-1-v8','countertrend-entry-model-1-v9'])('draws the versioned wide stop and independent narrow ladder (%s)', version => {
    const saved = {...entry, scales: {
      wide: entryRiskScale(1.35,1.3507,[],'GBPUSD','short',{variant:'wide',entryPattern:version}),
      narrow: entry.scales.narrow,
    }};
    const primitive=new M1EntryPrimitive(saved);
    primitive.attached({chart:{timeScale:()=>({timeToCoordinate:()=>300,options:()=>({barSpacing:10})}),subscribeCrosshairMove:vi.fn()},
      series:{priceToCoordinate:p=>300-(p-saved.price)*10000},requestUpdate:vi.fn()});
    for(const variant of ['', 'wide', 'narrow']) {
      primitive.variant=variant;primitive.updateAllViews();
      const ctx=Object.fromEntries(['setLineDash','beginPath','moveTo','lineTo','stroke','fillRect','strokeRect','fillText'].map(k=>[k,vi.fn()]));
      primitive.paneViews()[0].renderer().draw({useBitmapCoordinateSpace:cb=>cb({context:ctx,horizontalPixelRatio:1,verticalPixelRatio:1,bitmapSize:{width:1200,height:800}})});
      const texts=ctx.fillText.mock.calls.map(c=>c[0]);
      expect(texts.some(t=>t.includes('Weiter SL über 6 Pips'))).toBe(version.endsWith('v8') && variant!=='narrow');
      expect(texts.some(t=>t.includes('SL weit 1,35060'))).toBe(version.endsWith('v9') && variant!=='narrow');
      expect(texts.some(t=>t.includes('SL eng 1,35030'))).toBe(variant!=='wide');
      expect(texts.some(t=>t.includes('SL weit 1,35070'))).toBe(false);
    }
  });

  it('draws the original narrow ladder independently from an invalid, null or absent wide scale',()=>{
    const before=JSON.stringify(original);
    const chart={timeScale:()=>({timeToCoordinate:()=>300,options:()=>({barSpacing:10})}),subscribeCrosshairMove:vi.fn()};
    for(const wide of [original.entry.scales.wide,null,undefined]){
      const saved={...original.entry,scales:{wide,narrow:original.entry.scales.narrow}};
      const primitive=new M1EntryPrimitive(saved);primitive.variant='';
      primitive.attached({chart,series:{priceToCoordinate:p=>300-(p-saved.price)*10000},requestUpdate:vi.fn()});
      primitive.updateAllViews();
      expect(primitive.views[0].point.scales).toMatchObject([null,{axisStyleKey:'pipScale'}]);
      const ctx=Object.fromEntries(['setLineDash','beginPath','moveTo','lineTo','stroke','fillRect','strokeRect','fillText'].map(k=>[k,vi.fn()]));
      primitive.paneViews()[0].renderer().draw({useBitmapCoordinateSpace:cb=>cb({context:ctx,horizontalPixelRatio:1,verticalPixelRatio:1,bitmapSize:{width:1200,height:800}})});
      expect(ctx.fillText.mock.calls.some(a=>a[0].includes('SL eng 1,33828'))).toBe(true);
      expect(ctx.fillText.mock.calls.some(a=>a[0].includes('Weit: SL nicht auswertbar'))).toBe(true);
      for(const variant of ['wide','narrow','']){
        primitive.variant=variant;primitive.updateAllViews();
        expect(primitive.views[0].point.scales.length).toBe(variant?1:2);
        if(variant==='narrow')expect(primitive.views[0].point.scales[0].axisStyleKey).toBe('pipScale');
      }
    }
    expect(JSON.stringify(original)).toBe(before);
  });
  it('separates two Long or Short annotations from the last candle while keeping historical anchors',()=>{
    for(const direction of ['long','short']){
      const sign=direction==='long'?1:-1;
      const candles=[{time:2940},{time:3000},{time:3600}];
      const timeToCoordinate=t=>({2940:200,3000:300,3600:550})[t];
      const chart={timeScale:()=>({timeToCoordinate,options:()=>({barSpacing:10})}),
        subscribeCrosshairMove:vi.fn(),unsubscribeCrosshairMove:vi.fn()};
      const series={priceToCoordinate:p=>300-(p-1.35)*10000,detachPrimitive:vi.fn(),
        attachPrimitive:p=>p.attached({chart,series,requestUpdate:vi.fn()})};
      const entries=[2940,3000].map((time,i)=>({...entry,id:String(i),candleTime:time,recognizedAt:time+60,
        scales:{wide:entryRiskScale(1.35,1.35-sign*0.0006,[{label:'T1',price:1.35+sign*0.0028}],'GBPUSD',direction)}}));
      const primitives=[];renderM1Entry(series,entries,primitives,candles,'1m','wide');
      const boxes=[];
      for(const [i,p] of primitives.entries()){
        p.updateAllViews();
        const ctx=Object.fromEntries(['setLineDash','beginPath','moveTo','lineTo','stroke','fillRect','strokeRect','fillText'].map(k=>[k,vi.fn()]));
        p.paneViews()[0].renderer().draw({useBitmapCoordinateSpace:cb=>cb({context:ctx,horizontalPixelRatio:2,verticalPixelRatio:2,bitmapSize:{width:2000,height:1200}})});
        boxes.push(p.views[0].point.box);
        expect(boxes[i].left).toBeGreaterThan(555);
        expect(ctx.moveTo.mock.calls[0][0]).toBe((i?300:200)*2);
        expect(ctx.lineTo.mock.calls.every(a=>a.every(Number.isFinite))).toBe(true);
        expect(ctx.fillText.mock.calls.filter(a=>/^3R|^6R|^10R|^SL|^T1/.test(a[0])).every(a=>a[1]>555*2)).toBe(true);
        expect(ctx.fillText.mock.calls.some(a=>a[0].startsWith(`Entry ${i+1} ·`))).toBe(true);
      }
      expect(boxes[1].left).toBeGreaterThan(boxes[0].right);
    }
  });
  it('keeps one primitive per event and clears on rewind, hidden M1 or another timeframe', () => {
    const series = { attachPrimitive: vi.fn(), detachPrimitive: vi.fn() };
    const primitives = [], candles = [{ time: 2940 }];
    renderM1Entry(series,entry,primitives,candles,'1m');
    renderM1Entry(series,{ ...entry },primitives,candles,'1m');
    expect(primitives).toHaveLength(1);
    expect(series.attachPrimitive).toHaveBeenCalledTimes(1);
    renderM1Entry(series,entry,primitives,[{ time:2700 }],'5m');
    expect(primitives).toHaveLength(1);
    expect(primitives[0].entry).toEqual(entry);
    expect(primitives[0].currentBar).toBe('5m');
    expect(series.attachPrimitive).toHaveBeenCalledTimes(1);
    renderM1Entry(series,entry,primitives,candles,'15m');
    expect(primitives).toHaveLength(0);
    renderM1Entry(series,entry,primitives,candles,'1m');
    renderM1Entry(series,null,primitives,candles,'1m');
    expect(primitives).toHaveLength(0);
    renderM1Entry(series,entry,primitives,[{ time:2880 }],'1m');
    expect(primitives).toHaveLength(0);
  });
  it('reprojects confirmation time and entry price on pan/zoom without adding autoscale bounds', () => {
    const primitive = new M1EntryPrimitive(entry);
    const timeToCoordinate = vi.fn(() => 300);
    const priceToCoordinate = vi.fn(price => (1.36-price)*10000);
    const chart = { timeScale: () => ({ timeToCoordinate, options: () => ({ barSpacing: 10 }) }), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn() };
    primitive.attached({ chart, series: { priceToCoordinate }, requestUpdate: vi.fn() });
    const draw = () => {
      primitive.updateAllViews();
      const ctx = Object.fromEntries(['setLineDash','beginPath','moveTo','lineTo','stroke','fillRect','strokeRect','fillText'].map(key => [key,vi.fn()]));
      primitive.paneViews()[0].renderer().draw({ useBitmapCoordinateSpace: cb => cb({ context:ctx, horizontalPixelRatio:2, verticalPixelRatio:2, bitmapSize:{ width:2000,height:1200 } }) });
      return ctx;
    };
    const first = draw();
    expect(timeToCoordinate).toHaveBeenLastCalledWith(2940);
    expect(first.moveTo.mock.calls[0][0]).toBe(600);
    expect(first.fillText.mock.calls.filter(args => args[0] === 'Entry 1')).toHaveLength(1);
    expect(first.fillText.mock.calls.some(args => args[0] === '3R')).toBe(true);
    expect(first.fillText.mock.calls.some(args => args[0] === '6R')).toBe(true);
    expect(first.fillText.mock.calls.some(args => args[0] === '10R')).toBe(true);
    expect(first.fillText.mock.calls.some(args => ['4R','5R'].includes(args[0]))).toBe(false);
    expect(first.fillText.mock.calls.some(args => args[0].includes('T1 4,67R'))).toBe(true);
    timeToCoordinate.mockReturnValue(450);
    expect(draw().moveTo.mock.calls[0][0]).toBe(900);
    timeToCoordinate.mockReturnValue(900);
    expect(draw().fillText.mock.calls.some(args=>args[0]==='Entry 1')).toBe(true);
    expect(primitive.views[0].point.box).toMatchObject({left:925,right:1070});
    timeToCoordinate.mockReturnValue(450);
    expect(draw().fillText.mock.calls.some(args=>args[0]==='Entry 1')).toBe(true);
    primitive.candles = [{ time:2700 }]; primitive.currentBar = '5m';
    expect(draw().moveTo.mock.calls[0][0]).toBe(916);
    expect(timeToCoordinate).toHaveBeenLastCalledWith(2700);
    const box = primitive.views[0].point.box;
    // Lightweight Charts aktualisiert Views vor dem Crosshair-Callback erneut.
    primitive.updateAllViews();
    chart.subscribeCrosshairMove.mock.calls[0][0]({ point: { x: box.left+10, y: box.top+10 } });
    expect(draw().fillText.mock.calls.some(args => args[0].startsWith('M1-Bestätigung:'))).toBe(true);
    expect(primitive.autoscaleInfo).toBeUndefined();
    primitive.detached();
    expect(primitive.series).toBeNull();
    expect(chart.unsubscribeCrosshairMove).toHaveBeenCalledWith(primitive.onMove);
  });
});
