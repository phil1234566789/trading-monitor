import {computed,onMounted,onUnmounted,ref,shallowReactive,watch} from 'vue';
import {mmtAccountSnapshot} from '../milkyMetaTraderPolling.js';
import {subscribeMmtUiInvalidation,invalidateMmtPlans} from '../mmtUiInvalidation.js';

const pending=order=>['searching','sending','unknown'].includes(order.status);
const groups=['catalog','snapshots','orders','guards','health','balances'];
const changeSections={catalog:['catalog','snapshots','guards','balances'],snapshots:['snapshots'],orders:['orders'],guards:['guards','snapshots'],balances:['balances','snapshots']};
export function useMmtUiData({api,credential,enabled=()=>true,balances=false,health=false}){
 const accounts=ref([]),activeId=ref(null),rawStatuses=ref({}),orders=ref([]),healthState=ref(null),accountBalances=ref([]),flags=ref({});
 const error=ref(''),now=ref(Date.now()),initialized=ref(false),checkedAt=ref(null),healthReadAt=ref(null),key=ref(credential());
 const hintedOrders=shallowReactive(new Set()),versions={},queued=new Set();
 let disposed=false,running=null,reading=new Set(),timer,unsubscribe,nextLive=Infinity,nextActivity=Infinity,nextHealth=Infinity,nextRetry=0;
 const visible=()=>enabled()&&document.visibilityState==='visible'&&Boolean(credential());
 const eligible=section=>groups.includes(section)&&(section!=='balances'||balances)&&(section!=='health'||health);
 const open=computed(()=>Object.values(rawStatuses.value).some(value=>!value.inactive&&(value.bridge?.snapshot?.positions?.length||value.bridge?.snapshot?.pending_orders)));
 const searches=computed(()=>orders.value.some(pending)||hintedOrders.size>0);
 const live=computed(()=>open.value||searches.value);
 const accountStatuses=computed(()=>Object.fromEntries(Object.entries(rawStatuses.value).map(([id,value])=>{
  const account=accounts.value.find(a=>a.id===id);
  return [id,{...value,ui_cached:!open.value,ui_checked_at:checkedAt.value,orders:orders.value.filter(order=>Number(account?.login)===order.intent?.account_login&&account?.server===order.intent?.account_server)}];
 })));
 const status=computed(()=>({...flags.value,...accountStatuses.value[activeId.value],orders:orders.value,health:healthState.value,account_balances:accountBalances.value,active_account_id:activeId.value,ui_cached:!open.value,ui_checked_at:checkedAt.value,ui_health_read_at:healthReadAt.value}));
 function clear(){accounts.value=[];activeId.value=null;rawStatuses.value={};orders.value=[];healthState.value=null;accountBalances.value=[];flags.value={};initialized.value=false;error.value='';hintedOrders.clear();for(const key of Object.keys(versions))delete versions[key];queued.clear();nextRetry=0;}
 function syncCredential(){const value=credential();if(value!==key.value){clear();key.value=value;}return Boolean(value);}
 function desired(){return [...(open.value?['snapshots']:[]),...(searches.value?['orders']:[])];}
 function changed(revisions={},loaded=[]){
  const missing=new Set();
  for(const [section,value] of Object.entries(revisions)){
   if(loaded.includes(section)){versions[section]=value;continue;}
   if(section==='plans'){
    if(versions.plans!=null&&versions.plans!==value)invalidateMmtPlans();versions.plans=value;continue;
   }
   if(versions[section]!=null&&versions[section]!==value)for(const item of changeSections[section]??[])if((item!=='balances'||balances)&&!loaded.includes(item))missing.add(item);
   if(versions[section]==null)versions[section]=value;
  }
  return [...missing];
 }
 function merge(data,sections){
  const wasOpen=open.value;
  if(sections.includes('catalog')){accounts.value=data.accounts??[];activeId.value=data.active_account_id??null;flags.value={execution_enabled:data.execution_enabled,server_live_allowed:data.server_live_allowed};}
  const states={...rawStatuses.value};
  for(const [id,value] of Object.entries(data.account_statuses??{})){
   const account=accounts.value.find(a=>a.id===id);if(!account)continue;
   const previous=states[id]??{};
   if(Object.hasOwn(value,'bridge')&&!mmtAccountSnapshot(account,value.bridge)){
    states[id]={...previous,...value,...(mmtAccountSnapshot(account,previous.bridge)?{bridge:previous.bridge}:{}),online:false,status_error:'Kein bestätigter Brokerstand für dieses Konto.'};
   }else{states[id]={...previous,...value};if(Object.hasOwn(value,'bridge'))delete states[id].status_error;}
  }
  for(const id of Object.keys(states))if(!accounts.value.some(account=>account.id===id))delete states[id];
  rawStatuses.value=states;
  if(sections.includes('orders')){orders.value=data.orders??[];for(const id of hintedOrders)if(orders.value.some(order=>order.id===id&&!pending(order)))hintedOrders.delete(id);}
  if(sections.includes('health')){healthState.value=data.health??null;healthReadAt.value=Date.now();nextHealth=Date.now()+900000;}
  if(sections.includes('balances'))accountBalances.value=data.account_balances??[];
  if(wasOpen&&!open.value&&balances&&!sections.includes('balances'))queued.add('balances');
  checkedAt.value=Date.now();initialized.value=true;nextRetry=0;error.value='';
 }
 function schedule(){nextLive=live.value?Date.now()+8000:Infinity;nextActivity=live.value?Infinity:Date.now()+30000;}
 function queue(sections,force=false){
  for(const section of sections)if(eligible(section)&&(force||!reading.has(section)))queued.add(section);
  if(running)return running;
  if(!visible())return Promise.resolve();
  const key=credential();if(!key)return Promise.resolve();
  const stale=()=>disposed||credential()!==key;
  running=Promise.resolve().then(async()=>{
   while(queued.size&&!stale()&&visible()){
    const sections=[...queued];queued.clear();reading=new Set(sections);
    try{
     const data=await api('ui_state',{sections},{background:true});if(stale())return;
     merge(data,sections);for(const section of changed(data.revisions,sections))queued.add(section);
    }catch(e){if(!stale()){for(const section of sections)queued.add(section);nextRetry=Date.now()+(live.value?8000:30000);error.value=e.message;rawStatuses.value=Object.fromEntries(Object.entries(rawStatuses.value).map(([id,value])=>[id,{...value,online:false,status_error:e.message}]));}break;}
    finally{reading=new Set();}
   }
  }).finally(()=>{running=null;if(!disposed)schedule();});
  return running;
 }
 async function probe(){
  if(running)return running;
  const key=credential();if(!key){clear();return;}
  running=(async()=>{try{
   const data=await api('ui_activity',{}, {background:true});if(disposed||credential()!==key)return;
   error.value='';for(const section of changed(data.revisions))queued.add(section);
  }catch(e){if(!disposed&&credential()===key)error.value=e.message;}
  })().finally(()=>{running=null;if(!disposed)schedule();});
  await running;if(queued.size&&!disposed&&visible())return queue([]);
 }
 async function refresh({sections,orderIds=[],full=false}={}){
  if(!syncCredential()){clear();return;}
  for(const id of orderIds)hintedOrders.add(id);
  if(full||!initialized.value)return queue(groups,full);
  return queue(sections??['snapshots','orders',...(balances?['balances']:[])]);
 }
 async function tick(){
  now.value=Date.now();syncCredential();if(!visible()||running||Date.now()<nextRetry)return;
  if(!initialized.value){await refresh();return;}
  if(queued.size){await queue([]);return;}
  const sections=Date.now()>=nextLive?desired():[];
  if(health&&Date.now()>=nextHealth)sections.push('health');
  if(sections.length){await queue(sections);return;}
  if(Date.now()>=nextActivity)await probe();
 }
 function wake(){syncCredential();if(!visible())return;if(!initialized.value)void refresh();else if(queued.size)void queue([]);else if(live.value)void queue(desired());else void probe();}
 watch(enabled,value=>{if(value)wake();});
 onMounted(()=>{
  unsubscribe=subscribeMmtUiInvalidation(sections=>{if(visible())void queue(sections,true);else for(const section of sections)if(eligible(section))queued.add(section);});
  document.addEventListener('visibilitychange',wake);globalThis.window?.addEventListener('focus',wake);
  if(visible())void refresh();timer=setInterval(tick,1000);
 });
 onUnmounted(()=>{disposed=true;clearInterval(timer);unsubscribe?.();document.removeEventListener('visibilitychange',wake);globalThis.window?.removeEventListener('focus',wake);});
 return {accounts,activeId,status,accountStatuses,orders,error,now,key,initialized,refresh,clear};
}
