<script setup>
import { ref, watch } from "vue";
import ProtokollTable from "../components/ProtokollTable.vue";
import ToggleButton from "../components/ui/ToggleButton.vue";
import { fetchAlarmLog } from "../alarmLog.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";

// Gleiche Instrument-Liste wie im Dashboard-Symbol-Switcher.
const SYMBOLS = ["GBPUSD", "EURUSD"];
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
        <ToggleButton
          v-for="sym in SYMBOLS"
          :key="sym"
          :class="{ active: sym === currentSymbol }"
          @click="currentSymbol = sym"
        >
          {{ sym }}
        </ToggleButton>
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
  font-weight: 600;
}
</style>
