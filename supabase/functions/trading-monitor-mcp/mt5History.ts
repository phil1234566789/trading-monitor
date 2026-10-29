import { activeMt5Account,checked,mt5Database } from './mt5Credentials.ts';
import { validateHistoryBatch } from './mt5HistoryContract.js';
export async function historyWorkerAction(body:Record<string,any>) {
 const account=await activeMt5Account(),db=mt5Database(),now=Math.floor(Date.now()/1000);
 if(body.action==='history_context'){
  const sync=checked(await db.from('mt5_history_sync').select('*').eq('account_id',account.id).maybeSingle());
  return {account_login:Number(account.login),account_server:account.server,archived:account.archived,
   since_sec:sync?.complete_until_sec??0,full_due:!sync?.last_full_at||Date.now()-Date.parse(sync.last_full_at)>86400000};
 }
 if(body.account_login!==Number(account.login)||body.account_server!==account.server)throw new Error('account_mismatch');
 if(body.action==='history_start'){
  checked(await db.from('mt5_history_sync').upsert({account_id:account.id},{onConflict:'account_id',ignoreDuplicates:true}));
  checked(await db.from('mt5_history_sync').update({in_progress:true,last_error:null}).eq('account_id',account.id));
  return {recorded:true};
 }
 if(body.action==='history_batch'){
  const rows=validateHistoryBatch(body,account,now);
  if(rows.length)checked(await db.from('mt5_broker_deals').upsert(rows,{onConflict:'account_id,ticket'}));
  return {recorded:rows.length};
 }
 if(body.action==='history_complete'){
  if(!Number.isSafeInteger(body.until_sec)||body.until_sec<=0||body.until_sec>now+60||typeof body.full!=='boolean'
   ||typeof body.currency!=='string'||!/^[A-Z]{3,8}$/.test(body.currency))throw new Error('invalid_history_completion');
  const previous=checked(await db.from('mt5_history_sync').select('*').eq('account_id',account.id).maybeSingle());
  checked(await db.from('mt5_history_sync').upsert({account_id:account.id,complete_until_sec:Math.max(body.until_sec,previous?.complete_until_sec??0),
   last_full_at:body.full?new Date().toISOString():previous?.last_full_at??null,synced_at:new Date().toISOString(),last_error:null,in_progress:false,currency:body.currency}));
  return {recorded:true};
 }
 if(body.action==='history_fault'){
  checked(await db.from('mt5_history_sync').upsert({account_id:account.id},{onConflict:'account_id',ignoreDuplicates:true}));
  checked(await db.from('mt5_history_sync').update({last_error:'history_unavailable',in_progress:false}).eq('account_id',account.id));
  return {recorded:true};
 }
 throw new Error('unknown_action');
}
export async function readHistoryPage(body:Record<string,any>) {
 const cursor=body.after_id??0;
 if(!Number.isSafeInteger(cursor)||cursor<0)throw new Error('invalid_history_cursor');
 const db=mt5Database();
 const rows=checked(await db.from('mt5_broker_deals').select('*').gt('id',cursor).order('id').limit(500))??[];
 const sync=cursor===0?checked(await db.from('mt5_history_sync').select('*')):undefined;
 return {rows,next_cursor:rows.length?rows[rows.length-1].id:null,sync};
}
