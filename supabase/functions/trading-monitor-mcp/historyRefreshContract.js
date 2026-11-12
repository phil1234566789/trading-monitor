import {isExecutionId} from './executionContract.js';
export function historyRefreshState(requests,sync){
 if(!Array.isArray(requests)||requests.length>1000||requests.some(r=>!r||!isExecutionId(r.account_id)||!Number.isFinite(Date.parse(r.requested_at)))
  ||new Set(requests.map(r=>r.account_id)).size!==requests.length)throw new Error('invalid_history_requests');
 const rows=new Map(sync.map(s=>[s.account_id,s]));
 const pending=[],failed=[];
 for(const request of requests){
  const row=rows.get(request.account_id);
  if(!row||!(Date.parse(row.completed_request_at)>=Date.parse(request.requested_at)))pending.push(request.account_id);
  else if(row.last_error)failed.push(request.account_id);
 }
 return {done:pending.length===0,failed,pending};
}
