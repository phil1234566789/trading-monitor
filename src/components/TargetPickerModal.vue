<script setup>
import { computed } from "vue";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { formatLiquidityLevelLabel } from "../liquidity.js";
import MetadataPanel from "./MetadataPanel.vue";

// Target-Vorschläge (PLAN-find-targets.md, erster Baustein, Chat 2026-08-27) — Auswahl-Logik
// selbst lebt in findTargets.js (pur/testbar, siehe dort), diese Komponente ist nur Anzeige +
// Hover/Klick. Gleiche Bausteine wie an anderer Stelle schon etabliert: MetadataPanel.vue als
// Rahmen (wie PinPanel.vue/TakeTradeModal.vue), Hover-Zeile emittiert "hover" genau wie
// PinPanel.vue es für den Auswahl-Halo im Chart tut — hier highlightet PriceChart.vue darüber
// dieselbe LQ-Linie, keine eigene Zeichnung nötig.
const props = defineProps({
  instrument: { type: String, required: true },
  direction: { type: String, default: null }, // "long" | "short" | null
  candidates: { type: Array, required: true }, // Rohformat wie getCurrentLiquidityLevels()
  nowSec: { type: Number, required: true },
});
const emit = defineEmits(["close", "hover", "select"]);

const precision = computed(() => pricePrecisionForInstrument(props.instrument));

function label(level) {
  return formatLiquidityLevelLabel(level, {
    nowSec: props.nowSec,
    formatPrice: (price) => fmtPrice(price, precision.value),
    includePrice: true,
  });
}
</script>

<template>
  <MetadataPanel title="🎯 Target-Vorschläge" :width="340" :height="320" @close="emit('close')">
    <div v-if="direction !== 'short'" class="target-picker-hint">Long ist hier noch nicht unterstützt — bisher nur Short.</div>
    <div v-else-if="candidates.length === 0" class="target-picker-hint">Keine unberührten LQ-Level unterhalb des aktuellen Preises gefunden.</div>
    <div v-else class="target-picker-list">
      <div
        v-for="level in candidates"
        :key="`${level.timeframe}-${level.pivotTime}`"
        class="target-picker-row"
        @mouseenter="emit('hover', level)"
        @mouseleave="emit('hover', null)"
        @click="emit('select', level)"
      >
        {{ label(level) }}
      </div>
    </div>
  </MetadataPanel>
</template>

<style scoped>
.target-picker-hint {
  color: #787b86;
  font-size: 12px;
}

.target-picker-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.target-picker-row {
  border: 1px solid #2a2e39;
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d4dc;
  font-size: 13px;
  cursor: pointer;
}

.target-picker-row:hover {
  background: #1c2030;
  border-color: #2962ff;
}
</style>
