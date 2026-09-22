import { it, expect, vi } from 'vitest';
import { readFxcmCandles } from '../supabase/functions/_shared/fxcmCandles.ts';

function database(pages) {
  const query = {};
  for (const method of ['select', 'eq', 'lt', 'order']) query[method] = vi.fn(() => query);
  query.limit = vi.fn(async () => ({ data: pages.shift() ?? [], error: null }));
  return { from: vi.fn(() => query), query };
}
const row = (minute, price = 1) => ({ time: new Date(Date.UTC(2026, 0, 5, 0, minute)).toISOString(), open: price, high: price + 1, low: price - .1, close: price + .2, volume: 10 });

it('continues across short server pages and returns oldest first', async () => {
  const db = database([[row(4)], [row(3)], [row(2)], []]);
  const candles = await readFxcmCandles(db, 'GBPUSD', 'M1', 4);
  expect(candles).toHaveLength(3);
  expect(candles[0].time).toBe(Date.parse(row(2).time) / 1000);
  expect(db.query.limit).toHaveBeenCalledTimes(4);
});
it('reads native M3 bars rather than reconstructing them from M1', async () => {
  const db = database([[row(0, 1)]]);
  expect((await readFxcmCandles(db, 'GBPUSD', 'M3', 1))[0]).toMatchObject({ open: 1, high: 2, low: .9, close: 1.2, volume: 10 });
  expect(db.query.eq).toHaveBeenCalledWith('bar', '3m');
});
it('rejects invalid instrument and counts', async () => {
  await expect(readFxcmCandles(database([]), 'OTHER', 'M5', 300)).rejects.toThrow();
  await expect(readFxcmCandles(database([]), 'GBPUSD', 'M5', NaN)).rejects.toThrow();
});
