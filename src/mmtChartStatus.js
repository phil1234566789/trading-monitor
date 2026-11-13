import {mmtRiskReason} from './mmtRiskReasons.js';
export function mmtSearchFeedback(orders,previous,submittedIds){
 let result=null;
 const labels={rejected:'Abgelehnt',expired:'Suche abgelaufen',cancelled:'Suche abgebrochen'};
 for(const order of orders){
  const old=previous?.find(p=>p.id===order.id);
  if((submittedIds.has(order.id)||old&&['searching','sending','unknown'].includes(old.status))&&labels[order.status]){
   submittedIds.delete(order.id);
   result={id:order.id,text:order.intent.symbol+' · '+labels[order.status],reason:order.result?.reason?mmtRiskReason(order.result.reason,order.result.reason):'',error:order.status==='rejected'};
  }
 }
 return result;
}

export function mmtDashboardOrders(accounts,status,statuses){
 const known=order=>accounts.some(a=>!a.archived&&Number(a.login)===order.intent?.account_login&&a.server===order.intent?.account_server);
 const byId=new Map();
 for(const order of status?.orders??[])if(known(order))byId.set(order.id,order);
 for(const account of accounts){
  for(const order of statuses?.[account.id]?.orders??[]){
   if(Number(account.login)===order.intent?.account_login&&account.server===order.intent?.account_server&&known(order)){
    const previous=byId.get(order.id);
    if(!previous||!previous.updated_at||!order.updated_at||order.updated_at>=previous.updated_at)byId.set(order.id,order);
   }
  }
 }
 return [...byId.values()];
}
