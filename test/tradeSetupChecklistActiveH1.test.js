import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildChecklistMarketContext, evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import { buildMarketStructureState } from '../src/marketStructureAnalysis';
import { evaluateChecklistCandidates } from '../src/tradeSetupChecklistCandidates.js';
vi.mock('../src/marketStructureAnalysis', async importOriginal => ({ ...await importOriginal(),
  computeRangesPivots: vi.fn(() => []), buildMarketStructureState: vi.fn() }));
vi.mock('../src/tradeSetupChecklistCandidates.js', () => ({ evaluateChecklistCandidates: vi.fn(() => ({ checks: {}, candidates: [] })) }));
const level = (trend, nestedTrend = null) => ({ trend, nestedTrend, structurePivots: [], appliedPivots: [], closedRanges: [] });
const input = { instrument: 'GBPUSD', evaluatedAt: 3600,
  h1Candles: [{ time: 0, open: 1, high: 2, low: 0, close: 1 }],
  m5Candles: [{ time: 3300, open: 1, high: 2, low: 0, close: 1 }], entryGates: true };
beforeEach(() => vi.clearAllMocks());
describe('active confirmed H1 controls A and candidate context', () => {
  it.each([
    ['uptrend', level('downtrend'), 'short'],
    ['uptrend', level('downtrend', level('uptrend', level('downtrend'))), 'short'],
    ['uptrend', level('downtrend', level('unknown', level('uptrend'))), 'short'],
    ['downtrend', null, 'short'],
    ['uptrend', null, 'long'],
  ])('%s with active chain yields %s', (outer, nested, direction) => {
    const state = level(outer, nested);
    state.closedRanges = [level(direction === 'short' ? 'uptrend' : 'downtrend')];
    buildMarketStructureState.mockReturnValue(state);
    const result = evaluateTradeSetupChecklist(input);
    expect(result.direction).toBe(direction);
    expect(result.context.direction).toBe(direction);
    expect(result.structure).toBe(state);
    expect(result.checks.h1Trend).toMatchObject({ status: 'passed', source: 'active-confirmed-h1',
      trend: direction === 'long' ? 'uptrend' : 'downtrend' });
    expect(evaluateChecklistCandidates.mock.calls[0][0].direction).toBe(direction);
  });
  it('keeps direction on promotion and never enters under an unknown outer state', () => {
    buildMarketStructureState.mockReturnValue(level('uptrend', level('downtrend')));
    expect(buildChecklistMarketContext(input).direction).toBe('short');
    buildMarketStructureState.mockReturnValue(level('downtrend'));
    expect(buildChecklistMarketContext(input).direction).toBe('short');
    buildMarketStructureState.mockReturnValue(level('unknown'));
    expect(evaluateTradeSetupChecklist(input).direction).toBeNull();
    expect(evaluateChecklistCandidates).not.toHaveBeenCalled();
  });
});
