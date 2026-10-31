export async function readExecutionOrders(db) {
 const recent=(await db.from('mt5_execution_orders').select('*').order('created_at',{ascending:false}).limit(20));
 if(recent.error)throw new Error('mt5_storage_unavailable');
 const active=[];let after='00000000-0000-0000-0000-000000000000';
 while(true){
  const response=await db.from('mt5_execution_orders').select('*').in('status',['searching','sending','unknown']).gt('id',after).order('id').limit(500);
  if(response.error)throw new Error('mt5_storage_unavailable');
  const page=response.data??[];
  if(!page.length)break;
  active.push(...page);after=page[page.length-1].id;
 }
 return [...new Map([...(recent.data??[]),...active].map(o=>[o.id,o])).values()];
}
