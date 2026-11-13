import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import {createMilkyMetaTraderClient} from '../milkyMetaTraderClient.js';
import {mmtDashboardOrders} from '../mmtChartStatus.js';
import {readMilkyMetaTraderKey} from '../milkyMetaTraderKey.js';
import {mmtPollDelay,mmtSelectedAccountId} from '../milkyMetaTraderPolling.js';
import {findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {readAccountDailyStatuses} from '../mmtAccountDailyStatus.js';
import {chartInstrument} from '../tradeIdeas.js';
export function useDashboardMmt(symbol,enabled=()=>true) {
 const status=ref(null),accounts=ref([]),activeId=ref(null),error=ref('');
 const key=ref(readMilkyMetaTraderKey()),now=ref(Date.now());
 const api=(action,fields={},options={})=>createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,key.value)(action,fields,options);
 const account=computed(()=>accounts.value.find(a=>a.id===activeId.value));
 const switchingAccount=ref(false),accountMessage=ref('');
 const accountStatuses=ref({});
 const snapshot=computed(()=>{
  const s=status.value?.bridge?.snapshot;
  return s?.account_login===Number(account.value?.login)&&s?.account_server===account.value?.server?s:null;
 });
 const brokerQuote=computed(()=>{
  const matches=(snapshot.value?.quotes??[]).filter(q=>chartInstrument(q.symbol)===symbol.value);
  return matches.length===1?matches[0]:null;
 });
 const orders=computed(()=>mmtDashboardOrders(accounts.value,status.value,accountStatuses.value));
 const activeOrders=computed(()=>orders.value.filter(o=>['searching','sending','unknown'].includes(o.status)));
 function entryTimeFor(order){
  const account=accounts.value.find(a=>Number(a.login)===order.intent.account_login&&a.server===order.intent.account_server);
  return findOrderPosition(order,accountStatuses.value[account?.id]?.bridge?.snapshot)?.opened_at_sec??null;
 }
 let timer,next=0,request=null,disposed=false;
 const pollDelay=()=>Math.min(...[status.value,...Object.values(accountStatuses.value)].map(mmtPollDelay));
 function clear(){status.value=null;accounts.value=[];accountStatuses.value={};activeId.value=null;error.value='';}
 async function refresh(){
  if(!enabled())return;
  key.value=readMilkyMetaTraderKey();if(!key.value){clear();return;}
  if(request)return request;
  const credential=key.value;
  const stale=()=>disposed||readMilkyMetaTraderKey()!==credential;
  request=(async()=>{try{
   const [a,s]=await Promise.all([api('accounts',{}, {background:true}),api('status',{}, {background:true})]);
   if(stale())return;
   accounts.value=a.accounts;activeId.value=mmtSelectedAccountId(s,a.active_account_id);status.value=s;error.value='';
   const states=await readAccountDailyStatuses(api,a.accounts,activeId.value,s,{background:true},accountStatuses.value);
   if(stale())return;
   accountStatuses.value=states;
  }catch(e){if(!stale()){
   error.value=e.message;
   accountStatuses.value=Object.fromEntries(Object.entries(accountStatuses.value).map(([id,value])=>[id,{...value,online:false,status_error:e.message}]));
  }}finally{request=null;next=Date.now()+pollDelay();}})();
  return request;
 }
 async function cancel(id){try{await api('cancel',{id});await refresh();}catch(e){error.value=e.message;}}
 async function selectAccount(id){
  if(switchingAccount.value||id===activeId.value)return;
  switchingAccount.value=true;accountMessage.value='';
  try{
   if(request)await request;
   await api('select_account',{id});
   // Alte Kurse dürfen nach dem Wechsel keine Vorschau für das neue Konto liefern.
   activeId.value=id;status.value=null;
   await refresh();
   accountMessage.value='Handelskonto gewählt. Der MT5-Worker muss mit diesem Konto verbunden sein.';
  }catch(e){error.value=e.message;}finally{switchingAccount.value=false;}
 }
 function visibilityChanged(){now.value=Date.now();if(enabled()&&document.visibilityState==='visible'){next=0;void refresh();}}
 watch(enabled,active=>{if(active)visibilityChanged();});
 onMounted(()=>{if(enabled()&&document.visibilityState==='visible')void refresh();document.addEventListener('visibilitychange',visibilityChanged);timer=setInterval(()=>{now.value=Date.now();if(enabled()&&now.value>=next&&document.visibilityState==='visible')void refresh();},1000);});
 onUnmounted(()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibilityChanged);});
 return {api,status,orders,accounts,accountStatuses,activeId,switchingAccount,accountMessage,selectAccount,account,snapshot,brokerQuote,activeOrders,entryTimeFor,error,key,now,refresh,cancel};
}
