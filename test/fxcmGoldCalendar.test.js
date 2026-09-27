import { expect, it } from 'vitest';
import { goldWeekendClosed, isGoldWeekendPlaceholder } from '../src/fxcmGoldCalendar.js';
it('filters only flat Gold placeholders in the definitely closed weekend core', () => {
  const row={time:'2026-09-26T22:00:00Z',open:4284.76,high:4284.76,low:4284.76,close:4284.76};
  expect(isGoldWeekendPlaceholder('XAUUSD',row)).toBe(true);
  expect(isGoldWeekendPlaceholder('GBPUSD',row)).toBe(false);
  expect(isGoldWeekendPlaceholder('XAUUSD',{...row,high:4285})).toBe(false);
  expect(isGoldWeekendPlaceholder('XAUUSD',{...row,time:'2026-09-25T12:00:00Z'})).toBe(false);
  expect(goldWeekendClosed(Date.parse('2026-09-27T22:00:00Z'))).toBe(false);
});
