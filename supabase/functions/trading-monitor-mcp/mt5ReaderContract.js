export const READER_ACTIONS=new Set(['configuration','snapshot','history_context','history_start','history_batch','history_complete','history_fault']);
export function validateReaderRequest(body){
 if(!body||!READER_ACTIONS.has(body.action))throw new Error('unknown_reader_action');
 if(typeof body.account_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.account_id))throw new Error('invalid_reader_account');
}
export function validateReaderSnapshot(body,account,now){
 if(body.account_login!==Number(account.login)||body.account_server!==account.server)throw new Error('account_mismatch');
 const s=body.snapshot;
 if(!s||!['balance','equity'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))
  ||typeof s.currency!=='string'||!/^[A-Z]{3,8}$/.test(s.currency)||!Number.isSafeInteger(s.positions)||s.positions<0
  ||!Number.isSafeInteger(body.observed_at_sec)||body.observed_at_sec>now+1||now-body.observed_at_sec>15)throw new Error('invalid_reader_snapshot');
 return {balance:s.balance,equity:s.equity,currency:s.currency,positions:s.positions};
}
