import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/chartColors.js', () => ({ cssColor: key => key }));
vi.mock('../src/chartLineWidths.js', () => ({ lineWidth: () => 1 }));
import { M1EntryPrimitive, renderM1Entry } from '../src/m1EntryRendering.js';
import { entryRiskScale } from '../src/entryRisk.js';

const entry = { id: 'GBPUSD:setup:entry-1', label: 'Entry 1', instrument: 'GBPUSD', candleTime: 2940, recognizedAt: 3000, price: 1.35,
  scales: { wide: entryRiskScale(1.35,1.3506,[{ label:'T1', price:1.3472 }],'GBPUSD','short'),
    narrow: entryRiskScale(1.35,1.3503,[{ label:'T1', price:1.3472 }],'GBPUSD','short') } };
describe('M1 entry annotation', () => {
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
