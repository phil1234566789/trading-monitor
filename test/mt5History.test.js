import {it,expect} from 'vitest';
import {validateHistoryBatch} from '../supabase/functions/trading-monitor-mcp/mt5HistoryContract.js';
const account={id:'a',login:42,server:'Demo'},now=1800000000;
const deal={ticket:1,position_id:2,time_msc:now*1000,type:1,entry:0,symbol:'XAUUSD.gbe',volume:.01,price:4020,profit:0,commission:-.05,swap:0,fee:0};
const body={account_login:42,account_server:'Demo',currency:'USD',deals:[deal]};
it('pins broker identity and rejects malformed or oversized history batches',()=>{
 expect(validateHistoryBatch(body,account,now)[0].account_id).toBe('a');
 for(const patch of [{account_login:43},{account_server:'Other'},{currency:'bad'},{deals:Array(101).fill(deal)},{deals:[{...deal,profit:NaN}]},{deals:[{...deal,password:'private'}]}])expect(()=>validateHistoryBatch({...body,...patch},account,now)).toThrow();
});
