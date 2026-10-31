import {it,expect} from 'vitest';
import {readExecutionOrders} from '../supabase/functions/trading-monitor-mcp/mt5OrderRead.js';
it('returns old active searches across all assets, even after a short server page',async()=>{
 const rows=[{id:'1',status:'searching',symbol:'XAUUSD'},{id:'2',status:'unknown',symbol:'EURUSD'},{id:'3',status:'sending',symbol:'GBPUSD'}];
 const cursors=[];
 const db={from:()=>{let active=false,after='';const q={select:()=>q,order:()=>q,in:()=>{active=true;return q;},gt:(k,id)=>{after=id;return q;},limit:async()=>{
  if(!active)return {data:[{id:'3',status:'searching'},{id:'4',status:'executed'}]};
  cursors.push(after);return {data:rows.filter(r=>r.id>after).slice(0,1)};
 }};return q;}};
 const result=await readExecutionOrders(db);
 expect(result).toHaveLength(4);expect(result.find(r=>r.id==='3').status).toBe('sending');
 expect(result.filter(r=>r.status!=='executed').map(r=>r.symbol).sort()).toEqual(['EURUSD','GBPUSD','XAUUSD']);
 expect(cursors).toEqual(['00000000-0000-0000-0000-000000000000','1','2','3']);
});
