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
  const saved=order?.result;
  return !!saved && order.status===result.status && Object.keys(saved).length===Object.keys(result).length
    && Object.keys(saved).every(key=>saved[key]===result[key]);
}

export function validateExecutionIntent(value, config, now) {
  fields(value, ['id','account_login','account_server','mode','symbol','direction','stop_loss',
    'take_profit','risk_amount','trigger','trigger_price','created_sec','expires_sec','reference_price','volume']);
  account(value, config);
  if (!isExecutionId(value.id) || typeof value.symbol !== 'string'
    || !/^[A-Za-z0-9._-]{1,64}$/.test(value.symbol)
    || !['long', 'short'].includes(value.direction)) throw new Error('invalid_order');
  if (!positive(value.stop_loss) || !positive(value.risk_amount) || value.risk_amount > 5
    || (value.take_profit != null && !positive(value.take_profit))) throw new Error('invalid_risk');
  if (!Number.isSafeInteger(value.created_sec) || value.created_sec > now + 2 || now - value.created_sec > 10
    || !Number.isSafeInteger(value.expires_sec) || value.expires_sec <= now
    || value.expires_sec - value.created_sec > 3600) throw new Error('invalid_expiry');
  if (!['market_confirmed','m1_close_above','m1_close_below','test_next_m1_close'].includes(value.trigger)) {
    throw new Error('invalid_trigger');
  }
  if(value.trigger==='market_confirmed') {
    if(!positive(value.reference_price)||!positive(value.volume)||value.volume>.01
      ||value.expires_sec-value.created_sec>30) throw new Error('invalid_market_preview');
  } else if (value.trigger === 'test_next_m1_close') {
    if (value.mode !== 'demo') throw new Error('test_trigger_demo_only');
  } else if (!positive(value.trigger_price)) throw new Error('invalid_trigger_price');
  return value;
}

export function validateWorkerSnapshot(value, config) {
  fields(value, ['account_login','account_server','mode','balance','equity','currency',
    'trade_allowed','positions','pending_orders','quotes','execution_ready']);
  account(value, config);
  if (!finite(value.balance) || !finite(value.equity) || typeof value.currency !== 'string'
    || !/^[A-Z]{3,8}$/.test(value.currency) || typeof value.trade_allowed !== 'boolean'
    || !Array.isArray(value.positions) || value.positions.length > 100
    || !Number.isSafeInteger(value.pending_orders) || value.pending_orders < 0) throw new Error('invalid_snapshot');
  if(value.execution_ready!=null&&typeof value.execution_ready!=='boolean') throw new Error('invalid_snapshot');
  if(value.quotes!=null) {
    if(!Array.isArray(value.quotes)||value.quotes.length>10) throw new Error('invalid_quotes');
    for(const q of value.quotes) {
      fields(q,['symbol','bid','ask','time','point','digits','minimum_volume','loss_per_unit_long','loss_per_unit_short']);
      if(typeof q.symbol!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(q.symbol)
        ||![q.bid,q.ask,q.time,q.point,q.minimum_volume,q.loss_per_unit_long,q.loss_per_unit_short].every(positive)
        ||q.ask<q.bid||!Number.isInteger(q.digits)||q.digits<0||q.digits>10) throw new Error('invalid_quotes');
    }
  }
  for (const p of value.positions) {
    fields(p,['ticket','symbol','volume','type','sl','tp','profit','magic']);
    if (!Number.isSafeInteger(p.ticket) || p.ticket <= 0 || !positive(p.volume)
      || typeof p.symbol !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(p.symbol)
      || ![0,1].includes(p.type) || ![p.sl,p.tp,p.profit,p.magic].every(finite)) throw new Error('invalid_position');
  }
  return value;
}
