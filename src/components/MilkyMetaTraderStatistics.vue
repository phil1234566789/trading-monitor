<script setup>
import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import EquityChart from './MilkyMetaTraderEquityChart.vue';
import Breakdown from './MilkyMetaTraderStatisticsBreakdown.vue';
import {loadMmtHistory} from '../milkyMetaTraderHistory.js';
import {closedBrokerTrades,filterBrokerTrades,statisticsGroups} from '../milkyMetaTraderStatistics.js';
import {fmtDateTime,fmtPrice,pnlClass} from '../format.js';
import '../milkyMetaTraderStatistics.css';
const props=defineProps({api:{type:Function,required:true},accounts:{type:Array,default:()=>[]}});
const raw=ref([]),sync=ref([]),loading=ref(false),error=ref(''),loaded=ref(false),view=ref('list');
const account=ref(''),asset=ref(''),currency=ref(''),from=ref(''),to=ref(''),page=ref(0);
let timer,inFlight=false,alive=true;
async function refresh(background=false){
 if(inFlight)return;inFlight=true;if(!background)loading.value=true;
 try{const data=await loadMmtHistory(props.api,background);if(alive){raw.value=data.rows;sync.value=data.sync;error.value='';loaded.value=true;}}
 catch(e){if(alive)error.value=e.message;}
 finally{inFlight=false;if(alive)loading.value=false;}
}
onMounted(()=>{void refresh();timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh(true);},60000);});
onUnmounted(()=>{alive=false;clearInterval(timer);});
const result=computed(()=>closedBrokerTrades(raw.value));
const currencies=computed(()=>[...new Set(raw.value.map(d=>d.currency))].sort());
watch(currencies,list=>{if(!list.includes(currency.value))currency.value=list[0]??'';},{immediate:true});
const assets=computed(()=>[...new Set(result.value.trades.map(t=>t.symbol))].sort());
const trades=computed(()=>filterBrokerTrades(result.value.trades,{account:account.value,asset:asset.value,currency:currency.value,from:from.value,to:to.value}));
const total=computed(()=>trades.value.reduce((s,t)=>s+t.net,0));
const wins=computed(()=>trades.value.filter(t=>t.net>0).length);
const grouped=computed(()=>Object.fromEntries(['asset','hour','weekday'].map(dim=>[dim,statisticsGroups(trades.value,dim)])));
const selectedAccounts=computed(()=>props.accounts.filter(a=>!account.value||a.id===account.value));
const coverage=computed(()=>selectedAccounts.value.filter(a=>sync.value.some(s=>s.account_id===a.id&&s.last_full_at)));
const problems=computed(()=>sync.value.filter(s=>(!account.value||s.account_id===account.value)&&(s.last_error||s.in_progress)));
const fees=computed(()=>result.value.unallocated.filter(d=>(!account.value||d.account_id===account.value)&&d.currency===currency.value).reduce((s,d)=>s+d.profit+d.commission+d.swap+d.fee,0));
const listed=computed(()=>[...trades.value].reverse().slice(page.value*50,page.value*50+50));
const pages=computed(()=>Math.max(1,Math.ceil(trades.value.length/50)));
watch([account,asset,currency,from,to],()=>{page.value=0;});
watch(pages,value=>{page.value=Math.min(page.value,value-1);});
const name=id=>props.accounts.find(a=>a.id===id)?.name??id;
const time=ms=>fmtDateTime(ms/1000,{timeZone:'Europe/Berlin'});
const latest=computed(()=>sync.value.filter(s=>!account.value||s.account_id===account.value).map(s=>s.synced_at).filter(Boolean).sort().at(-1));
</script>
<template><section class="mmt-panel mmt-statistics" aria-labelledby="mmt-statistics-title">
 <div class="mmt-section-heading"><h2 id="mmt-statistics-title">Trading-Statistik</h2><ActionButton :disabled="loading" @click="refresh(false)">{{loading?'Lädt …':'Statistik aktualisieren'}}</ActionButton></div>
 <p v-if="error" class="mmt-error" role="alert">Historie nicht aktuell: {{error}}</p>
 <p class="mmt-muted">{{coverage.length}} / {{selectedAccounts.length}} Konten mit abgeschlossenem Historienabruf · {{latest?'Letzter Historienabgleich '+fmtDateTime(latest,{timeZone:'Europe/Berlin',second:'2-digit'}):'Historienabgleich noch nicht bestätigt'}} · Brokerdaten, inklusive manueller Trades.</p>
 <p v-if="problems.length" class="mmt-error" role="status">Historienimport läuft oder ist gestört. Ergebnisse können noch unvollständig sein.</p>
 <div class="mmt-stat-filters">
  <label>Konto<select v-model="account"><option value="">Alle Konten</option><option v-for="a in accounts" :key="a.id" :value="a.id">{{a.name}}{{a.archived?' · archiviert':''}}</option></select></label>
  <label>Asset<select v-model="asset"><option value="">Alle Assets</option><option v-for="a in assets" :key="a">{{a}}</option></select></label>
  <label>Währung<select v-model="currency"><option v-if="!currencies.length" value="">—</option><option v-for="c in currencies" :key="c">{{c}}</option></select></label>
  <label>Abschluss ab<input v-model="from" type="date"></label><label>bis<input v-model="to" type="date"></label>
 </div>
 <p v-if="from&&to&&from>to" role="alert" class="mmt-error">Das Enddatum liegt vor dem Startdatum.</p>
 <div class="mmt-stat-summary"><span>Netto-PnL <strong :class="pnlClass(total)">{{coverage.length?fmtPrice(total,2):'—'}} {{currency}}</strong></span><span>Trades <strong>{{coverage.length?trades.length:'—'}}</strong></span><span>Ø/Trade <strong :class="pnlClass(total)">{{trades.length?fmtPrice(total/trades.length,2):'—'}} {{currency}}</strong></span><span>Gewinntrades <strong>{{trades.length?fmtPrice(wins/trades.length*100,0):'—'}} %</strong></span></div>
 <div class="mmt-stat-tabs" aria-label="PnL-Ansicht"><ActionButton :aria-pressed="view==='list'" @click="view='list'">PnL-Liste</ActionButton><ActionButton :aria-pressed="view==='chart'" @click="view='chart'">X–Y-Diagramm</ActionButton></div>
 <EquityChart v-if="view==='chart'" :trades="trades" :currency="currency" />
 <template v-else><div class="mmt-stat-table-wrap"><table><thead><tr><th>Abschluss · Berlin</th><th>Konto / Asset</th><th>Richtung</th><th>Lot</th><th>Netto-PnL</th></tr></thead><tbody><tr v-for="t in listed" :key="t.id"><td>{{time(t.closed_at)}}</td><td>{{name(t.account_id)}}<br><strong>{{t.symbol}}</strong></td><td><span class="trade-direction" :class="t.direction">{{t.direction==='long'?'Long':'Short'}}</span></td><td>{{fmtPrice(t.volume,4)}}</td><td :class="pnlClass(t.net)">{{fmtPrice(t.net,2)}} {{t.currency}}</td></tr><tr v-if="!listed.length"><td colspan="5">{{loading?'Brokerhistorie wird geladen …':loaded&&coverage.length?'Keine abgeschlossenen Trades für diese Auswahl.':'Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.'}}</td></tr></tbody></table></div>
 <div v-if="pages>1" class="mmt-stat-pages"><ActionButton :disabled="page===0" @click="page--">Zurück</ActionButton><span>{{page+1}} / {{pages}}</span><ActionButton :disabled="page>=pages-1" @click="page++">Weiter</ActionButton></div></template>
 <div class="mmt-stat-breakdowns"><Breakdown title="Assets" :rows="grouped.asset" :currency="currency"/><Breakdown title="Entry-Stunden · Berlin" :rows="grouped.hour" :currency="currency"/><Breakdown title="Entry-Wochentage · Berlin" :rows="grouped.weekday" :currency="currency"/></div>
 <p class="mmt-muted">Beträge in {{currency||'Kontowährung'}} aus zugeordneten Brokerbuchungen inklusive Kommission, Gebühren und Swap. Nach Ø/Trade sortiert; N = Stichprobe. Unterschiedliche Lotgrößen beeinflussen PnL; keine automatische Aussage über die Qualität einer Handelszeit. R-Werte benötigen belegtes initiales Risiko.</p>
 <p v-if="fees" class="mmt-error">Nicht einzelnen Trades zugeordnete Kosten/Buchungen (Konten/Währung, vor Zeit-/Assetfilter): {{fmtPrice(fees,2)}} {{currency}} – separat, nicht im Trade-PnL.</p>
 <p v-if="result.excluded" class="mmt-error">{{result.excluded}} Positionsverläufe mit fehlenden Einstiegen, Umkehrungen oder widersprüchlichen Buchungen sind nicht in den Kennzahlen enthalten.</p>
 <details><summary>Datenumfang &amp; ältere Konten</summary><p>Einzahlungen, Resets und sonstige Kontobuchungen sind keine Gewinne aus Trades. Offene/teilgeschlossene Positionen zählen erst nach vollständigem Abschluss. Alte und gescheiterte Konten können später als archivierte Historien hinzukommen; ihr Dateiimport ist noch nicht eingerichtet. Ausgewertet wird nur die vom Broker gelieferte Historie; davor liegende Trades sind nicht automatisch enthalten. Andere aktive MT5-Konten werden für den Statistikabruf nicht automatisch umgeschaltet.</p><ul><li v-for="a in accounts" :key="a.id">{{a.name}} · {{sync.find(s=>s.account_id===a.id)?.last_full_at?'Historie vorhanden':'Historie noch nicht abgerufen'}}</li></ul></details>
</section></template>
