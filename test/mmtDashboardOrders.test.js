import {it,expect} from 'vitest';
import {mmtDashboardOrders} from '../src/mmtChartStatus.js';
const accounts=[{id:'a',login:42,server:'Demo'},{id:'b',login:43,server:'Other'},{id:'archive',login:99,server:'Demo',archived:true}];
const order=(id,login,server,updated_at)=>({id,intent:{account_login:login,account_server:server},updated_at,status:'searching'});
it('unites all accounts, deduplicates IDs by newer state and rejects foreign identities or archived accounts',()=>{
 const one=order('one',42,'Demo','2026-11-13T09:00:00Z'),two=order('two',43,'Other','2026-11-13T09:00:00Z');
 const latest={...one,status:'expired',updated_at:'2026-11-13T09:00:10Z'};
 const result=mmtDashboardOrders(accounts,{orders:[one,order('archive',99,'Demo')]},{a:{orders:[latest,order('wrongserver',42,'Other')]},b:{orders:[two,order('wronglogin',42,'Other'),one]}});
 expect(result.map(o=>o.id)).toEqual(['one','two']);expect(result[0].status).toBe('expired');
});
it('does not replace a newer global order with an older per-account poll',()=>{
 const latest=order('one',42,'Demo','2026-11-13T09:00:10Z'),old={...latest,status:'sending',updated_at:'2026-11-13T09:00:00Z'};
 expect(mmtDashboardOrders(accounts,{orders:[latest]},{a:{orders:[old]}})).toEqual([latest]);
});
