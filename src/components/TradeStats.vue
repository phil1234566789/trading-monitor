<script setup>
import { computed } from "vue";
import { computeTradeStats } from "../trades.js";
import { fmtR } from "../format.js";

const props = defineProps({
  trades: { type: Array, required: true },
});

const stats = computed(() => computeTradeStats(props.trades));
const pnlClass = computed(() => (stats.value.totalR > 0 ? "positive" : stats.value.totalR < 0 ? "negative" : ""));
const winrateClass = computed(() => {
  if (stats.value.winrate == null) return "";
  return stats.value.winrate >= 50 ? "positive" : "negative";
});
</script>

<template>
  <div class="trade-stats">
    <div class="stat-item">
      <span class="stat-label">Trades</span>
      <span class="stat-value">{{ stats.total }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Wins / Losses</span>
      <span class="stat-value">{{ stats.wins }} / {{ stats.losses }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Winrate</span>
      <span class="stat-value" :class="winrateClass">{{ stats.winrate != null ? stats.winrate.toFixed(0) + "%" : "–" }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">PnL (R)</span>
      <span class="stat-value" :class="pnlClass">{{ stats.totalR ? fmtR(stats.totalR) : "–" }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Ø R / Trade</span>
      <span class="stat-value">{{ fmtR(stats.avgR) }}</span>
    </div>
  </div>
</template>

<style scoped>
.trade-stats {
  flex-shrink: 0;
  display: flex;
  gap: 24px;
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid #2a2e39;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: #787b86;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #d1d4dc;
}

.stat-value.positive {
  color: #26a69a;
}

.stat-value.negative {
  color: #ef5350;
}
</style>
