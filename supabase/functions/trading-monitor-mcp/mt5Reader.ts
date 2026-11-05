import {checked,mt5Database,decryptCredential} from './mt5Credentials.ts';
import {historyWorkerAction} from './mt5History.ts';
import {validateReaderRequest,validateReaderSnapshot} from './mt5ReaderContract.js';
export async function readerAction(body:Record<string,any>){
 validateReaderRequest(body);
 const db=mt5Database(),account=checked(await db.from('mt5_accounts').select('*').eq('id',body.account_id).single());
 if(!account||account.archived)throw new Error('reader_account_unavailable');
 if(body.action==='configuration')return {account_login:Number(account.login),account_server:account.server,
  password:await decryptCredential(account.credentials,`${account.login}:${account.server}`)};
 if(body.action==='snapshot'){
  const snapshot=validateReaderSnapshot(body,account,Math.floor(Date.now()/1000));
  checked(await db.rpc('mt5_record_reader_balance',{p_account_id:account.id,p_snapshot:snapshot,p_observed_at:new Date(body.observed_at_sec*1000).toISOString()}));
  return {recorded:true};
 }
 return historyWorkerAction(body,account);
}
