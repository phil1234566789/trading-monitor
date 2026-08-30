<script setup>
import { computed } from "vue";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { formatLiquidityLevelLabel } from "../liquidity.js";
import MetadataPanel from "./MetadataPanel.vue";

// Anti-Confluence-Vorschläge (Chat 2026-08-30) — Auswahl-Logik lebt in findAntiConfluences.js,
// diese Komponente ist nur Anzeige + Hover/Klick, analog TargetPickerModal.vue. Vier statt zwei
// Kandidaten-Arten (ob/pivot/divergence/ob-inv) kommen als getrennte Props rein (je eine eigene
// Funktion in findAntiConfluences.js), werden aber als EINE gemeinsam nach Preisdistanz zum
// aktuellen Preis sortierte Liste angezeigt — Kind-Badge pro Zeile hält sie unterscheidbar.
// hover/select tragen {kind: "ob"|"pivot"|"divergence"|"ob-inv", item}.
const props = defineProps({
  instrument: { type: String, required: true },
  direction: { type: String, default: null }, // "long" | "short" | null
  obCandidates: { type: Array, required: true },
  sweepCandidates: { type: Array, required: true },
  divergenceCandidates: { type: Array, required: true },
  invalidationObCandidates: { type: Array, required: true },
  currentPrice: { type: Number, default: null },
  nowSec: { type: Number, required: true },
});
const emit = defineEmits(["close", "hover", "select"]);

const precision = computed(() => pricePrecisionForInstrument(props.instrument));

// candidatePrice liest je Kind das richtige Feld (edgePrice bei ob/ob-inv, price bei pivot, toPrice
// bei divergence) — einmal zentral statt in Sortierung/Label wiederholt.
function candidatePrice(candidate) {
  if (candidate.kind === "pivot") return candidate.item.price;
  if (candidate.kind === "divergence") return candidate.item.toPrice;
  return candidate.item.edgePrice;
}

const mergedCandidates = computed(() => {
  const items = [
    ...props.obCandidates.map((zone) => ({ kind: "ob", item: zone })),
    ...props.sweepCandidates.map((level) => ({ kind: "pivot", item: level })),
    ...props.divergenceCandidates.map((div) => ({ kind: "divergence", item: div })),
    ...props.invalidationObCandidates.map((zone) => ({ kind: "ob-inv", item: zone })),
  ];
  return items.slice().sort((a, b) => Math.abs(candidatePrice(a) - props.currentPrice) - Math.abs(candidatePrice(b) - props.currentPrice));
});

function candidateLabel(candidate) {
  const formatPrice = (price) => fmtPrice(price, precision.value);
  if (candidate.kind === "divergence") {
    const d = candidate.item;
    return `${formatPrice(d.fromPrice)}→${formatPrice(d.toPrice)} RSI ${Math.round(d.fromRsi)}→${Math.round(d.toRsi)}`;
  }
  if (candidate.kind === "pivot") {
    return formatLiquidityLevelLabel(candidate.item, { nowSec: props.nowSec, formatPrice, includePrice: true });
  }
  // ob / ob-inv — dasselbe Preis-/Alter-Label wie ein LQ-Level, nur mit den OB-eigenen Feldern.
  const zone = candidate.item;
  return formatLiquidityLevelLabel(
    { price: zone.edgePrice, pivotTime: zone.startTime, touchedTime: zone.held ? zone.endTime : null },
    { nowSec: props.nowSec, formatPrice, includePrice: true },
  );
}

function candidateKindLabel(kind) {
  if (kind === "pivot") return "LQ";
  if (kind === "divergence") return "RSI";
  if (kind === "ob-inv") return "OB⚠";
  return "OB";
}
</script>

<template>
  <MetadataPanel title="💀 Anti-Confluence-Vorschläge" :width="360" :height="420" @close="emit('close')">
    <div v-if="mergedCandidates.length === 0" class="anti-confluence-picker-hint">Keine Gegenargumente in der Ziel-Zone gefunden.</div>
    <div v-else class="anti-confluence-picker-list">
      <div
        v-for="candidate in mergedCandidates"
        :key="`${candidate.kind}-${candidate.item.timeframe}-${candidate.kind === 'ob' || candidate.kind === 'ob-inv' ? candidate.item.startTime : candidate.kind === 'pivot' ? candidate.item.pivotTime : candidate.item.toTime}`"
        class="anti-confluence-picker-row"
        @mouseenter="emit('hover', candidate)"
        @mouseleave="emit('hover', null)"
        @click="emit('select', candidate)"
      >
        <span class="anti-confluence-picker-kind" :class="candidate.kind">{{ candidateKindLabel(candidate.kind) }}</span>
        <span v-if="candidate.item.timeframe" class="anti-confluence-picker-tf">{{ candidate.item.timeframe?.toUpperCase() }}</span>
        <span v-if="candidate.kind === 'ob' && candidate.item.held" class="anti-confluence-picker-held" title="Bereits berührt, aber gehalten">gehalten</span>
        {{ candidateLabel(candidate) }}
        <span v-if="candidate.kind === 'ob-inv'" class="anti-confluence-picker-inv-hint" title="Nahe der Invalidierung">Inv.</span>
      </div>
    </div>
  </MetadataPanel>
</template>

<style scoped>
.anti-confluence-picker-hint {
  color: #787b86;
  font-size: 12px;
}

.anti-confluence-picker-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anti-confluence-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #2a2e39;
  border-radius: 6px;
  padding: 8px 10px;
  color: #d1d4dc;
  font-size: 13px;
  cursor: pointer;
}

.anti-confluence-picker-row:hover {
  background: #1c2030;
  border-color: #2962ff;
}

.anti-confluence-picker-kind {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  color: #9aa0ac;
  background: #1a1e28;
  border: 1px solid #2a2e39;
}

.anti-confluence-picker-kind.ob,
.anti-confluence-picker-kind.ob-inv {
  color: #7ea6ff;
  border-color: rgba(41, 98, 255, 0.4);
}

.anti-confluence-picker-kind.divergence {
  color: #d19aff;
  border-color: rgba(157, 41, 255, 0.4);
}

.anti-confluence-picker-tf {
  flex-shrink: 0;
  font-size: 11px;
  color: #787b86;
}

.anti-confluence-picker-held {
  flex-shrink: 0;
  font-size: 10px;
  color: #f0b90b;
  border: 1px solid rgba(240, 185, 11, 0.4);
  border-radius: 4px;
  padding: 1px 5px;
}

.anti-confluence-picker-inv-hint {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  color: #787b86;
}
</style>
