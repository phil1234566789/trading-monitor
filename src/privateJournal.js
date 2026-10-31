import {createMilkyMetaTraderClient} from './milkyMetaTraderClient.js';
import {readMilkyMetaTraderKey} from './milkyMetaTraderKey.js';

export const privateJournalAvailable=()=>Boolean(readMilkyMetaTraderKey());
export function privateJournalApi(action,fields={},options={}){
 return createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,readMilkyMetaTraderKey())(action,fields,options);
}
export async function loadPrivateJournalPages(action,fields,api=privateJournalApi){
 const rows=[];let after_id;
 while(true){
  const page=await api(action,{...fields,...(after_id!==undefined?{after_id}:{})},{background:true});
  if(!page.rows.length)return rows;
  rows.push(...page.rows);
  if(page.next_cursor==null||page.next_cursor===after_id)throw new Error('Journal-Paginierung ist unvollständig.');
  after_id=page.next_cursor;
 }
}
