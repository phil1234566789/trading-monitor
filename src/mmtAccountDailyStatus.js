import {accountAvailability} from './milkyMetaTraderAccountSelection.js';
import {mmtAccountSnapshot} from './milkyMetaTraderPolling.js';

export const accountDailyStatus=(account,status)=>mmtAccountSnapshot(account,status?.bridge)?status:null;

export async function readAccountDailyStatuses(api,accounts,selectedId,status,options) {
 const rows=await Promise.all(accountAvailability(accounts).active.map(async account=>{
  try{
   const value=account.id===selectedId?status:await api('status',{account_id:account.id},options);
   return [account.id,accountDailyStatus(account,value)];
  }catch{return [account.id,null];}
 }));
 return Object.fromEntries(rows);
}
