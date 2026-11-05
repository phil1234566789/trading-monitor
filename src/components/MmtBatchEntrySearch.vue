<script setup>
import {computed,ref,watch} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import {chartInstrument} from '../tradeIdeas.js';
import {riskPreviewMetrics} from '../../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import {confirmMmtBatch} from '../mmtBatchSearch.js';
const props=defineProps({api:Function,accounts:Array,statuses:Object,activeId:String,symbol:String,idea:Object,disabled:Boolean,now:Number});
const emit=defineEmits(['submitted']);
const selected=ref([]),riskMode=ref('risky'),duration=ref(30),rows=ref([]),busy=ref(false),error=ref('');
const storageKey='mmt-batch-entry';
try{selected.value=JSON.parse(sessionStorage.getItem('mmt-selected-accounts')??'[]');}catch{}
try{rows.value=JSON.parse(sessionStorage.getItem(storageKey)??'[]').filter(r=>r.state!=='prepared');}catch{}
watch(()=>props.activeId,id=>{if(!selected.value.length&&id)selected.value=[id];},{immediate:true});
watch(selected,value=>sessionStorage.setItem('mmt-selected-accounts',JSON.stringify(value)),{deep:true});
const unresolved=computed(()=>rows.value.some(r=>r.state==='unknown'));
const selectedAccounts=computed(()=>(props.accounts??[]).filter(a=>!a.archived&&selected.value.includes(a.id)));
function details(a){
 const s=props.statuses?.[a.id],snapshot=s?.bridge?.snapshot;
 const quotes=(snapshot?.quotes??[]).filter(q=>chartInstrument(q.symbol)===props.symbol);
 if(!s?.online||!snapshot||snapshot.account_login!==Number(a.login)||snapshot.account_server!==a.server||quotes.length!==1)return {reason:'Worker / Brokerkurs fehlt'};
 if(!snapshot.execution_ready||!snapshot.trade_allowed)return {reason:'Handelsfreigabe / Schutzprüfung fehlt'};
 try{
  const order={symbol:quotes[0].symbol,direction:props.idea?.direction,stop_loss:props.idea?.sl,take_profit:props.idea?.tp??null,risk_mode:riskMode.value};
  return {order,metrics:riskPreviewMetrics(order,snapshot,s.risk_policy,props.now/1000)};
 }catch{return {reason:'Risikolimits, SL oder Restbudget prüfen'};}
}
const canPrepare=computed(()=>!props.disabled&&!!props.idea&&selectedAccounts.value.length>0&&selectedAccounts.value.every(a=>details(a).metrics));
const expired=computed(()=>rows.value.some(r=>r.state==='prepared'&&props.now>=r.preview.confirmation_expires_sec*1000));
const draftKey=computed(()=>JSON.stringify([selected.value,props.symbol,props.idea,riskMode.value,duration.value]));
watch(draftKey,()=>{if(!busy.value&&!unresolved.value){rows.value=[];persist(rows.value);}});
function persist(value){sessionStorage.setItem(storageKey,JSON.stringify(value));}
async function prepare(){
 if(busy.value||unresolved.value||!canPrepare.value)return;
 busy.value=true;error.value='';rows.value=[];
 const key=draftKey.value;
 try{
  const results=await Promise.allSettled(selectedAccounts.value.map(async a=>{
   const order={...details(a).order,duration_sec:Number(duration.value)*60};
   const data=await props.api('search_preview',{account_id:a.id,order});
   return {accountId:a.id,name:a.name,...data,state:'prepared',message:''};
  }));
  if(key!==draftKey.value)return;
  rows.value=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(results.some(r=>r.status==='rejected')){rows.value=[];throw new Error('Mindestens ein Konto konnte nicht vorbereitet werden. Bitte Kontostatus prüfen.');}
  persist(rows.value);
 }catch(e){error.value=e.message;}finally{busy.value=false;}
}
async function confirm(){
 if(busy.value||expired.value||props.disabled||unresolved.value)return;
 busy.value=true;error.value='';
 try{await confirmMmtBatch(props.api,rows.value,persist);emit('submitted');}
 catch(e){error.value='Sitzungsspeicher nicht verfügbar. '+e.message;}
 finally{busy.value=false;}
}
async function reconcile(){
 busy.value=true;error.value='';
 try{
  for(const row of rows.value.filter(r=>r.state==='unknown')){
   let order=await props.api('status',{id:row.preview.intent.id,account_id:row.accountId});
   if(!order&&props.now>=row.preview.confirmation_expires_sec*1000){
    order=(await props.api('search_abandon',{account_id:row.accountId,confirmation:row.confirmation})).order;
   }
   if(order){row.state=order.status;row.message='Status abgeglichen';}
  }
  persist(rows.value);emit('submitted');
 }catch(e){error.value=e.message;}finally{busy.value=false;}
}
</script>
<template>
 <section class="mmt-panel mmt-ticket" aria-label="Entry auf ausgewählten Konten suchen">
  <h2>Entry suchen</h2>
  <fieldset :disabled="busy||unresolved"><legend>Handelskonten · Mehrfachauswahl</legend>
   <label v-for="a in accounts" :key="a.id" class="account-choice">
    <input v-model="selected" type="checkbox" :value="a.id" :disabled="a.archived">
    <span>{{a.name}} <small>· {{a.login}}{{a.archived?' · Archiv':''}}</small></span>
   </label>
  </fieldset>
  <p><strong>{{idea?.direction==='long'?'Long':'Short'}} · SL {{idea?.sl??'—'}} · {{symbol}}</strong></p>
  <p v-for="a in selectedAccounts" :key="a.id">{{a.name}} · <template v-if="details(a).metrics">{{details(a).metrics.volume}} Lot · RR {{details(a).metrics.rr?.toFixed(2)??'—'}} · Risiko {{details(a).metrics.risk.toFixed(2)}} {{details(a).metrics.currency}}</template><span v-else>{{details(a).reason}}</span></p>
  <form class="mmt-form" @submit.prevent="prepare">
   <label class="mmt-wide">Risiko je Konto<select v-model="riskMode" :disabled="busy||unresolved"><option value="risky">Risky · 0,5 %</option><option value="full">Full · 0,9 %</option></select></label>
   <label class="mmt-wide">Suche gültig (Minuten)<input v-model="duration" type="number" min="1" max="60" required :disabled="busy||unresolved"></label>
   <ActionButton type="submit" class="mmt-primary mmt-wide" :disabled="busy||unresolved||!canPrepare">{{busy?'Wird verarbeitet …':`Entry auf ${selectedAccounts.length} Konten suchen`}}</ActionButton>
  </form>
  <p v-if="error" role="alert">{{error}}</p>
  <div v-if="rows.length" class="mmt-preview" aria-label="Kontogebundene Bestätigung">
   <p v-for="row in rows" :key="row.accountId"><strong>{{row.name}}</strong> · {{row.preview.volume}} Lot · SL {{row.preview.intent.stop_loss}} · TP {{row.preview.intent.take_profit??'offen'}}<br>{{row.state==='prepared'?'Bereit zur Bestätigung':row.state}} {{row.message}}</p>
   <p>Jedes Konto erhält eine eigene Suche und Risikoprüfung. Fills und Rückmeldungen können voneinander abweichen.</p>
   <p v-if="expired">Vorschau abgelaufen. Bitte neu vorbereiten.</p>
   <ActionButton v-if="rows.every(r=>r.state==='prepared')" class="mmt-primary" :disabled="busy||expired||disabled" @click="confirm">{{rows.length}} Entry-Suchen verbindlich starten</ActionButton>
   <ActionButton v-if="unresolved" :disabled="busy" @click="reconcile">Unklare Rückmeldungen prüfen</ActionButton>
  </div>
 </section>
</template>
<style scoped>
fieldset{margin:6px 0;padding:6px;border:1px solid #475569;border-radius:4px}
.account-choice{display:flex;align-items:center;gap:6px;padding:4px 0}
.account-choice input{width:auto}.account-choice small{opacity:.7}
</style>
