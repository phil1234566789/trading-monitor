<script setup>
import {computed,onUnmounted,ref,toRef,watch} from 'vue';
import MmtTargetEditor from './MmtTargetEditor.vue';
import {executionPositionId,findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {nearestTradeIdea,chartInstrument} from '../tradeIdeas.js';
import {useDashboardMmt} from '../composables/useDashboardMmt.js';
import MmtBatchEntrySearch from './MmtBatchEntrySearch.vue';
import {mmtSearchFeedback} from '../mmtChartStatus.js';
import ActionButton from './ui/ActionButton.vue';
import IconButton from './ui/IconButton.vue';
import {fmtPrice,pnlClass} from '../format.js';
import {collectMmtBrokerPositions,projectBrokerPositions} from '../mmtBrokerPositions.js';
import '../milkyMetaTrader.css';
const props=defineProps({symbol:String,annotations:Array,lastCandleTime:Number,replay:Boolean,enabled:{type:Boolean,default:true}});
const emit=defineEmits(['broker-positions']);
const mmt=useDashboardMmt(toRef(props,'symbol'),()=>props.enabled);
const {api,status,orders,accounts,accountStatuses,activeId,account,snapshot,brokerQuote,activeOrders,entryTimeFor,error,key,now,refresh,cancel}=mmt;
const nearest=computed(()=>nearestTradeIdea(props.annotations??[],props.lastCandleTime));
const ambiguity=computed(()=>nearest.value.reason==='tie');
const entryDisabledReason=computed(()=>props.replay?'Replay aktiv: Entry-Suche nur im Live-Chart möglich.':error.value||(!nearest.value.idea?(ambiguity.value?'Zwei Ideen sind gleich nah: eine ausblenden.':'Eine Long-/Short-Idee mit SL im Chart fehlt.') :''));
const accountFor=o=>accounts.value.find(a=>Number(a.login)===o.intent.account_login&&a.server===o.intent.account_server);
const snapshotFor=o=>accountStatuses.value[accountFor(o)?.id]?.bridge?.snapshot;
const onlineFor=o=>props.enabled&&openPositions.value.find(p=>p.account.id===accountFor(o)?.id&&p.position.ticket===executionPositionId(o))?.online===true;
const apiFor=o=>(action,fields,options)=>api(action,{...fields,account_id:accountFor(o)?.id},options);
const apiForNativePosition=position=>(action,fields,options)=>api(action,{...fields,account_id:position.accountId},options);
const openPositions=computed(()=>collectMmtBrokerPositions(accounts.value,accountStatuses.value,now.value));
const managedPositions=computed(()=>orders.value.filter(o=>findOrderPosition(o,snapshotFor(o))));
const brokerPositions=computed(()=>projectBrokerPositions(openPositions.value,managedPositions.value));
const searchStatus={searching:'Entry wird gesucht',sending:'Wird gesendet',unknown:'Ausführung ungeklärt'};
const lastResult=ref(null),submittedIds=new Set();
function afterSubmit(ids=[]){for(const id of ids)submittedIds.add(id);void refresh({sections:['orders','snapshots'],orderIds:ids});}
watch(orders,(orders,previous)=>{
 const result=mmtSearchFeedback(orders,previous,submittedIds);
 if(result)lastResult.value=result;
});
watch(brokerPositions,value=>emit('broker-positions',value),{immediate:true});
onUnmounted(()=>emit('broker-positions',[]));
</script>
<template>
 <section class="mmt-page mmt-chart-card" aria-label="MMT im Chart">
  <header><strong>MMT · {{symbol}}</strong><RouterLink to="/milky-meta-trader">Konten / Status</RouterLink></header>
  <p v-if="!key">MMT unter Konten entsperren.</p>
  <p v-if="error" class="mmt-error" role="alert">{{error}}</p>
  <p v-if="replay" role="status">Replay · Entry-Suche gesperrt</p>
  <p v-if="ambiguity" role="status">Zwei Ideen gleich nah · eine ausblenden</p>
  <MmtBatchEntrySearch v-if="key" :api="api" :accounts="accounts" :statuses="accountStatuses" :active-id="activeId" :symbol="symbol" :idea="nearest.idea" :now="now" :disabled="!!entryDisabledReason" :disabled-reason="entryDisabledReason" @submitted="afterSubmit" />
  <p v-if="lastResult" :role="lastResult.error?'alert':'status'" :class="{'mmt-error':lastResult.error}">{{lastResult.text}}<span v-if="lastResult.reason"> · {{lastResult.reason}}</span> <IconButton aria-label="Rückmeldung schließen" title="Rückmeldung schließen" @click="lastResult=null">×</IconButton></p>
  <p v-for="a in accounts.filter(a=>accountStatuses[a.id]?.status_error)" :key="a.id" class="mmt-error" role="alert">{{a.name}} · {{accountStatuses[a.id].status_error}}</p>
  <ul v-if="activeOrders.length" class="mmt-order-list" aria-label="Laufende Entry-Suchen" aria-live="polite">
   <li v-for="o in activeOrders" :key="o.id" class="mmt-order-card" :data-state="o.status">
    <div class="mmt-order-heading"><strong>{{o.intent.symbol}} · {{o.intent.direction==='long'?'Long':'Short'}}</strong><span class="mmt-order-state">{{searchStatus[o.status]}}</span><ActionButton v-if="o.status==='searching'" @click="cancel(o.id)">Abbrechen</ActionButton></div>
    <small class="mmt-muted">{{accountFor(o)?.name}}</small>
   </li>
  </ul>
  <ul v-if="openPositions.length" class="mmt-order-list" aria-label="Offene Positionen" aria-live="polite">
   <li v-for="p in openPositions" :key="p.key" class="mmt-live-position" :data-stale="!p.online">
    <div class="mmt-order-heading"><strong>{{p.position.symbol}} · {{p.position.type===0?'Long':'Short'}} · {{fmtPrice(p.position.volume,2)}} Lot</strong><strong :class="pnlClass(p.position.profit)">{{fmtPrice(p.position.profit,2)}} {{p.currency}}</strong></div>
    <small class="mmt-muted">{{p.account.name}} · Broker-PnL ohne Kosten/Swap<span v-if="p.account.archived"> · Konto inaktiv · letzter bekannter Stand</span><span v-else-if="!p.online"> · Stand veraltet</span></small>
   </li>
  </ul>
  <MmtTargetEditor v-for="o in managedPositions" :key="o.id" headless :order="o" :api="apiFor(o)" :snapshot="snapshotFor(o)" :online="onlineFor(o)&&!error" :entry-time="entryTimeFor(o)" :account-name="accountFor(o)?.name" @saved="refresh" />
  <MmtTargetEditor v-for="position in brokerPositions.filter(position=>!position.inactive&&!position.managedOrderId)" :key="position.id" headless :native-position="position" :api="apiForNativePosition(position)" :snapshot="accountStatuses[position.accountId]?.bridge?.snapshot" :online="enabled&&position.online&&!error" :entry-time="position.openedAt" :account-name="position.accountName" @saved="refresh" />
 </section>
</template>
<style scoped>
.mmt-chart-card .mmt-live-position{padding:6px;margin:5px 0}.mmt-chart-card .mmt-order-card{padding:5px 0}
.mmt-chart-card{padding:7px;font-size:11px;overflow:visible;flex:none;max-width:100%;border:1px solid #303746;border-radius:4px}
header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}header a{font-size:10px}
p{margin:5px 0}
.mmt-chart-card :deep(.mmt-panel){padding:5px;margin:5px 0}.mmt-chart-card :deep(p){font-size:11px}
</style>
