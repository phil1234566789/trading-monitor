import {checked,mt5Database,encryptCredential} from './mt5Credentials.ts';
import {isExecutionId} from './executionContract.js';

export const ACCOUNT_SELECTION_ERRORS=['active_orders_block_account_switch','active_positions_block_account_switch',
 'account_state_unavailable','archived_account','account_not_found'];

export async function readMt5TradingAccounts(){
 const db=mt5Database(),rows=[];let after='00000000-0000-0000-0000-000000000000';
 while(true){
  const page:Record<string,any>[]=checked(await db.from('mt5_accounts').select('id,name,login,server,mode,archived,created_at,trade_role')
   .gt('id',after).order('id').limit(500))??[];
  if(!page.length)return rows;
  rows.push(...page);after=page[page.length-1].id;
 }
}
export async function listMt5TradingAccounts(){
 const accounts=(await readMt5TradingAccounts()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 return {accounts,active_account_id:await readActiveMt5AccountId()};
}
export async function readActiveMt5AccountId(){
 const settings=checked(await mt5Database().from('mt5_execution_settings').select('active_account_id').eq('id','primary').single());
 return settings?.active_account_id??null;
}
export async function selectMt5TradingAccount(accountId:unknown){
 if(accountId!==null&&!isExecutionId(accountId))throw new Error('invalid_id');
 const {error}=await mt5Database().rpc('mt5_select_test_account',{account_id:accountId});
 if(error)throw new Error(ACCOUNT_SELECTION_ERRORS.includes(error.message)?error.message:'mt5_storage_unavailable');
 return {active_account_id:accountId};
}
export async function manageMt5Accounts(body:Record<string,unknown>){
 if(body.action==='accounts')return listMt5TradingAccounts();
 if(body.action==='select_account')return selectMt5TradingAccount(body.id);
 if(body.action==='assign_account_role'){
  if(!isExecutionId(body.id)||!(body.role===null||['risky','safe','normal'].includes(body.role as string)))throw new Error('invalid_account');
  checked(await mt5Database().rpc('mt5_assign_account_role',{p_account:body.id,p_role:body.role}));
  return {saved:true};
 }
 if(body.action==='save_account'){
  const {name,login,server,mode,password}=body;
  if(typeof name!=='string'||!name.trim()||name.length>100||!Number.isSafeInteger(login)||Number(login)<=0
   ||typeof server!=='string'||!server.trim()||server.length>100||!['demo','live'].includes(mode as string)
   ||typeof password!=='string'||!password||password.length>200)throw new Error('invalid_account');
  const credentials=await encryptCredential(password,`${login}:${server.trim()}`);
  // Kein Upsert: ein zweiter Import darf bestehende Zugangsdaten nicht überschreiben.
  return {account:checked(await mt5Database().from('mt5_accounts').insert({name:name.trim(),login,server:server.trim(),mode,credentials})
   .select('id,name,login,server,mode').single())};
 }
 throw new Error('unknown_action');
}
