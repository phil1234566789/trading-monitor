<script setup>
import {computed} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import MmtTradeExtremes from './MmtTradeExtremes.vue';
import EquityChart from './MilkyMetaTraderEquityChart.vue';
import Breakdown from './MilkyMetaTraderStatisticsBreakdown.vue';
import {RouterLink} from 'vue-router';
import {historyJournalKey,historyJournalRoute} from '../mmtHistoryJournal.js';
import {useMmtStatistics} from '../composables/useMmtStatistics.js';
import {fmtDate,fmtDateTime,fmtPrice,pnlClass} from '../format.js';
import '../milkyMetaTraderStatistics.css';
import {tradeOutcomeClass} from '../milkyMetaTraderPerformance.js';
import {ALL_HISTORY_ACCOUNTS} from '../milkyMetaTraderAccountSelection.js';
const emit=defineEmits(['history']);
const props=defineProps({api:{type:Function,required:true},accounts:{type:Array,default:()=>[]},account:{type:String,default:''},commissionPositions:{type:Array,default:()=>[]}});
const {asset,from,to,outcomes,selectedWeek,offset,extremeLimit,view,summary,page,series,loading,pageLoading,seriesLoading,refreshing,error,selectedAccounts,weeks,weekIndex,week,refresh}=useMmtStatistics(props,emit);
const outcomeOptions=[{key:'win',label:'Gewinner'},{key:'loss',label:'Verlierer'},{key:'breakeven',label:'Break-even'}];
const currency='USD';
const views=[{key:'list',label:'PnL-Liste'},{key:'chart',label:'X–Y-Diagramm'},{key:'asset',label:'Assets'},{key:'hour',label:'Entry-Stunden · Berlin'},{key:'weekday',label:'Entry-Wochentage · Berlin'}];
const linksByPosition=computed(()=>new Map((page.value.journal_links??[]).map(link=>[historyJournalKey(link),link])));
const journalLink=trade=>linksByPosition.value.get(historyJournalKey(trade));
const assets=computed(()=>summary.value?.assets??[]);
const performance=computed(()=>summary.value?.totals??{count:0,net:0,commission:0,breakeven:0,winrate:null});
const total=computed(()=>performance.value.net),commission=computed(()=>performance.value.commission);
const grouped=computed(()=>summary.value?.groups??{}),listed=computed(()=>page.value.rows??[]);
const hasHistory=id=>(summary.value?.coverage??[]).includes(id);
const coverage=computed(()=>selectedAccounts.value.filter(a=>hasHistory(a.id)));
const problems=computed(()=>(summary.value?.sync??[]).filter(s=>selectedAccounts.value.some(a=>a.id===s.account_id)&&(s.last_error||s.in_progress)));
const fees=computed(()=>summary.value?.fees??0),excluded=computed(()=>summary.value?.excluded??0);
const breakdown=computed(()=>views.find(v=>v.key===view.value));
const name=id=>id===ALL_HISTORY_ACCOUNTS?'Alle Konten inklusive inaktiver':props.accounts.find(a=>a.id===id)?.name??id;
const time=ms=>fmtDateTime(ms/1000,{timeZone:'Europe/Berlin'});
const latest=computed(()=>summary.value?.latest);
</script>
<template><div class="mmt-stat-layout"><MmtTradeExtremes :ranked="summary?.extremes" v-model:count="extremeLimit" :account-name="name" :known="Boolean(coverage.length)"/><section class="mmt-panel mmt-statistics" aria-labelledby="mmt-statistics-title">
 <div class="mmt-section-heading"><h2 id="mmt-statistics-title">Trading-Statistik <small v-if="account" class="mmt-muted">· {{name(account)}}</small></h2><ActionButton :disabled="refreshing" @click="refresh()">{{refreshing?'Abgleich läuft …':'Statistik aktualisieren'}}</ActionButton></div>
 <p v-if="error" class="mmt-error" role="alert">Historie nicht aktuell: {{error}}</p>
 <p v-if="problems.length" class="mmt-error" role="status">Historienimport läuft oder ist gestört. Ergebnisse können noch unvollständig sein.</p>
 <details class="mmt-stat-filter-menu"><summary>Filter<span v-if="asset||from||to||outcomes.length<outcomeOptions.length"> · aktiv</span></summary>
 <p class="mmt-muted">{{coverage.length}} / {{selectedAccounts.length}} Konten mit eingelesener Historie · {{latest?'Letzter Historienabgleich '+fmtDateTime(latest,{timeZone:'Europe/Berlin',second:'2-digit'}):'Historienabgleich noch nicht bestätigt'}} · Brokerdaten und gekennzeichnete CSV-Importe, inklusive manueller Trades.</p>
 <div class="mmt-stat-filters">
  <label>Asset<select v-model="asset"><option value="">Alle Assets</option><option v-for="a in assets" :key="a">{{a}}</option></select></label>
  <label>Abschluss ab<input v-model="from" type="date"></label><label>bis<input v-model="to" type="date"></label>
 </div>
 <fieldset class="mmt-outcome-filter"><legend>Ergebnis</legend><label v-for="item in outcomeOptions" :key="item.key"><input v-model="outcomes" type="checkbox" :value="item.key">{{item.label}}</label><span class="mmt-muted">Mehrfachauswahl · vor Kommission</span></fieldset>
 </details>
 <p v-if="!outcomes.length" class="mmt-muted" role="status">Keine Ergebnisart ausgewählt.</p>
 <p v-if="outcomes.length<outcomeOptions.length" class="mmt-muted">Ergebnisfilter aktiv: Alle Kennzahlen und Ansichten beziehen sich nur auf die ausgewählten Ergebnisse.</p>
 <p v-if="from&&to&&from>to" role="alert" class="mmt-error">Das Enddatum liegt vor dem Startdatum.</p>
 <div class="mmt-stat-summary"><span>Netto-PnL <strong :class="pnlClass(total)">{{coverage.length?fmtPrice(total,2):'—'}} {{currency}}</strong></span><span>Commission <strong :class="pnlClass(commission)">{{coverage.length?fmtPrice(commission,2):'—'}} {{currency}}</strong></span><span>Trades <strong>{{coverage.length?performance.count:'—'}}</strong></span><span>Ø/Trade <strong :class="pnlClass(total)">{{performance.count?fmtPrice(performance.average,2):'—'}} {{currency}}</strong></span><span>Winrate <strong>{{performance.winrate==null?'—':fmtPrice(performance.winrate,0)}} %</strong></span><span>Break-even <strong>{{coverage.length?performance.breakeven:'—'}}</strong></span></div>
 <div class="mmt-stat-tabs" aria-label="Statistik-Ansicht"><ActionButton v-for="item in views" :key="item.key" :aria-pressed="view===item.key" @click="view=item.key">{{item.label}}</ActionButton></div>
 <template v-if="view==='chart'"><p v-if="seriesLoading" role="status" class="mmt-muted">Diagramm wird geladen …</p><EquityChart v-if="coverage.length" :trades="series" :currency="currency" /><p v-else class="mmt-muted">Diagramm unbekannt: Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.</p></template>
 <template v-else-if="view==='list'">
 <nav v-if="week" class="mmt-stat-pages" aria-label="Kalenderwochen der PnL-Liste">
  <strong>KW {{week.number}}/{{week.year}} · {{fmtDate(week.start)}} – {{fmtDate(week.end)}}</strong>
  <ActionButton :disabled="weekIndex===0||loading||pageLoading" @click="selectedWeek=weeks[weekIndex-1].key">Neuere Woche</ActionButton>
  <span>{{weekIndex+1}} / {{weeks.length}}</span>
  <ActionButton :disabled="weekIndex>=weeks.length-1||loading||pageLoading" @click="selectedWeek=weeks[weekIndex+1].key">Ältere Woche</ActionButton>
 </nav>
 <nav v-if="page.total>100" class="mmt-stat-pages" aria-label="Positionen dieser Woche">
  <ActionButton :disabled="offset===0||loading||pageLoading" @click="offset=Math.max(0,offset-100)">Vorherige Positionen</ActionButton>
  <span>{{offset+1}}–{{Math.min(offset+listed.length,page.total)}} / {{page.total}}</span>
  <ActionButton :disabled="page.next_offset==null||loading||pageLoading" @click="offset=page.next_offset">Weitere Positionen</ActionButton>
 </nav>
 <div class="mmt-stat-table-wrap" :aria-busy="loading||pageLoading"><table><thead><tr><th>Entry-Zeit · Berlin</th><th>Konto</th><th>Asset</th><th>Richtung</th><th>Lot</th><th>Commission</th><th>Netto-PnL</th><th>Journal</th></tr></thead><tbody><tr v-for="t in listed" :key="t.id"><td>{{time(t.opened_at)}}</td><td>{{name(t.account_id)}}</td><td><strong>{{t.symbol}}</strong></td><td><span class="trade-direction" :class="t.direction">{{t.direction==='long'?'Long':t.direction==='short'?'Short':'unbekannt'}}</span></td><td>{{fmtPrice(t.volume,4)}}</td><td :class="tradeOutcomeClass(t)?pnlClass(t.commission):''">{{fmtPrice(t.commission,2)}} {{t.currency}}</td><td :class="tradeOutcomeClass(t)" :title="tradeOutcomeClass(t)?undefined:'Break-even vor Kommission'">{{fmtPrice(t.net,2)}} {{t.currency}}</td><td><ActionButton v-if="historyJournalRoute(journalLink(t))" :as="RouterLink" :to="historyJournalRoute(journalLink(t))" target="_blank" rel="noopener noreferrer" :aria-label="`DR #${journalLink(t).trade_positions.dealing_range_id} in neuem Tab öffnen`">DR #{{journalLink(t).trade_positions.dealing_range_id}}</ActionButton><span v-else title="Keine Dealing Range zugeordnet">—</span> <span v-if="t.source==='csv'" :title="t.source_file">CSV-Import #{{t.source_trade_id}}</span></td></tr><tr v-if="!listed.length"><td colspan="8">{{loading||pageLoading?'Statistik wird geladen …':summary&&coverage.length?(week?'Keine abgeschlossenen Trades in dieser Kalenderwoche.':'Keine abgeschlossenen Trades für diese Auswahl.'):'Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.'}}</td></tr></tbody></table></div>
 </template>
 <template v-else><Breakdown v-if="coverage.length" :title="breakdown.label" :rows="grouped[view]" :currency="currency"/><p v-else class="mmt-muted">Noch keine Brokerhistorie für diese Kontenauswahl eingelesen.</p></template>

 <p class="mmt-muted">Beträge in {{currency||'Kontowährung'}} aus zugeordneten Brokerbuchungen inklusive Commission, Gebühren und Swap bzw. unverändert aus dem CSV-Nettofeld. Die separat gezeigte Commission wird nicht nochmals abgezogen. Assets nach Ø/Trade, Entry-Stunden und Entry-Wochentage chronologisch sortiert; N = Stichprobe. Die Wochenblätterung folgt der Entry-Zeit und begrenzt nur die PnL-Liste. Break-even: −10 bis +10 USD vor Kommission, farblich neutral. Winrate = Gewinne / (Gewinne + Verluste), ohne Break-even. Unterschiedliche Lotgrößen beeinflussen PnL; keine automatische Aussage über die Qualität einer Handelszeit. R-Werte benötigen belegtes initiales Risiko.</p>
 <p v-if="fees" class="mmt-error">Nicht einzelnen Trades zugeordnete Kosten/Buchungen (Konten/Währung, vor Zeit-/Assetfilter): {{fmtPrice(fees,2)}} {{currency}} – separat, nicht im Trade-PnL.</p>
 <p v-if="excluded" class="mmt-error">{{excluded}} Positionsverläufe mit fehlenden Einstiegen, Umkehrungen oder widersprüchlichen Buchungen sind nicht in den Kennzahlen enthalten.</p>
 <details><summary>Datenumfang &amp; ältere Konten</summary><p>Einzahlungen, Resets und sonstige Kontobuchungen sind keine Gewinne aus Trades. Offene/teilgeschlossene Positionen zählen erst nach vollständigem Abschluss. Inaktive Konten bleiben über die Kontenauswahl zugänglich. Weitere Historien nehmen wir anhand ihrer Brokerdaten auf. Ausgewertet wird nur die vom Broker gelieferte Historie; davor liegende Trades sind nicht automatisch enthalten. Andere aktive MT5-Konten werden für den Statistikabruf nicht automatisch umgeschaltet.</p><ul><li v-for="a in selectedAccounts" :key="a.id">{{a.name}} · {{hasHistory(a.id)?'Historie vorhanden':'Historie noch nicht abgerufen'}}<span v-if="a.archive_details?.reconciliation_note"> · {{a.archive_details.reconciliation_note}}</span></li></ul></details>
</section></div></template>
