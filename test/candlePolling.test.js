import { expect, it } from 'vitest';
import { nextCandlePollDelay } from '../src/candlePolling.js';

it('rechecks an old successful M5 response without waiting for the next close', () => {
  const now = Date.parse('2026-09-22T16:20:02+02:00');
  expect(nextCandlePollDelay('5m', now)).toBeLessThanOrEqual(60_000);
});

it('leaves the collector time after a close and keeps all timeframes checking', () => {
  const beforeClose = Date.parse('2026-09-22T16:19:59+02:00');
  expect(nextCandlePollDelay('5m', beforeClose)).toBe(21_000);
  for (const bar of ['1m', '3m', '5m', '15m', '1h', '4h', '1D']) {
    expect(nextCandlePollDelay(bar, beforeClose)).toBeLessThanOrEqual(60_000);
    expect(nextCandlePollDelay(bar, beforeClose)).toBeGreaterThan(0);
  }
});
