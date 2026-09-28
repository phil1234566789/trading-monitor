<script setup>
import { fmtPrice, pricePrecisionForInstrument } from '../format.js';
import { formatDatedTime } from '../berlinTime.js';
defineProps({ status: Object, symbol: String });
</script>

<template>
  <div class="m1-structure-status" role="status">
    <template v-if="status.state === 'waiting'">M1: wartet auf A + B + C und bekannten M5-Anker</template>
    <template v-else-if="status.state === 'loading'">M1-Struktur lädt…</template>
    <template v-else-if="status.state === 'error'">M1: Kerzen konnten nicht geladen werden</template>
    <template v-else-if="status.state === 'missing'">M1: Kerzenvorlauf fehlt</template>
    <template v-else>
      M1 · Anker {{ fmtPrice(status.anchor.price, pricePrecisionForInstrument(symbol)) }}
      · {{ formatDatedTime(status.anchor.pivotTime) }}
      <span v-if="status.lastClosedAt"> · Stand {{ formatDatedTime(status.lastClosedAt) }}</span>
    </template>
  </div>
</template>

<style scoped>
.m1-structure-status {
  position: absolute; bottom: 40px; left: 40px; z-index: 2;
  max-width: calc(100% - 95px); font-size: 11px; pointer-events: none;
  color: var(--text-secondary, #aaa); background: var(--bg-panel, #161b22);
  padding: 3px 6px; border-radius: 4px;
}
</style>
