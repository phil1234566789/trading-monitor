import { assumeFixtureH1Direction } from './helpers/fixtureH1Direction.js';
assumeFixtureH1Direction();
import { it, expect } from 'vitest';
import { buildChecklistMarketContext, evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { collectNestedChain } from '../src/marketStructureAnalysis';
import { collectChecklistH1Sweeps } from '../src/tradeSetupChecklistH1Sweeps.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-session-targets.json';

const args = { instrument: 'GBPUSD', h1Candles: h1.candles, m5Candles: m5.candles,
  settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff }, sessionConfigs: m5.sessions };
const at = time => Date.parse(`2026-09-09T${time}:00+02:00`) / 1000;
it('recognizes the already known H1 level from closed M5 before the H1 touch bar closes', () => {
  const context = buildChecklistMarketContext({ ...args, evaluatedAt: at('09:30') });
  expect(collectNestedChain(context.h1State).flatMap(s => s.structurePivots).find(p => p.price === 1.35649).touched).toBe(false);
  const result = evaluateTradeSetupChecklist({ ...args, evaluatedAt: at('09:30') });
  expect(result.checks.h1Trend.status).toBe('passed');
  expect(result.setup.primary?.sweep.level.price).toBe(1.35649);
  expect(result.checks.reaction.status).toBe('passed');
  expect(result.setup.primary.sweep.level).toMatchObject({ pivotTime: 1788184800, touchedTime: at('09:00'), fineTouchedTime: at('09:10') });
  expect(result.setup.primary.recognizedAt).toBe(at('09:15'));
  expect(result.setup.primary.reactionRecognizedAt).toBe(at('09:30'));
});

it('preserves identity and the first C/target time across the H1 close and backward replay', () => {
  const evaluate = time => evaluateTradeSetupChecklist({ ...args, evaluatedAt: at(time) });
  const initial = evaluate('09:30');
  for (const time of ['09:50', '10:00', '10:35', '09:30']) {
    const result = evaluate(time);
    expect(result.setup.primary.id).toBe(initial.setup.primary.id);
    expect(result.setup.primary.reactionRecognizedAt).toBe(at('09:30'));
    expect(result.setup.primary.targetSelection).toEqual(initial.setup.primary.targetSelection);
  }
});

it('does not use an open M5 touch or future H1 data', () => {
  const evaluate = (time, overrides = {}) => evaluateTradeSetupChecklist({ ...args, ...overrides, evaluatedAt: at(time) });
  expect(evaluate('09:14').setup.candidates.some(c => c.sweep.level.price === 1.35649)).toBe(false);
  expect(evaluate('09:15').setup.primary.checks.liquiditySweep.status).toBe('passed');
  expect(evaluate('09:25').setup.primary.checks.reaction.status).not.toBe('passed');
  const poisoned = h1.candles.map(c => c.time + 3600 > at('09:30') ? { ...c, high: 99, low: 0, close: 50 } : c);
  expect(evaluate('09:30', { h1Candles: poisoned })).toEqual(evaluate('09:30'));
});

it('uses the same closed-candle rule for long sweeps and ignores excluded candles', () => {
  const level = { type: 'low', price: 10, pivotTime: 0, touched: false };
  const context = { h1State: { trend: 'uptrend', structurePivots: [level] },
    h1Candles: [{ time: 3600 }], evaluatedAt: 7800,
    m5Candles: [{ time: 7200, low: 9, high: 12, ignored: true },
      { time: 7500, low: 10, high: 12 }, { time: 7800, low: 8, high: 12 }] };
  expect(collectChecklistH1Sweeps(context)).toMatchObject([
    { dir: -1, pivotTime: 0, touchedTime: 7200, fineTouchedTime: 7500, recognizedAt: 7800 },
  ]);
  expect(collectChecklistH1Sweeps({ ...context, evaluatedAt: 7799 })).toEqual([]);
  expect(collectChecklistH1Sweeps({ ...context, h1State: null })).toEqual([]);
});
