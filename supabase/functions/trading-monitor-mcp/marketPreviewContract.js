import {riskPreviewMetrics,entrySearchMetrics} from './mt5RiskContract.js';
import { validateExecutionIntent } from './executionContract.js';

export function buildMarketPreview(input, snapshot, config, now, id) {
  if(!input||Object.keys(input).some(k=>!['symbol','direction','stop_loss','take_profit','risk_mode'].includes(k))) throw new Error('invalid_fields');
  const q=snapshot.quotes?.find(q=>q.symbol===input.symbol);
  if(!q||now-q.time>5||q.time>now+1) throw new Error('quote_stale');
  if((snapshot.positions.length&&!input.risk_mode)||snapshot.pending_orders) throw new Error('bridge_not_ready');
  const long=input.direction==='long';
  const price=long?q.ask:q.bid;
  const sl=Number(input.stop_loss), tp=input.take_profit == null ? null : Number(input.take_profit);
  if(!Number.isFinite(sl)||sl<=0||(long?sl>=q.bid-q.point:sl<=q.ask+q.point)
    ||(tp!==null&&(!Number.isFinite(tp)||tp<=0||(long?tp<=q.bid+q.point:tp>=q.ask-q.point)))) throw new Error('invalid_stop_or_target');
  const dynamic=input.risk_mode!=null;
  const metrics=riskPreviewMetrics(input,snapshot,config.riskPolicy,now);
  const {risk,volume}=metrics;
  const intent=validateExecutionIntent({id,account_login:config.login,account_server:config.server,mode:config.mode,
    symbol:q.symbol,direction:input.direction,stop_loss:sl,take_profit:tp,risk_amount:dynamic?metrics.budget.available:risk,
    ...(dynamic?{risk_mode:input.risk_mode,risk_policy_revision:config.riskPolicy.revision}:{}),
    trigger:dynamic?'m1_directional_close':'market_confirmed',reference_price:price,volume,created_sec:now,expires_sec:now+30},
    {...config,allowLive:true},now);
  return {intent,risk,budget:metrics.budget,currency:snapshot.currency,quote_time:q.time};
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
export async function verifyMarketPreview(token,secret,now,{allowExpired=false}={}) {
  if(typeof token!=='string'||token.length>4096) throw new Error('invalid_preview');
  const parts=token.split('.');
  if(parts.length!==2) throw new Error('invalid_preview');
  const data=decode(parts[0]);
  if(!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),data)) throw new Error('invalid_preview');
  const value=JSON.parse(new TextDecoder().decode(data));
  if(!value?.intent||(!allowExpired&&now>=(value.confirmation_expires_sec??value.intent.expires_sec))||value.intent.created_sec>now+1) throw new Error('preview_expired');
  return value;
}

export function buildEntrySearchPreview(input,snapshot,config,now,id) {
  const {duration_sec,...fields}=input??{};
  if(!Number.isInteger(duration_sec)||duration_sec<60||duration_sec>3600) throw new Error('invalid_search_duration');
  if(fields.risk_mode!=null){
    if(Object.keys(fields).some(k=>!['symbol','direction','stop_loss','take_profit','risk_mode'].includes(k)))throw new Error('invalid_fields');
    const {budget,metrics}=entrySearchMetrics(fields,snapshot,config.riskPolicy,now);
    const intent=validateExecutionIntent({id,account_login:config.login,account_server:config.server,mode:config.mode,
      symbol:fields.symbol,direction:fields.direction,stop_loss:Number(fields.stop_loss),take_profit:fields.take_profit==null?null:Number(fields.take_profit),
      risk_mode:fields.risk_mode,risk_policy_revision:config.riskPolicy.revision,risk_amount:budget.available,
      // Alte Worker verlangen dieses Feld; risk_mode ersetzt es vor jedem Fill durch natives Sizing.
      volume:metrics?.volume??.01,trigger:'m1_directional_close',trigger_price:null,created_sec:now,expires_sec:now+duration_sec},
      {...config,allowLive:true},now);
    return {intent,budget,risk:metrics?.risk??null,volume:metrics?.volume??null,reference_price:metrics?.reference_price??null,
      currency:snapshot.currency,quote_time:metrics?.quote_time??null,kind:'entry_search',confirmation_expires_sec:now+30};
  }
  const market=buildMarketPreview(fields,snapshot,config,now,id);
  const {reference_price,...intent}=market.intent;
  const volume=intent.volume;
  intent.trigger='m1_directional_close';
  intent.trigger_price=null;
  intent.expires_sec=now+duration_sec;
  validateExecutionIntent(intent,{...config,allowLive:true},now);
  return {...market,intent,volume,reference_price,kind:'entry_search',confirmation_expires_sec:now+30};
}
