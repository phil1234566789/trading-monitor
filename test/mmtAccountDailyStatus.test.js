import {it,expect,vi} from 'vitest';
import {readAccountDailyStatuses,accountDailyStatus} from '../src/mmtAccountDailyStatus.js';
it('reads each active account without switching the selected trading account and isolates failures',async()=>{
 const accounts=[{id:'a',login:1,server:'s'},{id:'b',login:2,server:'s'},{id:'c',login:3,server:'s'},{id:'archived',archived:true}];
 const status={bridge:{snapshot:{account_login:1,account_server:'s'}},daily_stop:{day:'today'}};
 const other={bridge:{snapshot:{account_login:2,account_server:'s'}},daily_stop:{day:'other'}};
 const api=vi.fn(async(action,fields)=>{if(fields.account_id==='b')return other;throw new Error('offline');});
 const result=await readAccountDailyStatuses(api,accounts,'a',status,{background:true});
 expect(api.mock.calls.map(c=>c[1])).toEqual([{account_id:'b'},{account_id:'c'}]);
 expect(result).toEqual({a:status,b:other,c:null});
 expect(accountDailyStatus(accounts[0],other)).toBeNull();
 expect(accountDailyStatus(accounts[1],other)).toBe(other);
});
