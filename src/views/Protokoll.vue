<script setup>
import ProtokollTable from "../components/ProtokollTable.vue";
import { fetchTouchedZones } from "../poiZones.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";

const INST_ID = "BTC-USDT";
const POLL_MS = 15_000;

const { data: zones } = usePolledFetch(() => fetchTouchedZones(INST_ID), { intervalMs: POLL_MS });
</script>

<template>
  <div class="protokoll-wrapper">
    <h2 class="protokoll-title">POI-Protokoll — erreichte Order-Blocks (4H + 1H)</h2>
    <ProtokollTable :zones="zones" />
  </div>
</template>

<style scoped>
.protokoll-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.protokoll-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #d1d4dc;
}
</style>
