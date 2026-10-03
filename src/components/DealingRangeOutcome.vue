<script setup>
import { computed } from 'vue';
import { savedRangeOutcome } from '../tradeSetup2SavedRangeOutcome.js';
import { formatDatedTime } from '../berlinTime.js';
import { fmtPrice, pricePrecisionForInstrument } from '../format.js';
const props = defineProps({ group: { type: Object, required: true } });
const outcome = computed(() => savedRangeOutcome(props.group));
const price = value => fmtPrice(value, pricePrecisionForInstrument(props.group.instrument));
</script>
<template>
  <div v-if="outcome" class="range-outcome">
    <strong>DR-Verlauf: {{ outcome.label }}</strong>
    <strong v-if="outcome.status === 'invalidation'" class="prevented" title="Kein Entry gespeichert; DR erreichte Invalidierung vor T1. Kein simuliertes Trade-Ergebnis.">👍 Loss verhindert</strong>
    <small>Ab Validierung {{ outcome.from == null ? 'unbekannt' : formatDatedTime(outcome.from) }}</small>
    <small>T1 {{ price(outcome.target1) }} · Invalidierung {{ price(outcome.invalidation) }}</small>
    <small v-if="outcome.recognizedAt != null">Erkannt {{ formatDatedTime(outcome.recognizedAt) }}</small>
    <small v-else-if="outcome.through != null">Gespeicherter Stand {{ formatDatedTime(outcome.through) }}</small>
    <small v-if="outcome.reason">{{ outcome.reason }}</small>
  </div>
</template>
<style scoped>
.range-outcome { margin-top: 6px; min-width: 170px; }
small { display: block; color: #b1b7c5; }
.prevented { display: block; color: #81d993; }
</style>
