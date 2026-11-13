import {computed,ref} from 'vue';
import {createMilkyMetaTraderClient} from '../milkyMetaTraderClient.js';
import {readMilkyMetaTraderKey} from '../milkyMetaTraderKey.js';
import {useMmtUiData} from './useMmtUiData.js';
import {findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {mmtAccountSnapshot} from '../milkyMetaTraderPolling.js';
import {chartInstrument} from '../tradeIdeas.js';
export function useDashboardMmt(symbol,enabled=()=>true){
 const api=(action,fields={},options={})=>createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,readMilkyMetaTraderKey())(action,fields,options);
 const data=useMmtUiData({api,credential:readMilkyMetaTraderKey,enabled});
 const {accounts,activeId,status,accountStatuses,orders,refresh,error}=data;
 const account=computed(()=>accounts.value.find(value=>value.id===activeId.value));
 const snapshot=computed(()=>mmtAccountSnapshot(account.value,status.value?.bridge));
 const brokerQuote=computed(()=>{const matches=(snapshot.value?.quotes??[]).filter(quote=>chartInstrument(quote.symbol)===symbol.value);return matches.length===1?matches[0]:null;});
 const activeOrders=computed(()=>orders.value.filter(order=>['searching','sending','unknown'].includes(order.status)));
 const switchingAccount=ref(false),accountMessage=ref('');
 function entryTimeFor(order){const account=accounts.value.find(value=>Number(value.login)===order.intent.account_login&&value.server===order.intent.account_server);return findOrderPosition(order,accountStatuses.value[account?.id]?.bridge?.snapshot)?.opened_at_sec??null;}
 async function cancel(id){try{await api('cancel',{id});}catch(e){error.value=e.message;}}
 async function selectAccount(id){
  if(switchingAccount.value||id===activeId.value)return;switchingAccount.value=true;accountMessage.value='';
  try{await api('select_account',{id});await refresh({sections:['catalog','snapshots','guards']});accountMessage.value='Handelskonto gewählt.';}catch(e){error.value=e.message;}finally{switchingAccount.value=false;}
 }
 return {...data,api,account,snapshot,brokerQuote,activeOrders,entryTimeFor,switchingAccount,accountMessage,selectAccount,cancel};
}
