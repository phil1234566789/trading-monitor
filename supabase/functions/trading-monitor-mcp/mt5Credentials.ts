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

// Nur mt5-worker schaltet das ein: der VPS-Worker las Konto/aktives Konto/Policy pro Zyklus mehrfach (~23k REST/h).
// Handelszustand (Orders, Guards, Daily Stops, Bridge) bleibt bewusst ungecacht.
let readCacheMs=0;
const readCache=new Map<string,{at:number;value:unknown}>();
export function enableMt5ReadCache(ms:number){readCacheMs=ms;}
export async function cachedMt5Read<T>(key:string,read:()=>Promise<T>):Promise<T>{
  if(!readCacheMs)return read();
  const hit=readCache.get(key);
  if(hit&&Date.now()-hit.at<readCacheMs)return structuredClone(hit.value) as T;
  const value=await read();
  readCache.set(key,{at:Date.now(),value:structuredClone(value)});
  return value;
}
export const activeMt5AccountId=(db=mt5Database())=>cachedMt5Read('settings',async()=>
  checked(await db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single())?.active_account_id??null);
const readMt5Account=(db:any,id:string)=>cachedMt5Read('account:'+id,async()=>checked(await db.from('mt5_accounts').select('*').eq('id',id).single()));

export async function activeMt5Account(accountId?:unknown) {
  const db=mt5Database();
  if(accountId!=null){
    if(typeof accountId!=='string'||!/^[0-9a-f-]{36}$/i.test(accountId))throw new Error('invalid_account');
    const account:any=await readMt5Account(db,accountId);
    if(!account||account.archived)throw new Error('archived_account');
    return account;
  }
  const activeId=await activeMt5AccountId(db);
  if (!activeId) throw new Error('no_active_account');
  const account:any=await readMt5Account(db,activeId);
  if (!account||account.archived) throw new Error('no_active_account');
  return account;
}

export async function workerConfiguration(accountId?:unknown) {
  if (Deno.env.get('MT5_EXECUTION_ENABLED') !== 'true') throw new Error('mt5_not_configured');
  const account=await activeMt5Account(accountId);
  return {account_login:account.login,account_server:account.server,mode:account.mode,realtime:await workerRealtime(),
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

// Im Leerlauf schläft der Worker bis zu 1 h; wer eine frische Bridge braucht (MCP-Entry, Preview), weckt ihn und wartet kurz.
export async function freshBridge(account:any,maxAgeMs:number){
  const fresh=(b:any)=>{const at=Date.parse(b?.heartbeat_at);return Number.isFinite(at)&&Date.now()-at<=maxAgeMs&&at<=Date.now()+1000;};
  let bridge=await accountBridge(account);
  if(fresh(bridge))return bridge;
  checked(await mt5Database().rpc('mt5_touch_presence'));
  for(const deadline=Date.now()+8000;Date.now()<deadline;){
    await new Promise(r=>setTimeout(r,700));
    bridge=await accountBridge(account);
    if(fresh(bridge))return bridge;
  }
  return bridge;
}

export async function workerRealtime(){
  const wake:any=checked(await mt5Database().from('mt5_worker_wake').select('topic').eq('id',true).single());
  return {url:Deno.env.get('SUPABASE_URL')!.replace(/^https:/,'wss:')+'/realtime/v1/websocket',apikey:Deno.env.get('SUPABASE_ANON_KEY'),topic:wake.topic};
}
