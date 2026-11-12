import {checked,mt5Database} from './mt5Credentials.ts';
import {readHistorySync} from './mt5History.ts';
import {historyRefreshState} from './historyRefreshContract.js';
export async function historyRefreshAction(body:Record<string,any>){
 if(body.action==='history_refresh'){
  const requests=checked(await mt5Database().rpc('mt5_request_history_refresh'))??[];
  return {requests};
 }
 if(body.action==='history_refresh_status'){
  historyRefreshState(body.requests,[]);
  return historyRefreshState(body.requests,await readHistorySync(mt5Database()));
 }
 throw new Error('unknown_action');
}
