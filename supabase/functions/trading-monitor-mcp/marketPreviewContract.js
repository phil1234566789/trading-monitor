import { validateExecutionIntent } from './executionContract.js';

export function buildMarketPreview(input, snapshot, config, now, id) {
  if(!input||Object.keys(input).some(k=>!['symbol','direction','stop_loss','take_profit'].includes(k))) throw new Error('invalid_fields');
  const q=snapshot.quotes?.find(q=>q.symbol===input.symbol);
  if(!q||now-q.time>5||q.time>now+1) throw new Error('quote_stale');
  if(snapshot.positions.length||snapshot.pending_orders) throw new Error('bridge_not_ready');
  const long=input.direction==='long';
  const price=long?q.ask:q.bid;
  const sl=Number(input.stop_loss), tp=Number(input.take_profit);
  if(!Number.isFinite(sl)||!Number.isFinite(tp)||tp<=0
    ||(long?(sl>=q.bid-q.point||tp<=q.bid+q.point):(sl<=q.ask+q.point||tp>=q.ask-q.point))) throw new Error('invalid_stop_or_target');
  const risk=Math.abs(price-sl)*(long?q.loss_per_unit_long:q.loss_per_unit_short);
  if(!Number.isFinite(risk)||risk<=0||risk>4) throw new Error('minimum_volume_exceeds_budget');
  const intent=validateExecutionIntent({id,account_login:config.login,account_server:config.server,mode:config.mode,
    symbol:q.symbol,direction:input.direction,stop_loss:sl,take_profit:tp,risk_amount:5,
    trigger:'market_confirmed',reference_price:price,volume:q.minimum_volume,created_sec:now,expires_sec:now+30},
    {...config,allowLive:true},now);
  return {intent,risk,currency:snapshot.currency,quote_time:q.time};
}

const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(secret) {
  if(!secret||secret.length<32) throw new Error('preview_key_missing');
  return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function signMarketPreview(preview,secret) {
  const data=new TextEncoder().encode(JSON.stringify(preview));
  const signature=await crypto.subtle.sign('HMAC',await key(secret),data);
  return encode(data)+'.'+encode(new Uint8Array(signature));
}
export async function verifyMarketPreview(token,secret,now) {
  if(typeof token!=='string'||token.length>4096) throw new Error('invalid_preview');
  const parts=token.split('.');
  if(parts.length!==2) throw new Error('invalid_preview');
  const data=decode(parts[0]);
  if(!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),data)) throw new Error('invalid_preview');
  const value=JSON.parse(new TextDecoder().decode(data));
  if(!value?.intent||now>=value.intent.expires_sec||value.intent.created_sec>now+1) throw new Error('preview_expired');
  return value;
}
