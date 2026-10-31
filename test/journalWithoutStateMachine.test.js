import { beforeEach, expect, it, vi } from 'vitest';

const { from, replies, writes } = vi.hoisted(() => ({ from: vi.fn(), replies: [], writes: [] }));
vi.mock('../supabase/functions/trading-monitor-mcp/supabaseClient.ts', () => ({ supabase: { from } }));
import { addTradePosition, updateTradePosition, addTradeConfirmation, addTradeTarget, removePinEntry } from '../supabase/functions/trading-monitor-mcp/db.ts';

beforeEach(() => {
  replies.length = 0;
  writes.length = 0;
  from.mockReset().mockImplementation(table => {
    if (['trading_loop_state', 'state_machine_log'].includes(table)) throw new Error('Retired state machine accessed');
    const result = replies.shift() ?? { data: null, error: null };
    const query = {};
    for (const method of ['insert', 'update', 'delete', 'select', 'eq', 'maybeSingle', 'single']) {
      query[method] = vi.fn((...args) => {
        if (['insert', 'update', 'delete'].includes(method)) writes.push({ table, method, value: args[0] });
        return query;
      });
    }
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
  });
});

it('inserts an execution without requiring a trading loop', async () => {
  replies.push({ data: { id: 8, dealing_ranges: { instrument: 'GBPUSD' } }, error: null });
  expect(await addTradePosition(3, { source: 'paper', entryPrice: 1.3, stopLoss: 1.29 })).toMatchObject({ id: 8 });
  expect(writes[0]).toMatchObject({ table: 'trade_positions', value: { dealing_range_id: 3, entry_price: 1.3, stop_loss: 1.29 } });
});

it('closes an execution without updating a trading loop', async () => {
  replies.push({ data: { id: 8, outcome: 'win', dealing_ranges: { instrument: 'GBPUSD' } }, error: null });
  expect(await updateTradePosition(8, { outcome: 'win', exitPrice: 1.31 })).toMatchObject({ outcome: 'win' });
  expect(writes[0]).toMatchObject({ table: 'trade_positions', value: { outcome: 'win', exit_price: 1.31 } });
});

it('keeps range confirmation writes independent of the retired log', async () => {
  replies.push({ data: { id: 3, instrument: 'GBPUSD' }, error: null }, { data: { id: 9 }, error: null });
  expect(await addTradeConfirmation({ id: 3, level: 'range', kind: 'fib', price: 1.3, sourceTime: '2026-10-30T10:00:00Z' })).toMatchObject({ id: 9 });
  expect(writes[0]).toMatchObject({ table: 'trade_evidence', value: { dealing_range_id: 3, kind: 'fib', price: 1.3 } });
});

it('keeps targets and pin removal available without transitions', async () => {
  replies.push({ data: { id: 3, instrument: 'GBPUSD' }, error: null }, { data: { id: 10 }, error: null });
  expect(await addTradeTarget(3, { price: 1.32, sourceTime: '2026-10-30T10:00:00Z' })).toMatchObject({ id: 10 });
  await removePinEntry(4);
  expect(writes.map(({ table, method }) => [table, method])).toEqual([['trade_targets', 'insert'], ['pin_context', 'delete']]);
});

it('still reports failed journal writes', async () => {
  replies.push({ data: null, error: { message: 'write rejected' } });
  await expect(addTradePosition(3, { source: 'paper' })).rejects.toThrow('write rejected');
});
