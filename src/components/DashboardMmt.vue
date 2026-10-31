<script setup>
import {computed,toRef,watch} from 'vue';
import {nearestTradeIdea,brokerIdeaMetrics,chartInstrument} from '../tradeIdeas.js';
import {useDashboardMmt} from '../composables/useDashboardMmt.js';
import EntrySearch from './MilkyMetaTraderEntrySearch.vue';
import OrderCard from './MilkyMetaTraderOrderCard.vue';
import '../milkyMetaTrader.css';
const props=defineProps({symbol:String,annotations:Array,lastCandleTime:Number,replay:Boolean});
const emit=defineEmits(['trades']);
const mmt=useDashboardMmt(toRef(props,'symbol'));
const {api,status,account,snapshot,brokerQuote,activeOrders,trades,links,error,key,now,refresh,cancel}=mmt;
const nearest=computed(()=>nearestTradeIdea(props.annotations??[],props.lastCandleTime));
const reasons={loading:'Chartkerzen werden geladen.',missing:'Long-/Short-Idee im Chart einzeichnen.',tie:'Zwei Ideen sind gleich nah. Eine Idee unter Zeichnungen ausblenden.'};
const quoteFor=o=>snapshot.value?.account_login===o.intent.account_login&&snapshot.value?.account_server===o.intent.account_server
 ?snapshot.value.quotes?.find(q=>q.symbol===o.intent.symbol):null;
const metrics=o=>brokerIdeaMetrics({direction:o.intent.direction,sl:o.intent.stop_loss,tp:o.intent.take_profit},quoteFor(o),now.value/1000);
const executed=computed(()=>(status.value?.orders??[]).filter(o=>o.status==='executed'));
watch(trades,value=>emit('trades',value),{immediate:true});
</script>
<template>
 <section class="mmt-page mmt-chart-card" aria-label="MMT im Chart">
  <header><strong>MMT · {{symbol}}</strong><RouterLink to="/milky-meta-trader">Konten / Status</RouterLink></header>
  <p v-if="!key">MMT zuerst unter Konten entsperren.</p>
  <p v-if="error" role="alert">{{error}} · Letzter Stand, keine aktuelle Bestätigung.</p>
  <p v-if="replay" role="status">Replay: neue Broker-Suche gesperrt.</p>
  <p v-if="nearest.reason" role="status">{{reasons[nearest.reason]}}</p>
  <p v-if="key&&!brokerQuote">Kein eindeutiges Broker-Symbol für {{symbol}} verfügbar.</p>
  <p v-if="account">Konto: {{account.name}}</p>
  <EntrySearch v-if="key" :api="api" :status="status" :account="account" compact :chart-symbol="brokerQuote?.symbol" :idea="nearest.idea" :disabled="replay||!!error||!nearest.idea||!brokerQuote" @submitted="refresh" />
  <details class="mmt-help"><summary>Idee und Ausführung</summary><p>Chart: FXCM Bid, geschlossene Kerzen. Suche: aktuelle MT5 Bid/Ask-Kurse. Der gezeichnete Anker ist niemals ein MMT-Trigger. Broker prüft SL und Mindestlot vor Ausführung erneut. Zusätzliche dynamische Risikolots benötigen ein freigegebenes Risikobudget.</p></details>
  <section v-if="activeOrders.length" aria-label="Alle laufenden Entry-Suchen">
   <h3>Alle Assets · laufende Aufträge</h3>
   <ul class="mmt-order-list"><template v-for="order in activeOrders" :key="order.id">
    <OrderCard :order="order" :snapshot="snapshot" @cancel="cancel" />
    <li v-if="order.status==='searching'" class="mmt-muted">Aktuell RR {{metrics(order)?.rr?.toFixed(2)??'—'}} · {{metrics(order)?.volume??'—'}} Lot (Pilot) · Risiko {{metrics(order)?.risk?.toFixed(2)??'—'}} {{snapshot?.currency}}<br>SL / Richtung / Konto / Suchende sind fest.</li>
   </template></ul>
  </section>
  <details v-if="executed.length"><summary>Bestätigte Ausführungen · {{executed.length}}</summary>
   <p v-for="o in executed" :key="o.id">{{o.intent.symbol}} · {{o.result.volume}} Lot fest · Fill {{o.result.price}}<br>
    <span v-if="chartInstrument(o.intent.symbol)===symbol&&!trades.some(t=>t.id==='mmt:'+o.id)">Brokerzeit wird aus Dealhistorie abgeglichen; noch keine Chartmarke.</span>
    <RouterLink v-if="links[o.id]" :to="{path:'/',query:{journalTrade:links[o.id].trade_position_id,instrument:symbol}}">DR / Journal öffnen</RouterLink>
   </p>
  </details>
  <details v-if="status?.orders?.some(o=>['rejected','expired','cancelled'].includes(o.status))"><summary>Beendete Suchen</summary><ul class="mmt-order-list"><OrderCard v-for="o in status.orders.filter(o=>['rejected','expired','cancelled'].includes(o.status))" :key="o.id" :order="o" /></ul></details>
 </section>
</template>
<style scoped>
.mmt-chart-card{padding:10px;font-size:12px;overflow:visible;flex:none;max-width:100%;border:1px solid #303746;border-radius:4px}
header{display:flex;justify-content:space-between;gap:8px;align-items:center}
header a{font-size:11px}
.mmt-chart-card :deep(.mmt-panel){padding:8px;margin:6px 0}
.mmt-chart-card :deep(.mmt-form){gap:6px}
.mmt-chart-card :deep(h2){font-size:13px;margin:0}
.mmt-chart-card :deep(p){font-size:11px}
</style>
