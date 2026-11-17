<script setup>
import {dobPct,dobSignedR,dobWinTone,dobBreakEven} from '../dobTradeStatistics.js';
// Kompakte Zelle je R-Ziel: Winrate (gegen Break-even 1/(1+k) gefärbt) · ΣR, Win/Loss/offen im Tooltip. Ohne festes k (TP je
// Trade aus der Konfig) bleibt die Winrate ungefärbt, weil es keinen gemeinsamen Break-even gibt.
defineProps({stats:Object,k:{type:Number,default:null}});
</script>
<template>
  <span class="cell" :title="`${k==null?'TP nach Konfig':`${k}R`} · ${stats.success} W / ${stats.loss} L · offen ${stats.open}${k==null?'':` · Break-even ${dobPct(dobBreakEven(k))}`}`"><span :class="k==null?'':dobWinTone(stats.winrate,k)">{{ dobPct(stats.winrate) }}</span> · <span :class="stats.sumR>0?'positive':stats.sumR<0?'negative':''">{{ dobSignedR(stats.sumR) }}</span></span>
</template>
<style scoped>
.cell{white-space:nowrap}.positive{color:var(--positive)}.negative{color:var(--negative)}
</style>
