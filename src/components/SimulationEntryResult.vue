<script setup>
import { computed } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { fmtMoney, fmtR, pnlClass } from '../format.js';
import { simulationEntryResult, simulationOutcomeKey, SIMULATION_OUTCOME_LABELS, SIMULATION_REASON_LABELS } from '../tradeSetupSimulationStatistics.js';
const props = defineProps({ snapshot: { type: Object, required: true }, results: { type: Array, required: true }, variant: String });
const result = computed(() => simulationEntryResult(props.results, props.snapshot, props.variant));
</script>
<template>
  <div class="entry-result">
    <small>Entry {{ formatDatedTime(snapshot.entry.recognizedAt) }}</small>
    <template v-if="result">
      <strong>{{ SIMULATION_OUTCOME_LABELS[simulationOutcomeKey(result)] ?? 'Unbekannt' }}</strong>
      <small v-if="result.status === 'closed' && result.netPnlUsd != null">{{ result.netPnlUsd > 0 ? 'Gewinn' : result.netPnlUsd < 0 ? 'Verlust' : 'Break-even' }} nach Kommission</small>
      <small v-if="result.reason">{{ SIMULATION_REASON_LABELS[result.reason] ?? 'Ergebnis nicht abschließend bestimmbar' }}</small>
      <div :class="pnlClass(result.netPnlUsd)">Netto USD: {{ fmtMoney(result.netPnlUsd) }}</div>
      <div :class="pnlClass(result.netRMultiple)">Netto R: {{ fmtR(result.netRMultiple) }}</div>
      <small v-if="result.status === 'open'">Bisher realisiert netto: {{ fmtMoney(result.realizedNetPnlUsd) }}</small>
    </template>
    <span v-else>Ergebnis nicht gespeichert oder außerhalb des Entry-Filters</span>
  </div>
</template>
<style scoped>
.entry-result { min-width: 150px; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.positive { color: #71c8b3; } .negative { color: #ef5350; }
small { display: block; color: #b1b7c5; }
</style>
