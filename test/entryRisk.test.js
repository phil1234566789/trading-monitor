import { describe, expect, it } from 'vitest';
import { entryRiskScale, entryRiskSpec } from '../src/entryRisk.js';

describe('entry risk scales', () => {
  it.each([null, NaN, 1.35, 1.34])('does not invent short risk for invalid stop %s', stop => {
    expect(entryRiskScale(1.35, stop, [], 'GBPUSD', 'short').status).toBe('unknown');
  });
  it('uses entry risk independently for each ladder without the old six pip cap', () => {
    const scale = entryRiskScale(1.35, 1.351, [{ label: 'T1', price: 1.347 }, { label: 'T2', price: 1.352 }], 'GBPUSD', 'short');
    expect(scale.riskPips).toBeCloseTo(10);
    expect(scale.levels.map(l => l.r)).toEqual([3,4,5,6]);
    expect(scale.levels[3].price).toBeCloseTo(1.344);
    expect(scale.targets[0].rr).toBeCloseTo(3);
    expect(scale.targets[1].rr).toBeNull();
    expect(entryRiskSpec(scale, 'SL weit', 'rScale', 'GBPUSD').levels.some(l => l.label.includes('1,35100'))).toBe(true);
  });
  it('uses instrument precision and pip sizes', () => {
    const scale = entryRiskScale(2600,2601,[{ label:'T1', price:2597 }],'XAUUSD','short');
    expect(scale.riskPips).toBe(100);
    expect(entryRiskSpec(scale,'SL weit','rScale','XAUUSD').levels[0].label).toContain('2.601,00');
  });
});
