import { describe, expect, it } from 'vitest';
import { buildHistoricalDailyAnchors, historicalSettingsAt } from '../src/tradeSetup2Anchors.js';

describe('historical daily P4 anchors', () => {
  it('waits for all four actual right-hand daily candles to close', () => {
    const daily = Array.from({ length: 16 }, (_, i) => ({ time: i * 86400, high: i === 8 ? 4 : 2, low: 1, open: 1.5, close: 1.5 }));
    const h1 = [{ time: 8 * 86400 + 3600, high: 4, low: 1 }];
    const anchors = buildHistoricalDailyAnchors(daily, h1);
    expect(anchors).toEqual([{ pivotTime: 8 * 86400, structureStartTime: 8 * 86400 + 3600, knownAt: 13 * 86400, direction: 'high', price: 4 }]);
    expect(historicalSettingsAt({}, anchors, 13 * 86400 - 1)).toBeNull();
    expect(historicalSettingsAt({}, anchors, 13 * 86400)).toMatchObject({ rangesFixedStartActive: true, rangesFixedStartTime: 8 * 86400 + 3600 });
    expect(buildHistoricalDailyAnchors(daily.slice(0, 13), h1)).toEqual(anchors);
  });
});
