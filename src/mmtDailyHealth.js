import {berlinDateStrFor} from './berlinTime.js';

export function dailyHealth(snapshot,stop,now) {
 const risk=snapshot?.risk,day=berlinDateStrFor(now/1000),limit=stop?.daily_loss_limit;
 if(snapshot?.currency!=='USD'||stop?.day!==day||risk?.day!==day
  ||!Number.isFinite(limit)||limit<=0||!Number.isFinite(risk?.realized_net_day)
  ||!Number.isFinite(risk?.open_loss)||risk.open_loss>0||!Number.isFinite(risk?.time)
  ||now/1000-risk.time>15||risk.time>now/1000+1)return null;
 // Offene Gewinne geben wie im Tagesstopp kein zusätzliches Budget; ein ausgelöster Stopp bleibt gesperrt.
 const remaining=stop.latched?0:Math.max(0,Math.min(limit,limit+risk.realized_net_day+risk.open_loss));
 return {remaining,limit,percent:100*remaining/limit,realized:risk.realized_net_day,openLoss:risk.open_loss};
}
