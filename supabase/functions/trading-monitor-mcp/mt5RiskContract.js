const finite=n=>typeof n==='number'&&Number.isFinite(n);
const nonnegative=n=>finite(n)&&n>=0;
const positive=n=>finite(n)&&n>0;
export const RISK_BASE=50000;
export const RISK_MODES={risky:.005,full:.009};
export const riskMarket=symbol=>symbol.split('.')[0].toUpperCase();
export function riskBudget(mode,symbol,snapshot,policy,now) {
 if(!Object.hasOwn(RISK_MODES,mode))throw new Error('invalid_risk_mode');
 if(!policy||!positive(policy.confirmed_balance)||!positive(policy.confirmed_equity)||!positive(policy.cost_buffer)||policy.risk_base!==RISK_BASE||!positive(policy.drawdown_floor)||!positive(policy.valid_until_sec)
  ||policy.valid_until_sec<=now||policy.currency!=='USD'||policy.currency!==snapshot.currency)throw new Error('risk_limits_unconfirmed');
 if(snapshot.balance>policy.confirmed_balance+1e-7||snapshot.equity>policy.confirmed_equity+1e-7)throw new Error('risk_floor_reconfirmation_required');
 const r=snapshot.risk;
 if(snapshot.risk_guards_ready!==true||!r||!positive(r.time)||now-r.time>5||r.time>now+1
  ||r.day!==policy.day||r.latched!==false||!finite(r.realized_net_day)||!finite(r.open_loss)||r.open_loss>0)throw new Error('risk_guard_unavailable');
 if(snapshot.pending_orders||!positive(snapshot.equity)||!positive(snapshot.balance)
  ||(snapshot.positions.length&&snapshot.hedging!==true))throw new Error('risk_exposure_unavailable');
 let marketUsed=0,remaining=0;
 for(const p of snapshot.positions){
  if(!nonnegative(p.risk_to_sl)||!nonnegative(p.remaining_risk_to_sl))throw new Error('risk_exposure_unavailable');
  remaining+=p.remaining_risk_to_sl+policy.cost_buffer;
  if(riskMarket(p.symbol)===riskMarket(symbol))marketUsed+=p.risk_to_sl+policy.cost_buffer;
 }
 const requested=RISK_BASE*RISK_MODES[mode],marketLeft=Math.max(0,RISK_BASE*.009-marketUsed);
 const dailyLeft=Math.max(0,1000+r.realized_net_day+r.open_loss-remaining);
 const drawdownLeft=Math.max(0,snapshot.equity-policy.drawdown_floor-remaining);
 const allocation=Math.min(requested,marketLeft,dailyLeft,drawdownLeft),available=allocation-policy.cost_buffer;
 if(!positive(available))throw new Error('risk_budget_exhausted');
 return {requested,allocation,cost_buffer:policy.cost_buffer,available,market_used:marketUsed,market_left:marketLeft,daily_left:dailyLeft,drawdown_left:drawdownLeft,currency:policy.currency};
}
export function riskVolume(risk,lossPerLot,quote) {
 const {minimum_volume:minimum,maximum_volume:maximum,volume_step:step}=quote;
 if(![risk,lossPerLot,minimum,maximum,step].every(positive))throw new Error('risk_sizing_unavailable');
 const raw=Math.min(risk/lossPerLot,maximum),units=Math.floor(raw/step+1e-9);
 const lots=Number((units*step).toFixed(10));
 if(lots<minimum||lots*lossPerLot>risk+1e-7)throw new Error('minimum_volume_exceeds_budget');
 return lots;
}

export function riskPreviewMetrics(input,snapshot,policy,now){
 const q=snapshot.quotes?.find(q=>q.symbol===input.symbol);
 if(!q||now-q.time>5||q.time>now+1||!positive(q.point)||!nonnegative(q.stops_level))throw new Error('quote_stale');
 const long=input.direction==='long',price=long?q.ask:q.bid,sl=Number(input.stop_loss),tp=input.take_profit==null?null:Number(input.take_profit);
 const distance=Math.max(q.point,q.stops_level),reference=long?q.bid:q.ask;
 if(!positive(sl)||(long?sl>=reference-distance:sl<=reference+distance)
  ||(tp!==null&&(!positive(tp)||(long?tp<=reference+distance:tp>=reference-distance))))throw new Error('invalid_stop_or_target');
 const dynamic=input.risk_mode!=null,budget=riskBudget(dynamic?input.risk_mode:'full',input.symbol,snapshot,policy,now);
 const lossPerLot=Math.abs(price-sl)*(long?q.loss_per_unit_long:q.loss_per_unit_short)/q.minimum_volume;
 const sized=riskVolume(budget.available,lossPerLot,q),volume=dynamic?sized:q.minimum_volume,risk=volume*lossPerLot;
 if(risk>budget.available+1e-7)throw new Error('minimum_volume_exceeds_budget');
 const reward=tp==null?null:long?tp-price:price-tp;
 return {budget,volume,risk,reference_price:price,rr:reward>0?reward/Math.abs(price-sl):null,currency:snapshot.currency,quote_time:q.time};
}
