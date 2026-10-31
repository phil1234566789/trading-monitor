export async function loadMmtHistory(api,background=false,afterId=0){
 const rows=[];let cursor=afterId,sync=[];
 while(true){
  const page=await api('history_page',{after_id:cursor},{background});
  if(!Array.isArray(page.rows))throw new Error('Ungültige Brokerhistorie');
  if(cursor===0)sync=page.sync??[];
  if(!page.rows.length)break;
  rows.push(...page.rows);
  const next=page.rows[page.rows.length-1].id;
  if(!Number.isSafeInteger(next)||next<=cursor)throw new Error('Ungültige Historien-Paginierung');
  cursor=next;
 }
 return {rows,sync};
}
