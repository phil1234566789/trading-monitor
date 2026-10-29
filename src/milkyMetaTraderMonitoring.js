// Gleiche Symbole können mehrere Ausführungen haben: nur das echte Positionsticket zuordnen.
export function findOrderPosition(order,snapshot) {
  if(order.status!=='executed'||order.result?.position_lifecycle?.state==='closed'
    ||order.intent.account_login!==snapshot?.account_login||order.intent.account_server!==snapshot?.account_server)return null;
  const ticket=order.result?.position_lifecycle?.position??order.result?.position??order.result?.order;
  return snapshot?.positions?.find(p=>p.ticket===ticket&&p.symbol===order.intent.symbol&&p.type===(order.intent.direction==='long'?0:1))??null;
}
export function snapshotAgeSeconds(heartbeat,now) {
  if(!heartbeat)return null;
  const stamp=Date.parse(heartbeat);
  return Number.isFinite(stamp)?Math.max(0,Math.floor((now-stamp)/1000)):null;
}
