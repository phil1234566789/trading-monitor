import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/chartColors.js', () => ({ cssColor: key => key }));
vi.mock('../src/chartLineWidths.js', () => ({ lineWidth: () => 1 }));
import { M1EntryPrimitive, renderM1Entry } from '../src/m1EntryRendering.js';
import { entryRiskScale } from '../src/entryRisk.js';

const entry = { id: 'GBPUSD:setup:entry-1', label: 'Entry 1', instrument: 'GBPUSD', candleTime: 2940, price: 1.35,
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
    renderM1Entry(series,entry,primitives,candles,'5m');
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
    primitive.attached({ chart: { timeScale: () => ({ timeToCoordinate }) }, series: { priceToCoordinate }, requestUpdate: vi.fn() });
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
    expect(first.fillText.mock.calls.some(args => args[0].includes('T1 4,67R'))).toBe(true);
    timeToCoordinate.mockReturnValue(450);
    expect(draw().moveTo.mock.calls[0][0]).toBe(900);
    expect(primitive.autoscaleInfo).toBeUndefined();
    primitive.detached();
    expect(primitive.series).toBeNull();
  });
});
