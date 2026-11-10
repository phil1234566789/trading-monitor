import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { useTradePositionForm } from '../src/composables/useTradePositionForm.js';
import { tradePositionPayload } from '../src/tradePositionFields.js';
const api = vi.hoisted(() => ({ addPositionToDealingRange:vi.fn(), updateTrade:vi.fn() }));
vi.mock('../src/tradeIntake.js', () => api);
let scope;
afterEach(() => { scope?.stop(); vi.resetAllMocks(); });
function setup() {
  const trade = ref({ id:151, dealingRangeId:128, tradingAccountId:5, entryPrice:4100, entryTime:1793908800,
    stopLoss:4120, exitPrice:4080, exitTime:1793912400, outcome:'win', reasoning:'original', size:1, netPl:50, commission:2 });
  const callbacks = { saved:vi.fn(), created:vi.fn() };
  scope = effectScope();
  return { trade, callbacks, form:scope.run(() => useTradePositionForm(() => trade.value, callbacks)) };
}
it('opens an empty sibling draft without writing or copying execution values; cancel restores unsaved edits', () => {
  const {form} = setup(); form.reasoning.value = 'unsaved original';
  form.beginPositionDraft();
  expect(form.addingPosition.value).toBe(true);
  expect(form.tradingAccountId.value).toBe(5);
  for (const name of ['entryPrice','entryTimeInput','stopLoss','exitPrice','exitTimeInput','outcome','reasoning','size','netPl','commission']) expect(form[name].value).toBe('');
  expect(api.addPositionToDealingRange).not.toHaveBeenCalled(); expect(api.updateTrade).not.toHaveBeenCalled();
  form.cancelPositionDraft(); expect(form.reasoning.value).toBe('unsaved original'); expect(form.entryPrice.value).toBe(4100);
});
it('requires entry price/time before creating and reports failure without discarding the draft', async () => {
  const {form} = setup(); form.beginPositionDraft(); await form.save();
  expect(api.addPositionToDealingRange).not.toHaveBeenCalled();
  form.beginPositionDraft({entryPrice:4112.1,entryTime:1793908800}); api.addPositionToDealingRange.mockResolvedValue(null);
  await form.save(); expect(form.saveError.value).toContain('fehlgeschlagen'); expect(form.entryPrice.value).toBe(4112.1);
});
it('creates one execution under the existing DR atomically and blocks double submits', async () => {
  const {form,callbacks} = setup(); let complete;
  api.addPositionToDealingRange.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  form.beginPositionDraft({entryPrice:4112.1,entryTime:1793908800});
  const saving = form.save(); await form.save();
  expect(api.addPositionToDealingRange).toHaveBeenCalledTimes(1);
  expect(api.addPositionToDealingRange).toHaveBeenCalledWith(128,{fields:expect.objectContaining({entryPrice:4112.1,entryTime:1793908800,tradingAccountId:5,stopLoss:null,exitPrice:null})});
  complete({id:152}); await saving; await form.save();
  expect(api.addPositionToDealingRange).toHaveBeenCalledTimes(1); expect(api.updateTrade).not.toHaveBeenCalled();
  expect(callbacks.created).toHaveBeenCalledWith(152,5);
});
it('preserves drafts across polling but resets when another position is opened', async () => {
  const {form,trade} = setup(); form.beginPositionDraft({entryPrice:4112.1,entryTime:1793908800});
  trade.value = {...trade.value,entryPrice:4200}; await nextTick(); expect(form.entryPrice.value).toBe(4112.1);
  trade.value = {...trade.value,id:152,entryPrice:4000}; await nextTick();
  expect(form.addingPosition.value).toBe(false); expect(form.entryPrice.value).toBe(4000);
});
it('keeps existing update semantics, including dirty fields during polling', async () => {
  const {form,trade,callbacks} = setup(); form.reasoning.value='edited'; trade.value={...trade.value,entryPrice:4101}; await nextTick();
  expect(form.reasoning.value).toBe('edited'); expect(form.entryPrice.value).toBe(4101);
  api.updateTrade.mockResolvedValue(true); await form.save(); expect(api.updateTrade).toHaveBeenCalledWith(151,expect.objectContaining({reasoning:'edited'}),undefined);
  expect(callbacks.saved).toHaveBeenCalledOnce(); expect(api.addPositionToDealingRange).not.toHaveBeenCalled();
});
it('maps only execution columns and preserves null-date update semantics', () => {
  expect(tradePositionPayload({entryTime:null,exitTime:null,entryPrice:3,dealingRangeId:9,source:'broker'}))
    .toEqual({entry_price:3,exit_time:null});
  expect(tradePositionPayload({entryTime:1793908800,exitTime:1793912400,tradingAccountId:5}))
    .toEqual({triggered_at:'2026-11-05T20:00:00.000Z',exit_time:'2026-11-05T21:00:00.000Z',trading_account_id:5});
});
