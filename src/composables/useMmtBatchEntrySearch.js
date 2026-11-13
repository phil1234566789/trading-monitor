import {computed,ref,watch,onMounted} from 'vue';
import {chartInstrument} from '../tradeIdeas.js';
import {riskPreviewMetrics} from '../../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {confirmMmtBatch,batchIntent,findMmtBatchOrder,reconcileMmtBatchRows,isMmtSearchState} from '../mmtBatchSearch.js';
import {accountsForRole} from '../mmtAccountRoles.js';
import {mmtRiskReason} from '../mmtRiskReasons.js';

const activeStates=['preparing','prepared','searching','sending','unknown'];
export function useMmtBatchEntrySearch(props,emit){
const role=ref('normal'),riskMode=ref('risky'),duration=ref(30),rows=ref([]),busy=ref(false),error=ref('');
const storageKey='mmt-batch-entry';
try{role.value=sessionStorage.getItem('mmt-entry-role')??'normal';}catch{}
try{rows.value=JSON.parse(sessionStorage.getItem(storageKey)??'[]').filter(r=>!['prepared','preparing'].includes(r.state));}catch{}
watch(role,value=>{try{sessionStorage.setItem('mmt-entry-role',value);}catch{}});
const unresolved=computed(()=>rows.value.some(r=>r.state==='unknown'));
const selectedAccounts=computed(()=>accountsForRole(props.accounts??[],role.value));
const brokerSymbols=ref({});
const symbolKey=a=>JSON.stringify([a.id,a.login,a.server,props.symbol]);
watch(()=>[props.statuses,props.symbol,props.accounts],()=>{
 for(const a of props.accounts??[]){
  const snapshot=props.statuses?.[a.id]?.bridge?.snapshot;
  if(snapshot?.account_login!==Number(a.login)||snapshot.account_server!==a.server)continue;
  const matches=(snapshot.quotes??[]).filter(q=>chartInstrument(q.symbol)===props.symbol);
  if(matches.length)brokerSymbols.value[symbolKey(a)]=matches.map(q=>q.symbol);
 }
},{immediate:true,deep:true});
function details(a){
 const s=props.statuses?.[a.id],snapshot=s?.bridge?.snapshot;
 const quotes=(snapshot?.quotes??[]).filter(q=>chartInstrument(q.symbol)===props.symbol);
 if(!s?.online||!snapshot)return {reason:'Brokerverbindung offline'};
 if(snapshot.account_login!==Number(a.login)||snapshot.account_server!==a.server)return {reason:'Brokerkonto stimmt nicht überein'};
 const symbols=quotes.length?quotes.map(q=>q.symbol):brokerSymbols.value[symbolKey(a)]??[];
 if(symbols.length!==1)return {reason:symbols.length?'Broker-Symbol mehrdeutig':'Broker-Symbol für '+props.symbol+' noch nicht zugeordnet'};
 if(!snapshot.execution_ready||!snapshot.trade_allowed)return {reason:'Handel nicht bereit · Details unter Konten'};
 const order={symbol:symbols[0],direction:props.idea?.direction,stop_loss:props.idea?.sl,take_profit:props.idea?.tp??null,risk_mode:riskMode.value};
 try{
  return {order,metrics:riskPreviewMetrics(order,snapshot,s.risk_policy,props.now/1000)};
 }catch(e){return {order,reason:e.message==='quote_stale'?'Lot/RR beim Entry · Suchauftrag möglich':`Prüfung beim Start: ${mmtRiskReason(e.message)}`};}
}
const accountDetails=computed(()=>selectedAccounts.value.map(account=>({account,...details(account)})));

const draftKey=computed(()=>JSON.stringify([selectedAccounts.value.map(a=>[a.id,a.login,a.server]).sort(),props.symbol,props.idea?.direction,props.idea?.sl,props.idea?.tp??null,riskMode.value,Number(duration.value)]));
const blockedReason=computed(()=>{
 if(busy.value)return 'Eine Anfrage wird gerade verarbeitet.';
 if(unresolved.value)return 'Unklare Rückmeldungen zuerst prüfen; kein erneuter Versand.';
 if(props.disabled)return props.disabledReason||'Entry-Suche im aktuellen Chartzustand gesperrt.';
 if(!props.idea)return 'Eine eindeutige Long-/Short-Idee mit SL im Chart fehlt.';
 if(!selectedAccounts.value.length)return 'Kontozuordnung fehlt oder ist mehrdeutig. Konto-Tags unter MMT prüfen.';
 if(rows.value.some(r=>r.requestKey===draftKey.value&&activeStates.includes(r.state)))return 'Diese Entry-Suche läuft bereits. Status unten prüfen.';
 return accountDetails.value.filter(row=>!row.order).map(row=>`${row.account.name}: ${row.reason}`).join('\n');
});
const canSubmit=computed(()=>!blockedReason.value);
const feedbackRows=computed(()=>rows.value.filter(row=>!['searching','sending'].includes(row.state)||!findMmtBatchOrder(row,props.statuses)));
function persist(){sessionStorage.setItem(storageKey,JSON.stringify(rows.value));}
function reportFailures(batch){error.value=batch.filter(r=>['rejected','unknown'].includes(r.state)).map(r=>`${r.name}: ${r.message}`).join(' · ');}
function submitted(){emit('submitted',rows.value.flatMap(row=>row.preview?.intent?.id?[row.preview.intent.id]:[]));}
watch(()=>props.statuses,()=>{if(reconcileMmtBatchRows(rows.value,props.statuses)){reportFailures(rows.value);try{persist();}catch(e){error.value='Status bestätigt, Sitzungsspeicher nicht verfügbar: '+e.message;}}},{deep:true});
onMounted(()=>{if(rows.value.length)submitted();});
async function submit(){
 if(busy.value||!canSubmit.value)return;
 busy.value=true;error.value='';
 const requestKey=draftKey.value,attempt=crypto.randomUUID();
 const batchAccounts=[...selectedAccounts.value];
 rows.value=[...rows.value.filter(r=>activeStates.includes(r.state)),...rows.value.filter(r=>!activeStates.includes(r.state)).slice(-8),...batchAccounts.map(a=>({attempt,requestKey,accountId:a.id,name:a.name,state:'preparing',order:{...details(a).order,duration_sec:Number(duration.value)*60},message:''}))];
 const batch=rows.value.filter(r=>r.attempt===attempt);
 try{
  await Promise.all(batch.map(async row=>{
   try{Object.assign(row,await props.api('search_preview',{account_id:row.accountId,order:row.order}),{state:'prepared'});}
   catch(e){row.state='rejected';row.message=mmtRiskReason(e.code??e.message,e.message||String(e));}
  }));
  if(props.disabled||requestKey!==draftKey.value){
   for(const row of batch.filter(r=>r.state==='prepared')){row.state='rejected';row.message=props.disabled?(props.disabledReason||'Suche inzwischen gesperrt. Kein Suchauftrag gestartet.'):'Idee während der Prüfung geändert. Kein Suchauftrag gestartet.';}
   persist();reportFailures(batch);return;
  }
  // Der Klick autorisiert die asynchrone Suche; signierte Vorprüfung und dauerhafte Unknown-Reservierung bleiben bestehen.
  persist();await confirmMmtBatch(props.api,batch,persist);reportFailures(batch);submitted();
 }catch(e){error.value='Suchauftrag nicht bestätigt. Sitzungsspeicher oder Verbindung prüfen: '+e.message;}
 finally{busy.value=false;}
}
async function reconcile(){
 if(busy.value)return;busy.value=true;error.value='';
 try{
  for(const row of rows.value.filter(r=>r.state==='unknown')){
   let order=await props.api('status',{id:row.preview.intent.id,account_id:row.accountId});
   if(!order&&props.now>=row.preview.confirmation_expires_sec*1000)order=(await props.api('search_abandon',{account_id:row.accountId,confirmation:row.confirmation})).order;
   if(order){if(order.id!==row.preview.intent.id||!isMmtSearchState(order.status))throw new Error('Status nicht eindeutig bestätigt; kein erneuter Versand.');row.state=order.status;row.message=order.result?.reason?mmtRiskReason(order.result.reason,order.result.reason):'Status abgeglichen';}
  }
  persist();reportFailures(rows.value);submitted();
 }catch(e){error.value=e.message;}finally{busy.value=false;}
}
function dismiss(row){if(activeStates.includes(row.state))return;rows.value=rows.value.filter(r=>r!==row);reportFailures(rows.value);try{persist();}catch(e){error.value=e.message;}}
const stateLabel=state=>({preparing:'Anfrage wird geprüft',prepared:'Suchauftrag wird übertragen',searching:'Entry wird gesucht',sending:'Ausführung läuft',unknown:'Ausgang ungeklärt · nicht erneut senden',rejected:'Abgelehnt',expired:'Suche abgelaufen',cancelled:'Suche abgebrochen',executed:'Entry ausgeführt'}[state]??state);
return {role,riskMode,duration,rows,busy,error,unresolved,selectedAccounts,accountDetails,blockedReason,canSubmit,feedbackRows,submit,reconcile,dismiss,stateLabel,rowIntent:batchIntent};
}
