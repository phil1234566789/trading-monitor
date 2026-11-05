// Ein unklarer Versand bleibt an dieselbe ID gebunden, auch nach Reload.
export async function confirmMmtBatch(api,rows,persist){
 for(const row of rows){
  if(row.state!=='prepared')continue;
  row.state='unknown';persist(rows);
  try{
   const data=await api('search_confirm',{account_id:row.accountId,confirmation:row.confirmation});
   row.state=data.order.status;row.message='Angenommen';
  }catch(e){
   row.message=e.message;
   if(e.definitiveRejection)row.state='rejected';
  }
  persist(rows);
 }
 return rows;
}
