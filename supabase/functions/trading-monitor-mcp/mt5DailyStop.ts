import {activeMt5Account,checked,mt5Database} from './mt5Credentials.ts';
import {readRiskPolicy} from './mt5Risk.ts';
import {tradingDay,evaluateDailyStop,validateGuardExposure,guardCommandsForExposure} from './dailyStopContract.js';
import {validateWorkerSnapshot,isExecutionId} from './executionContract.js';
async function readGuardCommands(db:any,accountId:string,day?:string){
 const rows=[];let after='00000000-0000-0000-0000-000000000000';
 while(true){
  let query=db.from('mt5_guard_commands').select('*').eq('account_id',accountId).gt('id',after).order('id').limit(500);
  query=day?query.eq('day',day):query.in('status',['pending','sending','unknown']);
  const page:any[]=checked(await query)??[];
  if(!page.length)return rows;
  rows.push(...page);after=page[page.length-1].id;
 }
}
async function stopContext(account:any,db:any,now:number){
 const window=tradingDay(now);
 const stop=checked<{reason:string}>(await db.from('mt5_daily_stops').select('*').eq('account_id',account.id).eq('day',window.day).maybeSingle());
 const unresolved=checked<{id:string}[]>(await db.from('mt5_guard_commands').select('id').eq('account_id',account.id).in('status',['pending','sending','unknown']).limit(1))??[];
 return {...window,checked_at_sec:now,latched:!!stop||unresolved.length>0,day_latched:!!stop,daily_loss_limit:1000,daily_stop_ready:true,stop,
  policy:await readRiskPolicy(account.id)};
}
export async function dailyStopAction(body:Record<string,any>){
 const db=mt5Database(),account=await activeMt5Account(),now=Math.floor(Date.now()/1000);
 if(body.account_login!==Number(account.login)||body.account_server!==account.server)throw new Error('account_mismatch');
 const context=await stopContext(account,db,now);
 if(body.action==='risk_context')return context;
 if(body.action==='guard_sync'){
  const snapshot=validateWorkerSnapshot(body.snapshot,{login:Number(account.login),server:account.server,mode:account.mode,allowLive:true});
  let reason=null;
  try{reason=evaluateDailyStop(snapshot,context,context.policy,now);}catch(error){
   // Ein bereits bestätigter Tagesstopp bleibt auch bei ausfallender Historie ausführbar.
   if(!context.latched)throw error;
  }
  if(reason)checked(await db.rpc('mt5_latch_daily_stop',{p_account:account.id,p_day:context.day,p_reason:reason,p_snapshot:snapshot}));
  const current=reason?await stopContext(account,db,now):context;
  // Ein manueller Close zwischen Snapshot und Exposition darf den bereits gesehenen Verlust-Latch nicht verhindern.
  const exposure=validateGuardExposure(body.exposure);
  if(exposure.positions.length!==snapshot.positions.length||exposure.positions.some((p:any)=>!snapshot.positions.some((s:any)=>s.ticket===p.ticket&&s.symbol===p.symbol&&s.volume===p.volume&&s.type===p.type&&s.magic===p.magic)))throw new Error('invalid_guard_exposure');
  if(current.day_latched){
   const previous=await readGuardCommands(db,account.id,current.day);
   const commands=guardCommandsForExposure(exposure,previous,now).map(c=>({...c,account_id:account.id,day:current.day,
    checkpoint:{...c.checkpoint,account_login:Number(account.login),account_server:account.server,mode:account.mode}}));
   if(commands.length)checked(await db.from('mt5_guard_commands').upsert(commands,{onConflict:'account_id,day,kind,ticket,expected_volume,attempt',ignoreDuplicates:true}));
  }
  const commands=await readGuardCommands(db,account.id);
  return {latched:current.latched,day:current.day,commands};
 }
 if(!isExecutionId(body.id))throw new Error('invalid_id');
 const row:any=checked(await db.from('mt5_guard_commands').select('*').eq('id',body.id).eq('account_id',account.id).single());
 if(body.action==='guard_claim'){
  const rows:any[]=checked(await db.rpc('mt5_claim_guard',{p_id:row.id}))??[];
  return {authorized:rows.length===1};
 }
 if(body.action==='guard_result'){
  const result=body.result;
  if(!result||!['executed','rejected','unknown'].includes(result.status)||typeof result.reason!=='string'||result.reason.length>100
   ||Object.keys(result).some(k=>!['status','reason','retcode','deal','order','volume'].includes(k)))throw new Error('invalid_guard_result');
  for(const k of ['retcode','deal','order','volume'])if(result[k]!=null&&(typeof result[k]!=='number'||!Number.isFinite(result[k])||result[k]<0))throw new Error('invalid_guard_result');
  if(row.status==='executed')return {recorded:true};
  if(!['sending','unknown'].includes(row.status))return {recorded:row.status===result.status};
  checked(await db.from('mt5_guard_commands').update({status:result.status,result,updated_at:new Date().toISOString()})
   .eq('id',row.id).in('status',['sending','unknown']));
  return {recorded:true};
 }
 throw new Error('unknown_action');
}

export async function readDailyStopStatus(accountId?:string){
 const db=mt5Database();let account;
 try{account=await activeMt5Account();}catch(error){if(error instanceof Error&&error.message==='no_active_account')return null;throw error;}
 if(accountId&&accountId!==account.id)throw new Error('account_mismatch');
 const context=await stopContext(account,db,Math.floor(Date.now()/1000));
 const recent=checked(await db.from('mt5_guard_commands').select('*').eq('account_id',account.id).order('created_at',{ascending:false}).limit(20))??[];
 const commands=await readGuardCommands(db,account.id);
 const bridge:any=checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle());
 const s=bridge?.snapshot,now=Math.floor(Date.now()/1000);
 const ready=!!bridge&&Date.now()-Date.parse(bridge.heartbeat_at)<=5000&&s.account_login===Number(account.login)&&s.account_server===account.server
  &&s.risk_guards_ready===true&&s.hedging===true&&!s.worker_error&&!s.risk_error&&s.risk?.day===context.day
  &&typeof s.risk?.time==='number'&&now-s.risk.time<=5&&s.risk.time<=now+1;
 return {...context,daily_stop_ready:ready,reason:context.stop?.reason??null,commands:[...new Map([...recent,...commands].map(c=>[c.id,c])).values()]};
}
