<script setup>
import {dobPct,dobSignedR} from '../dobTradeStatistics.js';
// Simulationskonto in R: je Spalte (Halbjahre, gesamt) ΣR groß, darunter Trades/Wins/Losses/Winrate, offen und unklar klein.
// columns: [{label, stats (dobTotalStats), delta?: {sumR, winratePp}}]
defineProps({title:String,subtitle:String,columns:Array});
const pp=v=>v==null?'–':`${v>0?'+':v<0?'−':'±'}${Math.abs(v).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} Pkt`;
const tone=v=>v>0?'positive':v<0?'negative':'';
</script>
<template>
  <article class="account">
    <h2>{{ title }}</h2>
    <p class="subtitle">{{ subtitle }}</p>
    <div class="columns">
      <div v-for="c in columns" :key="c.label" class="column" :class="{total:c.total}">
        <p class="label">{{ c.label }}</p>
        <p class="sum" :class="tone(c.stats.sumR)">{{ dobSignedR(c.stats.sumR) }} R</p>
        <p>{{ c.stats.success+c.stats.loss }} Trades · {{ c.stats.success }} W / {{ c.stats.loss }} L · {{ dobPct(c.stats.winrate) }}</p>
        <p class="small">offen {{ c.stats.open }} · unklar {{ c.stats.ambiguous+c.stats.unknown }}</p>
        <p v-if="c.delta" class="delta" title="gegen Standard"><span :class="tone(c.delta.sumR)">{{ dobSignedR(c.delta.sumR) }} R</span> · {{ pp(c.delta.winratePp) }}</p>
      </div>
    </div>
  </article>
</template>
<style scoped>
.account{background:#1e222d;border:1px solid #2a2e39;border-radius:6px;padding:18px 20px}h2{margin:0;font-size:16px;font-weight:600}.subtitle{margin:4px 0 14px;font-size:13px;color:#b1b7c5;min-height:1.2em}.columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.column p{margin:2px 0;font-size:13px}.column.total{border-left:1px solid #434651;padding-left:16px}.label{color:#b1b7c5}.sum{font-size:34px!important;font-weight:600;line-height:1.15}.small{font-size:12px!important;color:#7f8696}.delta{font-size:13px!important;color:#91b8ff}.positive{color:var(--positive)}.negative{color:var(--negative)}@media(max-width:600px){.columns{grid-template-columns:1fr}.column.total{border-left:0;padding-left:0;border-top:1px solid #434651;padding-top:8px}}
</style>
