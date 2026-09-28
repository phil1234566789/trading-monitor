import { describe, expect, it } from 'vitest';
import { evaluateTradeSetupChecklist, checklistEvaluationTime } from '../src/tradeSetupChecklist.js';
import m5Candles from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import fixture from './fixtures/gbpusd-m5-dr114-session-targets.json';
const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const args = { instrument: 'GBPUSD', h1Candles: h1.candles, m5Candles, sessionConfigs: fixture.sessions,
  settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff } };
const evaluate = (clock, extra = {}) => evaluateTradeSetupChecklist({ ...args,
  evaluatedAt: checklistEvaluationTime(at(clock), at('11:00'), m5Candles), ...extra });
describe('Checklist H in the closed M5 replay', () => {
  it.each([
    ['09:45', ['unmet', 'unmet', 'unmet']],
    ['09:50', ['unmet', 'passed', 'unmet']],
    ['09:55', ['unmet', 'passed', 'unmet']],
    ['10:00', ['unmet', 'passed', 'passed']],
  ])('shows three stable details at %s, without granting an overall GO', (clock, statuses) => {
    const result = evaluate(clock);
    expect(result.direction).toBe('short');
    expect(result.checks.m5Trend.detailStatuses).toEqual(statuses);
    expect(result.checks.m5Trend.details[0]).toBe('M5-Trend bullisch');
    expect(result.checks.m5Trend.details[1]).toContain('Change of Character');
    expect(result.checks.m5Trend.details[2]).toContain('BOS');
    expect(result.tradeability).not.toBe('passed');
  });
  it.each(['loading', 'error', 'stale', 'missing'])('reports %s data honestly', dataStatus => {
    expect(evaluate('10:00', { dataStatus }).checks.m5Trend.detailStatuses).toEqual(['unknown', 'unknown', 'unknown']);
  });
  it('does not trust a history beginning after the M5 structure anchor', () => {
    expect(evaluate('10:00', { m5Candles: fixture.candles }).checks.m5Trend.status).toBe('unknown');
  });
  it('cannot use a half-open candle or a later cached pivot', () => {
    expect(evaluate('10:00', { evaluatedAt: at('09:54') }).checks.m5Trend.structureReaction.choch).toBeNull();
    const initial = evaluate('09:45');
    evaluate('10:20');
    expect(evaluate('09:45').checks.m5Trend).toEqual(initial.checks.m5Trend);
  });
});
