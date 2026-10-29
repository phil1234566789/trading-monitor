import { isExecutionId, isSameExecutionResult, validateDispatchAccount, validateExecutionIntent, validateWorkerSnapshot } from './executionContract.js';
import { activeMt5Account, checked, mt5Database as database } from './mt5Credentials.ts';

export async function executionConfig() {
  if (Deno.env.get('MT5_EXECUTION_ENABLED') !== 'true') {
    throw new Error('mt5_not_configured');
  }
  const {login,server,mode} = await activeMt5Account();
  return { login:Number(login), server, mode, allowLive: Deno.env.get('MT5_ALLOW_LIVE') === 'true' };
}

function validId(id: string) {
  if (!isExecutionId(id)) throw new Error('invalid_id');
}

export async function getExecutionStatus(id?: string) {
  const db = database();
  if (id) {
    validId(id);
    return checked(await db.from('mt5_execution_orders').select('*').eq('id', id).maybeSingle());
  }
  const bridge = checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle());
  // Bewusst nur die letzten 20 Aufträge, kein vollständiger Archiv-Export.
  const orders = checked(await db.from('mt5_execution_orders').select('*').order('created_at', { ascending:false }).limit(20));
  const online = bridge && Date.now() - Date.parse(bridge.heartbeat_at) <= 15_000;
  return { bridge, online: !!online, orders, execution_enabled:Deno.env.get('MT5_EXECUTION_ENABLED')==='true',
    server_live_allowed:Deno.env.get('MT5_ALLOW_LIVE')==='true',
    limits: { maxLots:.01, maxRiskAccountCurrency:5, maxDurationSec:3600 } };
}

export async function createExecutionOrder(input: Record<string, unknown>, confirmedMarket=false) {
  const config = await executionConfig();
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
  const bridge = checked(await db.from('mt5_bridge_state').select('*').eq('id','primary').maybeSingle());
  if (!bridge || Date.now() - Date.parse(bridge.heartbeat_at) > 15_000) throw new Error('bridge_offline');
  validateWorkerSnapshot(bridge.snapshot, config);
  if (!bridge.snapshot.trade_allowed || bridge.snapshot.mode !== intent.mode) throw new Error('bridge_not_ready');
  const { data, error } = await db.rpc('mt5_enqueue_order',{new_intent:intent});
  if (error?.code === '23505') return createExecutionOrder(input,confirmedMarket);
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
  const config = await executionConfig();
  const db = database();
  const now = new Date().toISOString();
  if (body.action === 'poll') {
    const snapshot = validateWorkerSnapshot(body.snapshot, {...config,allowLive:true});
    checked(await db.from('mt5_bridge_state').upsert({ id:'primary', snapshot, heartbeat_at:now }));
    checked(await db.from('mt5_execution_orders').update({status:'expired',updated_at:now})
      .eq('status','searching').lte('expires_at',now));
    const orders = checked(await db.from('mt5_execution_orders').select('*')
      .in('status',['searching','sending','unknown']).order('created_at').limit(100));
    return { orders };
  }
  validId(body.id);
  if (body.action === 'begin') {
    const order=checked(await db.from('mt5_execution_orders').select('intent').eq('id',body.id).single());
    if(!order) throw new Error('invalid_order');
    validateDispatchAccount(order.intent,config);
    const rows = checked(await db.rpc('mt5_begin_send', { order_id:body.id }));
    return { authorized: rows.length === 1 };
  }
  if (body.action === 'reject_search') {
    if(typeof body.reason!=='string'||!body.reason||body.reason.length>100) throw new Error('invalid_reason');
    const result={status:'rejected',reason:body.reason};
    // Ein zweiter Worker ohne Versandrecht darf eine laufende/unklare Sendung niemals entsperren.
    const rows=checked(await db.from('mt5_execution_orders').update({status:'rejected',result,updated_at:now})
      .eq('id',body.id).eq('status','searching').select('id'));
    return {recorded:!!rows?.length};
  }
  if (body.action === 'result') {
    const result = body.result;
    if (!result || !['executed','rejected','unknown'].includes(result.status)
      || Object.keys(result).some(k => !['status','reason','retcode','order','deal','volume','price','magic','partial'].includes(k))
      || (result.reason != null && (typeof result.reason !== 'string' || result.reason.length > 100))) throw new Error('invalid_result');
    for (const key of ['retcode','order','deal','volume','price','magic']) {
      if (result[key] != null && (typeof result[key] !== 'number' || !Number.isFinite(result[key]))) throw new Error('invalid_result');
    }
    if (result.status === 'executed' && (!(result.volume > 0) || result.volume > .01 || !(result.deal > 0))) {
      throw new Error('invalid_execution_result');
    }
    const rows = checked(await db.from('mt5_execution_orders').update({ status:result.status,result,updated_at:now })
      .eq('id',body.id).in('status',['sending','unknown']).select('id'));
    if(rows?.length===1) return {recorded:true};
    const existing=checked(await db.from('mt5_execution_orders').select('status,result').eq('id',body.id).maybeSingle());
    return { recorded:isSameExecutionResult(existing,result) };
  }
  throw new Error('unknown_action');
}
