import { describe, expect, it } from 'vitest';
import { evaluateChecklistTargets, evaluateChecklistTargetValidity } from '../src/tradeSetupChecklistTargets.js';

const at = value => Date.parse(value) / 1000;
const evaluatedAt = at('2026-09-09T09:20:00+02:00');
const pivot = (price, type = 'low', pivotTime = evaluatedAt - 12 * 3600, extra = {}) =>
  ({ price, type, pivotTime, touched: false, ...extra });
const state = (inner = [], outer = [], nestedTrend = null) =>
  ({ trend: 'downtrend', innerStructurePivots: inner, structurePivots: outer, nestedTrend });
const evaluate = (structure, extra = {}) => evaluateChecklistTargets({
  state: structure, instrument: 'GBPUSD', direction: 'short', referencePrice: 1.355,
  evaluatedAt, ...extra,
});

describe('checklist D structural targets', () => {
  it('selects P2 and P5 independently by proximity without inventing a TP offset', () => {
    const result = evaluate(state([pivot(1.35409), pivot(1.354)], [pivot(1.353)]));
    expect(result.status).toBe('passed');
    expect(result.target1).toMatchObject({ price: 1.35409, period: 2, source: 'innerStructurePivots', timeframe: '1h' });
    expect(result.target2).toMatchObject({ price: 1.353, period: 5, source: 'structurePivots' });
  });

  it('keeps the second target optional and does not impose the picker distance cap', () => {
    expect(evaluate(state([pivot(1.3)]) )).toMatchObject({ status: 'passed', target2: null });
    expect(evaluate(state([], [pivot(1.353)]))).toMatchObject({ status: 'pending', target1: null });
  });

  it('distinguishes unavailable input from a known structure without targets', () => {
    expect(evaluate(null).status).toBe('unknown');
    expect(evaluate({ trend: 'downtrend' }).status).toBe('unknown');
    expect(evaluate(state()).status).toBe('pending');
    for (const extra of [{ direction: null }, { referencePrice: NaN }, { evaluatedAt: null }]) {
      expect(evaluate(state([pivot(1.354)]), extra).status).toBe('unknown');
    }
  });

  it('uses confirmed nested levels and stable ids regardless of depth or ordering', () => {
    const p = pivot(1.35409);
    const nested = { ...state([p]), trend: 'uptrend' };
    const deep = evaluate(state([pivot(1.35)], [], state([], [], nested)));
    const shallow = evaluate(state([p, pivot(1.35)]));
    expect(deep.target1.id).toBe(shallow.target1.id);
    expect(deep.target1.depth).toBe(2);
    expect(evaluate(state([], [], { ...nested, trend: 'unknown' })).target1).toBeNull();
  });

  it.each(['long', 'short'])('uses explicit pivot side for %s and never guesses LQ/BOS direction', direction => {
    const price = direction === 'long' ? 1.356 : 1.354;
    const type = direction === 'long' ? 'high' : 'low';
    const otherType = direction === 'long' ? 'low' : 'high';
    const result = evaluate(state([pivot(price, type), pivot(1.355, type), pivot(price, otherType),
      pivot((price + 1.355) / 2, 'LQ-sweep'), pivot((price + 1.355) / 2, 'break-of-structure')]), { direction });
    expect(result.target1.price).toBe(price);
    expect(result.target1.dir).toBe(direction === 'long' ? 1 : -1);
  });

  it('excludes touched, ignored and future pivots, while ignoring future touches', () => {
    const valid = pivot(1.353, 'low', undefined, { touched: { touchedTime: evaluatedAt + 3600 } });
    const result = evaluate(state([
      pivot(1.3549, 'low', evaluatedAt + 1),
      pivot(1.3548, 'low', undefined, { ignored: true }),
      pivot(1.3547, 'low', undefined, { touched: { touchedTime: evaluatedAt - 3600 } }),
      pivot(1.3546, 'low', undefined, { touched: {} }), valid,
    ]));
    expect(result.target1.price).toBe(1.353);
  });

  it('requires actual closed right-side bars when candle history is supplied', () => {
    const start = evaluatedAt - 4 * 3600;
    const h1Candles = [0, 1, 3, 4].map(n => ({ time: start + n * 3600, high: 1.36, low: 1.355 }));
    const s = state([pivot(1.354, 'low', start)]);
    expect(evaluate(s, { h1Candles, evaluatedAt: start + 3 * 3600 }).target1).toBeNull();
    expect(evaluate(s, { h1Candles }).target1).toMatchObject({ knownAt: evaluatedAt });
  });

  it('does not let missing optional P5 history block a known P2 target', () => {
    const start = evaluatedAt - 4 * 3600;
    const h1Candles = [0, 1, 2, 3].map(n => ({ time: start + n * 3600, high: 1.36, low: 1.355 }));
    const result = evaluate(state([pivot(1.354, 'low', start)], [pivot(1.353)]), { h1Candles });
    expect(result).toMatchObject({ status: 'passed', target2: null });
  });

  it('excludes a target touched by a closed M5 candle after the last H1 close', () => {
    const s = state([pivot(1.354), pivot(1.353)]);
    const m5Candles = [{ time: evaluatedAt - 300, high: 1.356, low: 1.354 }];
    expect(evaluate(s, { m5Candles }).target1.price).toBe(1.353);
    expect(evaluate(s, { m5Candles, evaluatedAt: evaluatedAt - 1 }).target1.price).toBe(1.354);
  });

  it('does not manufacture a session extreme from missing candle evidence', () => {
    const sessionConfigs = [{ instrument: 'GBPUSD', label: 'Asia', fromMinutes: 0, toMinutes: 1439, highLowRelevant: true }];
    expect(evaluate(state([pivot(1.354)]), { sessionConfigs }).target1.sessionLabel).toBeNull();
  });

  it('returns unknown if missing P2 history prevents proving the nearest target', () => {
    const start = evaluatedAt - 4 * 3600;
    const h1Candles = [0, 1, 2, 3].map(n => ({ time: start + n * 3600, high: 1.36, low: 1.355 }));
    expect(evaluate(state([pivot(1.354), pivot(1.353, 'low', start)]), { h1Candles }))
      .toMatchObject({ status: 'unknown', target1: null });
  });

  it('labels synthetic reference prices with existing Asia Mid and NY Low rules and excludes spread hour', () => {
    // Synthetischer Strukturstand aus dokumentierten Referenzpreisen, kein Feed-Replay.
    const asiaTime = at('2026-09-09T04:00:00+02:00');
    const nyTime = at('2026-09-08T17:00:00+02:00');
    const spreadTime = at('2026-09-08T23:00:00+02:00');
    const sessionConfigs = [
      { instrument: 'GBPUSD', label: 'Asia', fromMinutes: 120, toMinutes: 540, highLowRelevant: true },
      { instrument: 'GBPUSD', label: 'New York', fromMinutes: 900, toMinutes: 1320, highLowRelevant: true },
      { instrument: 'GBPUSD', label: 'Spread Hour', fromMinutes: 1380, toMinutes: 60, ignoreLiquidity: true },
    ];
    const candles = [
      { time: nyTime, high: 1.36, low: 1.353 },
      { time: asiaTime, high: 1.35501, low: 1.35335 },
      { time: evaluatedAt + 3600, high: 2, low: 1 },
    ];
    const result = evaluate(state([pivot(1.35409, 'low', asiaTime)], [pivot(1.35294, 'low', spreadTime), pivot(1.353, 'low', nyTime)]),
      { sessionConfigs, labelCandles: candles, labelBar: '1h' });
    expect(result.target1.label).toContain('Asia-Mid');
    expect(result.target2.label).toContain('New York-Low');
    expect(result.target2.price).toBe(1.353);
    expect(evaluate(state([], [pivot(1.35294, 'low', spreadTime)]), { sessionConfigs }).target2).toBeNull();
  });
});

describe('fixed target lifecycle', () => {
  const selection = () => evaluate(state([pivot(1.354)], [pivot(1.353)]));
  it.each(['long', 'short'])('ends on equality touch of first %s target without reselection', direction => {
    const result = evaluate(state([pivot(direction === 'short' ? 1.354 : 1.356, direction === 'short' ? 'low' : 'high')]), { direction });
    const candles = [{ time: evaluatedAt, low: direction === 'short' ? 1.354 : 1.355, high: direction === 'long' ? 1.356 : 1.355 }];
    const validity = evaluateChecklistTargetValidity(result, { evaluatedAt: evaluatedAt + 300, candles });
    expect(validity).toMatchObject({ status: 'blocked', target1TouchedAt: evaluatedAt, endedAt: evaluatedAt + 300 });
    expect(validity.target1).toBe(result.target1);
  });
  it('ignores future and pre-selection bars', () => {
    const candles = [{ time: evaluatedAt - 300, low: 1.3, high: 1.4 }, { time: evaluatedAt, low: 1.354, high: 1.356 }];
    expect(evaluateChecklistTargetValidity(selection(), { evaluatedAt: evaluatedAt + 299, candles }).status).toBe('unknown');
  });
  it('reports missing coverage instead of claiming an untouched target', () => {
    expect(evaluateChecklistTargetValidity(selection(), { evaluatedAt: evaluatedAt + 600, candles: [] }).status).toBe('unknown');
  });
  it('does not let an optional target end the first target lifecycle', () => {
    const result = evaluate(state([pivot(1.353)], [pivot(1.354)]));
    const candles = [{ time: evaluatedAt, low: 1.354, high: 1.356 }];
    expect(evaluateChecklistTargetValidity(result, { evaluatedAt: evaluatedAt + 300, candles })).toMatchObject({ status: 'passed', target1TouchedAt: null });
  });
  it('ignores spread-hour touches and does not mutate selection or candles', () => {
    const result = selection();
    const candles = [{ time: evaluatedAt, low: 1.3, high: 1.4 }];
    const before = JSON.stringify({ result, candles });
    const sessionConfigs = [{ instrument: 'GBPUSD', fromMinutes: 560, toMinutes: 565, ignoreLiquidity: true }];
    expect(evaluateChecklistTargetValidity(result, { evaluatedAt: evaluatedAt + 300, candles, sessionConfigs }).status).toBe('passed');
    expect(JSON.stringify({ result, candles })).toBe(before);
  });
});
