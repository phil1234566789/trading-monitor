<script setup>
import {computed} from 'vue';
import {fmtMoney,fmtPrice,fmtDateTime} from '../format.js';
import {closedBrokerTrades} from '../milkyMetaTraderStatistics.js';
import {accountBalance,accountPerformance,challengeGauge,balanceHealth} from '../milkyMetaTraderBalances.js';
import {snapshotAgeSeconds} from '../milkyMetaTraderMonitoring.js';
const props=defineProps({accounts:Array,activeId:String,status:Object,history:Object,now:Number,staleSeconds:Number});
const result=computed(()=>closedBrokerTrades(props.history?.rows??[]));
const rows=computed(()=>(props.accounts??[]).map(account=>{
 const value=accountBalance(account,props.status?.account_balances?.find(s=>s.account_id===account.id),props.status?.bridge);
 const sync=props.history?.sync?.find(s=>s.account_id===account.id);
 const stats=accountPerformance(account.id,value.currency,result.value,sync);
 const age=snapshotAgeSeconds(value.balance_at,props.now);
 const fresh=value.balance_source==='MT5-Worker'&&age!=null&&age<=props.staleSeconds&&Date.parse(value.balance_at)<=props.now;
 return {account,...value,stats,gauge:challengeGauge(value.balance,value.loss_floor,value.target),health:balanceHealth(props.status,fresh,account,props.now)};
}));
const time=value=>fmtDateTime(value,{year:'numeric',timeZone:'Europe/Berlin'});
const money=(value,currency)=>value==null?'unbekannt':fmtMoney(value,currency);
</script>

<template>
 <section class="mmt-balances" aria-label="Balance aller gespeicherten Konten">
  <div class="mmt-balance-list" tabindex="0" role="region" aria-label="Konten horizontal scrollen">
  <article v-for="row in rows" :key="row.account.id" class="mmt-balance-card" :data-selected="row.account.id===activeId" :aria-label="row.account.name+' · '+row.account.login">
   <div class="mmt-balance-heading">
    <strong>{{row.account.name}}</strong>
    <div><small class="mmt-muted">{{row.account.login}}</small> <small v-if="row.account.id===activeId" class="mmt-selected">Aktives Handelskonto</small><small v-else class="mmt-muted">Nicht ausgewählt</small></div>
   </div>
   <div class="mmt-balance-gauge" role="img" :aria-label="'Balance '+money(row.balance,row.currency)+', Verlustgrenze '+money(row.loss_floor,row.currency)+', Ziel '+money(row.target,row.currency)+', Challenge-Fortschritt '+(row.gauge.progress==null?'unbekannt':fmtPrice(row.gauge.progress,1)+' Prozent')">
    <svg viewBox="0 0 220 122" aria-hidden="true">
     <path class="mmt-balance-arc" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" />
     <path v-if="row.gauge.gain>0" class="mmt-balance-fill" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" :stroke-dasharray="row.gauge.gain+' 100'" :stroke-dashoffset="-row.gauge.start" />
     <path v-if="row.gauge.floor!=null" class="mmt-balance-risk" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" :stroke-dasharray="row.gauge.floor+' 100'" />
     <line v-if="row.gauge.floor!=null" class="mmt-balance-floor-marker" x1="3" y1="110" x2="25" y2="110" :transform="'rotate('+(row.gauge.floor*1.8)+' 110 110)'" />
     <line v-if="row.gauge.start!=null" class="mmt-balance-start" x1="5" y1="110" x2="23" y2="110" :transform="'rotate('+(row.gauge.start*1.8)+' 110 110)'" />
     <line v-if="row.gauge.position!=null" class="mmt-balance-pointer" :class="{negative:row.gauge.position<row.gauge.start}" x1="0" y1="110" x2="30" y2="110" :transform="'rotate('+(row.gauge.position*1.8)+' 110 110)'" />
    </svg>
    <div class="mmt-balance-value"><small>Balance <span v-if="row.currency">{{row.currency}}</span></small><strong>{{money(row.balance,row.currency)}}</strong><small>{{row.gauge.progress==null?'Fortschritt unbekannt':fmtPrice(row.gauge.progress,1)+' % vom Challengeziel'}}</small></div>
   </div>
   <div class="mmt-balance-ends"><span>Skala<strong>{{money(row.gauge.scaleFloor,row.currency)}}</strong></span><span>Start<strong>50.000</strong></span><span>Ziel<strong>{{money(row.target,row.currency)}}</strong></span></div>
   <div class="mmt-balance-details">
    <span class="mmt-balance-floor" :title="'Quelle: '+(row.limits_source??'unbekannt')+' · '+(row.limits_at?time(row.limits_at):'Stand unbekannt')">Verlustgrenze {{money(row.loss_floor,row.currency)}}</span>
    <span>Winrate <strong>{{row.stats.winrate==null?'unbekannt':fmtPrice(row.stats.winrate,1)+' %'}}</strong><template v-if="row.stats.winrate!=null"> · {{row.stats.count}} Trades</template></span>
    <span v-if="row.account.id===activeId" class="mmt-balance-health" :data-ok="row.health.ok" :role="row.health.ok?'status':'alert'">{{row.health.ok?'●':'⚠'}} {{row.health.label}}</span>
    <span v-else class="mmt-muted" :title="row.balance_at?time(row.balance_at)+' (Berlin)':'Zeitpunkt unbekannt'">Gespeicherter Stand</span>
   </div>
   <p v-if="row.balance!=null&&row.loss_floor!=null&&row.balance<row.loss_floor" class="mmt-error">Balance unter der zuletzt bestätigten Verlustgrenze.</p>
   <p v-else-if="row.balance!=null&&row.target!=null&&row.balance>row.target" class="mmt-muted">Balance über dem Challengeziel.</p>

  </article>
  </div>
 </section>
</template>

<style scoped>
.mmt-balances{margin:1rem 0;font-variant-numeric:tabular-nums}
.mmt-balance-list{display:grid;grid-auto-flow:column;grid-auto-columns:max(230px,calc((100% - 1.5rem)/4));gap:.5rem;overflow-x:auto;align-items:start;padding:.5rem 0;scroll-snap-type:x proximity}
.mmt-balance-list:focus-visible{outline:2px solid var(--mmt-accent);outline-offset:2px}
.mmt-balance-card{min-width:0;border:1px solid var(--mmt-border);border-radius:6px;padding:.75rem;background:var(--mmt-surface);scroll-snap-align:start}
.mmt-balance-card[data-selected="true"]{border-color:var(--mmt-positive)}
.mmt-balance-heading{display:grid;gap:.25rem;min-height:2.75rem;margin-bottom:.25rem}
.mmt-balance-heading strong{overflow-wrap:anywhere}
.mmt-balance-heading small{font-weight:normal}
.mmt-balance-gauge{position:relative;width:220px;max-width:100%;margin:0 auto}
.mmt-balance-gauge svg{display:block;width:100%;overflow:visible}
.mmt-balance-arc,.mmt-balance-risk,.mmt-balance-fill{fill:none;stroke-width:14}.mmt-balance-arc{stroke-linecap:round}
.mmt-balance-arc{stroke:var(--mmt-border)}.mmt-balance-fill{stroke:var(--mmt-positive)}.mmt-balance-risk{stroke:var(--mmt-negative);opacity:.25}.mmt-balance-start{stroke:var(--mmt-muted);stroke-width:2}.mmt-balance-floor-marker{stroke:var(--mmt-negative);stroke-width:2}.mmt-balance-pointer{stroke:var(--mmt-positive);stroke-width:3}.mmt-balance-pointer.negative{stroke:var(--mmt-negative)}
.mmt-balance-value{position:absolute;top:52%;left:0;right:0;display:grid;gap:.25rem;text-align:center;line-height:1.1}
.mmt-balance-value small{font-size:.7rem;color:var(--mmt-muted)}.mmt-balance-value strong{font-size:1.1rem}
.mmt-balance-ends{display:flex;justify-content:space-between;gap:.5rem;font-size:.7rem;color:var(--mmt-muted)}
.mmt-balance-ends span:nth-child(2){text-align:center}.mmt-balance-floor{color:var(--mmt-negative)}
.mmt-balance-ends span:last-child{text-align:right}.mmt-balance-ends strong{display:block;font-weight:normal;color:inherit}
.mmt-balance-details{display:grid;gap:.25rem;margin-top:.75rem;font-size:.75rem}
.mmt-balance-health{color:var(--mmt-negative)}.mmt-balance-health[data-ok="true"]{color:var(--mmt-positive)}
</style>
