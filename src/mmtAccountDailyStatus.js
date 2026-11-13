import {accountAvailability} from './milkyMetaTraderAccountSelection.js';
import {mmtAccountSnapshot} from './milkyMetaTraderPolling.js';

export const accountDailyStatus=(account,status)=>mmtAccountSnapshot(account,status?.bridge)?status:null;

export async function readAccountDailyStatuses(api,accounts,selectedId,status,options,previousStatuses={}) {
 const rows=await Promise.all(accountAvailability(accounts).active.map(async account=>{
  try{
   const value=account.id===selectedId?status:await api('status',{account_id:account.id},options);
   if(!accountDailyStatus(account,value))throw new Error('Brokerstand gehört nicht zu diesem Konto.');
   return [account.id,value];
  }catch(error){
   // Ein fehlgeschlagener Poll ist kein Nachweis, dass alle Positionen geschlossen wurden.
   const previous=accountDailyStatus(account,previousStatuses[account.id]);
   return [account.id,{...(previous??{}),online:false,status_error:error?.message||'Kontostatus konnte nicht geladen werden.'}];
  }
 }));
 return Object.fromEntries(rows);
}
