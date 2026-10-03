import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction();
import { expect, it, vi } from 'vitest';
import * as queries from '../src/candleCloseWindow';
import { buildMarketStructureState, computeRangesPivots } from '../src/marketStructureAnalysis';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

const linear = (rows, from, to, price, above) => rows.length === 0 || rows.some(c =>
  c.time > from && c.time <= to && (above ? c.close > price : c.close < price));
const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;

it('preserves complete states and every intermediate nested state in both price directions', () => {
  for (const sign of [1, -1]) {
    const rows = m5.filter(c => c.time <= at('10:20') && !c.ignored).map(c => ({ ...c,
      open: sign * c.open, close: sign * c.close,
      high: sign > 0 ? c.high : -c.low, low: sign > 0 ? c.low : -c.high }));
    const outer = computeRangesPivots(rows, 5, 1788350400);
    const inner = computeRangesPivots(rows, 2, 1788350400);
    const evaluate = () => {
      const steps = [];
      const state = buildMarketStructureState(outer, inner, 5, 2, rows, {
        barSeconds: 300, onStep: (time, state) => steps.push({ time, state: structuredClone(state) }),
      });
      return { state, steps };
    };
    const bounded = evaluate();
    const spy = vi.spyOn(queries, 'closesPastLevel').mockImplementation(linear);
    try { expect(evaluate()).toEqual(bounded); } finally { spy.mockRestore(); }
    expect(bounded.steps.length).toBeGreaterThan(10);
  }
}, 30000);

it('preserves complete DR114 snapshots including its entry and evidence', async () => {
  const input = { instrument: 'GBPUSD', h1Candles: h1.candles, m5Candles: m5, m1Candles: m1,
    settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff }, sessionConfigs: config.sessions,
    fromTime: at('09:25'), toTime: at('09:55'), tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]} };
  const bounded = await scanTradeSetup2Window(input);
  const spy = vi.spyOn(queries, 'closesPastLevel').mockImplementation(linear);
  try { expect(await scanTradeSetup2Window(input)).toEqual(bounded); } finally { spy.mockRestore(); }
  expect(bounded.filter(s => s.entry)).toHaveLength(1);
}, 30000);
