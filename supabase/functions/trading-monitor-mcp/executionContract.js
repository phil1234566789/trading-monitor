const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isExecutionId = (value) => typeof value === 'string' && UUID.test(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;

function fields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) throw new Error('invalid_fields');
}

function account(value, config) {
  if (!Number.isSafeInteger(value.account_login) || value.account_login !== config.login
    || value.account_server !== config.server) throw new Error('account_mismatch');
  if (!['demo', 'live'].includes(value.mode) || (value.mode === 'live' && !config.allowLive)) {
    throw new Error('live_not_enabled');
  }
  if (config.mode && value.mode !== config.mode) throw new Error('account_mode_mismatch');
}

export function validateDispatchAccount(intent, config) { account(intent,config); }

export function isSameExecutionResult(order, result) {
  const stored=order?.result;
  const {position_lifecycle,...saved}=stored??{};
  return !!stored && order.status===result.status && Object.keys(saved).length===Object.keys(result).length
    && Object.keys(saved).every(key=>saved[key]===result[key]);
}

export function validateExecutionIntent(value, config, now) {
  fields(value, ['id','account_login','account_server','mode','symbol','direction','stop_loss',
    'take_profit','risk_amount','trigger','trigger_price','created_sec','expires_sec','reference_price','volume','risk_mode','risk_policy_revision']);
  account(value, config);
  if (!isExecutionId(value.id) || typeof value.symbol !== 'string'
    || !/^[A-Za-z0-9._-]{1,64}$/.test(value.symbol)
    || !['long', 'short'].includes(value.direction)) throw new Error('invalid_order');
  if (!positive(value.stop_loss) || !positive(value.risk_amount)
    || (value.take_profit != null && !positive(value.take_profit))) throw new Error('invalid_risk');
  if (!Number.isSafeInteger(value.created_sec) || value.created_sec > now + 2 || now - value.created_sec > 10
    || !Number.isSafeInteger(value.expires_sec) || value.expires_sec <= now
    || value.expires_sec - value.created_sec > 3600) throw new Error('invalid_expiry');
  if (!['m1_directional_close','market_confirmed','m1_close_above','m1_close_below','test_next_m1_close'].includes(value.trigger)) {
    throw new Error('invalid_trigger');
  }
  const dynamic=value.risk_mode!=null;
  if(dynamic && (!['risky','full'].includes(value.risk_mode)||value.trigger!=='m1_directional_close'
    ||!isExecutionId(value.risk_policy_revision)||!config.riskPolicy||value.risk_policy_revision!==config.riskPolicy.revision
    ||config.riskPolicy.valid_until_sec<=now))throw new Error('risk_limits_unconfirmed');
  if(value.trigger==='m1_directional_close'&&(!positive(value.volume)||(!dynamic&&value.volume>.01))) throw new Error('invalid_search_volume');
  if(value.trigger==='market_confirmed') {
    if(!positive(value.reference_price)||!positive(value.volume)||value.volume>.01
      ||value.expires_sec-value.created_sec>30) throw new Error('invalid_market_preview');
  } else if (value.trigger === 'test_next_m1_close') {
    if (value.mode !== 'demo') throw new Error('test_trigger_demo_only');
  } else if (value.trigger!=='m1_directional_close'&&!positive(value.trigger_price)) throw new Error('invalid_trigger_price');
  return value;
}

export function validateWorkerSnapshot(value, config) {
  fields(value, ['account_login','account_server','mode','balance','equity','currency',
    'trade_allowed','positions','pending_orders','quotes','execution_ready','worker_error','hedging','risk','risk_error','risk_guards_ready','target_plans_ready']);
  account(value, config);
  if (!finite(value.balance) || !finite(value.equity) || typeof value.currency !== 'string'
    || !/^[A-Z]{3,8}$/.test(value.currency) || typeof value.trade_allowed !== 'boolean'
    || !Array.isArray(value.positions) || value.positions.length > 100
    || !Number.isSafeInteger(value.pending_orders) || value.pending_orders < 0) throw new Error('invalid_snapshot');
  for(const key of ['hedging','risk_guards_ready','target_plans_ready'])if(value[key]!=null&&typeof value[key]!=='boolean')throw new Error('invalid_snapshot');
  if(value.risk_error!=null&&value.risk_error!=='risk_history_unavailable')throw new Error('invalid_risk_snapshot');
  if(value.risk!=null){
    const r=value.risk;fields(r,['time','day','realized_net_day','open_loss','latched']);
    if(!Number.isSafeInteger(r.time)||r.time<=0||typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)
      ||![r.realized_net_day,r.open_loss].every(finite)||r.open_loss>0||typeof r.latched!=='boolean')throw new Error('invalid_risk_snapshot');
  }
  if(value.worker_error!=null)validateWorkerFault(value.worker_error);
  if(value.execution_ready!=null&&typeof value.execution_ready!=='boolean') throw new Error('invalid_snapshot');
  if(value.quotes!=null) {
    if(!Array.isArray(value.quotes)||value.quotes.length>10) throw new Error('invalid_quotes');
    for(const q of value.quotes) {
      fields(q,['symbol','bid','ask','time','point','digits','minimum_volume','loss_per_unit_long','loss_per_unit_short','volume_step','maximum_volume','stops_level']);
      if((q.volume_step!=null&&!positive(q.volume_step))||(q.maximum_volume!=null&&!positive(q.maximum_volume))
        ||(q.stops_level!=null&&(!finite(q.stops_level)||q.stops_level<0)))throw new Error('invalid_quotes');
      if(typeof q.symbol!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(q.symbol)
        ||![q.bid,q.ask,q.time,q.point,q.minimum_volume,q.loss_per_unit_long,q.loss_per_unit_short].every(positive)
        ||q.ask<q.bid||!Number.isInteger(q.digits)||q.digits<0||q.digits>10) throw new Error('invalid_quotes');
    }
  }
  for (const p of value.positions) {
    fields(p,['ticket','symbol','volume','type','sl','tp','profit','magic','price_open','price_current','risk_to_sl','remaining_risk_to_sl','opened_at_sec']);
    for(const key of ['risk_to_sl','remaining_risk_to_sl'])if(p[key]!=null&&(!finite(p[key])||p[key]<0))throw new Error('invalid_position_risk');
    if(p.opened_at_sec!=null&&(!Number.isSafeInteger(p.opened_at_sec)||p.opened_at_sec<=0))throw new Error('invalid_position_time');
    for(const key of ['price_open','price_current'])if(p[key]!=null&&!positive(p[key]))throw new Error('invalid_position_price');
    if (!Number.isSafeInteger(p.ticket) || p.ticket <= 0 || !positive(p.volume)
      || typeof p.symbol !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(p.symbol)
      || ![0,1].includes(p.type) || ![p.sl,p.tp,p.profit,p.magic].every(finite)) throw new Error('invalid_position');
  }
  return value;
}

export function validateExecutionResult(result,intent) {
  fields(result,['status','reason','retcode','order','deal','position','volume','price','magic','partial','confirmation_source']);
  if(!['executed','rejected','unknown'].includes(result.status)
    ||result.reason!=null&&(typeof result.reason!=='string'||result.reason.length>100))throw new Error('invalid_result');
  for(const key of ['retcode','order','deal','position','volume','price','magic'])
    if(result[key]!=null&&!finite(result[key]))throw new Error('invalid_result');
  if(result.partial!=null&&typeof result.partial!=='boolean')throw new Error('invalid_result');
  if(result.confirmation_source!=null&&!['deal_history','position_snapshot','broker_reply'].includes(result.confirmation_source))throw new Error('invalid_result');
  const confirmed=positive(result.deal)||(positive(result.position)&&result.position===result.order
    &&positive(result.magic)&&result.confirmation_source==='position_snapshot');
  if(result.status==='executed'&&(!positive(result.volume)||(result.volume>.01&&!['risky','full'].includes(intent?.risk_mode))||!positive(result.price)||!confirmed))
    throw new Error('invalid_execution_result');
  return result;
}

export function validateWorkerFault(value) {
 fields(value,['code','stage','line','since_sec']);
 if(typeof value.code!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(value.code)
  ||typeof value.stage!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(value.stage)
  ||!Number.isSafeInteger(value.line)||value.line<1||value.line>1000000
  ||!Number.isSafeInteger(value.since_sec)||value.since_sec<=0)throw new Error('invalid_worker_fault');
 return value;
}

export function validatePositionLifecycle(value,intent) {
 fields(value,['state','position','remaining_volume','source','close_reason','exit_price','closed_volume','closed_at_sec','gross_profit','net_profit','currency']);
 if(!['open','closed','unverified'].includes(value.state)||!Number.isSafeInteger(value.position)||value.position<=0)throw new Error('invalid_lifecycle');
 if(value.state!=='closed'&&Object.keys(value).some(k=>!['state','position','remaining_volume'].includes(k)))throw new Error('invalid_lifecycle');
 if(value.state==='closed'&&value.remaining_volume!=null)throw new Error('invalid_lifecycle');
 if(value.state==='open'&&!positive(value.remaining_volume))throw new Error('invalid_lifecycle');
 if(value.state==='closed'&&(!positive(value.exit_price)||!positive(value.closed_volume)||(value.closed_volume>.01&&!['risky','full'].includes(intent?.risk_mode))
   ||!Number.isSafeInteger(value.closed_at_sec)||value.closed_at_sec<=0||![value.gross_profit,value.net_profit].every(finite)
   ||value.source!=='deal_history'||!['tp','sl','mixed','other'].includes(value.close_reason)
   ||typeof value.currency!=='string'||!/^[A-Z]{3,8}$/.test(value.currency)))throw new Error('invalid_lifecycle');
 return value;
}
