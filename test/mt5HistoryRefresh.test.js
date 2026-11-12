import {it,expect} from 'vitest';
import {historyRefreshState} from '../supabase/functions/trading-monitor-mcp/historyRefreshContract.js';
const account_id='58ef24f2-96d8-464f-9d09-5f00af282f4d';
const requested_at='2026-11-12T21:00:00Z';
const requests=[{account_id,requested_at}];
it('waits for a fresh completed broker import, not just an existing history row',()=>{
 expect(historyRefreshState(requests,[{account_id,synced_at:requested_at}]).done).toBe(false);
 expect(historyRefreshState(requests,[{account_id,completed_request_at:'2026-11-12T20:59:00Z'}]).done).toBe(false);
 expect(historyRefreshState(requests,[{account_id,completed_request_at:'2026-11-12T21:01:00Z'}])).toEqual({done:true,failed:[],pending:[]});
});
it('reports a failure only when it belongs to the current or newer request',()=>{
 expect(historyRefreshState(requests,[{account_id,completed_request_at:requested_at,last_error:'history_unavailable'}]).failed).toEqual([account_id]);
 expect(historyRefreshState(requests,[{account_id,completed_request_at:'2026-11-12T20:59:00Z',last_error:'old'}]).failed).toEqual([]);
});
it('rejects malformed and duplicate request lists',()=>{
 for(const value of [null,[{account_id:'wrong',requested_at}], [...requests,...requests],[{account_id,requested_at:'bad'}]]){
  expect(()=>historyRefreshState(value,[])).toThrow('invalid_history_requests');
 }
});
