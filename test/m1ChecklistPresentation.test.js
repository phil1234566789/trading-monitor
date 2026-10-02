import { describe, expect, it } from 'vitest';
import { normalizeM1ChecklistPresentation } from '../src/m1ChecklistPresentation.js';
import { restoreTradeSetup2Snapshot } from '../src/tradeSetup2Snapshot.js';
import { setupEntryConditions } from '../src/tradeSetup2Review.js';
import { initMarketStructureState, applyMarketStructurePivot, collectNestedChain } from '../src/marketStructureAnalysis';

const check = trends => ({ evaluatedAt: 600, trends,
  details: [...trends.map(() => 'Alte Trendzeile'), 'CHoCH', 'BOS', 'Retest', 'FVG'],
  detailStatuses: [...trends.map(() => 'unmet'), 'unmet', 'unmet', 'passed', 'passed'],
  entry: { id: 'saved-entry' } });
const present = (state, direction) => normalizeM1ChecklistPresentation(
  check(collectNestedChain(state).map((level, depth) => ({ trend: level.trend, depth }))), direction);

describe('current M1 direction presentation', () => {
  it.each([false, true])('follows confirmation, promotion and discarded nested trends (mirror=%s)', mirror => {
    const expected = mirror ? 'downtrend' : 'uptrend';
    const direction = mirror ? 'short' : 'long';
    const pivot = (type, price, time) => ({ type: mirror ? type === 'high' ? 'low' : 'high' : type,
      price: mirror ? 3 - price : price, pivotTime: time, pivotAt: String(time), touched: false });
    let state = initMarketStructureState(pivot('high', 1.2, 0), pivot('low', 1.1, 10));
    for (const p of [pivot('high', 1.15, 20), pivot('low', 1.05, 40)]) state = applyMarketStructurePivot(state, p);
    const outerTrend = state.trend;
    expect(present(state, direction).currentTrend).toEqual({ trend: outerTrend, depth: 0 });
    for (const p of [pivot('high', 1.08, 50), pivot('low', 1.06, 60)]) state = applyMarketStructurePivot(state, p);
    expect(state.nestedTrend.trend).toBe('unknown');
    expect(present(state, direction).currentTrend).toEqual({ trend: outerTrend, depth: 0 });
    state = applyMarketStructurePivot(state, pivot('high', 1.12, 70));
    expect(present(state, direction).currentTrend).toEqual({ trend: expected, depth: 1 });
    expect(present(state, direction).detailStatuses.slice(0, 2)).toEqual(['passed', 'context']);
    const discarded = applyMarketStructurePivot(state, pivot('low', 0.95, 80));
    expect(present(discarded, direction).currentTrend).toEqual({ trend: outerTrend, depth: 0 });
    const candle = { time: 95, open: 1.12, high: 1.26, low: 1.11, close: 1.26 };
    const candles = [mirror ? { ...candle, open: 3-candle.open, high: 3-candle.low,
      low: 3-candle.high, close: 3-candle.close } : candle];
    state = applyMarketStructurePivot(state, pivot('high', 1.25, 100), { candles, direction: mirror ? 'up' : 'down' });
    expect(present(state, direction).currentTrend).toEqual({ trend: expected, depth: 0 });
  });

  it('normalizes legacy snapshots without changing saved values or signal offsets', () => {
    const saved = { instrument: 'GBPUSD', direction: 'short', knownAt: 600,
      m1Check: check([{ trend: 'uptrend', depth: 0 }, { trend: 'downtrend', depth: 1 }]) };
    const before = structuredClone(saved);
    const restored = restoreTradeSetup2Snapshot(saved);
    expect(saved).toEqual(before);
    expect(restored.m1Check.details.slice(0, 2)).toEqual([
      'Aktuelle M1-Richtung: Downtrend', 'Outer: Uptrend (Kontext)']);
    expect(restored.m1Check.entry).toEqual(saved.m1Check.entry);
    expect(restoreTradeSetup2Snapshot(restored)).toEqual(restored);
    const review = setupEntryConditions(saved);
    expect(review.rows.find(row => row.key === 'structure').details).toEqual(restored.m1Check.details.slice(0, 2));
    expect(review.rows.filter(row => ['retest', 'fvg'].includes(row.key)).map(row => row.status)).toEqual(['passed', 'passed']);
  });

  it('uses a deeper active direction rather than always selecting the first nested level', () => {
    const saved = check([{ trend: 'uptrend', depth: 0 }, { trend: 'downtrend', depth: 1 },
      { trend: 'uptrend', depth: 2 }]);
    const result = normalizeM1ChecklistPresentation(saved, 'short');
    expect(result.currentTrend).toEqual({ trend: 'uptrend', depth: 2 });
    expect(result.detailStatuses.slice(0, 3)).toEqual(['unmet', 'context', 'context']);
  });

  it('does not infer a current direction from future or incomplete saved chains', () => {
    const saved = check([{ trend: 'downtrend', depth: 0 }]);
    expect(normalizeM1ChecklistPresentation(saved, 'short', 599).currentTrend).toBeUndefined();
    expect(normalizeM1ChecklistPresentation(check([{ trend: 'unknown', depth: 0 }]), 'short').currentTrend).toBeUndefined();
    expect(normalizeM1ChecklistPresentation(check([{ trend: 'uptrend', depth: 2 }]), 'short').currentTrend).toBeUndefined();
  });

  it('handles malformed legacy arrays without throwing or treating strings as signal statuses', () => {
    for (const trends of [null, 'legacy', [null]]) {
      const saved = { knownAt: 600, m1Check: { evaluatedAt: 600, trends } };
      expect(() => restoreTradeSetup2Snapshot(saved)).not.toThrow();
      expect(() => setupEntryConditions(saved)).not.toThrow();
    }
    const saved = { ...check([{ trend: 'downtrend', depth: 0 }]), details: 'legacy', detailStatuses: 'passed' };
    const result = normalizeM1ChecklistPresentation(saved, 'short');
    expect(result.details).toEqual(['Aktuelle M1-Richtung: Downtrend']);
    expect(result.detailStatuses).toEqual(['passed']);
  });
});
