import {afterEach,expect,it,vi} from 'vitest';
import {effectScope,ref} from 'vue';
const api=vi.hoisted(()=>({addPositionToDealingRange:vi.fn(),updateTrade:vi.fn()}));
vi.mock('../src/tradeIntake.js',()=>api);
import {useTradePositionForm} from '../src/composables/useTradePositionForm.js';
let scope;afterEach(()=>{scope?.stop();vi.resetAllMocks();});
it('prefills an existing execution without turning it into an insert or changing its stop/exit; cancel restores it',async()=>{
 scope=effectScope();const original=ref({id:153,dealingRangeId:129,tradingAccountId:5,entryPrice:4005.43,entryTime:1793086020,stopLoss:4009,exitPrice:3997.24,exitTime:1793087880});
 const form=scope.run(()=>useTradePositionForm(()=>original.value,{saved:vi.fn(),created:vi.fn()}));
 expect(form.applyEntryPrefill({entryPrice:4004.83,entryTime:1793086500})).toBe(true);
 expect(form.addingPosition.value).toBe(false);expect(form.stopLoss.value).toBe(4009);expect(form.exitPrice.value).toBe(3997.24);
 api.updateTrade.mockResolvedValue(true);await form.save();
 expect(api.updateTrade).toHaveBeenCalledWith(153,expect.objectContaining({entryPrice:4004.83,entryTime:1793086500,stopLoss:4009,exitPrice:3997.24}),undefined);
 expect(api.addPositionToDealingRange).not.toHaveBeenCalled();form.cancelPositionDraft();expect(form.entryPrice.value).toBe(4005.43);
});
