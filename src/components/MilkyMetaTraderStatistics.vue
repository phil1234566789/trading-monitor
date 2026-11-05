<script setup>
import {computed,onMounted,onUnmounted,ref,watch} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import MmtTradeExtremes from './MmtTradeExtremes.vue';
import EquityChart from './MilkyMetaTraderEquityChart.vue';
import Breakdown from './MilkyMetaTraderStatisticsBreakdown.vue';
import MilkyMetaTraderJournal from './MilkyMetaTraderJournal.vue';
import {loadMmtHistory} from '../milkyMetaTraderHistory.js';
import {closedBrokerTrades,filterBrokerTrades,statisticsGroups} from '../milkyMetaTraderStatistics.js';
import {fmtDate,fmtDateTime,fmtPrice,pnlClass} from '../format.js';
import '../milkyMetaTraderStatistics.css';
import {tradePerformance,tradeOutcomeClass} from '../milkyMetaTraderPerformance.js';
import {tradeCalendarWeeks} from '../milkyMetaTraderWeeks.js';
import {importedClosedTrades} from '../milkyMetaTraderImportedTrades.js';
import {statisticsAccounts,ALL_HISTORY_ACCOUNTS} from '../milkyMetaTraderAccountSelection.js';
const emit=defineEmits(['history']);
const props=defineProps({api:{type:Function,required:true},accounts:{type:Array,default:()=>[]},account:{type:String,default:''}});
const imports=ref([]);
const raw=ref([]),sync=ref([]),loading=ref(false),error=ref(''),loaded=ref(false),view=ref('list');
const account=computed(()=>props.account);
const asset=ref(''),from=ref(''),to=ref(''),selectedWeek=ref('');
const currency='USD';
const views=[{key:'list',label:'PnL-Liste'},{key:'chart',label:'X–Y-Diagramm'},{key:'asset',label:'Assets'},{key:'hour',label:'Entry-Stunden · Berlin'},{key:'weekday',label:'Entry-Wochentage · Berlin'}];
const journalTrade=ref(null);
let timer,inFlight=false,alive=true;
async function refresh(background=false){
 if(inFlight)return;inFlight=true;if(!background)loading.value=true;
 try{const data=await loadMmtHistory(props.api,background);if(alive){raw.value=data.rows;sync.value=data.sync;imports.value=data.imports;error.value='';loaded.value=true;emit('history',data);}}
 catch(e){if(alive)error.value=e.message;}
 finally{inFlight=false;if(alive)loading.value=false;}
}
onMounted(()=>{void refresh();timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh(true);},60000);});
onUnmounted(()=>{alive=false;clearInterval(timer);});
const result=computed(()=>closedBrokerTrades(raw.value));
const imported=computed(()=>importedClosedTrades(imports.value));
const assets=computed(()=>[...new Set([...result.value.trades,...imported.value].map(t=>t.symbol))].sort());
const selectedAccounts=computed(()=>statisticsAccounts(props.accounts,account.value));
const selectedIds=computed(()=>new Set(selectedAccounts.value.map(a=>a.id)));
const selectedRows=computed(()=>raw.value.filter(d=>selectedIds.value.has(d.account_id)));
const selectedResult=computed(()=>closedBrokerTrades(selectedRows.value));
const trades=computed(()=>filterBrokerTrades([...selectedResult.value.trades,...imported.value.filter(t=>selectedIds.value.has(t.account_id))].sort((a,b)=>a.closed_at-b.closed_at||a.id.localeCompare(b.id)),{asset:asset.value,currency:currency,from:from.value,to:to.value}));
const performance=computed(()=>tradePerformance(trades.value));
const total=computed(()=>performance.value.net);
const commission=computed(()=>performance.value.commission);
const grouped=computed(()=>Object.fromEntries(['asset','hour','weekday'].map(dim=>[dim,statisticsGroups(trades.value,dim)])));
const hasHistory=id=>sync.value.some(s=>s.account_id===id&&s.last_full_at)||imported.value.some(t=>t.account_id===id);
const coverage=computed(()=>selectedAccounts.value.filter(a=>hasHistory(a.id)));
const problems=computed(()=>sync.value.filter(s=>selectedIds.value.has(s.account_id)&&(s.last_error||s.in_progress)));
const fees=computed(()=>selectedResult.value.unallocated.filter(d=>d.currency===currency).reduce((s,d)=>s+d.profit+d.commission+d.swap+d.fee,0));
const weeks=computed(()=>tradeCalendarWeeks(trades.value));
const weekIndex=computed(()=>Math.max(0,weeks.value.findIndex(w=>w.key===selectedWeek.value)));
const week=computed(()=>weeks.value[weekIndex.value]);
const listed=computed(()=>week.value?.trades??[]);
const breakdown=computed(()=>views.find(v=>v.key===view.value));
watch([account,asset,from,to],()=>{selectedWeek.value='';});
const name=id=>id===ALL_HISTORY_ACCOUNTS?'Alle Konten inklusive inaktiver':props.accounts.find(a=>a.id===id)?.name??id;
const time=ms=>fmtDateTime(ms/1000,{timeZone:'Europe/Berlin'});
const latest=computed(()=>[...sync.value.filter(s=>selectedIds.value.has(s.account_id)).map(s=>s.synced_at),...imports.value.filter(t=>selectedIds.value.has(t.account_id)).map(t=>t.imported_at)].filter(Boolean).sort().at(-1));
</script>
<template><div class="mmt-stat-layout"><MmtTradeExtremes :trades="trades" :account-name="name" :known="Boolean(coverage.length)"/><section class="mmt-panel mmt-statistics" aria-labelledby="mmt-statistics-title">
 <div class="mmt-section-heading"><h2 id="mmt-statistics-title">Trading-Statistik <small v-if="account" class="mmt-muted">· {{name(account)}}</small></h2><ActionButton :disabled="loading" @click="refresh(false)">{{loading?'Lädt …':'Statistik aktualisieren'}}</ActionButton></div>
 <p v-if="error" class="mmt-error" role="alert">Historie nicht aktuell: {{error}}</p>
 <p class="mmt-muted">{{coverage.length}} / {{selectedAccounts.length}} Konten mit eingelesener Historie · {{latest?'Letzter Historienabgleich '+fmtDateTime(latest,{timeZone:'Europe/Berlin',second:'2-digit'}):'Historienabgleich noch nicht bestätigt'}} · Brokerdaten und gekennzeichnete CSV-Importe, inklusive manueller Trades.</p>
 <p v-if="problems.length" class="mmt-error" role="status">Historienimport läuft oder ist gestört. Ergebnisse können noch unvollständig sein.</p>
 <div class="mmt-stat-filters">
  <label>Asset<select v-model="asset"><option value="">Alle Assets</option><option v-for="a in assets" :key="a">{{a}}</option></select></label>
  <label>Abschluss ab<input v-model="from" type="date"></label><label>bis<input v-model="to" type="date"></label>
 </div>
 <p v-if="from&&to&&from>to" role="alert" class="mmt-error">Das Enddatum liegt vor dem Startdatum.</p>
 <div class="mmt-stat-summary"><span>Netto-PnL <strong :class="pnlClass(total)">{{coverage.length?fmtPrice(total,2):'—'}} {{currency}}</strong></span><span>Commission <strong :class="pnlClass(commission)">{{coverage.length?fmtPrice(commission,2):'—'}} {{currency}}</strong></span><span>Trades <strong>{{coverage.length?trades.length:'—'}}</strong></span><span>Ø/Trade <strong :class="pnlClass(total)">{{trades.length?fmtPrice(total/trades.length,2):'—'}} {{currency}}</strong></span><span>Winrate <strong>{{performance.winrate==null?'—':fmtPrice(performance.winrate,0)}} %</strong></span><span>Break-even <strong>{{coverage.length?performance.breakeven:'—'}}</strong></span></div>
 <div class="mmt-stat-tabs" aria-label="Statistik-Ansicht"><ActionButton v-for="item in views" :key="item.key" :aria-pressed="view===item.key" @click="view=item.key">{{item.label}}</ActionButton></div>
 <template v-if="view==='chart'"><EquityChart v-if="coverage.length" :trades="trades" :currency="currency" /><p v-else class="mmt-muted">Diagramm unbekannt: Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.</p></template>
 <template v-else-if="view==='list'">
 <nav v-if="week" class="mmt-stat-pages" aria-label="Kalenderwochen der PnL-Liste">
  <strong>KW {{week.number}}/{{week.year}} · {{fmtDate(week.start)}} – {{fmtDate(week.end)}}</strong>
  <ActionButton :disabled="weekIndex===0" @click="selectedWeek=weeks[weekIndex-1].key">Neuere Woche</ActionButton>
  <span>{{weekIndex+1}} / {{weeks.length}}</span>
  <ActionButton :disabled="weekIndex>=weeks.length-1" @click="selectedWeek=weeks[weekIndex+1].key">Ältere Woche</ActionButton>
 </nav>
 <div class="mmt-stat-table-wrap"><table><thead><tr><th>Entry-Zeit · Berlin</th><th>Konto</th><th>Asset</th><th>Richtung</th><th>Lot</th><th>Commission</th><th>Netto-PnL</th><th>Journal</th></tr></thead><tbody><tr v-for="t in listed" :key="t.id"><td>{{time(t.opened_at)}}</td><td>{{name(t.account_id)}}</td><td><strong>{{t.symbol}}</strong></td><td><span class="trade-direction" :class="t.direction">{{t.direction==='long'?'Long':t.direction==='short'?'Short':'unbekannt'}}</span></td><td>{{fmtPrice(t.volume,4)}}</td><td :class="tradeOutcomeClass(t)?pnlClass(t.commission):''">{{fmtPrice(t.commission,2)}} {{t.currency}}</td><td :class="tradeOutcomeClass(t)" :title="tradeOutcomeClass(t)?undefined:'Break-even vor Kommission'">{{fmtPrice(t.net,2)}} {{t.currency}}</td><td><span v-if="t.source==='csv'" :title="t.source_file">CSV-Import #{{t.source_trade_id}}</span><ActionButton v-else @click="journalTrade=t">Journal / Kommentare</ActionButton></td></tr><tr v-if="!listed.length"><td colspan="8">{{loading?'Brokerhistorie wird geladen …':loaded&&coverage.length?(week?'Keine abgeschlossenen Trades in dieser Kalenderwoche.':'Keine abgeschlossenen Trades für diese Auswahl.'):'Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.'}}</td></tr></tbody></table></div>
 </template>
 <template v-else><Breakdown v-if="coverage.length" :title="breakdown.label" :rows="grouped[view]" :currency="currency"/><p v-else class="mmt-muted">Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.</p></template>
 <MilkyMetaTraderJournal v-if="journalTrade" :trade="journalTrade" :api="api" @close="journalTrade=null" />

 <p class="mmt-muted">Beträge in {{currency||'Kontowährung'}} aus zugeordneten Brokerbuchungen inklusive Commission, Gebühren und Swap bzw. unverändert aus dem CSV-Nettofeld. Die separat gezeigte Commission wird nicht nochmals abgezogen. Assets nach Ø/Trade, Entry-Stunden und Entry-Wochentage chronologisch sortiert; N = Stichprobe. Die Wochenblätterung folgt der Entry-Zeit und begrenzt nur die PnL-Liste. Break-even: −10 bis +10 USD vor Kommission, farblich neutral. Winrate = Gewinne / (Gewinne + Verluste), ohne Break-even. Unterschiedliche Lotgrößen beeinflussen PnL; keine automatische Aussage über die Qualität einer Handelszeit. R-Werte benötigen belegtes initiales Risiko.</p>
 <p v-if="fees" class="mmt-error">Nicht einzelnen Trades zugeordnete Kosten/Buchungen (Konten/Währung, vor Zeit-/Assetfilter): {{fmtPrice(fees,2)}} {{currency}} – separat, nicht im Trade-PnL.</p>
 <p v-if="selectedResult.excluded" class="mmt-error">{{selectedResult.excluded}} Positionsverläufe mit fehlenden Einstiegen, Umkehrungen oder widersprüchlichen Buchungen sind nicht in den Kennzahlen enthalten.</p>
 <details><summary>Datenumfang &amp; ältere Konten</summary><p>Einzahlungen, Resets und sonstige Kontobuchungen sind keine Gewinne aus Trades. Offene/teilgeschlossene Positionen zählen erst nach vollständigem Abschluss. Inaktive Konten bleiben über die Kontenauswahl zugänglich. Weitere Historien nehmen wir anhand ihrer Brokerdaten auf. Ausgewertet wird nur die vom Broker gelieferte Historie; davor liegende Trades sind nicht automatisch enthalten. Andere aktive MT5-Konten werden für den Statistikabruf nicht automatisch umgeschaltet.</p><ul><li v-for="a in selectedAccounts" :key="a.id">{{a.name}} · {{hasHistory(a.id)?'Historie vorhanden':'Historie noch nicht abgerufen'}}<span v-if="a.archive_details?.reconciliation_note"> · {{a.archive_details.reconciliation_note}}</span></li></ul></details>
</section></div></template>
