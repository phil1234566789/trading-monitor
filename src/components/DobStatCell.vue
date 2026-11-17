<script setup>
import {dobPct,dobSignedR,dobWinTone,dobBreakEven} from '../dobTradeStatistics.js';
// Kompakte Zelle je R-Ziel: Winrate (gegen Break-even 1/(1+k) gefärbt) · ΣR, Win/Loss/offen im Tooltip.
defineProps({stats:Object,k:Number});
</script>
<template>
  <span class="cell" :title="`${k}R · ${stats.success} W / ${stats.loss} L · offen ${stats.open} · Break-even ${dobPct(dobBreakEven(k))}`"><span :class="dobWinTone(stats.winrate,k)">{{ dobPct(stats.winrate) }}</span> · <span :class="stats.sumR>0?'positive':stats.sumR<0?'negative':''">{{ dobSignedR(stats.sumR) }}</span></span>
</template>
<style scoped>
.cell{white-space:nowrap}.positive{color:var(--positive)}.negative{color:var(--negative)}
</style>
