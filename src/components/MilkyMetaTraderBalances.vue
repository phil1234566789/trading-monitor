<script setup>
import {computed} from 'vue';
import ToggleButton from './ui/ToggleButton.vue';
import ArchivedAccounts from './MmtArchivedAccounts.vue';
import {fmtMoney,fmtPrice,fmtDateTime} from '../format.js';
import {closedBrokerTrades} from '../milkyMetaTraderStatistics.js';
import {accountBalance,accountPerformance,challengeGauge,balanceHealth} from '../milkyMetaTraderBalances.js';
import {snapshotAgeSeconds} from '../milkyMetaTraderMonitoring.js';
const statisticsAccount=defineModel('statisticsAccount',{type:String,default:''});
const props=defineProps({accounts:Array,activeId:String,status:Object,history:Object,now:Number,staleSeconds:Number});
const result=computed(()=>closedBrokerTrades(props.history?.rows??[]));
const rows=computed(()=>(props.accounts??[]).filter(a=>!a.archived).map(account=>{
 const value=accountBalance(account,props.status?.account_balances?.find(s=>s.account_id===account.id),props.status?.bridge);
 const sync=props.history?.sync?.find(s=>s.account_id===account.id);
 const stats=accountPerformance(account.id,value.currency,result.value,sync);
 const age=snapshotAgeSeconds(value.balance_at,props.now);
 const fresh=value.balance_source==='MT5-Worker'&&age!=null&&age<=props.staleSeconds&&Date.parse(value.balance_at)<=props.now;
 const readerFresh=value.balance_source==='MT5-Reader'&&age!=null&&age>=0&&age<=90;
 return {account,...value,stats,readerFresh,gauge:challengeGauge(value.balance,value.loss_floor,value.target),health:balanceHealth(props.status,fresh,account,props.now)};
}));
const time=value=>fmtDateTime(value,{year:'numeric',timeZone:'Europe/Berlin'});
const money=(value,currency)=>value==null?'unbekannt':fmtMoney(value,currency);
const limitsTitle=row=>'Quelle: '+(row.limits_source??'unbekannt')+' · '+(row.limits_at?time(row.limits_at)+' (Berlin)':'Stand unbekannt');
</script>

<template>
 <section class="mmt-balances" aria-label="Balance aller gespeicherten Konten">
  <div class="mmt-balance-selection"><span class="mmt-muted">Statistik nach Konto</span><ToggleButton variant="bordered" :class="{active:!statisticsAccount}" :aria-pressed="!statisticsAccount" @click="statisticsAccount=''">Alle aktive Konten</ToggleButton><ArchivedAccounts v-model:account="statisticsAccount" :accounts="accounts" /></div>
  <div class="mmt-balance-list" tabindex="0" role="region" aria-label="Konten horizontal scrollen">
  <article v-for="row in rows" :key="row.account.id" class="mmt-balance-card" :data-statistics-selected="row.account.id===statisticsAccount" :aria-label="row.account.name+' · '+row.account.login">
   <button type="button" class="mmt-balance-select" :aria-label="'Statistik: '+row.account.name" :aria-pressed="row.account.id===statisticsAccount" :title="'Verlustgrenze: '+money(row.loss_floor,row.currency)+' · '+limitsTitle(row)" @click="statisticsAccount=row.account.id"></button>
   <div class="mmt-balance-heading">
    <strong>{{row.account.name}}</strong>
    <span v-if="row.account.id===activeId" class="mmt-balance-health" :data-ok="row.health.ok" :role="row.health.ok?'status':'alert'">{{row.health.ok?'●':'⚠'}} {{row.health.label}}</span>
    <small v-else class="mmt-muted mmt-balance-saved" :title="row.balance_at?time(row.balance_at)+' (Berlin)':'Zeitpunkt unbekannt'">{{row.readerFresh?'Daten aktuell':'Gespeicherter Stand'}}</small>
    <div><small class="mmt-muted">{{row.account.login}}</small> <small v-if="row.account.id===activeId" class="mmt-selected">Aktives Handelskonto</small><small v-else class="mmt-muted">Handel: nicht gewählt</small></div>
   </div>
   <div class="mmt-balance-gauge" role="group" :aria-label="'Balance '+money(row.balance,row.currency)+', Verlustgrenze '+money(row.loss_floor,row.currency)+', Ziel '+money(row.target,row.currency)+', Challenge-Fortschritt '+(row.gauge.progress==null?'unbekannt':fmtPrice(row.gauge.progress,1)+' Prozent')">
    <svg viewBox="-64 -32 348 154" aria-hidden="true">
     <path class="mmt-balance-arc" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" />
     <path v-if="row.gauge.gain>0" class="mmt-balance-fill" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" :stroke-dasharray="row.gauge.gain+' 100'" :stroke-dashoffset="-row.gauge.start" />
     <path v-if="row.gauge.floor!=null" class="mmt-balance-risk" d="M 14 110 A 96 96 0 0 1 206 110" pathLength="100" :stroke-dasharray="row.gauge.floor+' 100'" />
     <line v-if="row.gauge.floor!=null" class="mmt-balance-floor-marker" x1="3" y1="110" x2="25" y2="110" :transform="'rotate('+(row.gauge.floor*1.8)+' 110 110)'" />
     <line v-if="row.gauge.start!=null" class="mmt-balance-start" x1="5" y1="110" x2="23" y2="110" :transform="'rotate('+(row.gauge.start*1.8)+' 110 110)'" />
     <line v-if="row.gauge.position!=null" class="mmt-balance-pointer" :class="{negative:row.gauge.position<row.gauge.start}" x1="0" y1="110" x2="30" y2="110" :transform="'rotate('+(row.gauge.position*1.8)+' 110 110)'" />
     <text v-if="row.gauge.floorLabel" class="mmt-balance-floor-label" :x="row.gauge.floorLabel.x" :y="row.gauge.floorLabel.y" text-anchor="middle"><title>{{limitsTitle(row)}}</title><tspan :x="row.gauge.floorLabel.x">Verlustgrenze</tspan><tspan :x="row.gauge.floorLabel.x" dy="12">{{money(row.loss_floor,row.currency)}}</tspan></text>
    </svg>
    <div class="mmt-balance-value"><strong>{{money(row.balance,row.currency)}}</strong><small>{{row.gauge.progress==null?'Fortschritt unbekannt':fmtPrice(row.gauge.progress,1)+' % geschafft'}}</small><small>Winrate <strong>{{row.stats.winrate==null?'unbekannt':fmtPrice(row.stats.winrate,1)+' %'}}</strong><template v-if="row.stats.winrate!=null"> · {{row.stats.count}} Trades</template></small><small v-if="row.loss_floor==null" class="mmt-balance-floor">Verlustgrenze unbekannt</small></div>
   </div>
   <div class="mmt-balance-ends"><span>Skala<strong>{{money(row.gauge.scaleFloor,row.currency)}}</strong></span><span>Start<strong>50.000</strong></span><span>Ziel<strong>{{money(row.target,row.currency)}}</strong></span></div>

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
.mmt-balance-card{position:relative;min-width:0;border:1px solid var(--mmt-border);border-radius:6px;padding:.75rem;background:var(--mmt-surface);scroll-snap-align:start}
.mmt-balance-card[data-statistics-selected="true"]{border-color:var(--mmt-accent);box-shadow:inset 0 0 0 1px var(--mmt-accent)}
.mmt-balance-selection{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;font-size:11px}
.mmt-balance-selection>span{margin-right:auto}
.mmt-balance-select{position:absolute;z-index:1;inset:0;width:100%;height:100%;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}
.mmt-balance-select:hover{box-shadow:inset 0 0 0 1px var(--mmt-accent)}
.mmt-balance-select:focus-visible{outline:2px solid var(--mmt-accent);outline-offset:2px}
.mmt-balance-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.25rem .5rem;min-height:2.75rem;margin-bottom:.25rem;align-items:start}.mmt-balance-heading>div{grid-column:1/-1}.mmt-balance-heading>.mmt-balance-health,.mmt-balance-saved{text-align:right;max-width:110px;font-size:.65rem}
.mmt-balance-heading strong{overflow-wrap:anywhere}
.mmt-balance-heading small{font-weight:normal}
.mmt-balance-gauge{position:relative;width:320px;max-width:100%;min-height:120px;margin:0 auto}
.mmt-balance-gauge svg{display:block;width:100%;overflow:visible}
.mmt-balance-arc,.mmt-balance-risk,.mmt-balance-fill{fill:none;stroke-width:14}.mmt-balance-arc{stroke-linecap:round}
.mmt-balance-arc{stroke:var(--mmt-border)}.mmt-balance-fill{stroke:var(--mmt-positive)}.mmt-balance-risk{stroke:var(--mmt-negative);opacity:.25}.mmt-balance-start{stroke:var(--mmt-muted);stroke-width:2}.mmt-balance-floor-marker{stroke:var(--mmt-negative);stroke-width:2}.mmt-balance-pointer{stroke:var(--mmt-positive);stroke-width:3}.mmt-balance-pointer.negative{stroke:var(--mmt-negative)}
.mmt-balance-value{position:absolute;top:57%;left:18%;right:18%;display:grid;gap:.25rem;text-align:center;line-height:1.1}
.mmt-balance-value small{font-size:.7rem;color:var(--mmt-muted)}.mmt-balance-value>strong{font-size:1.1rem}.mmt-balance-value small strong{font-size:inherit}
.mmt-balance-ends{display:flex;justify-content:space-between;gap:.5rem;font-size:.7rem;color:var(--mmt-muted)}
.mmt-balance-ends span:nth-child(2){text-align:center}.mmt-balance-floor{color:var(--mmt-negative)}
.mmt-balance-ends span:last-child{text-align:right}.mmt-balance-ends strong{display:block;font-weight:normal;color:inherit}
.mmt-balance-floor-label{fill:var(--mmt-negative);font:11px system-ui}
.mmt-balance-health{color:var(--mmt-negative)}.mmt-balance-health[data-ok="true"]{color:var(--mmt-positive)}
</style>
