import {findOrderPosition} from './milkyMetaTraderMonitoring.js';
import {chartInstrument} from './tradeIdeas.js';

export function unmanagedBrokerTakeProfits(positions,orders){
 return positions.flatMap(({account,position,online})=>{
  if(!Number.isFinite(position.tp)||position.tp<=0)return [];
  const snapshot={account_login:Number(account.login),account_server:account.server,positions:[position]};
  if(orders.some(order=>findOrderPosition(order,snapshot)))return [];
  return [{id:`${account.id}:${position.ticket}`,instrument:chartInstrument(position.symbol),price:position.tp,
   title:`Broker-TP · ${account.name} · #${position.ticket} · nur Anzeige${online?'':' · alter Stand'}`}];
 });
}
