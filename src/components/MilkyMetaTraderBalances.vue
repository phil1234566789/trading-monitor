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
  <div class="mmt-balance-list" tabindex="0" role="region" aria-label="Konten horizontal scrollen">
  <article v-for="row in rows" :key="row.account.id" class="mmt-balance-card" :data-selected="row.account.id===activeId" :aria-label="row.account.name+' · '+row.account.login">
   <div class="mmt-balance-heading">
    <strong>{{row.account.name}}</strong>
    <div><small class="mmt-muted">{{row.account.login}}</small> <small v-if="row.account.id===activeId" class="mmt-selected">Handelskonto ausgewählt</small><small v-else class="mmt-muted">Nicht ausgewählt</small></div>
   </div>
   <div class="mmt-balance-gauge" role="img" :aria-label="'Balance '+money(row.balance,row.currency)+', Verlustgrenze '+money(row.loss_floor,row.currency)+', Ziel '+money(row.target,row.currency)">
    <svg viewBox="0 0 220 122" aria-hidden="true">
     <path class="mmt-balance-arc" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" />
     <path v-if="row.position!=null&&row.position>0" class="mmt-balance-fill" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" :stroke-dasharray="row.position+' 100'" />
    </svg>
    <div class="mmt-balance-value"><small>Balance <span v-if="row.currency">{{row.currency}}</span></small><strong>{{money(row.balance,row.currency)}}</strong><small v-if="row.position==null">Skala unbekannt</small></div>
   </div>
   <div class="mmt-balance-ends"><span>Verlustgrenze<strong>{{money(row.loss_floor,row.currency)}}</strong></span><span>Ziel<strong>{{money(row.target,row.currency)}}</strong></span></div>
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
  </div>
 </section>
</template>

<style scoped>
.mmt-balances{margin:1rem 0;font-variant-numeric:tabular-nums}
.mmt-balance-note{margin:0;font-size:.8rem}
.mmt-balance-list{display:grid;grid-auto-flow:column;grid-auto-columns:max(230px,calc((100% - 1.5rem)/4));gap:.5rem;overflow-x:auto;align-items:start;padding:.5rem 0;scroll-snap-type:x proximity}
.mmt-balance-list:focus-visible{outline:2px solid var(--mmt-accent);outline-offset:2px}
.mmt-balance-card{min-width:0;border:1px solid var(--mmt-border);border-radius:6px;padding:.75rem;background:var(--mmt-surface);scroll-snap-align:start}
.mmt-balance-card[data-selected="true"]{border-color:var(--mmt-positive)}
.mmt-balance-heading{display:grid;gap:.25rem;min-height:2.75rem;margin-bottom:.25rem}
.mmt-balance-heading strong{overflow-wrap:anywhere}
.mmt-balance-heading small{font-weight:normal}
.mmt-balance-gauge{position:relative;width:220px;max-width:100%;margin:0 auto}
.mmt-balance-gauge svg{display:block;width:100%;overflow:visible}
.mmt-balance-arc,.mmt-balance-fill{fill:none;stroke-width:14;stroke-linecap:round}
.mmt-balance-arc{stroke:var(--mmt-border)}.mmt-balance-fill{stroke:var(--mmt-positive)}
.mmt-balance-value{position:absolute;top:52%;left:0;right:0;display:grid;gap:.25rem;text-align:center;line-height:1.1}
.mmt-balance-value small{font-size:.7rem;color:var(--mmt-muted)}.mmt-balance-value strong{font-size:1.1rem}
.mmt-balance-ends{display:flex;justify-content:space-between;gap:.5rem;font-size:.7rem;color:var(--mmt-muted)}
.mmt-balance-ends span:last-child{text-align:right}.mmt-balance-ends strong{display:block;font-weight:normal;color:inherit}
.mmt-balance-details{display:grid;gap:.25rem;margin-top:.75rem;font-size:.75rem}
.positive{color:var(--mmt-positive)}.negative{color:var(--mmt-negative)}
.mmt-balance-source{font-size:.7rem;color:var(--mmt-muted);margin-top:.25rem;overflow-wrap:anywhere}
.mmt-balance-source summary{cursor:pointer}.mmt-balance-source p{margin:.25rem 0}
</style>
