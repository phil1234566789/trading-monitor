import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, writes } = vi.hoisted(() => ({ from: vi.fn(), writes: [] }));
vi.mock('../src/supabaseClient.js', () => ({ supabase: { from } }));
import { matchOBZone } from '../src/priceChartHitTest.js';
import { addRangeConfirmation, addTargetToTrade } from '../src/tradeIntake.js';

beforeEach(() => {
  writes.length = 0;
  from.mockImplementation(table => {
    const query = {
      upsert: row => { writes.push({ table, row }); return query; },
      insert: row => { writes.push({ table, row }); return query; },
      select: () => query, eq: () => query,
      single: async () => ({ data: { id: 3587174 }, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: resolve => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return query;
  });
});

describe.each(['1H', '4H'])('%s-OB vom Chart ins Cockpit', timeframe => {
  it.each(['confirmation', 'confluence', 'anti_confluence', 'target'])('speichert als %s', async category => {
    const selection = matchOBZone([{ timeframe, startTime: 1790838000, endTime: null,
      top: 1.3266, bottom: 1.32446, dir: -1, touched: false, invalidated: false }],
      1.3265, 1790848800, 'GBPUSD');
    expect(selection).not.toBeNull();
    const ok = category === 'target'
      ? await addTargetToTrade(42, selection)
      : await addRangeConfirmation(42, selection, category);
    expect(ok).toBe(true);
    const saved = writes.find(w => w.table === (category === 'target' ? 'trade_targets' : 'trade_evidence'));
    expect(saved.row).toMatchObject({ dealing_range_id: 42, kind: 'ob', timeframe,
      price: 1.3266, range_low: 1.32446, range_high: 1.3266,
      source_time: '2026-10-01T07:00:00.000Z', touched_time: null });
    if (category !== 'target') {
      expect(saved.row).toMatchObject({ category, ob_zone_id: 3587174 });
      expect(writes.find(w => w.table === 'ob_zones').row).toMatchObject({
        instrument: 'GBPUSD', timeframe, direction: 'short',
      });
    }
  });
});
