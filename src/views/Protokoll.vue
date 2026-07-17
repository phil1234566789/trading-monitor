<script setup>
import { ref, watch } from "vue";
import ProtokollTable from "../components/ProtokollTable.vue";
import { fetchAlarmLog } from "../alarmLog.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";

// Gleiche Instrument-Liste wie im Dashboard-Symbol-Switcher — BTC hat nur OB-Zonen
// (Liquidität/Trade-Setup laufen ausschliesslich für die cTrader-Instrumente, siehe
// poi-watcher/index.ts), GBPUSD/EURUSD sind die tatsächlich live alarmierten Instrumente.
const SYMBOLS = ["GBPUSD", "EURUSD", "BTC-USDT"];
const POLL_MS = 15_000;

const currentSymbol = ref("GBPUSD");
const { data: rows, refresh } = usePolledFetch(() => fetchAlarmLog(currentSymbol.value), { intervalMs: POLL_MS });
// Symbolwechsel soll sofort die neuen Daten laden, statt bis zu POLL_MS lang das alte
// Instrument anzuzeigen (gleiches Muster wie Dashboard.vue).
watch(currentSymbol, refresh);
</script>

<template>
  <div class="protokoll-wrapper">
    <div class="protokoll-header">
      <h2 class="protokoll-title">Alarm-Protokoll</h2>
      <div class="symbol-switcher">
        <button
          v-for="sym in SYMBOLS"
          :key="sym"
          :class="{ active: sym === currentSymbol }"
          @click="currentSymbol = sym"
        >
          {{ sym }}
        </button>
      </div>
    </div>
    <ProtokollTable :rows="rows" />
  </div>
</template>

<style scoped>
.protokoll-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.protokoll-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 16px;
}

.protokoll-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #d1d4dc;
}

.symbol-switcher {
  display: flex;
  gap: 4px;
}

.symbol-switcher button {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.symbol-switcher button:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.symbol-switcher button.active {
  background: #2962ff;
  color: #fff;
}
</style>
