import { describe, expect, it } from 'vitest';
import { entryPattern1TargetExclusions, usesEntryPattern1TargetReplacement } from '../src/entryPattern1Targets.js';
import { replaceChecklistTargets } from '../src/tradeSetupChecklistTargets.js';
import { isEntryPattern1, usesCountertrendM5BosEntryPattern1, usesPivotBreakEntryPattern1 } from '../src/entryPattern1Conditions.js';
import { supportsSnapshotIndicators } from '../src/tradeSetup2Configuration.js';

describe('Entry Pattern 1 target replacement', () => {
  it.each(['short', 'long'])('replaces only the chosen turning seed of the causal countertrend (%s)', direction => {
    const short = direction === 'short', dir = short ? -1 : 1;
    const price = value => short ? 100 - value : 100 + value;
    const seed = { type: short ? 'low' : 'high', pivotTime: 200, price: price(1) };
    const origin = { pivotTime: 250, price: price(-1) };
    const state = { trend: short ? 'uptrend' : 'downtrend',
      currRange: short ? { low: { pivotTime: 10 }, high: origin } : { high: { pivotTime: 10 }, low: origin },
      nestedTrend: { trend: 'unknown', appliedPivots: [origin, seed] } };
    const primary = { checks: { m5Trend: { structureState: state, evaluatedAt: 300 } } };
    const excludedTargets = entryPattern1TargetExclusions(primary, direction, 300);
    const levels = [
      { ...seed, dir, sessionKey: 'NY' },
      { pivotTime: 150, price: price(2), dir, sessionKey: 'MMM' },
      { pivotTime: 100, price: price(3), dir },
      { pivotTime: 90, price: price(2.5), dir, touched: true },
      { pivotTime: 80, price: price(-2), dir },
    ];
    expect(excludedTargets).toEqual([{ pivotTime: 200, price: price(1), dir }]);
    const options = { direction, referencePrice: 100, excludedTargets };
    expect(replaceChecklistTargets(levels, options).map(p => p.price)).toEqual([price(2), price(3)]);
    expect(replaceChecklistTargets(levels.slice(0, 2), options).map(p => p.price)).toEqual([price(2)]);
    expect(replaceChecklistTargets(levels.slice(0, 1), options)).toEqual([]);
    // Ein späterer/fremder Seed und ein unabhängiges Target ändern die historische Auswahl nicht.
    expect(entryPattern1TargetExclusions(primary, direction, 299)).toEqual([]);
    const independent = [{ ...levels[0], pivotTime: 199 }, ...levels.slice(1)];
    expect(replaceChecklistTargets(independent, options)).toEqual(replaceChecklistTargets(independent, { ...options, excludedTargets: [] }));
    state.nestedTrend.appliedPivots[0] = { ...origin, pivotTime: 249 };
    expect(entryPattern1TargetExclusions(primary, direction, 300)).toEqual([]);
    state.nestedTrend.appliedPivots[0] = origin;
    state.nestedTrend.trend = short ? 'downtrend' : 'uptrend';
    expect(entryPattern1TargetExclusions(primary, direction, 300)).toEqual([]);
  });
  it('replaces an excluded T2 without moving an independent T1', () => {
    const levels = [
      { pivotTime: 1, dir: -1, price: 99, sessionKey: 'A' },
      { pivotTime: 2, dir: -1, price: 98, sessionKey: 'B' },
      { pivotTime: 3, dir: -1, price: 97 },
    ];
    expect(replaceChecklistTargets(levels, { direction: 'short', referencePrice: 100,
      excludedTargets: [levels[1]] })).toEqual([levels[0], levels[2]]);
  });
  it('preserves historical Entry Pattern gates and snapshot readers', () => {
    for (const version of ['countertrend-entry-model-1-v6', 'countertrend-entry-model-1-v7', 'countertrend-entry-model-1-v8', 'countertrend-entry-model-1-v9']) {
      expect(isEntryPattern1(version)).toBe(true);
      expect(usesCountertrendM5BosEntryPattern1(version)).toBe(true);
      expect(usesPivotBreakEntryPattern1(version)).toBe(true);
    }
    expect(usesEntryPattern1TargetReplacement('countertrend-entry-model-1-v6')).toBe(false);
    expect(usesEntryPattern1TargetReplacement('countertrend-entry-model-1-v7')).toBe(true);
    expect(supportsSnapshotIndicators('countertrend-entry-model-1-v17')).toBe(true);
  });
});
