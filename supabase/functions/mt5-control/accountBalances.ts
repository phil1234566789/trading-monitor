import {checked,mt5Database} from '../trading-monitor-mcp/mt5Credentials.ts';

export async function readAccountBalances(){
 const db=mt5Database(),rows=[];
 for(let offset=0;;){
  const page=checked(await db.from('mt5_account_balances').select('*').order('account_id').range(offset,offset+499))??[];
  if(!page.length)return rows;
  rows.push(...page);offset+=page.length;
 }
}
