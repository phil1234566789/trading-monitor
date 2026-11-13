import {readExecutionOrders} from './mt5OrderRead.js';
import {riskPreviewMetrics,entrySearchMetrics} from './mt5RiskContract.js';
import {readRiskPolicy} from './mt5Risk.ts';
import {readAccountDailyStopStatus} from './mt5DailyStop.ts';
import {assertDailyStopSnapshot} from './dailyStopContract.js';
import {scheduleMt5Health,getMt5Health} from './mt5Health.ts';

import { isExecutionId, isSameExecutionResult, validateExecutionResult, validatePositionLifecycle, validateWorkerFault, validateDispatchAccount, validateExecutionIntent, validateWorkerSnapshot } from './executionContract.js';
import { accountBridge, activeMt5Account, checked, mt5Database as database } from './mt5Credentials.ts';

export async function executionConfig(accountId?:unknown) {
  if (Deno.env.get('MT5_EXECUTION_ENABLED') !== 'true') {
    throw new Error('mt5_not_configured');
  }
  const account=await activeMt5Account(accountId),{login,server,mode}=account;
  return { accountId:account.id,historyRequest:account.history_requested_at??null,riskPolicy:await readRiskPolicy(account.id),login:Number(login), server, mode, allowLive: Deno.env.get('MT5_ALLOW_LIVE') === 'true' };
}

function validId(id: string) {
  if (!isExecutionId(id)) throw new Error('invalid_id');
}

export async function getExecutionStatus(id?: string,accountId?:unknown) {
  const db = database();
  if (id) {
    validId(id);
    return checked(await db.from('mt5_execution_orders').select('*').eq('id', id).maybeSingle());
  }
  let account;
  try{account=await activeMt5Account(accountId);}catch(e){if(accountId!=null||!(e instanceof Error)||e.message!=='no_active_account')throw e;}
  const bridge = account?await accountBridge(account):null;
  // Erledigte Historie bleibt begrenzt; laufende Suchen dürfen durch neue Aufträge nie verschwinden.
  const orders=await readExecutionOrders(db);
  const dailyStatus=account?await readAccountDailyStopStatus(account,bridge):null;
  const {policy:risk_policy,...dailyStop}=dailyStatus??{policy:null};
  const online = bridge && Date.now() - Date.parse(bridge.heartbeat_at) <= 15_000;
  return { daily_stop:dailyStatus?dailyStop:null,risk_policy,bridge, online: !!online, health:await getMt5Health(), orders, execution_enabled:Deno.env.get('MT5_EXECUTION_ENABLED')==='true',
    server_live_allowed:Deno.env.get('MT5_ALLOW_LIVE')==='true',
    limits: { maxLots:.01, maxDurationSec:3600 } };
}

export async function getAccountExecutionStatus(accountId:unknown){
  // Zusatzkonten brauchen ihren Broker-/Schutzstand, nicht erneut globale Orders, Health und Balances.
  if(accountId==null)throw new Error('invalid_account');
  const account=await activeMt5Account(accountId),bridge=await accountBridge(account);
  if(bridge)validateDispatchAccount(bridge.snapshot,{login:Number(account.login),server:account.server,mode:account.mode,allowLive:true});
  const dailyStatus=await readAccountDailyStopStatus(account,bridge);
  const {policy:risk_policy,...daily_stop}=dailyStatus;
  return {daily_stop,risk_policy,bridge,online:!!bridge&&Date.now()-Date.parse(bridge.heartbeat_at)<=15000,
    execution_enabled:Deno.env.get('MT5_EXECUTION_ENABLED')==='true',server_live_allowed:Deno.env.get('MT5_ALLOW_LIVE')==='true'};
}

export async function createExecutionOrder(input: Record<string, unknown>, confirmedMarket=false,accountId?:unknown) {
  const config = await executionConfig(accountId);
  if(input.trigger==='market_confirmed'&&!confirmedMarket) throw new Error('market_confirmation_required');
  const db = database();
  validId(input.id as string);
  const existing = checked(await db.from('mt5_execution_orders').select('*').eq('id', input.id).maybeSingle());
  if (existing) {
    const keys = Object.keys(existing.intent).filter(k => k !== 'created_sec');
    if (keys.some(k => existing.intent[k] !== input[k]) || Object.keys(input).some(k => !keys.includes(k))) {
      throw new Error('idempotency_key_reused');
    }
    return existing;
  }
  const now = Math.floor(Date.now()/1000);
  const intent = validateExecutionIntent({ ...input, created_sec:now }, config, now);
  const bridge = await accountBridge(await activeMt5Account(accountId));
  if (!bridge || Date.now() - Date.parse(bridge.heartbeat_at) > 15_000) throw new Error('bridge_offline');
  validateWorkerSnapshot(bridge.snapshot, config);
  assertDailyStopSnapshot(bridge.snapshot,now);
  const check=intent.trigger==='m1_directional_close'&&intent.risk_mode?entrySearchMetrics:riskPreviewMetrics;
  check({symbol:intent.symbol,direction:intent.direction,stop_loss:intent.stop_loss,take_profit:intent.take_profit,risk_mode:intent.risk_mode},bridge.snapshot,config.riskPolicy,now);
  if (bridge.snapshot.worker_error||bridge.snapshot.execution_ready===false||!bridge.snapshot.trade_allowed || bridge.snapshot.mode !== intent.mode) throw new Error('bridge_not_ready');
  const { data, error } = await db.rpc('mt5_enqueue_order',{new_intent:intent});
  if (error?.code === '23505') return createExecutionOrder(input,confirmedMarket,accountId);
  return checked({ data, error });
}

export async function cancelExecutionOrder(id: string) {
  validId(id);
  const db = database();
  checked(await db.from('mt5_execution_orders').update({ status:'cancelled', updated_at:new Date().toISOString() })
    .eq('id',id).eq('status','searching'));
  return checked(await db.from('mt5_execution_orders').select('*').eq('id',id).maybeSingle());
}

export async function workerAction(body: Record<string, any>) {
  const config = await executionConfig(body.account_id);
  const db = database();
  const now = new Date().toISOString();
  if(body.action==='fault') {
    if(body.account_login!==config.login||body.account_server!==config.server)throw new Error('account_mismatch');
    const fault=validateWorkerFault(body.fault);
    const bridge=await accountBridge(await activeMt5Account(body.account_id));
    if(bridge)checked(await db.from('mt5_bridge_state').update({snapshot:{...bridge.snapshot,worker_error:fault,execution_ready:false},heartbeat_at:now}).eq('id',bridge.id));
    await scheduleMt5Health();
    return {recorded:true};
  }
  if (body.action === 'poll') {
    const snapshot = validateWorkerSnapshot(body.snapshot, {...config,allowLive:true});
    checked(await db.from('mt5_bridge_state').upsert({ id:config.accountId, snapshot, heartbeat_at:now }));
    const settings=checked(await db.from('mt5_execution_settings').select('active_account_id').eq('id','primary').single());
    if(settings?.active_account_id===config.accountId)checked(await db.from('mt5_bridge_state').upsert({id:'primary',snapshot,heartbeat_at:now}));
    checked(await db.from('mt5_execution_orders').update({status:'expired',updated_at:now})
      .eq('status','searching').lte('expires_at',now));
    const orders = checked(await db.from('mt5_execution_orders').select('*')
      .in('status',['searching','sending','unknown']).eq('intent->>account_login',String(config.login)).eq('intent->>account_server',config.server).order('created_at').limit(100));
    if(body.watch_cursor!=null)validId(body.watch_cursor);
    let query=db.from('mt5_execution_orders').select('*').eq('status','executed')
      .eq('intent->>account_login',String(config.login)).eq('intent->>account_server',config.server)
      .is('result->position_lifecycle->closed_at_sec',null).order('id').limit(20);
    if(body.watch_cursor)query=query.gt('id',body.watch_cursor);
    const watched=checked(await query)??[];
    return {orders,watch_orders:watched,watch_cursor:watched.length?watched[watched.length-1].id:null,history_request:config.historyRequest};
  }
  validId(body.id);
  if(body.action==='position_update') {
    const row=checked(await db.from('mt5_execution_orders').select('*').eq('id',body.id).single());
    if(!row||row.status!=='executed')throw new Error('invalid_position_order');
    validateDispatchAccount(row.intent,{...config,allowLive:true});
    const lifecycle=validatePositionLifecycle(body.lifecycle,row.intent);
    if(lifecycle.position!==(row.result?.position??row.result?.order))throw new Error('account_mismatch');
    if(lifecycle.state==='closed'&&Math.abs(lifecycle.closed_volume-row.result.volume)>1e-8)throw new Error('invalid_lifecycle');
    if(row.result?.position_lifecycle?.state==='closed')return {recorded:true};
    const rows=checked(await db.from('mt5_execution_orders').update({result:{...row.result,position_lifecycle:lifecycle},updated_at:now})
      .eq('id',body.id).eq('status','executed').eq('updated_at',row.updated_at).select('id'));
    return {recorded:!!rows?.length};
  }
  if (body.action === 'begin') {
    const order=checked(await db.from('mt5_execution_orders').select('intent').eq('id',body.id).single());
    if(!order) throw new Error('invalid_order');
    validateDispatchAccount(order.intent,config);
    const rows = checked(await db.rpc('mt5_begin_send', { order_id:body.id }));
    return { authorized: rows.length === 1 };
  }
  if (body.action === 'reject_search') {
    if(typeof body.reason!=='string'||!body.reason||body.reason.length>100) throw new Error('invalid_reason');
    const candidate=checked(await db.from('mt5_execution_orders').select('intent').eq('id',body.id).single());
    if(!candidate)throw new Error('invalid_order');
    validateDispatchAccount(candidate.intent,{...config,allowLive:true});
    const result={status:'rejected',reason:body.reason};
    // Ein zweiter Worker ohne Versandrecht darf eine laufende/unklare Sendung niemals entsperren.
    const rows=checked(await db.from('mt5_execution_orders').update({status:'rejected',result,updated_at:now})
      .eq('id',body.id).eq('status','searching').select('id'));
    return {recorded:!!rows?.length};
  }
  if (body.action === 'result') {
    const row=checked(await db.from('mt5_execution_orders').select('intent').eq('id',body.id).single());
    if(!row)throw new Error('invalid_order');
    validateDispatchAccount(row.intent,{...config,allowLive:true});
    const result=validateExecutionResult(body.result,row?.intent);
    const rows = checked(await db.from('mt5_execution_orders').update({ status:result.status,result,updated_at:now })
      .eq('id',body.id).in('status',['sending','unknown']).select('id'));
    if(rows?.length===1) {
      if(result.status==='unknown')await scheduleMt5Health();
      return {recorded:true};
    }
    const existing=checked(await db.from('mt5_execution_orders').select('status,result').eq('id',body.id).maybeSingle());
    return { recorded:isSameExecutionResult(existing,result) };
  }
  throw new Error('unknown_action');
}
