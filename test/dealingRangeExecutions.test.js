import {afterEach,expect,it,vi} from 'vitest';
import {effectScope,nextTick,ref} from 'vue';
const api=vi.hoisted(()=>({fetchTrades:vi.fn()}));
vi.mock('../src/trades.js',()=>api);
vi.mock('../src/tradingAccounts.js',()=>({ALL_ACCOUNTS_ID:'all'}));
import {useDealingRangeExecutions} from '../src/composables/useDealingRangeExecutions.js';
let scope;
afterEach(()=>{scope?.stop();vi.resetAllMocks();});
const flush=async()=>{await Promise.resolve();await nextTick();};
it('loads every account of the same DR, preserves loaded siblings when dashboard account filters differ, and orders by persistent ID',async()=>{
 const one={id:151,dealingRangeId:128,instrument:'XAUUSD',tradingAccountId:5};
 const two={...one,id:152,tradingAccountId:7,brokerPrivate:true};
 api.fetchTrades.mockResolvedValue([two,one]);const trade=ref(one),available=ref([one]);scope=effectScope();
 const state=scope.run(()=>useDealingRangeExecutions(()=>trade.value,()=>available.value));await flush();
 expect(api.fetchTrades).toHaveBeenCalledExactlyOnceWith('XAUUSD','all',128);expect(state.positions.value.map(p=>p.id)).toEqual([151,152]);
 available.value=[{...one,entryPrice:1},{id:999,dealingRangeId:999,instrument:'XAUUSD'}];await flush();
 expect(state.positions.value.map(p=>p.id)).toEqual([151,152]);expect(state.positions.value[0].entryPrice).toBe(1);
 trade.value={...one,reasoning:'poll'};await flush();expect(api.fetchTrades).toHaveBeenCalledTimes(1);
});
it('does not publish a previous DR response after the user switches and exposes real loading failures',async()=>{
 let finishOld;api.fetchTrades.mockImplementationOnce(()=>new Promise(resolve=>finishOld=resolve)).mockResolvedValueOnce([{id:160,dealingRangeId:129,instrument:'XAUUSD'}]);
 const trade=ref({id:151,dealingRangeId:128,instrument:'XAUUSD'}),available=ref([]);scope=effectScope();
 const state=scope.run(()=>useDealingRangeExecutions(()=>trade.value,()=>available.value));
 trade.value={id:160,dealingRangeId:129,instrument:'XAUUSD'};await flush();finishOld([{id:151,dealingRangeId:128}]);await flush();
 expect(state.positions.value.map(p=>p.id)).toEqual([160]);
 api.fetchTrades.mockRejectedValue(new Error('offline'));expect(await state.refresh()).toBe(false);expect(state.error.value).toContain('nicht vollständig');expect(state.positions.value[0].id).toBe(160);
});
