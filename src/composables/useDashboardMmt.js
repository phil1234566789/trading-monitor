import {computed,onMounted,onUnmounted,ref} from 'vue';
import {createMilkyMetaTraderClient} from '../milkyMetaTraderClient.js';
import {mmtDashboardOrders} from '../mmtChartStatus.js';
import {readMilkyMetaTraderKey} from '../milkyMetaTraderKey.js';
import {mmtPollDelay,mmtSelectedAccountId} from '../milkyMetaTraderPolling.js';
import {executionPositionId,findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {readAccountDailyStatuses} from '../mmtAccountDailyStatus.js';
import {loadMmtHistory} from '../milkyMetaTraderHistory.js';
import {confirmedOrderTrade,chartInstrument} from '../tradeIdeas.js';
export function useDashboardMmt(symbol) {
 const status=ref(null),accounts=ref([]),activeId=ref(null),error=ref(''),history=ref([]),links=ref({});
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
 function entryTimeFor(o){
  const native=findOrderPosition(o,accountStatuses.value[accounts.value.find(a=>Number(a.login)===o.intent.account_login&&a.server===o.intent.account_server)?.id]?.bridge?.snapshot)?.opened_at_sec;
  if(Number.isFinite(native)&&native>0)return native;
  const a=accounts.value.find(a=>Number(a.login)===o.intent.account_login&&a.server===o.intent.account_server);
  const times=history.value.filter(d=>d.account_id===a?.id&&d.position_id===executionPositionId(o)&&d.entry===0&&d.symbol===o.intent.symbol).map(d=>d.time_msc/1000);
  return times.length?Math.min(...times):null;
 }
 const trades=computed(()=>orders.value.flatMap(o=>{
  const trade=confirmedOrderTrade(o,entryTimeFor(o));
  return trade&&trade.instrument===symbol.value?[trade]:[];
 }));
 let timer,next=0,request=null,disposed=false,lastHistory=0,historyCursor=0;
 async function refresh(){
  if(request)return request;
  key.value=readMilkyMetaTraderKey();if(!key.value){status.value=null;return;}
  request=(async()=>{try{
   const [a,s]=await Promise.all([api('accounts',{}, {background:true}),api('status',{}, {background:true})]);
   if(disposed)return;
   accounts.value=a.accounts;activeId.value=mmtSelectedAccountId(s,a.active_account_id);status.value=s;error.value='';
   const states=await readAccountDailyStatuses(api,a.accounts,activeId.value,s,{background:true},accountStatuses.value);
   if(disposed)return;
   accountStatuses.value=states;
   if(s.orders?.some(o=>o.status==='executed')&&Date.now()-lastHistory>8000){
    const data=await loadMmtHistory(api,true,historyCursor);if(disposed)return;
    history.value=[...history.value,...data.rows];
    if(data.rows.length)historyCursor=data.rows[data.rows.length-1].id;
    lastHistory=Date.now();
    for(const o of s.orders.filter(o=>o.status==='executed')){
     const acct=a.accounts.find(x=>Number(x.login)===o.intent.account_login&&x.server===o.intent.account_server);
     const position=executionPositionId(o);
     if(!acct||!position||Object.hasOwn(links.value,o.id))continue;
     const data=await api('journal_context',{account_id:acct.id,broker_position_id:position},{background:true});
     if(!disposed&&data.link)links.value={...links.value,[o.id]:data.link};
    }
   }
  }catch(e){if(!disposed)error.value=e.message;}finally{request=null;next=Date.now()+Math.min(4000,mmtPollDelay(status.value));}})();
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
 onMounted(()=>{void refresh();timer=setInterval(()=>{now.value=Date.now();if(now.value>=next&&document.visibilityState==='visible')void refresh();},1000);});
 onUnmounted(()=>{disposed=true;clearInterval(timer);});
 return {api,status,orders,accounts,accountStatuses,activeId,switchingAccount,accountMessage,selectAccount,account,snapshot,brokerQuote,activeOrders,trades,history,entryTimeFor,links,error,key,now,refresh,cancel};
}
