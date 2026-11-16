// Ein pausierter SL-Plan ist still gefährlich: die Linie steht im Chart, beim Broker liegt womöglich nichts.
const detailPattern=/^[a-z0-9_]{1,64}$/;
export function observedReason(reason,detail){
 return detail==null?reason:`${reason}:${typeof detail==='string'&&detailPattern.test(detail)?detail:'other'}`;
}
export function exitPlanAlertMessage(row,state,reason){
 const plan=row?.plan;if(state!=='paused'||!plan?.stops?.length)return null;
 const brokerSl=Number(row.checkpoint?.sl),where=`#${plan.position} · ${plan.symbol} · Konto ${plan.account_login}`;
 const sl=plan.stops.map(s=>s.price).join(' / ');
 return brokerSl>0
  ?`MMT ⚠ SL-Plan pausiert ${where}. Geplanter SL ${sl} ist NICHT aktiv, beim Broker bleibt SL ${brokerSl}. Grund: ${reason}. Bitte in MT5 prüfen.`
  :`MMT 🚨 POSITION UNGESCHÜTZT ${where}: kein SL beim Broker, geplanter SL ${sl} wurde NICHT gesetzt. Grund: ${reason}. Sofort in MT5 SL setzen oder schließen.`;
}
