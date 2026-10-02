import { expect, it } from 'vitest';
import { scanWindowCandles } from '../scripts/tradeSetup2ScanWindow.mjs';

it('shares the exact warmup and exclusive end across runner and benchmark, including an anchor switch', () => {
  const day = 86400;
  const from = 10 * day, to = 11 * day;
  const anchors = [{ knownAt: 9 * day, structureStartTime: 3 * day },
    { knownAt: from + 3600, structureStartTime: day },
    { knownAt: to, structureStartTime: -100 * day }];
  const rows = [-6 * day - 1, -6 * day, from, to - 1, to].map(time => ({ time }));
  expect(scanWindowCandles({ '1h': rows, '5m': rows, '1m': rows }, anchors, from, to, 1))
    .toEqual({ h1Candles: rows.slice(1, 4), m5Candles: rows.slice(1, 4), m1Candles: rows.slice(1, 4) });
});
