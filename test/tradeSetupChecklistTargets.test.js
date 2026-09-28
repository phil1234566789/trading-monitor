import { describe, expect, it } from 'vitest';
import fixture from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { evaluateChecklistTargets, evaluateChecklistTargetValidity, selectChecklistSessionTargets } from '../src/tradeSetupChecklistTargets.js';

const at = text => Date.parse(text) / 1000;
const evaluatedAt = fixture.evaluatedAt;
const evaluate = (extra = {}) => evaluateChecklistTargets({ direction: 'short', referencePrice: 1.35641,
  instrument: 'GBPUSD', evaluatedAt, m5Candles: fixture.candles, sessionConfigs: fixture.sessions, ...extra });
const level = (price, sessionKey, pivotTime = 1, dir = -1) => ({ price, sessionKey, pivotTime, dir, touched: false });
const select = (levels, direction = 'short') => selectChecklistSessionTargets(levels, { direction, referencePrice: 10 });

describe('session target selection', () => {
  it('takes the deepest eligible pivot of each session', () => {
    expect(select([level(9, 'a'), level(8, 'a'), level(6, 'b')]).map(p => p.price)).toEqual([8, 6]);
  });
  it('uses price direction instead of session chronology', () => {
    expect(select([level(9, 'a', 30), level(11, 'previous', 20), level(7, 'older', 10)]).map(p => p.sessionKey)).toEqual(['a', 'older']);
  });
  it('does not choose a second level of the same session or an equal price', () => {
    expect(select([level(8, 'a'), level(9, 'a'), level(8, 'b'), level(7, 'c')]).map(p => p.price)).toEqual([8, 7]);
  });
  it('mirrors long selection using the highest eligible pivot', () => {
    expect(select([level(11, 'a', 1, 1), level(12, 'a', 2, 1), level(14, 'b', 3, 1), level(9, 'other', 4, 1)], 'long').map(p => p.price)).toEqual([12, 14]);
  });
  it('ignores touched and wrong-side pivots; second target stays optional', () => {
    expect(select([level(9, 'a'), { ...level(8, 'a'), touched: true }, level(7, 'b', 1, 1)]).map(p => p.price)).toEqual([9]);
  });
  it('uses a stable oldest-pivot tie-break independent of input order', () => {
    const levels = [level(8, 'a', 2), level(8, 'a', 1), level(7, 'b', 3)];
    expect(select(levels)).toEqual(select([...levels].reverse()));
    expect(select(levels)[0].pivotTime).toBe(1);
  });
});

describe('DR114 real closed M5 prefix', () => {
  it('keeps midnight eligible under the actual exclusive spread-hour boundary', () => {
    const r = evaluate();
    expect(r.status).toBe('passed');
    expect(r.target1).toMatchObject({ price: 1.35335, pivotTime: at('2026-09-09T00:00:00+02:00'), timeframe: '5m', period: 5, sessionLabel: 'Asia-Low' });
    expect(r.target2).toMatchObject({ price: 1.353, pivotTime: at('2026-09-08T18:45:00+02:00'), sessionLabel: 'NY-Low', ageText: '14h 35m' });
    expect(r.target1.label).not.toContain('1h P2');
    expect(r.target2.label).not.toContain('1h P5');
  });
  it.each([['10:30', '15h 45m'], ['10:35', '15h 50m']])('retains real session pivots at %s after the separate TP1 is touched', (time, ageText) => {
    const r = evaluate({ evaluatedAt: at(`2026-09-09T${time}:00+02:00`), referencePrice: 1.35468 });
    expect(r.target1.price).toBe(1.35335);
    expect(r.target2).toMatchObject({ price: 1.353, ageText });
    expect([r.target1.price, r.target2.price]).not.toContain(1.35479);
  });
  it('ignores future candles and display state without mutating inputs', () => {
    const before = JSON.stringify(fixture);
    expect(evaluate({ state: null, m5Candles: [...fixture.candles, { time: evaluatedAt, open: 1.35, high: 1.36, low: 1.3, close: 1.31 }] })).toEqual(evaluate());
    expect(JSON.stringify(fixture)).toBe(before);
  });
  it('requires the right confirmation bars to close', () => {
    const cutoff = at('2026-09-08T19:10:00+02:00');
    expect(evaluate({ evaluatedAt: cutoff }).target1?.price).not.toBe(1.353);
    expect(evaluate({ evaluatedAt: cutoff + 300 }).target1?.price).toBe(1.353);
  });
  it('uses highLowRelevant for eligibility and ignoreLiquidity independently', () => {
    const noAsia = fixture.sessions.map(s => s.label === 'Asia' ? { ...s, highLowRelevant: false } : s);
    expect(evaluate({ sessionConfigs: noAsia }).target1.sessionLabel).toBe('NY-Low');
    expect(evaluate().target1.price).not.toBe(1.35294);
  });
  it('distinguishes missing data from no eligible target, with no H1 requirement', () => {
    expect(evaluate({ m5Candles: [] }).status).toBe('unknown');
    expect(evaluate({ sessionConfigs: [] }).status).toBe('unknown');
    expect(evaluate({ referencePrice: null }).status).toBe('unknown');
    expect(evaluate({ referencePrice: 1 }).status).toBe('pending');
    expect(evaluate({ state: null }).status).toBe('passed');
  });
});

describe('fixed target lifecycle', () => {
  const selection = (direction = 'short') => ({ status: 'passed', selectedAt: evaluatedAt, instrument: 'GBPUSD', direction,
    target1: { price: direction === 'short' ? 1.354 : 1.356 }, target2: null });
  it.each(['long', 'short'])('ends on equality touch of first %s target without reselection', direction => {
    const r = selection(direction);
    const candles = [{ time: evaluatedAt, low: direction === 'short' ? 1.354 : 1.355, high: direction === 'long' ? 1.356 : 1.355 }];
    const validity = evaluateChecklistTargetValidity(r, { evaluatedAt: evaluatedAt + 300, candles });
    expect(validity).toMatchObject({ status: 'blocked', target1TouchedAt: evaluatedAt, endedAt: evaluatedAt + 300 });
    expect(validity.target1).toBe(r.target1);
  });
  it('ignores future and pre-selection bars', () => {
    const candles = [{ time: evaluatedAt - 300, low: 1.3, high: 1.4 }, { time: evaluatedAt, low: 1.354, high: 1.356 }];
    expect(evaluateChecklistTargetValidity(selection(), { evaluatedAt: evaluatedAt + 299, candles }).status).toBe('unknown');
  });
  it('reports missing coverage instead of claiming untouched', () => {
    expect(evaluateChecklistTargetValidity(selection(), { evaluatedAt: evaluatedAt + 600, candles: [] }).status).toBe('unknown');
  });
  it('ignores spread-hour touches', () => {
    const candles = [{ time: evaluatedAt, low: 1.3, high: 1.4 }];
    const sessionConfigs = [{ instrument: 'GBPUSD', fromMinutes: 560, toMinutes: 565, ignoreLiquidity: true }];
    expect(evaluateChecklistTargetValidity(selection(), { evaluatedAt: evaluatedAt + 300, candles, sessionConfigs }).status).toBe('passed');
  });
});
