<script setup>
import { computed } from "vue";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { formatLiquidityLevelLabel } from "../liquidity.js";
import { isTooFarFromPrice, MAX_TARGET_DISTANCE_PIPS } from "../findTargets.js";
import MetadataPanel from "./MetadataPanel.vue";

// Target-Vorschläge (PLAN-find-targets.md, erster Baustein, Chat 2026-08-27) — Auswahl-Logik
// selbst lebt in findTargets.js (pur/testbar, siehe dort), diese Komponente ist nur Anzeige +
// Hover/Klick. Gleiche Bausteine wie an anderer Stelle schon etabliert: MetadataPanel.vue als
// Rahmen (wie PinPanel.vue/TakeTradeModal.vue), Hover-Zeile emittiert "hover" genau wie
// PinPanel.vue es für den Auswahl-Halo im Chart tut — hier highlightet PriceChart.vue darüber
// dieselbe LQ-Linie/OB-Zone, keine eigene Zeichnung nötig.
//
// Zwei Kandidaten-Arten (Philip 2026-08-27: "nimm noch untouched OBs auf") kommen als getrennte
// Props rein (liquidityCandidates: Rohformat wie getCurrentLiquidityLevels(); obCandidates:
// Rohformat wie poiZonesMetadata, plus targetPrice, siehe findTargets.js), weil sie aus zwei
// unabhängigen findTargets.js-Funktionen mit je eigenem Limit stammen — angezeigt werden sie aber
// als EINE gemeinsam nach Preis sortierte Liste (Philip: "schaffst du es beides zusammenzuführen
// und nach Preis zu sortieren?"), ein kleines Kind-Badge pro Zeile hält LQ/OB trotzdem
// unterscheidbar. hover/select tragen {kind: "pivot"|"ob", item}.
const props = defineProps({
  instrument: { type: String, required: true },
  direction: { type: String, default: null }, // "long" | "short" | null
  liquidityCandidates: { type: Array, required: true },
  obCandidates: { type: Array, required: true },
  currentPrice: { type: Number, default: null },
  nowSec: { type: Number, required: true },
});
const emit = defineEmits(["close", "hover", "select"]);

const precision = computed(() => pricePrecisionForInstrument(props.instrument));

// Alle Kandidaten liegen bereits einseitig vom aktuellen Preis (findNearestLiquidityTargets/
// -ObTargets filtern das schon) — bei Short also alle UNTERHALB, "am nächsten" heißt dort "am
// höchsten Preis". Sortierung nach reinem Preis reicht deshalb.
//
// disabled (Philip 2026-08-27: "falls ein LQ-Level oder OB ... über 50 pips weit entfernt ist,
// dann disable sie in der Liste, sodass man sie nicht als Target auswählen kann") — nur die
// Auswahl wird gesperrt (siehe Template: @click), sichtbar bleibt der Kandidat trotzdem.
const mergedCandidates = computed(() => {
  const items = [
    ...props.liquidityCandidates.map((level) => ({ kind: "pivot", item: level, price: level.price })),
    ...props.obCandidates.map((zone) => ({ kind: "ob", item: zone, price: zone.targetPrice })),
  ];
  return items
    .map((c) => ({ ...c, disabled: isTooFarFromPrice(c.price, props.currentPrice) }))
    .sort((a, b) => (props.direction === "short" ? b.price - a.price : a.price - b.price));
});

function candidateLabel(candidate) {
  const formatPrice = (price) => fmtPrice(price, precision.value);
  if (candidate.kind === "ob") {
    const zone = candidate.item;
    // Dasselbe Preis-/Alter-Label wie bei einem LQ-Level, nur mit den OB-eigenen Feldern
    // (targetPrice statt price, startTime/touched/endTime statt pivotTime/touchedTime).
    return formatLiquidityLevelLabel(
      { price: zone.targetPrice, pivotTime: zone.startTime, touchedTime: zone.touched ? zone.endTime : null },
      { nowSec: props.nowSec, formatPrice, includePrice: true },
    );
  }
  return formatLiquidityLevelLabel(candidate.item, { nowSec: props.nowSec, formatPrice, includePrice: true });
}
</script>

<template>
  <MetadataPanel title="🎯 Target-Vorschläge" :width="340" :height="420" @close="emit('close')">
    <div v-if="direction !== 'short'" class="target-picker-hint">Long ist hier noch nicht unterstützt — bisher nur Short.</div>
    <div v-else-if="mergedCandidates.length === 0" class="target-picker-hint">
      Keine unberührten LQ-Level/OBs unterhalb des aktuellen Preises gefunden.
    </div>
    <div v-else class="target-picker-list">
      <div
        v-for="candidate in mergedCandidates"
        :key="`${candidate.kind}-${candidate.item.timeframe}-${candidate.kind === 'ob' ? candidate.item.startTime : candidate.item.pivotTime}`"
        class="target-picker-row"
        :class="{ disabled: candidate.disabled }"
        @mouseenter="emit('hover', candidate)"
        @mouseleave="emit('hover', null)"
        @click="!candidate.disabled && emit('select', candidate)"
      >
        <span class="target-picker-kind" :class="candidate.kind">{{ candidate.kind === "ob" ? "OB" : "LQ" }}</span>
        <span class="target-picker-tf">{{ candidate.item.timeframe?.toUpperCase() }}</span>
        {{ candidateLabel(candidate) }}
        <span v-if="candidate.disabled" class="target-picker-far-hint" :title="`Mehr als ${MAX_TARGET_DISTANCE_PIPS} Pips entfernt`">&gt;{{ MAX_TARGET_DISTANCE_PIPS }}p</span>
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

.target-picker-row:hover {
  background: #1c2030;
  border-color: #2962ff;
}

.target-picker-row.disabled {
  cursor: default;
  opacity: 0.45;
}

.target-picker-row.disabled:hover {
  background: none;
  border-color: #2a2e39;
}

.target-picker-kind {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  color: #9aa0ac;
  background: #1a1e28;
  border: 1px solid #2a2e39;
}

.target-picker-kind.ob {
  color: #7ea6ff;
  border-color: rgba(41, 98, 255, 0.4);
}

.target-picker-tf {
  flex-shrink: 0;
  font-size: 11px;
  color: #787b86;
}

.target-picker-far-hint {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  color: #787b86;
}
</style>
