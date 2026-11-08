import { afterEach, describe, expect, it, vi } from 'vitest';
import h1 from './fixtures/gbpusd-h1-2026-07-08-long-setup.json';
import { usePriceChartMarketStructure } from '../src/composables/usePriceChartMarketStructure.js';
import { createChartStructureCalculator } from '../src/chartStructureCalculation.js';
import { innermostStructureStart } from '../src/marketStructureAnalysis';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const jobs = [];
  vi.stubGlobal('Worker', class {
    terminate = vi.fn();
    calculate = createChartStructureCalculator();
    postMessage(input) { jobs.push({ input, worker: this, reply: () => this.onmessage({ data: { result: this.calculate(input) } }) }); }
  });
  const api = usePriceChartMarketStructure();
  api.create({}, { attachPrimitive() {}, detachPrimitive() {} });
  const until = h1.at(-1).time;
  const settings = { symbol: 'GBPUSD', rangesPeriod: 5, ranges2Period: 2,
    rangesLookbackHours: 1000, ranges2LookbackHours: 1000, replayUntil: until };
  api.computeRangesPivotsAndMetadata(h1, settings);
  const h1Args = { ...settings, candles: h1, h1CandlesClipped: h1, showRanges: false };
  const m5Args = { symbol: 'GBPUSD', candles: [], m5CandlesClipped: [], replayUntil: until,
    m5Period: 5, m5Period2: 2, showM5Structure: false, showM5TrendPhases: false };
  return { api, jobs, h1Args, m5Args };
}
describe('chart H1/M5 asynchronous orchestration', () => {
  it('waits for the newest H1 publication before choosing the M5 anchor', async () => {
    const { api, jobs, h1Args, m5Args } = setup();
    const oldH1 = api.refreshMarketStructure(h1Args);
    const m5 = api.refreshM5Structure(m5Args);
    const newestH1 = api.refreshMarketStructure({ ...h1Args, h1CandlesClipped: h1.slice(0, -1) });
    expect(jobs).toHaveLength(2);
    jobs[1].reply();
    expect(await newestH1).toBe(true);
    await vi.waitFor(() => expect(jobs).toHaveLength(3));
    const expected = innermostStructureStart(api.marketStructureState.value, h1Args.replayUntil - 1000 * 3600);
    expect(jobs[2].input.anchor).toBe(expected);
    jobs[0].reply();
    expect(await oldH1).toBe(false);
    jobs[2].reply(); expect(await m5).toBe(true);
    api.cancelCalculation();
    expect(api.marketStructureState.value).toBeNull();
    expect(api.m5Trend.value).toBeNull();
    api.dispose();
  });
  it('coalesces concurrent redraws and never publishes an obsolete M5 answer', async () => {
    const { api, jobs, m5Args } = setup();
    const a = api.refreshM5Structure(m5Args);
    api.invalidateRendering(); // Timeframe-Wechsel: dieselbe Berechnung, neue Zeichenfläche.
    const b = api.refreshM5Structure(m5Args);
    expect(jobs).toHaveLength(1);
    jobs[0].reply();
    expect(await a).toBe(false); expect(await b).toBe(true);
    const c = api.refreshM5Structure({ ...m5Args, m5Period: 4 });
    api.cancelCalculation(); jobs[1].reply();
    expect(await c).toBe(false);
    api.dispose();
  });
  it('retains the continuous prefix when the regular M5 loading window moves forward', async () => {
    const { api, jobs, m5Args } = setup();
    const anchor = 1790000000;
    const candle = i => ({ time: anchor + i * 300, open: 2, high: 3, low: 1, close: 2 });
    api.computeRangesPivotsAndMetadata([], { rangesPeriod: 5, ranges2Period: 2,
      rangesFixedStartActive: true, rangesFixedStartTime: anchor });
    const loaded = Array.from({ length: 50 }, (_, i) => candle(i));
    const a = api.refreshM5Structure({ ...m5Args, candles: loaded, m5CandlesClipped: loaded, replayUntil: anchor + 50 * 300 });
    jobs[0].reply(); await a;
    const moved = [...loaded.slice(2), candle(50), candle(51)];
    const b = api.refreshM5Structure({ ...m5Args, candles: moved, m5CandlesClipped: moved, replayUntil: anchor + 52 * 300 });
    expect(jobs[1].input.candles.map(c => c.time)).toEqual([...loaded, candle(50), candle(51)].map(c => c.time));
    jobs[1].reply(); await b; api.dispose();
  });
});
