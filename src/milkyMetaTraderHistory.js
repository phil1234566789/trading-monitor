export async function loadMmtHistory(api,background=false,afterId=0){
 const rows=[];let cursor=afterId,sync=[],imports=[];
 while(true){
  const page=await api('history_page',{after_id:cursor},{background});
  if(!Array.isArray(page.rows))throw new Error('Ungültige Brokerhistorie');
  if(cursor===0){sync=page.sync??[];imports=page.imports??[];}
  if(!page.rows.length)break;
  rows.push(...page.rows);
  const next=page.rows[page.rows.length-1].id;
  if(!Number.isSafeInteger(next)||next<=cursor)throw new Error('Ungültige Historien-Paginierung');
  cursor=next;
 }
 return {rows,sync,imports};
}

export async function refreshMmtHistory(api){
 let refreshError='';
 try{
  const {requests}=await api('history_refresh',{});
  let done=false;
  for(let attempt=0;attempt<20;attempt++){
   const status=await api('history_refresh_status',{requests},{background:true});
   if(status.failed?.length)throw new Error('history_refresh_failed');
   if(status.done){done=true;break;}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!done)throw new Error('history_refresh_timeout');
 }catch{
  refreshError='Brokerhistorie konnte nicht aktualisiert werden. Angezeigt wird der gespeicherte Stand; bitte erneut versuchen.';
 }
 return {...await loadMmtHistory(api),refreshError};
}
