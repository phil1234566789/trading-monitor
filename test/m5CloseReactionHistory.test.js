import { expect, it } from 'vitest';
import { createCloseReactionCache, closeReactionHistory } from '../src/m5CloseReactionHistory.js';

it('retains a working set larger than 512 and enforces its weighted limit', () => {
  const cache = createCloseReactionCache(800);
  const value = [{ structurePivots: [] }];
  for (let i = 0; i < 700; i++) cache.set(String(i), value);
  for (let i = 0; i < 700; i++) expect(cache.get(String(i))).toBe(value);
  for (let i = 700; i < 900; i++) cache.set(String(i), value);
  expect(cache.size).toBe(800);
  expect(cache.has('0')).toBe(false);
  cache.set('oversize', [{ structurePivots: Array(801).fill({}) }]);
  expect(cache.has('oversize')).toBe(false);
  expect(cache.size).toBe(800);
  cache.set('weighted', [{ structurePivots: Array(798).fill({}) }]);
  expect(cache.size).toBe(2);
  expect(cache.has('898')).toBe(false);
  expect(cache.has('899')).toBe(true);
});

it('detaches only the historical fields needed for seed and protected-level lookup', () => {
  const state = { trend: 'uptrend', currRange: { high: { pivotTime: 10 }, low: { pivotTime: 5 } },
    structurePivots: [{ pivotTime: 5, type: 'protected-low' }, { pivotTime: 7, type: 'LQ-sweep', touched: { touchedTime: 9 } },
      { pivotTime: 8, type: 'higher-high' }], appliedPivots: Array(100).fill({}) };
  const history = closeReactionHistory(state);
  expect(history[0].structurePivots).toHaveLength(2);
  expect(history[0]).not.toHaveProperty('appliedPivots');
  state.structurePivots[1].touched.touchedTime = 100;
  expect(history[0].structurePivots[1].touched.touchedTime).toBe(9);
  state.structurePivots.unshift({ pivotTime: 5, type: 'higher-low' });
  const duplicate = closeReactionHistory(state)[0].structurePivots;
  expect(duplicate.find(p => p.pivotTime === 5).type).toBe('higher-low');
  expect(duplicate.some(p => p.type === 'protected-low')).toBe(true);
});
