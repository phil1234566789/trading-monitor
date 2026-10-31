import {berlinDateStrFor,berlinOffsetMinutes} from '../_shared/berlinTime.ts';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function tradingDay(now) {
 const day=berlinDateStrFor(now),[y,m,d]=day.split('-').map(Number);
 const guess=Date.UTC(y,m-1,d),next=Date.UTC(y,m-1,d+1);
 return {day,day_start_sec:(guess-berlinOffsetMinutes(guess)*60000)/1000,
  day_end_sec:(next-berlinOffsetMinutes(next)*60000)/1000};
}
export function evaluateDailyStop(snapshot,window,policy,now) {
 const risk=snapshot?.risk;
 if(snapshot?.currency!=='USD'||!risk||risk.day!==window.day||!finite(risk.time)||now-risk.time>5||risk.time>now+1
  ||!finite(risk.realized_net_day)||!finite(risk.open_loss)||risk.open_loss>0||!finite(snapshot.equity))throw new Error('daily_risk_unavailable');
 // 1000 USD und Berliner Mitternacht sind Philips ausdrücklich bestätigte Tagesregel.
 if(risk.realized_net_day+risk.open_loss<=-1000)return 'daily_loss';
 if(policy?.currency===snapshot.currency&&policy.valid_until_sec>now&&finite(policy.drawdown_floor)
  &&policy.drawdown_floor>0&&snapshot.equity<=policy.drawdown_floor)return 'broker_drawdown';
 return null;
}
export function validateGuardExposure(exposure) {
 if(!exposure||!Array.isArray(exposure.positions)||!Array.isArray(exposure.orders)
  ||exposure.positions.length>100||exposure.orders.length>100)throw new Error('invalid_guard_exposure');
 for(const [kind,rows] of [['close',exposure.positions],['cancel',exposure.orders]])for(const p of rows){
  if(!Number.isSafeInteger(p.ticket)||p.ticket<=0||typeof p.symbol!=='string'||!p.symbol||p.symbol.length>64
   ||!Number.isSafeInteger(p.type)||p.type<0||!finite(p.magic)||!finite(p.volume)||p.volume<=0
   ||(kind==='close'&&![0,1].includes(p.type)))throw new Error('invalid_guard_exposure');
 }
 return exposure;
}

export function assertDailyStopSnapshot(snapshot,now){
 const window=tradingDay(now);
 if(snapshot?.risk_guards_ready!==true||snapshot.hedging!==true||snapshot.risk?.latched!==false||snapshot.risk_error
  ||evaluateDailyStop(snapshot,window,null,now)!==null)throw new Error('daily_stop_not_ready');
}

export function guardCommandsForExposure(exposure,previous,now){
 const retryable=new Set(['guard_broker_rejected','guard_precheck_failed','guard_trading_disabled','close_specs_unavailable','close_filling_unsupported']);
 return [...exposure.orders.map(p=>({kind:'cancel',p})),...exposure.positions.map(p=>({kind:'close',p}))].flatMap(({kind,p})=>{
  const volume=kind==='close'?p.volume:0;
  const prior=previous.filter(r=>r.kind===kind&&r.ticket===p.ticket&&Number(r.expected_volume)===volume).sort((a,b)=>b.attempt-a.attempt)[0];
  if(prior&&!(prior.status==='rejected'&&retryable.has(prior.result?.reason)&&now-Date.parse(prior.updated_at)/1000>=5))return [];
  return [{kind,ticket:p.ticket,symbol:p.symbol,expected_volume:volume,attempt:prior?prior.attempt+1:0,checkpoint:p}];
 });
}
