import { expect, it } from 'vitest';
import { comparisonTone } from '../src/simulationComparisonTone.js';
it('compares gains and inverse cost/stop counts, leaving equal and missing values neutral', () => {
  expect(comparisonTone(6, 2)).toBe('positive');
  expect(comparisonTone(2, 6)).toBe('worse');
  expect(comparisonTone(1, 3, true)).toBe('positive');
  expect(comparisonTone(3, 1, true)).toBe('worse');
  expect(comparisonTone(2, 2)).toBe('');
  expect(comparisonTone(null, 2)).toBe('');
});
