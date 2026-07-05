<script setup>
import { ref } from "vue";
import PriceChart from "../components/PriceChart.vue";
import TradesTable from "../components/TradesTable.vue";
import TradeStats from "../components/TradeStats.vue";
import { TIMEFRAMES } from "../timeframes.js";
import { fetchTrades } from "../trades.js";
import { fetchPoiZones } from "../poiZones.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";

const INST_ID = "BTC-USDT";
const POLL_MS = 12_000;

const currentBar = ref("1h");
const { data: trades } = usePolledFetch(() => fetchTrades(INST_ID), { intervalMs: POLL_MS });
const { data: poiZones } = usePolledFetch(() => fetchPoiZones(INST_ID), { intervalMs: POLL_MS });
</script>

<template>
  <div class="toolbar">
    <span class="symbol">{{ INST_ID }}</span>
    <div class="timeframe-switcher">
      <button
        v-for="tf in TIMEFRAMES"
        :key="tf.label"
        :class="{ active: tf.label === currentBar }"
        @click="currentBar = tf.label"
      >
        {{ tf.label }}
      </button>
    </div>
  </div>

  <PriceChart :current-bar="currentBar" :trades="trades" :poi-zones="poiZones" />

  <aside class="trades-panel">
    <h2 class="trades-panel-title">Trades</h2>
    <div class="trades-list">
      <TradesTable :trades="trades" />
    </div>
    <TradeStats :trades="trades" />
  </aside>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #131722;
  border-bottom: 1px solid #2a2e39;
}

.symbol {
  font-weight: 600;
  font-size: 14px;
}

.timeframe-switcher {
  display: flex;
  gap: 4px;
}

.timeframe-switcher button {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.timeframe-switcher button:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.timeframe-switcher button.active {
  background: #2962ff;
  color: #fff;
}

.trades-panel {
  flex-shrink: 0;
  max-height: 320px;
  background: #1e222d;
  border-top: 1px solid #2a2e39;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}

.trades-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.trades-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
</style>
