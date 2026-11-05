import { createClient } from 'npm:@supabase/supabase-js@2.110.0';


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

export async function activeMt5Account(accountId?:unknown) {
  const db=mt5Database();
  if(accountId!=null){
    if(typeof accountId!=='string'||!/^[0-9a-f-]{36}$/i.test(accountId))throw new Error('invalid_account');
    const account=checked(await db.from('mt5_accounts').select('*').eq('id',accountId).single());
    if(!account||account.archived)throw new Error('archived_account');
    return account;
  }
  const settings=checked(await db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single());
  if (!settings?.active_account_id) throw new Error('no_active_account');
  const account=checked(await db.from('mt5_accounts').select('*').eq('id',settings.active_account_id).single());
  if (!account||account.archived) throw new Error('no_active_account');
  return account;
}

export async function workerConfiguration(accountId?:unknown) {
  if (Deno.env.get('MT5_EXECUTION_ENABLED') !== 'true') throw new Error('mt5_not_configured');
  const account=await activeMt5Account(accountId);
  return {account_login:account.login,account_server:account.server,mode:account.mode,
    password:await decryptCredential(account.credentials,`${account.login}:${account.server}`),
    allow_live:Deno.env.get('MT5_ALLOW_LIVE')==='true'};
}

export async function accountBridge(account:any){
  const db=mt5Database();
  const own=checked(await db.from('mt5_bridge_state').select('*').eq('id',account.id).maybeSingle());
  const legacy=checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle());
  const matching=legacy?.snapshot?.account_login===Number(account.login)&&legacy.snapshot.account_server===account.server?legacy:null;
  return own&&(!matching||Date.parse(own.heartbeat_at)>=Date.parse(matching.heartbeat_at))?own:matching;
}
