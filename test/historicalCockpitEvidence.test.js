import {beforeEach,expect,it,vi} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
const {from,writes}=vi.hoisted(()=>({from:vi.fn(),writes:[]}));
vi.mock('../src/tradingAccounts.js',()=>({ALL_ACCOUNTS_ID:'all'}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from}}));
import {matchOBZone} from '../src/priceChartHitTest.js';
import {addRangeConfirmation} from '../src/tradeIntake.js';
import {fetchDealingRangeCockpit} from '../src/trades.js';
import TradeSetupCockpit from '../src/components/TradeSetupCockpit.vue';

const ended={instrument:'GBPUSD',timeframe:'1H',dir:-1,top:1.32368,bottom:1.32315,
 startTime:1791165600,endTime:1791187200,touched:true,invalidated:true};
beforeEach(()=>{
 writes.length=0;
 from.mockImplementation(table=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,
   upsert:row=>{writes.push({table,row});return q;},insert:row=>{writes.push({table,row});return q;},
   update:row=>{writes.push({table,row});return q;},
   single:async()=>({data:{id:3653781},error:null}),
   maybeSingle:async()=>({data:{id:42,direction:'long',instrument:'GBPUSD'},error:null}),
   then:resolve=>Promise.resolve({data:table==='trade_evidence'?[{id:9,kind:'ob',category:'confirmation',
    price:1.32315,historical_only:true,source_time:'2026-10-05T02:00:00Z',timeframe:'1H'}]:[],error:null}).then(resolve)};
  return q;
 });
});
it.each(['5M','1H','4H'])('%s permits explicit historical evidence but still rejects it as a normal target',tf=>{
 const zone={...ended,timeframe:tf};
 expect(matchOBZone([zone],1.3233,zone.startTime+300,'GBPUSD')).toBeNull();
 expect(matchOBZone([zone],1.3233,zone.startTime+300,'GBPUSD',{allowHistorical:true}))
  .toMatchObject({kind:'ob',timeframe:tf,historicalOnly:true,touchedTime:zone.endTime});
});
it.each(['confirmation','confluence','anti_confluence'])('persists historical %s without changing direction or deriving invalidation',async category=>{
 const item=matchOBZone([ended],1.3233,ended.startTime+300,'GBPUSD',{allowHistorical:true});
 expect(await addRangeConfirmation(42,item,category)).toBe(true);
 expect(writes.find(w=>w.table==='trade_evidence').row).toMatchObject({historical_only:true,category,ob_zone_id:3653781});
 expect(writes.filter(w=>w.table==='dealing_ranges')).toEqual([]);
});
it('preserves historical status through a database reload',async()=>{
 const range=await fetchDealingRangeCockpit(42);
 expect(range.confirmations[0]).toMatchObject({historicalOnly:true});
});
it('renders historical evidence but does not count it toward the two confirmations or derive risk',async()=>{
 const historical={id:1,kind:'ob',category:'confirmation',price:1.32315,historicalOnly:true,rangeLow:1.32315,rangeHigh:1.32368};
 const valid={id:2,kind:'pivot',category:'confirmation',price:1.32};
 const range={id:42,direction:'short',invalidation:1.324,targets:[{id:3,kind:'pivot',price:1.31}],confirmations:[historical,valid]};
 const html=await renderToString(createSSRApp(TradeSetupCockpit,{range,instrument:'GBPUSD'}));
 expect(html).toContain('historisch');expect(html).toContain('kein GO');
 expect(html).toMatch(/<button[^>]*class="[^"]*tsc-transfer-btn[^>]*disabled/);
 expect(html).not.toContain('Deine Dealing Range');
 range.confirmations.push({...valid,id:4});
 const validHtml=await renderToString(createSSRApp(TradeSetupCockpit,{range,instrument:'GBPUSD'}));
 expect(validHtml).not.toMatch(/<button[^>]*class="[^"]*tsc-transfer-btn[^>]*disabled/);
});
