import { expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/supabaseClient.js', () => ({ supabase: { from } }));
import { fetchObZones } from '../src/obZones.js';

it('restores the GBP H1 zone before its later invalidation, beyond the live history limit', async () => {
  const target = { instrument: 'GBPUSD', timeframe: '1H', direction: 'short',
    top: 1.3266, bottom: 1.32446, touched: true, invalidated: true,
    start_time: '2026-10-01T07:00:00Z', end_time: '2026-10-06T11:00:00Z' };
  const rows = [...Array.from({ length: 1100 }, (_, id) => ({ ...target, id })), { ...target, id: 3587174 }];
  from.mockImplementation(() => {
    let start = 0;
    const query = {
      select: () => query, in: () => query, eq: () => query, lte: () => query,
      order: () => query, limit: () => query,
      range: value => { start = value; return query; },
      then: resolve => Promise.resolve({ data: rows.slice(start, start + 600), error: null }).then(resolve),
    };
    return query;
  });
  const zones = await fetchObZones('GBPUSD', Date.parse('2026-10-01T12:00:00+02:00') / 1000);
  expect(zones).toHaveLength(1101);
  expect(zones.at(-1)).toMatchObject({ top: 1.3266, bottom: 1.32446, touched: false, invalidated: false, endTime: null });
});

it('loads the recent untouched OB even beyond a silently capped response', async () => {
  const rows = Array.from({ length: 1250 }, (_, id) => ({
    id, instrument: 'GBPUSD', timeframe: '1H', direction: 'short',
    top: 1.33941, bottom: 1.33887, touched: false, invalidated: false,
    start_time: '2026-09-21T13:00:00Z', end_time: '2026-09-22T08:00:00Z',
  }));
  const offsets = [];
  from.mockImplementation(() => {
    let touched = false, start = 0;
    const query = {
      select: () => query, in: () => query, order: () => query, limit: () => query,
      eq: (_, value) => { touched = value; return query; },
      range: (value) => { start = value; offsets.push(value); return query; },
      then: (resolve) => Promise.resolve({ data: touched ? [] : rows.slice(start, start + 600), error: null }).then(resolve),
    };
    return query;
  });
  expect(await fetchObZones()).toHaveLength(1250);
  expect(offsets).toEqual([0, 600, 1200, 1250]);
});
