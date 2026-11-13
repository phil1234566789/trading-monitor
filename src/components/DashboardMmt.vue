<script setup>
import {computed,ref,toRef,watch} from 'vue';
import MmtTargetEditor from './MmtTargetEditor.vue';
import {findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {nearestTradeIdea,chartInstrument} from '../tradeIdeas.js';
import {useDashboardMmt} from '../composables/useDashboardMmt.js';
import MmtBatchEntrySearch from './MmtBatchEntrySearch.vue';
import {mmtSearchFeedback} from '../mmtChartStatus.js';
import {positionCommissions} from '../milkyMetaTraderStatistics.js';
import {fmtPrice,pnlClass} from '../format.js';
import '../milkyMetaTrader.css';
const props=defineProps({symbol:String,annotations:Array,lastCandleTime:Number,replay:Boolean});
const emit=defineEmits(['trades']);
const mmt=useDashboardMmt(toRef(props,'symbol'));
const {api,status,accounts,accountStatuses,activeId,account,snapshot,brokerQuote,activeOrders,trades,history,entryTimeFor,links,error,key,now,refresh,cancel}=mmt;
const nearest=computed(()=>nearestTradeIdea(props.annotations??[],props.lastCandleTime));
const ambiguity=computed(()=>nearest.value.reason==='tie');
const entryDisabledReason=computed(()=>props.replay?'Replay aktiv: Entry-Suche nur im Live-Chart möglich.':error.value||(!nearest.value.idea?(ambiguity.value?'Zwei Ideen sind gleich nah: eine ausblenden.':'Eine Long-/Short-Idee mit SL im Chart fehlt.') :''));
const accountFor=o=>accounts.value.find(a=>Number(a.login)===o.intent.account_login&&a.server===o.intent.account_server);
const snapshotFor=o=>accountStatuses.value[accountFor(o)?.id]?.bridge?.snapshot;
const apiFor=o=>(action,fields,options)=>api(action,{...fields,account_id:accountFor(o)?.id},options);
const openPositions=computed(()=>accounts.value.flatMap(a=>{
 const state=accountStatuses.value[a.id];
 const snap=state?.bridge?.snapshot;
 if(snap?.account_login!==Number(a.login)||snap?.account_server!==a.server)return [];
 return (snap.positions??[]).map(p=>({account:a,position:p,currency:snap.currency,online:state.online}));
}));
const managedPositions=computed(()=>(status.value?.orders??[]).filter(o=>findOrderPosition(o,snapshotFor(o))));
const searchStatus={searching:'Entry wird gesucht',sending:'Wird gesendet',unknown:'Ausführung ungeklärt'};
const lastResult=ref(null),submittedIds=new Set();
function afterSubmit(ids=[]){for(const id of ids)submittedIds.add(id);void refresh();}
const commissions=computed(()=>positionCommissions(history.value));
watch(()=>status.value?.orders??[],(orders,previous)=>{
 const result=mmtSearchFeedback(orders,previous,submittedIds);
 if(result)lastResult.value=result;
});
watch(trades,value=>emit('trades',value),{immediate:true});
</script>
<template>
 <section class="mmt-page mmt-chart-card" aria-label="MMT im Chart">
  <header><strong>MMT · {{symbol}}</strong><RouterLink to="/milky-meta-trader">Konten / Status</RouterLink></header>
  <p v-if="!key">MMT unter Konten entsperren.</p>
  <p v-if="error" role="alert">{{error}}</p>
  <p v-if="replay" role="status">Replay · Entry-Suche gesperrt</p>
  <p v-if="ambiguity" role="status">Zwei Ideen gleich nah · eine ausblenden</p>
  <MmtBatchEntrySearch v-if="key" :api="api" :accounts="accounts" :statuses="accountStatuses" :active-id="activeId" :symbol="symbol" :idea="nearest.idea" :now="now" :disabled="!!entryDisabledReason" :disabled-reason="entryDisabledReason" @submitted="afterSubmit" />
  <p v-if="lastResult" role="status">{{lastResult.text}}<span v-if="lastResult.reason"> · {{lastResult.reason}}</span> <button aria-label="Rückmeldung schließen" @click="lastResult=null">×</button></p>
  <ul v-if="activeOrders.length" class="live-state" aria-label="Laufende Entry-Suchen" aria-live="polite">
   <li v-for="o in activeOrders" :key="o.id"><strong>{{o.intent.symbol}} · {{o.intent.direction==='long'?'Long':'Short'}}</strong><br>{{accountFor(o)?.name}} · {{searchStatus[o.status]}} <button v-if="o.status==='searching'" @click="cancel(o.id)">Abbrechen</button></li>
  </ul>
  <ul v-if="openPositions.length" class="live-state" aria-label="Offene Positionen" aria-live="polite">
   <li v-for="p in openPositions" :key="p.account.id+':'+p.position.ticket"><strong>{{p.position.symbol}} · {{p.position.type===0?'Long':'Short'}} · {{p.position.volume}} Lot</strong><br>{{p.account.name}} · <span :class="pnlClass(p.position.profit)">{{fmtPrice(p.position.profit,2)}} {{p.currency}}</span> Broker-PnL<br><small>Ohne Kosten/Swap · Commission {{fmtPrice(commissions.get(p.account.id+':'+(p.position.position_id??p.position.ticket))??null,2)}} {{p.currency}}</small><span v-if="!p.online"> · Stand veraltet</span></li>
  </ul>
  <details v-for="o in managedPositions" :key="o.id"><summary>{{o.intent.symbol}} · TP verwalten</summary><MmtTargetEditor :order="o" :api="apiFor(o)" :snapshot="snapshotFor(o)" :online="!!accountStatuses[accountFor(o)?.id]?.online&&!error" :entry-time="entryTimeFor(o)" @saved="refresh" /></details>
 </section>
</template>
<style scoped>
.mmt-chart-card{padding:7px;font-size:11px;overflow:visible;flex:none;max-width:100%;border:1px solid #303746;border-radius:4px}
header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}header a{font-size:10px}
p{margin:5px 0}.live-state{list-style:none;padding:0;margin:5px 0}.live-state li{border-top:1px solid #303746;padding:5px 0;overflow-wrap:anywhere}
.live-state button{font-size:10px;margin-left:4px;background:transparent;color:inherit;border:1px solid #475569;border-radius:3px}details{margin-top:5px}
.mmt-chart-card :deep(.mmt-panel){padding:5px;margin:5px 0}.mmt-chart-card :deep(p){font-size:11px}
</style>
