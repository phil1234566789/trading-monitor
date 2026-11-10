import { expect, it, vi, beforeEach } from 'vitest';
const db = vi.hoisted(() => ({ from:vi.fn(), insert:vi.fn(), select:vi.fn(), single:vi.fn() }));
vi.mock('../src/supabaseClient.js', () => ({supabase:db}));
import { addPositionToDealingRange } from '../src/tradeIntake.js';
beforeEach(() => {
  vi.clearAllMocks(); db.from.mockReturnValue(db); db.insert.mockReturnValue(db); db.select.mockReturnValue(db);
  db.single.mockResolvedValue({data:{id:153,dealing_range_id:128},error:null});
});
it('inserts all new execution fields once under the existing DR without updating or creating a range', async () => {
  expect(await addPositionToDealingRange(128,{fields:{entryPrice:4112.1,entryTime:1793908800,exitPrice:4083.96,
    exitTime:1793912700,tradingAccountId:5,reasoning:'manual',stopLoss:null,dealingRangeId:999,source:'broker'}}))
    .toEqual({id:153,dealing_range_id:128});
  expect(db.from).toHaveBeenCalledExactlyOnceWith('trade_positions');
  expect(db.insert).toHaveBeenCalledExactlyOnceWith({dealing_range_id:128,source:'live',triggered_at:'2026-11-05T20:00:00.000Z',
    trading_account_id:5,entry_price:4112.1,exit_price:4083.96,exit_time:'2026-11-05T21:05:00.000Z',reasoning:'manual',stop_loss:null});
});
it('retains the existing empty TSC execution creation contract', async () => {
  await addPositionToDealingRange(128,{tradingAccountId:5,triggeredAt:1793908800});
  expect(db.insert).toHaveBeenCalledExactlyOnceWith({dealing_range_id:128,source:'live',triggered_at:'2026-11-05T20:00:00.000Z',trading_account_id:5});
});
