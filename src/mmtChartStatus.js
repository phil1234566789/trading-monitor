export function mmtSearchFeedback(orders,previous,submittedIds){
 let result=null;
 const labels={rejected:'Abgelehnt',expired:'Suche abgelaufen',cancelled:'Suche abgebrochen'};
 for(const order of orders){
  const old=previous?.find(p=>p.id===order.id);
  if((submittedIds.has(order.id)||old&&['searching','sending','unknown'].includes(old.status))&&labels[order.status]){
   submittedIds.delete(order.id);
   result={id:order.id,text:order.intent.symbol+' · '+labels[order.status],reason:order.result?.reason??''};
  }
 }
 return result;
}
