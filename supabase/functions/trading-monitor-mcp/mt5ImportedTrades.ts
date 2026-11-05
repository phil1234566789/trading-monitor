import {checked,mt5Database} from './mt5Credentials.ts';
export async function readImportedTrades(db=mt5Database()){
 const rows=[];let after=0;
 while(true){
  const page:any[]=checked(await db.from('mt5_imported_trades').select('id,account_id,source_trade_id,source_file,symbol,currency,opened_at,closed_at,entry,exit,direction,volume,net,commission,imported_at').gt('id',after).order('id').limit(500))??[];
  if(!page.length)return rows;
  rows.push(...page);after=page[page.length-1].id;
 }
}
