import {it,expect,vi} from 'vitest';
import {readAccountDailyStatuses,accountDailyStatus} from '../src/mmtAccountDailyStatus.js';
it('reads each active account without switching the selected trading account and isolates failures',async()=>{
 const accounts=[{id:'a',login:1,server:'s'},{id:'b',login:2,server:'s'},{id:'c',login:3,server:'s'},{id:'archived',archived:true}];
 const status={bridge:{snapshot:{account_login:1,account_server:'s'}},daily_stop:{day:'today'}};
 const other={bridge:{snapshot:{account_login:2,account_server:'s'}},daily_stop:{day:'other'}};
 const api=vi.fn(async(action,fields)=>{if(fields.account_id==='b')return other;throw new Error('offline');});
 const result=await readAccountDailyStatuses(api,accounts,'a',status,{background:true});
 expect(api.mock.calls.map(c=>c[1])).toEqual([{account_id:'b'},{account_id:'c'}]);
 expect(result).toEqual({a:status,b:other,c:{online:false,status_error:'offline'}});
 expect(accountDailyStatus(accounts[0],other)).toBeNull();
 expect(accountDailyStatus(accounts[1],other)).toBe(other);
});
it('retains only the last correctly bound account snapshot on a partial poll failure and clears real closures',async()=>{
 const accounts=[{id:'a',login:1,server:'s'},{id:'b',login:2,server:'s'}];
 const state=(login,positions)=>({online:true,bridge:{heartbeat_at:'2026-11-13T13:00:00Z',snapshot:{account_login:login,account_server:'s',positions}}});
 const a=state(1,[{ticket:10}]),b=state(2,[{ticket:10},{ticket:20}]);
 const api=vi.fn().mockRejectedValueOnce(new Error('Timeout')).mockResolvedValueOnce(state(2,[]));
 const failed=await readAccountDailyStatuses(api,accounts,'a',a,{}, {a,b});
 expect(failed.a).toBe(a);expect(failed.b.bridge).toBe(b.bridge);expect(failed.b).toMatchObject({online:false,status_error:'Timeout'});
 expect(b.online).toBe(true);expect(b).not.toHaveProperty('status_error');
 const closed=await readAccountDailyStatuses(api,accounts,'a',a,{},failed);
 expect(closed.b.bridge.snapshot.positions).toEqual([]);expect(closed.b).not.toHaveProperty('status_error');
});
it('rejects cross-account or cross-server responses without attaching wrong positions',async()=>{
 const account={id:'a',login:1,server:'s'};
 for(const snapshot of [{account_login:2,account_server:'s',positions:[{ticket:7}]},{account_login:1,account_server:'other',positions:[{ticket:7}]}]){
  const result=await readAccountDailyStatuses(vi.fn(),[account],'a',{bridge:{snapshot}}, {},{a:{bridge:{snapshot}}});
  expect(result.a.online).toBe(false);expect(result.a.status_error).toBeTruthy();expect(result.a.bridge).toBeUndefined();
 }
});
