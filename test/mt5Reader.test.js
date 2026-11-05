import {it,expect} from 'vitest';
import {validateReaderRequest,validateReaderSnapshot} from '../supabase/functions/trading-monitor-mcp/mt5ReaderContract.js';
const id='edc84f4d-4ec1-4d1b-8464-5bc64bc362a5',account={login:42,server:'Demo'},now=1800000000;
const body={action:'snapshot',account_id:id,account_login:42,account_server:'Demo',observed_at_sec:now,snapshot:{balance:50000,equity:49990,currency:'USD',positions:1}};
it('does not admit order, activation, guard or target actions on the reader endpoint',()=>{
 for(const action of ['snapshot','configuration','history_batch'])expect(()=>validateReaderRequest({...body,action})).not.toThrow();
 for(const action of ['poll','result','configuration_execute','select_account','guard_sync','target_claim'])expect(()=>validateReaderRequest({...body,action})).toThrow();
 for(const account_id of [undefined,'all',1])expect(()=>validateReaderRequest({...body,account_id})).toThrow();
});
it('accepts only fresh native balances for the pinned broker identity',()=>{
 expect(validateReaderSnapshot(body,account,now)).toEqual(body.snapshot);
 for(const patch of [{account_login:43},{account_server:'Other'},{observed_at_sec:now-16},{observed_at_sec:now+2},
  {snapshot:{...body.snapshot,balance:NaN}},{snapshot:{...body.snapshot,positions:-1}},{snapshot:{...body.snapshot,currency:'bad'}}])
  expect(()=>validateReaderSnapshot({...body,...patch},account,now)).toThrow();
});
