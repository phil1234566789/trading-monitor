<script setup>
import { computed } from 'vue';
import { comparisonTone } from '../simulationComparisonTone.js';
import { variantMetrics } from '../simulationRunComparison.js';
import { fmtMoney,fmtR } from '../format.js';
import { MIN_SIMULATION_WINRATE_CASES } from '../tradeSetupSimulationStatistics.js';
const props=defineProps({current:Array,previous:Array,compare:Boolean});
const definitions=[['total','Entries','count'],['winrate','Winrate netto','percent'],['pnlUsd','PnL netto · USD','money'],['grossPnlUsd','PnL brutto · USD','money'],['totalR','Summe R netto','r'],['commissionUsd','Kommission · USD','money'],['commissionR','Kommission · R (abgeschlossen)','r']];
const cards=computed(()=>['wide','narrow'].map(variant=>({variant,now:variantMetrics(props.current,variant),old:variantMetrics(props.previous,variant)})));
const format=(n,type)=>n==null?'–':type==='money'?fmtMoney(n):type==='r'?fmtR(n):type==='percent'?`${n.toFixed(1)} %`:n;
const metricValue=(metrics,key,type)=>{
  if(key!=='winrate' || metrics.winrate!=null)return format(metrics[key],type);
  if(!metrics.closed)return '–';
  const flat=metrics.closed-metrics.wins-metrics.losses;
  return `${metrics.wins}W/${metrics.losses}L${flat?`/${flat}BE`:''}`;
};
const delta=(a,b,type)=>a==null||b==null?'–':`${a>b?'↑':a<b?'↓':'→'} ${a-b>=0?'+':'−'}${type==='percent'?`${Math.abs(a-b).toFixed(1)} pp`:type==='count'?Math.abs(a-b):type==='money'?`$${Math.abs(a-b).toFixed(2)}`:`${Math.abs(a-b).toFixed(2)}R`}`;
const tone=(key,value)=>{
  if(value==null || value===0)return '';
  return (key.startsWith('commission')?value<0:value>0)?'positive':'negative';
};
const resultTone=(key,value)=>['pnlUsd','grossPnlUsd','totalR'].includes(key)?tone(key,value):'';
</script>
<template>
  <section class="metric-grid" aria-label="Ergebnis beider SL-Varianten">
    <article v-for="card in cards" :key="card.variant" class="metric-card">
      <h2>{{ card.variant==='wide'?'Weiter SL':'Enger SL' }}</h2>
      <table><thead><tr><th scope="col">50.000 USD Referenz</th><th v-if="compare" scope="col">Alt</th><th scope="col">{{ compare?'Neu':'Wert' }}</th><th v-if="compare" scope="col">Δ</th></tr></thead>
        <tbody><tr v-for="[key,label,type] in definitions" :key="key"><th scope="row" :title="key==='winrate'?'Netto-Gewinne / eindeutig abgeschlossene Entries. W = Gewinn, L = Verlust, BE = ohne Gewinn oder Verlust.':undefined">{{ label }}</th><td v-if="compare" :class="key==='winrate'?card.old.closed?'reference':'':card.old[key]==null?'':'reference'">{{ metricValue(card.old,key,type) }}</td><td :class="compare?comparisonTone(card.now[key],card.old[key],key.startsWith('commission')):resultTone(key,card.now[key])">{{ metricValue(card.now,key,type) }}</td><td v-if="compare" :class="comparisonTone(card.now[key],card.old[key],key.startsWith('commission'))" :title="key.startsWith('commission')?'Weniger Kosten sind günstiger':key==='total'?'Fallzahl, keine Qualitätswertung':'Höherer Wert ist günstiger'">{{ delta(card.now[key],card.old[key],type) }}</td></tr></tbody>
      </table>
      <p v-if="card.now.winrate==null || compare && card.old.winrate==null">Vorläufige Stichprobe. Prozent erst ab {{ MIN_SIMULATION_WINRATE_CASES }} eindeutig abgeschlossenen, ausführbaren Entries.</p>
    </article>
  </section>
</template>
<style scoped>
.negative{color:var(--negative)}
.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.metric-card{padding:16px;background:#1e222d;border:1px solid #434651;border-radius:4px;min-width:0}h2{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px 4px;border-bottom:1px solid #2a2e39}th{text-align:left;font-weight:400}td{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}p{font-size:12px;color:#b1b7c5;line-height:1.6}@media(max-width:768px){.metric-grid{grid-template-columns:1fr}}@media(max-width:400px){.metric-card{padding:8px}th,td{padding:8px 2px;font-size:11px}}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
