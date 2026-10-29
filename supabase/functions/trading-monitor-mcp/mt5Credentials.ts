import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { isExecutionId } from './executionContract.js';

export function mt5Database() {
  return createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {auth:{persistSession:false,autoRefreshToken:false}});
}

export function checked<T>({data,error}:{data:T;error:unknown}):T {
  if (error) throw new Error('mt5_storage_unavailable');
  return data;
}

const encode = (bytes:Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text:string) => Uint8Array.from(atob(text),c=>c.charCodeAt(0));

async function credentialKey() {
  const key = decode(Deno.env.get('MT5_CREDENTIAL_KEY') ?? '');
  if (key.length !== 32) throw new Error('credential_key_missing');
  return crypto.subtle.importKey('raw',key,'AES-GCM',false,['encrypt','decrypt']);
}

export async function encryptCredential(password:string, identity:string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(identity)},
    await credentialKey(),new TextEncoder().encode(password));
  return {iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};
}

export async function decryptCredential(value:{iv:string;ciphertext:string}, identity:string) {
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),
    additionalData:new TextEncoder().encode(identity)},await credentialKey(),decode(value.ciphertext));
  return new TextDecoder().decode(clear);
}

export async function activeMt5Account() {
  const db=mt5Database();
  const settings=checked(await db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single());
  if (!settings?.active_account_id) throw new Error('no_active_account');
  const account=checked(await db.from('mt5_accounts').select('*').eq('id',settings.active_account_id).single());
  if (!account) throw new Error('no_active_account');
  return account;
}

export async function workerConfiguration() {
  if (Deno.env.get('MT5_EXECUTION_ENABLED') !== 'true') throw new Error('mt5_not_configured');
  const account=await activeMt5Account();
  return {account_login:account.login,account_server:account.server,mode:account.mode,
    password:await decryptCredential(account.credentials,`${account.login}:${account.server}`),
    allow_live:Deno.env.get('MT5_ALLOW_LIVE')==='true'};
}

export async function manageMt5Accounts(body:Record<string,unknown>) {
  const db=mt5Database();
  if (body.action==='accounts') {
    const accounts=checked(await db.from('mt5_accounts').select('id,name,login,server,mode,created_at').order('created_at'));
    const settings=checked(await db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single());
    return {accounts,active_account_id:settings?.active_account_id??null};
  }
  if (body.action==='save_account') {
    const {name,login,server,mode,password}=body;
    if (typeof name!=='string'||!name.trim()||name.length>100||!Number.isSafeInteger(login)||Number(login)<=0
      ||typeof server!=='string'||!server.trim()||server.length>100||!['demo','live'].includes(mode as string)
      ||typeof password!=='string'||!password||password.length>200) throw new Error('invalid_account');
    const credentials=await encryptCredential(password,`${login}:${server.trim()}`);
    // Kein Upsert: vorhandene Zugangsdaten nicht versehentlich über einen zweiten Import überschreiben.
    return {account:checked(await db.from('mt5_accounts').insert({name:name.trim(),login,server:server.trim(),mode,credentials})
      .select('id,name,login,server,mode').single())};
  }
  if (body.action==='select_account') {
    if (body.id!==null&&!isExecutionId(body.id)) throw new Error('invalid_id');
    checked(await db.rpc('mt5_select_test_account',{account_id:body.id}));
    return {active_account_id:body.id};
  }
  throw new Error('unknown_action');
}
