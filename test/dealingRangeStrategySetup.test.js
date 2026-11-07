import {beforeEach,expect,it,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
const {from,writes}=vi.hoisted(()=>({from:vi.fn(),writes:[]}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from}}));
vi.mock('../src/tradingAccounts.js',()=>({ALL_ACCOUNTS_ID:'all'}));
import {updateDealingRange} from '../src/tradeIntake.js';
import {fetchDealingRangeCockpit} from '../src/trades.js';
import TradeSetupCockpit from '../src/components/TradeSetupCockpit.vue';
import SimulationComparisonFilters from '../src/components/SimulationComparisonFilters.vue';
import {STRATEGY_SETUP_KEYS,STRATEGY_SETUP_LABELS} from '../src/strategySetupLabels.js';

beforeEach(()=>{
 writes.length=0;
 from.mockImplementation(table=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,
   update:row=>{writes.push({table,row});return q;},
   maybeSingle:async()=>({data:{id:119,instrument:'XAUUSD',direction:'long',strategy_setup:'setup2'},error:null}),
   then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};
  return q;
 });
});
it('updates the strategy on the idea without replacing its favorite flag',async()=>{
 expect(await updateDealingRange(119,{strategySetup:'setup2'})).toBe(true);
 expect(writes).toEqual([{table:'dealing_ranges',row:{strategy_setup:'setup2'}}]);
});
it('clears an unproven strategy and rejects filter-only or arbitrary values before writing',async()=>{
 expect(await updateDealingRange(119,{strategySetup:null})).toBe(true);
 expect(writes[0].row).toEqual({strategy_setup:null});
 writes.length=0;
 expect(await updateDealingRange(119,{strategySetup:'all'})).toBe(false);
 expect(writes).toEqual([]);
});
it('reloads the saved setup for a cockpit idea',async()=>{
 expect(await fetchDealingRangeCockpit(119)).toMatchObject({strategySetup:'setup2'});
});
it.each(STRATEGY_SETUP_KEYS)('persists the statistics key %s with unknown stored as NULL',async key=>{
 expect(await updateDealingRange(119,{strategySetup:key})).toBe(true);
 expect(writes[0].row).toEqual({strategy_setup:key==='unknown'?null:key});
});
it('reports a database rejection instead of claiming the setup was saved',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 from.mockReturnValue({update:()=>({eq:async()=>({error:{message:'write rejected'}})})});
 expect(await updateDealingRange(119,{strategySetup:'setup2'})).toBe(false);
 log.mockRestore();
});
it('offers the six statistics setups for an existing range, without the All filter',async()=>{
 const html=await renderToString(createSSRApp(TradeSetupCockpit,{instrument:'XAUUSD',range:{id:119,strategySetup:'setup2'}}));
 expect(html).toContain('Setup 2 · Trendfortführung mit LS');
 expect(html).toContain('Setup nicht belegt');
 expect(html).not.toContain('>Alle</option>');
 expect(html).toMatch(/<select value="setup2"/);
 const statistics=await renderToString(createSSRApp(SimulationComparisonFilters,{modelValue:{},runs:[],features:[]}));
 for(const key of STRATEGY_SETUP_KEYS){
  expect(html).toContain(STRATEGY_SETUP_LABELS[key]);
  expect(statistics).toContain(STRATEGY_SETUP_LABELS[key]);
 }
});
