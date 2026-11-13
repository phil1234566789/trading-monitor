import {findOrderPosition,snapshotAgeSeconds} from './milkyMetaTraderMonitoring.js';
import {chartInstrument} from './tradeIdeas.js';
import {fmtPrice} from './format.js';
import {mmtAccountSnapshot,mmtPollDelay,mmtStaleSeconds} from './milkyMetaTraderPolling.js';

const positive=value=>Number.isFinite(value)&&value>0;
export function collectMmtBrokerPositions(accounts,statuses,now=Date.now()){
 return accounts.filter(account=>!account.archived||statuses[account.id]?.inactive).flatMap(account=>{
  const status=statuses[account.id],snapshot=mmtAccountSnapshot(account,status?.bridge);
  if(!snapshot)return [];
  const age=snapshotAgeSeconds(status.bridge?.heartbeat_at,now);
  const online=!account.archived&&!!status.online&&!status.status_error&&!snapshot.worker_error&&age!=null&&age<=mmtStaleSeconds(mmtPollDelay(status));
  return (snapshot.positions??[]).map(position=>({key:`${account.id}:${position.ticket}`,account,status,snapshot,position,age,online,currency:snapshot.currency}));
 });
}
export function projectBrokerPositions(positions,orders){
 return positions.map(({account,position,online})=>{
  const snapshot={account_login:Number(account.login),account_server:account.server,positions:[position]};
  const managedOrderId=orders.find(order=>findOrderPosition(order,snapshot))?.id;
  return {id:`${account.id}:${position.ticket}`,accountId:account.id,accountName:account.name,inactive:!!account.archived,login:Number(account.login),server:account.server,
   ticket:position.ticket,magic:position.magic,type:position.type,direction:position.type===0?'long':'short',symbol:position.symbol,instrument:chartInstrument(position.symbol),volume:position.volume,
   entryPrice:positive(position.price_open)?position.price_open:null,stopLoss:positive(position.sl)?position.sl:null,
   takeProfit:positive(position.tp)?position.tp:null,openedAt:position.opened_at_sec,online:!!online,managedOrderId};
 });
}

export function brokerPositionLines(position,tpCovered=false){
 const label=`${position.accountName} · #${position.ticket} · ${fmtPrice(position.volume,8)} Lot${position.online?'':' · alter Stand'}`;
 return [['entryPrice','Entry','tradeConnector'],['stopLoss','SL aktuell','candleDown'],['takeProfit','TP aktuell','candleUp']]
  .flatMap(([key,name,color])=>positive(position[key])&&!(key==='takeProfit'&&tpCovered)?[{id:`${position.id}:${key}`,price:position[key],color,title:`${name} · ${label}`}]:[]);
}
