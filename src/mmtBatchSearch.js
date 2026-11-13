import {mmtRiskReason} from './mmtRiskReasons.js';
export const isMmtSearchState=state=>['searching','sending','unknown','rejected','expired','cancelled','executed'].includes(state);
// Ein unklarer Versand bleibt an dieselbe ID gebunden, auch nach Reload.
export async function confirmMmtBatch(api,rows,persist){
 for(const row of rows){
  if(row.state!=='prepared')continue;
  row.state='unknown';persist(rows);
  try{
   const data=await api('search_confirm',{account_id:row.accountId,confirmation:row.confirmation});
   if(data.order?.id!==row.preview.intent.id||!isMmtSearchState(data.order.status))throw new Error('Ungültige Rückmeldung. Ausgang unklar; kein erneuter Versand.');
   row.state=data.order.status;row.message='Angenommen';
  }catch(e){
   row.message=e.message;
   if(e.definitiveRejection)row.state='rejected';
  }
  persist(rows);
 }
 return rows;
}

export const batchIntent=row=>row.preview?.intent??row.order??{};
export function findMmtBatchOrder(row,statuses){
 const intent=batchIntent(row),state=statuses?.[row.accountId];
 return state?.orders?.find(o=>o.id===intent.id&&o.intent?.account_login===intent.account_login&&o.intent?.account_server===intent.account_server);
}
export function reconcileMmtBatchRows(rows,statuses){
 let changed=false;
 for(const row of rows){
  if(['preparing','prepared'].includes(row.state))continue;
  const order=findMmtBatchOrder(row,statuses);
  if(order&&isMmtSearchState(order.status)&&order.status!==row.state){row.state=order.status;row.message=order.result?.reason?mmtRiskReason(order.result.reason,order.result.reason):'Status bestätigt';changed=true;}
 }
 return changed;
}
