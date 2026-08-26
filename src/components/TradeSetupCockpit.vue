<script setup>
import { computed } from "vue";
import { formatConfirmationLabel } from "../tradeConfirmations";
import { formatTargetLabel } from "../tradeTargets";
import CrudListSection from "./CrudListSection.vue";

// Trade-Setup-Cockpit (Chat 2026-08-26: "TSC clear, fangen wir von vorne an") — Neuaufbau Schritt
// 1: Bestätigungen + Targets, "erst mal alles manuell" (Philip) heißt hier: keine automatische
// Setup-Erkennung mehr, aber ansonsten 1:1 derselbe Weg wie im Trade-Edit-Modal (Chart-Klick im
// Trade-Modus, echte dealing_ranges/trade_confirmations/trade_targets-Zeilen) — über dieselbe
// CrudListSection.vue wie dort. `range` kommt von Dashboard.vue (tscRange, siehe dort) und ist
// null, solange noch keine Dealing Range über die TSC angelegt wurde. Deren Richtung entscheidet
// die ERSTE Bestätigung (meist ein Sweep, optional ein OB — Philip: "als erstes kommt der
// LQ-Sweep, vielleicht bildet sich eine OB danach, aber nur vielleicht", siehe Dashboard.vue:
// tscBootstrapArmed) — bis dahin gibt's hier keine Long/Short-Einfärbung und Targets bleiben
// gesperrt.
const props = defineProps({
  state: { type: Object, default: null },
  nowSec: { type: Number, default: undefined },
  instrument: { type: String, required: true },
  range: { type: Object, default: null },
});
const emit = defineEmits(["add-confirmation", "add-target", "remove-confirmation", "remove-target"]);

const confirmations = computed(() => props.range?.confirmations ?? []);
const targets = computed(() => props.range?.targets ?? []);
const direction = computed(() => props.range?.direction ?? null);

const nowSecResolved = computed(() => props.nowSec ?? Math.floor(Date.now() / 1000));
function confirmationLabel(c) {
  return formatConfirmationLabel(c, props.instrument, nowSecResolved.value);
}
function targetLabel(t) {
  return formatTargetLabel(t, props.instrument, nowSecResolved.value);
}

// Färbt Rahmen/Header je nach Richtung (Philip: "sobald ich eine OB als confirmation auswähle,
// färbt sich das TSC je nach Richtung der DR") — dieselben Long/Short-Töne wie überall sonst in
// der App (TradeEditModal.vue: .tem-direction, TradesTable.vue). Neutral/blau, solange keine
// Richtung feststeht.
const accentStyle = computed(() => {
  if (direction.value === "long") return { "--tsc-accent-bg": "rgba(38, 166, 154, 0.14)", "--tsc-accent-border": "rgba(38, 166, 154, 0.4)" };
  if (direction.value === "short") return { "--tsc-accent-bg": "rgba(255, 152, 0, 0.14)", "--tsc-accent-border": "rgba(255, 152, 0, 0.4)" };
  return {};
});
</script>

<template>
  <div v-if="state" class="tsc-card" :style="accentStyle">
    <div class="tsc-header">
      <h3 class="tsc-title">Trade-Setup-Cockpit</h3>
      <!-- Gleiches Label/Styling wie TradeEditModal.vue: .tem-direction (Philip: "dasselbe Label
           wie im trade-edit-modal"). -->
      <span v-if="direction" class="tsc-direction" :class="direction">{{ direction === "short" ? "Short" : "Long" }}</span>
    </div>

    <CrudListSection
      title="Bestätigungen"
      icon="✔"
      add-title="Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB/Fib anklicken) — ohne bestehende Range muss der erste Klick ein Sweep oder OB sein, der legt die Richtung fest"
      :items="confirmations"
      :item-key="(c) => c.id"
      :item-label="confirmationLabel"
      empty-text="Noch keine Bestätigungen."
      @add="emit('add-confirmation')"
      @remove="(c) => emit('remove-confirmation', c)"
    />

    <CrudListSection
      title="Targets"
      icon="🎯"
      :add-title="range ? 'Target hinzufügen (Trade-Modus, dann Pivot/OB im Chart anklicken)' : 'Erst eine Bestätigung (OB) hinzufügen — legt die Richtung fest'"
      :disabled="!range"
      :items="targets"
      :item-key="(t) => t.id"
      :item-label="targetLabel"
      empty-text="Noch keine Targets."
      @add="emit('add-target')"
      @remove="(t) => emit('remove-target', t)"
    />
  </div>
</template>

<style scoped>
.tsc-card {
  position: absolute;
  z-index: 5;
  /* Bug-Report Philip 2026-07-27: "TSC verdeckt die Preis-Y-Achse" — 12px reichte nicht, das
     überlappte die rechte Preisskala von lightweight-charts (die Teil desselben Chart-Canvas ist,
     kein eigenes DOM-Element, dem man ausweichen könnte). Fixer, großzügiger Wert statt die
     tatsächliche Preisskala-Breite zur Laufzeit abzufragen — die TSC läuft ohnehin nur für Forex
     (5 Nachkommastellen, immer ähnlich breite Preis-Labels), kein wirklich variabler Fall.
  */
  right: 70px;
  top: 50%;
  transform: translateY(-50%);
  width: max-content;
  max-width: 320px;
  padding: 16px;
  border-radius: 8px;
  background-color: rgba(19, 23, 34, 0.92);
  border: 1px solid var(--tsc-accent-border, rgba(120, 123, 134, 0.5));
  font-size: 15px;
  line-height: 24px;
}

.tsc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  /* Bleedet über das Card-Padding hinaus bis an den Kartenrand, damit die Hintergrundfarbe als
     eigener Balken erkennbar ist statt nur als Trennlinie (Philip: "andere Hintergrundfarbe"
     reichte allein per Border nicht als Abgrenzung). */
  margin: -16px -16px 10px -16px;
  padding: 10px 16px;
  border-radius: 8px 8px 0 0;
  background-color: var(--tsc-accent-bg, rgba(126, 166, 255, 0.14));
  border-bottom: 1px solid var(--tsc-accent-border, rgba(126, 166, 255, 0.35));
}

.tsc-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7ea6ff;
}

/* 1:1 TradeEditModal.vue: .tem-direction/.tem-direction.long/.tem-direction.short (Philip:
   "dasselbe Label wie im trade-edit-modal") — Short = Orange statt Rot (Chat 2026-07-31: "use
   green and orange for long and short"), Rot bleibt für Win/Loss reserviert. */
.tsc-direction {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.tsc-direction.short {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.tsc-direction.long {
  background: rgba(38, 166, 154, 0.2);
  color: #26a69a;
}
</style>
