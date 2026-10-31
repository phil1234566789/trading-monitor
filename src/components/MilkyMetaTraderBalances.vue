<script setup>
import {computed} from 'vue';
import {fmtMoney,fmtPrice,fmtDateTime,pnlClass} from '../format.js';
import {closedBrokerTrades} from '../milkyMetaTraderStatistics.js';
import {accountBalance,accountPerformance,balancePosition} from '../milkyMetaTraderBalances.js';
import {snapshotAgeSeconds} from '../milkyMetaTraderMonitoring.js';
const props=defineProps({accounts:Array,activeId:String,status:Object,history:Object,now:Number,staleSeconds:Number});
const result=computed(()=>closedBrokerTrades(props.history?.rows??[]));
const rows=computed(()=>(props.accounts??[]).map(account=>{
 const value=accountBalance(account,props.status?.account_balances?.find(s=>s.account_id===account.id),props.status?.bridge);
 const sync=props.history?.sync?.find(s=>s.account_id===account.id);
 const stats=accountPerformance(account.id,value.currency,result.value,sync);
 const age=snapshotAgeSeconds(value.balance_at,props.now);
 return {account,...value,stats,sync,position:balancePosition(value.balance,value.loss_floor,value.target),
  fresh:value.balance_source==='MT5-Worker'&&age!=null&&age<=props.staleSeconds&&Date.parse(value.balance_at)<=props.now};
}));
const time=value=>fmtDateTime(value,{year:'numeric',timeZone:'Europe/Berlin'});
const money=(value,currency)=>value==null?'unbekannt':fmtMoney(value,currency);
</script>

<template>
 <section class="mmt-balances" aria-label="Balance aller gespeicherten Konten">
  <p class="mmt-muted mmt-balance-note">Balance zwischen Verlustgrenze und Challengeziel. Maßgeblich für das Verlustrisiko ist die Equity. Der Worker liest nur das ausgewählte Konto.</p>
  <article v-for="row in rows" :key="row.account.id" class="mmt-balance-row" :data-selected="row.account.id===activeId" :aria-label="row.account.name+' · '+row.account.login">
   <div class="mmt-balance-heading">
    <div><strong>{{row.account.name}}</strong> <small class="mmt-muted">{{row.account.login}}</small> <small v-if="row.account.id===activeId" class="mmt-selected">Handelskonto ausgewählt</small></div>
    <strong>Balance {{money(row.balance,row.currency)}} <small v-if="row.currency">{{row.currency}}</small></strong>
   </div>
   <div class="mmt-balance-track" role="img" :aria-label="'Balance '+money(row.balance,row.currency)+', Verlustgrenze '+money(row.loss_floor,row.currency)+', Ziel '+money(row.target,row.currency)">
    <template v-if="row.position!=null"><span class="mmt-balance-fill" :style="{width:row.position+'%'}"></span><span class="mmt-balance-marker" :style="{left:row.position+'%'}"></span></template>
    <span v-else class="mmt-balance-unavailable">Skala unbekannt</span>
   </div>
   <div class="mmt-balance-ends"><span>Verlustgrenze {{money(row.loss_floor,row.currency)}}</span><span>Ziel {{money(row.target,row.currency)}}</span></div>
   <div class="mmt-balance-details">
    <span>Netto-PnL <strong :class="pnlClass(row.stats.net)">{{money(row.stats.net,row.currency)}}</strong></span>
    <span>Winrate <strong>{{row.stats.winrate==null?'unbekannt':fmtPrice(row.stats.winrate,1)+' %'}}</strong> · {{row.stats.count}} belegte Abschlüsse</span>
    <span>Equity {{money(row.equity,row.currency)}}</span>
    <span>Positionen {{row.positions??'unbekannt'}}</span>
    <span v-if="row.account.id===activeId">Laufende Aufträge {{status?.orders?.filter(o=>['searching','sending','unknown'].includes(o.status)).length??'unbekannt'}}</span>
   </div>
   <p v-if="row.balance!=null&&row.loss_floor!=null&&row.balance<row.loss_floor" class="mmt-error">Balance unter der zuletzt bestätigten Verlustgrenze.</p>
   <p v-else-if="row.balance!=null&&row.target!=null&&row.balance>row.target" class="mmt-muted">Balance über dem Challengeziel.</p>
   <details class="mmt-balance-source"><summary>{{row.fresh?'Aktueller Workerstand':'Letzter bekannter Stand'}} · {{row.balance_at?time(row.balance_at)+' (Berlin)':'Zeitpunkt unbekannt'}} · {{row.balance_source??'Quelle unbekannt'}}</summary>
    <p>Limits: {{row.limits_source??'unbekannt'}} · {{row.limits_at?time(row.limits_at)+' (Berlin)':'Zeitpunkt unbekannt'}}. Portalzeit = manuelle Übernahmezeit; Broker-Aktualisierungszeit unbekannt. Keine automatische Fortschreibung der EOD-Trailing-Grenze.</p>
    <p>Netto-PnL und Winrate aus belegten abgeschlossenen Brokertrades einschließlich bekannter Gebühren; Einzahlungen und Resets zählen nicht als Gewinn. Historienabgleich: {{row.sync?.synced_at?time(row.sync.synced_at)+' (Berlin)':'unbekannt'}}. {{row.sync?.last_full_at?'Vollabruf vorhanden.':'Nur Teilstand / Vollständigkeit unbekannt.'}} <span v-if="row.sync?.last_error||row.sync?.in_progress">Historienabgleich ausstehend oder gestört.</span></p>
   </details>
  </article>
 </section>
</template>

<style scoped>
.mmt-balances{display:grid;gap:.5rem;margin:1rem 0;font-variant-numeric:tabular-nums}
.mmt-balance-note{margin:0;font-size:.8rem}
.mmt-balance-row{min-width:0;border:1px solid var(--mmt-border);border-radius:6px;padding:.75rem;background:var(--mmt-surface)}
.mmt-balance-row[data-selected="true"]{border-left:3px solid var(--mmt-positive)}
.mmt-balance-heading,.mmt-balance-ends{display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap}
.mmt-balance-heading{align-items:baseline;margin-bottom:.5rem}
.mmt-balance-heading strong{overflow-wrap:anywhere}
.mmt-balance-heading small{font-weight:normal}
.mmt-balance-track{position:relative;height:.65rem;background:var(--mmt-border);border-radius:3px;overflow:hidden}
.mmt-balance-fill{position:absolute;inset:0 auto 0 0;background:var(--mmt-positive);opacity:.55}
.mmt-balance-marker{position:absolute;top:0;bottom:0;width:3px;background:currentColor;transform:translateX(-50%)}
.mmt-balance-unavailable{display:block;text-align:center;font-size:.65rem;line-height:.65rem}
.mmt-balance-ends{font-size:.75rem;margin-top:.25rem;color:var(--mmt-muted)}
.mmt-balance-details{display:flex;gap:.25rem 1rem;flex-wrap:wrap;margin-top:.5rem;font-size:.8rem}
.positive{color:var(--mmt-positive)}.negative{color:var(--mmt-negative)}
.mmt-balance-source{font-size:.7rem;color:var(--mmt-muted);margin-top:.25rem;overflow-wrap:anywhere}
.mmt-balance-source summary{cursor:pointer}.mmt-balance-source p{margin:.25rem 0}
@media(max-width:480px){.mmt-balance-row{padding:.5rem}.mmt-balance-heading{display:grid}.mmt-balance-ends{font-size:.7rem}}
</style>
