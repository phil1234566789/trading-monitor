<script setup>
import {computed} from 'vue';
import {fmtDateTime,fmtPrice} from '../format.js';
import {tradeExtremes,tradeOutcomeClass} from '../milkyMetaTraderPerformance.js';
const props=defineProps({trades:{type:Array,default:()=>[]},ranked:Object,accountName:{type:Function,required:true},known:Boolean});
const count=defineModel('count',{type:Number,default:5});
const ranked=computed(()=>props.ranked??tradeExtremes(props.trades,count.value===''?5:count.value));
const groups=computed(()=>[{label:'Biggest Winners',rows:ranked.value.winners},{label:'Biggest Losers',rows:ranked.value.losers}]);
function normalize(){count.value=Math.min(100,Math.max(1,Math.trunc(Number(count.value)||5)));}
</script>
<template>
 <aside class="mmt-panel mmt-trade-extremes" aria-label="Größte Gewinner und Verlierer">
  <h2>Größte Trades</h2>
  <label>Anzahl je Liste<input v-model.number="count" type="number" min="1" max="100" step="1" @change="normalize"></label>
  <p class="mmt-muted">Nach Netto-PnL · ohne Break-even · gesamte Auswahl</p>
  <section v-for="group in groups" :key="group.label">
   <h3>{{group.label}}</h3>
   <ol class="mmt-extreme-list">
    <li v-for="trade in group.rows" :key="trade.id">
     <div><strong>{{trade.symbol}}</strong><strong :class="tradeOutcomeClass(trade)">{{fmtPrice(trade.net,2)}} {{trade.currency}}</strong></div>
     <small>{{accountName(trade.account_id)}}</small>
     <small>Entry {{fmtDateTime(trade.opened_at/1000,{timeZone:'Europe/Berlin'})}}</small>
    </li>
   </ol>
   <p v-if="!group.rows.length" class="mmt-muted">{{known?'Keine passenden Trades.':'Historie unbekannt.'}}</p>
  </section>
 </aside>
</template>
<style scoped>
.mmt-trade-extremes label{display:grid;gap:4px;font-size:11px;color:var(--mmt-muted)}
.mmt-extreme-list{list-style:decimal;padding-left:18px;margin:0;font-size:11px}
.mmt-extreme-list li{padding:8px 0;border-bottom:1px solid var(--mmt-border);overflow-wrap:anywhere}
.mmt-extreme-list li:last-child{border-bottom:0}
.mmt-extreme-list li>div{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.mmt-extreme-list small{display:block;margin-top:3px;color:var(--mmt-muted)}
</style>
