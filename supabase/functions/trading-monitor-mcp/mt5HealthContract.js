export function assessMt5Health({selected,bridge,orders},now=Date.now()) {
  if(!selected)return null;
  const unknown=orders.find(o=>o.status==='unknown'||o.status==='sending'&&now-Date.parse(o.updated_at)>30000);
  if(unknown)return {key:'unknown:'+unknown.id,code:'send_outcome_unknown',detail:{order_id:unknown.id}};
  if(!bridge||now-Date.parse(bridge.heartbeat_at)>60000)return {key:'offline:'+selected.id,code:'worker_offline',detail:{}};
  const snapshot=bridge.snapshot;
  if(snapshot.account_login!==Number(selected.login)||snapshot.account_server!==selected.server)
    return {key:'account:'+selected.id,code:'account_mismatch',detail:{}};
  const fault=snapshot.worker_error;
  if(fault)return {key:`fault:${selected.id}:${fault.code}:${fault.stage}:${fault.line}`,code:fault.code,detail:{stage:fault.stage,line:fault.line}};
  if(!snapshot.execution_ready&&orders.some(o=>o.status==='searching'))
    return {key:'paused:'+selected.id,code:'execution_paused',detail:{}};
  return null;
}

export function healthMessage(incident) {
  const time=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'medium'}).format(new Date(incident.opened_at));
  const descriptions={worker_offline:'Der MT5-Worker liefert keinen aktuellen Heartbeat.',
    account_mismatch:'Worker und ausgewaehltes Testkonto stimmen nicht ueberein.',
    execution_paused:'Eine Entry-Suche wartet, aber der Worker ist nicht zur Ausfuehrung bereit.',
    send_outcome_unknown:'Der Orderausgang ist unklar. Brokerpositionen pruefen; nichts erneut senden.'};
  const reason=descriptions[incident.code]??`Ausfuehrungsfehler: ${incident.code}${incident.detail?.stage?' in '+incident.detail.stage:''}.`;
  return `MMT: ${incident.resolved_at?'Stoerung inzwischen beendet':'Eingreifen erforderlich'}\n${reason}\nErkannt: ${time} (Berlin)\nIncident: ${incident.id}\nKeinen verpassten Entry automatisch nachholen.\nhttps://phil1234566789.github.io/trading-monitor/#/milky-meta-trader`;
}
