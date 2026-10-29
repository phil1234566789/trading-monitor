import {checked,mt5Database} from './mt5Credentials.ts';
import {assessMt5Health,healthMessage} from './mt5HealthContract.js';
import {sendPushover,sendTelegramText} from '../_shared/setup2Notifications.js';
import {env} from '../_shared/setup2Http.ts';

export async function getMt5Health() {
 const db=mt5Database();
 const settings=checked(await db.from('mt5_execution_settings').select('health_checked_at').eq('id','primary').single());
 const incident=checked(await db.from('mt5_health_incidents').select('*').is('resolved_at',null).maybeSingle());
 const deliveries=incident?checked(await db.from('mt5_health_deliveries').select('channel,status,error,accepted_at').eq('incident_id',incident.id).limit(2)):[];
 return {checked_at:settings?.health_checked_at,incident,deliveries};
}

export async function deliverMt5Health() {
 const db=mt5Database();
 const rows=checked(await db.rpc('mt5_claim_health_notifications',{p_limit:4}));
 return Promise.all((rows??[]).map(async(row:any)=>{
  const incident=checked(await db.from('mt5_health_incidents').select('*').eq('id',row.incident_id).single());
  let status='accepted',error=null;
  try {
   const message=healthMessage(incident);
   if(row.channel==='pushover')await sendPushover(message,'MMT - Ausfuehrungsfehler',env);
   else await sendTelegramText(message,env);
  } catch(e) {
   const definite=e instanceof Error&&/rejected|secrets missing/.test(e.message);
   status=definite?'failed':'uncertain';error=definite?'provider_rejected':'provider_acceptance_unknown';
  }
  checked(await db.from('mt5_health_deliveries').update({status,error,accepted_at:status==='accepted'?new Date().toISOString():null}).eq('id',row.id).eq('status','claimed'));
  return {channel:row.channel,status};
 }));
}

export async function checkMt5Health() {
 const db=mt5Database();
 const [settings,bridge,unknown,sending,searching]=await Promise.all([
  db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single(),
  db.from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle(),
  db.from('mt5_execution_orders').select('id,status,updated_at').eq('status','unknown').limit(1),
  db.from('mt5_execution_orders').select('id,status,updated_at').eq('status','sending').order('updated_at').limit(1),
  db.from('mt5_execution_orders').select('id,status,updated_at').eq('status','searching').limit(1),
 ]);
 const accountId=checked(settings)?.active_account_id;
 const selected=accountId?checked(await db.from('mt5_accounts').select('id,login,server').eq('id',accountId).single()):null;
 const issue=env('MT5_EXECUTION_ENABLED')==='true'?assessMt5Health({selected,bridge:checked(bridge),orders:[...(checked(unknown)??[]),...(checked(sending)??[]),...(checked(searching)??[])]}):null;
 checked(await db.rpc('mt5_record_health',{p_key:issue?.key??null,p_code:issue?.code??null,p_detail:issue?.detail??{}}));
 const deliveries=await deliverMt5Health();
 checked(await db.from('mt5_execution_settings').update({health_checked_at:new Date().toISOString()}).eq('id','primary'));
 return {healthy:!issue,deliveries};
}

export async function sendMt5HealthTest() {
 const message='MMT - Test der Fehleralarmierung. Keine Stoerung, keine Order. Pushover/Telegram-Versandweg wird geprueft.';
 const attempts=await Promise.allSettled([sendPushover(message,'MMT - Alarmtest',env),sendTelegramText(message,env)]);
 return {deliveries:attempts.map((r,index)=>({channel:index===0?'pushover':'telegram',status:r.status==='fulfilled'?'accepted':'failed'}))};
}

declare const EdgeRuntime:{waitUntil(task:Promise<unknown>):void};
export async function scheduleMt5Health() {
 const task=checkMt5Health().catch(()=>{console.error('mt5_health_check_failed');});
 if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(task);else await task;
}
