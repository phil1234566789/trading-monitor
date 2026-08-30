<script setup>
import { computed, ref, watch } from "vue";
import { updateDealingRange } from "../tradeIntake.js";
import { formatEvidenceLabel } from "../tradeEvidence";
import { formatTargetLabel } from "../tradeTargets";
import { trendChainLevelDisplay, computeTrendAlignment, trendAlignmentDisplay } from "../tradeSetupCockpit";
import CrudListSection from "./CrudListSection.vue";
import InvalidationField from "./InvalidationField.vue";

// Trade-Setup-Cockpit (Chat 2026-08-26: "TSC clear, fangen wir von vorne an") — Neuaufbau Schritt
// 1: Bestätigungen + Targets, "erst mal alles manuell" (Philip) heißt hier: keine automatische
// Setup-Erkennung mehr, aber ansonsten 1:1 derselbe Weg wie im Trade-Edit-Modal (Chart-Klick im
// Trade-Modus, echte dealing_ranges/trade_evidence/trade_targets-Zeilen) — über dieselbe
// CrudListSection.vue wie dort. Seit 2026-08-28 zusätzlich Zusatzargumente (Confluence) und
// Anti-Confluences als eigene Sektionen, getrennt von Bestätigungen (Confirmation) — alle drei
// teilen dieselbe range.confirmations-Liste, nur nach category gefiltert (siehe computed unten).
// `range` kommt von Dashboard.vue (tscRange, siehe dort) und ist null, solange noch keine Dealing
// Range über die TSC angelegt wurde. Deren Richtung entscheidet die ERSTE Bestätigung (meist ein
// Sweep, optional ein OB — Philip: "als erstes kommt der LQ-Sweep, vielleicht bildet sich eine OB
// danach, aber nur vielleicht", siehe Dashboard.vue: tscBootstrapArmed) — bis dahin gibt's hier
// keine Long/Short-Einfärbung und Targets/Zusatzargumente/Anti-Confluences bleiben gesperrt.
//
// Lebt seit Chat 2026-08-28 als eigene Sidebar-Spalte in Dashboard.vue (vorher ein Chart-Overlay
// INNERHALB von PriceChart.vue) — die Komponente selbst ist jetzt IMMER gerendert, kein `state`-
// Prop/v-if-Gate mehr (das kam vorher aus PriceChart-internem cockpitState, nur um "TSC gerade
// sichtbar" zu entscheiden — Philip: "kannst du den TSC immer sichtbar lassen, der Toggle soll nur
// die Visualisierungen togglen" — showTradeSetupCockpit steuert seitdem nur noch die TSC-Range-
// Zeichnung auf dem Candlestick-Chart selbst, siehe PriceChart.vue).
const props = defineProps({
  nowSec: { type: Number, default: undefined },
  instrument: { type: String, required: true },
  range: { type: Object, default: null },
  // Trend-Kette aus dem 1h-Structure-Algo (Chat 2026-08-29, Philip: "der Trend soll rein") — kommt
  // reaktiv von PriceChart.vue über Dashboard.vue's trendChain-computed, siehe computeTrendChain
  // in tradeSetupCockpit.ts für die volle Begründung (KEINE echte 4H/1H/M5-Mehrfach-Timeframe-
  // Berechnung, nur die rekursive Verschachtelungstiefe desselben 1H-States).
  trendChain: { type: Array, default: () => [] },
});
const emit = defineEmits([
  "add-confirmation",
  "add-target",
  "add-confluence",
  "add-anti-confluence",
  "remove-confirmation",
  "remove-target",
  "remove-confluence",
  "remove-anti-confluence",
  "transfer-to-trades",
  "request-set-invalidation",
  "invalidation-saved",
  "reset",
  "open-target-picker",
  // Hover über eine Bestätigungs-/Zusatzargument-/Anti-Confluence- ODER Target-Zeile (Chat
  // 2026-08-30) — highlightet das zugehörige Chart-Objekt, siehe Dashboard.vue. Zwei separate
  // Events statt eines gemeinsamen, weil trade_evidence.id und trade_targets.id unabhängige
  // Id-Räume sind (Kollisionsgefahr bei einem gemeinsamen "hover-item"-Event).
  "hover-evidence",
  "hover-target",
]);

// category (Confirmation="Bestätigung"/GO-Signal, Confluence="Zusatzargument"/kein GO,
// Anti-Confluence/spricht dagegen — siehe trade-from-poi.md#confirmation-confluence-und-anti-
// confluence--wie-eine-dealing-range-go-bekommt) trennt eine gemeinsam geladene Liste
// (range.confirmations, siehe trades.js) in drei Sektionen — exakt dasselbe Filter-Muster wie
// TradeEditModal.vue: rangeConfirmations/positionConfirmations (dort nach `level`, hier
// zusätzlich nach `category`).
const confirmations = computed(() => (props.range?.confirmations ?? []).filter((c) => c.category === "confirmation"));
const confluences = computed(() => (props.range?.confirmations ?? []).filter((c) => c.category === "confluence"));
const antiConfluences = computed(() => (props.range?.confirmations ?? []).filter((c) => c.category === "anti_confluence"));
const targets = computed(() => props.range?.targets ?? []);
const direction = computed(() => props.range?.direction ?? null);

// Mindestqualität, bevor aus der Idee eine Ausführung werden darf (Chat 2026-08-27, Philip: "bitte
// dealing range anlegen nur enablen wenn: mind. 2 Bestätigung, mind. 1 Target, required
// Invalidierung") — prüft den GESPEICHERTEN Stand (props.range.invalidation), nicht das gerade
// eingetippte, noch nicht per "Speichern" bestätigte Invalidierungsfeld.
const transferBlockReason = computed(() => {
  const missing = [];
  if (confirmations.value.length < 2) missing.push("mind. 2 Bestätigungen");
  if (targets.value.length < 1) missing.push("mind. 1 Target");
  if (props.range?.invalidation == null) missing.push("Invalidierung");
  return missing.length > 0 ? `Fehlt noch: ${missing.join(", ")}` : "";
});
const canTransfer = computed(() => transferBlockReason.value === "");

// Invalidierung — 1:1 wie TradeEditModal.vue (Philip: "genau wie im trade-edit-modal, am besten
// reused Code"), über dieselbe InvalidationField.vue. Der Formular-Weg (Zahl eintippen) schreibt
// direkt (wie im Modal, nicht per Emit — das Modal macht dasselbe), der Chart-Klick-Weg (🚫-Icon)
// geht über Dashboard.vue (dort lebt der Trade-Modus-Klick-Arm-Mechanismus, siehe
// onTscSetInvalidationRequest). syncIfUntouched wie im Modal, damit ein externes Update (z.B. über
// den Chart-Klick-Weg) laufendes Tippen hier nicht überschreibt.
const invalidation = ref("");
const savingInvalidation = ref(false);
const invalidationJustSaved = ref(false);
const FEEDBACK_MS = 1200;
let invalidationFeedbackTimeout = null;
function flashInvalidationSaved() {
  invalidationJustSaved.value = true;
  clearTimeout(invalidationFeedbackTimeout);
  invalidationFeedbackTimeout = setTimeout(() => {
    invalidationJustSaved.value = false;
  }, FEEDBACK_MS);
}
function syncIfUntouched(target, sameRange, oldValue, newValue) {
  if (sameRange && target.value !== oldValue) return;
  target.value = newValue;
}
watch(
  () => props.range,
  (r, oldR) => {
    const sameRange = oldR != null && r != null && oldR.id === r.id;
    syncIfUntouched(invalidation, sameRange, oldR?.invalidation ?? "", r?.invalidation ?? "");
    if (sameRange && oldR.invalidation !== r.invalidation) flashInvalidationSaved();
  },
  { immediate: true },
);
async function saveInvalidation() {
  if (!props.range) return;
  savingInvalidation.value = true;
  const ok = await updateDealingRange(props.range.id, { invalidation: invalidation.value === "" ? null : Number(invalidation.value) });
  savingInvalidation.value = false;
  if (ok) {
    flashInvalidationSaved();
    emit("invalidation-saved");
  }
}

const nowSecResolved = computed(() => props.nowSec ?? Math.floor(Date.now() / 1000));
// Tag-Label im Header (Chat 2026-08-28, Philip: "damit man weiß für welchen Tag das Setup im TSC
// gerade gilt") — bewusst nowSecResolved (Live-Zeit ODER Replay-Zeitpunkt, siehe oben), nicht ein
// aus den Bestätigungen abgeleitetes Datum: die TSC-Karte selbst ist an "gerade jetzt" (bzw. den
// Replay-Stand) gebunden, nicht an eine bestimmte Bestätigung. Europe/Berlin statt Browser-
// Lokalzeit (siehe CLAUDE.md "Trading-hours / timezone handling"). .replace(".", "") entfernt das
// von de-DE angehängte Punkt-Suffix am Wochentag ("Fr." -> "Fr"), gleiches Muster wie
// newsMarkers.js: formatEventLabel.
const TSC_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const dateLabel = computed(() => TSC_DATE_FORMATTER.format(new Date(nowSecResolved.value * 1000)).replace(".", ""));
function confirmationLabel(c) {
  return formatEvidenceLabel(c, props.instrument, nowSecResolved.value);
}
function targetLabel(t) {
  return formatTargetLabel(t, props.instrument, nowSecResolved.value);
}

// Färbt Rahmen/Header je nach Richtung (Philip: "sobald ich eine OB als confirmation auswähle,
// färbt sich das TSC je nach Richtung der DR") — dieselben Long/Short-Töne wie überall sonst in
// der App (TradeEditModal.vue: .tem-direction, TradesTable.vue). Neutral/blau, solange keine
// Richtung feststeht.
// Trend-Kette (Chat 2026-08-29) — trendChainLevelDisplay rechnet pro Ebene Label+Text+Farbe fertig
// aus (tradeSetupCockpit.ts), hier nur noch die Zuordnung Ebene -> Tiefe fürs Label ("Trend"/
// "Korrektur"/"Gegenkorrektur").
const trendChainDisplay = computed(() => props.trendChain.map((level, depth) => trendChainLevelDisplay(level, depth)));
// Trend-Ausrichtung der Dealing Range (Chat 2026-08-30, Philip: "Short mit dem Trend" ✅ /
// "Long GEGEN den Trend" ⚠️) — siehe computeTrendAlignment für die volle Begründung.
const trendAlignment = computed(() => computeTrendAlignment(direction.value, props.trendChain));
const trendAlignmentInfo = computed(() => (direction.value && trendAlignment.value ? trendAlignmentDisplay(direction.value, trendAlignment.value) : null));

const accentStyle = computed(() => {
  if (direction.value === "long") return { "--tsc-accent-bg": "rgba(38, 166, 154, 0.14)", "--tsc-accent-border": "rgba(38, 166, 154, 0.4)" };
  if (direction.value === "short") return { "--tsc-accent-bg": "rgba(255, 152, 0, 0.14)", "--tsc-accent-border": "rgba(255, 152, 0, 0.4)" };
  return {};
});
</script>

<template>
  <div class="tsc-card" :style="accentStyle">
    <div class="tsc-header">
      <h3 class="tsc-title">Trade-Setup-Cockpit</h3>
      <div class="tsc-header-right">
        <span class="tsc-date">{{ dateLabel }}</span>
        <!-- Gleiches Label/Styling wie TradeEditModal.vue: .tem-direction (Philip: "dasselbe Label
             wie im trade-edit-modal"). -->
        <span v-if="direction" class="tsc-direction" :class="direction">{{ direction === "short" ? "Short" : "Long" }}</span>
        <!-- Reset (Chat 2026-08-27, Philip: "icon reicht, brauch den Text nicht, außer als
             Hover-Hint ... rechts neben dem Short-Label") — verwirft die ganze Idee (Range +
             Bestätigungen + Targets), nicht nur die Anzeige, siehe Dashboard.vue: onTscReset. -->
        <button v-if="range" class="tsc-reset-icon-btn" title="Zurücksetzen" @click="emit('reset')">↺</button>
      </div>
    </div>

    <!-- Trend-Kette (Chat 2026-08-29, Philip: "der Trend soll rein") — Kontext, kein Bestätigungs-
         Objekt (kein Chart-Klick-Mechanismus, anders als die Sektionen unten), deshalb eigene Zeile
         statt CrudListSection. Untereinander statt nebeneinander (Philip: "die chips sollen
         übereinander sein"), Richtungs-Pfeil LINKS neben dem Chip statt im Text (Philip: "das pfeil
         symbol ist cool! aber lieber links von dem chip anzeigen und bissl größer"). Die Tiefe
         (outer/nested/nested nested, siehe trendChainDepthHint in tradeSetupCockpit.ts) steckt nur
         noch im Hover-Title pro Chip, nicht mehr im Fließtext. -->
    <div v-if="trendChainDisplay.length" class="tsc-trend-chain">
      <div v-for="(d, i) in trendChainDisplay" :key="i" class="tsc-trend-row">
        <span class="tsc-trend-icon" :style="{ color: d.color }">{{ d.icon }}</span>
        <span class="tsc-trend-level" :style="{ '--level-color': d.color }" :title="d.hint">{{ d.text }}</span>
      </div>
    </div>

    <!-- Trend-Ausrichtung der Dealing Range (Chat 2026-08-30, Philip: "Long/Short im Trend" ✅ /
         "Long/Short GEGEN den Trend" ⚠️) — siehe computeTrendAlignment (tradeSetupCockpit.ts). Nur
         sichtbar, wenn beides feststeht (Richtung UND ein bestätigter äußerer Trend). -->
    <div v-if="trendAlignmentInfo" class="tsc-trend-alignment" :class="trendAlignment">
      {{ trendAlignmentInfo.text }} {{ trendAlignmentInfo.icon }}
    </div>

    <CrudListSection
      title="Bestätigungen"
      icon="✔"
      add-title="Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB anklicken) — der erste Klick legt die Richtung fest"
      :items="confirmations"
      :item-key="(c) => c.id"
      :item-label="confirmationLabel"
      empty-text="Noch keine Bestätigungen."
      @add="emit('add-confirmation')"
      @remove="(c) => emit('remove-confirmation', c)"
      @hover="(c) => emit('hover-evidence', c)"
    />

    <!-- Zusatzargumente (Confluence: gibt mehr Sicherheit, aber kein GO — Fib/RSI-Divergenz, siehe
         trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt).
         Gesperrt ohne Range (Chat 2026-08-28, analog zu Targets) — ohne Richtung/Idee gibt es noch
         nichts, zu dem ein Zusatzargument gehören könnte. -->
    <CrudListSection
      title="Zusatzargumente"
      icon="💡"
      :add-title="range ? 'Zusatzargument hinzufügen (Trade-Modus, dann Fib/Divergenz anklicken)' : 'Erst eine Bestätigung (Sweep/OB) hinzufügen — legt die Richtung fest'"
      :disabled="!range"
      :items="confluences"
      :item-key="(c) => c.id"
      :item-label="confirmationLabel"
      empty-text="Noch keine Zusatzargumente."
      @add="emit('add-confluence')"
      @remove="(c) => emit('remove-confluence', c)"
      @hover="(c) => emit('hover-evidence', c)"
    />

    <!-- Anti-Confluence (spricht gegen den Trade, siehe trade-from-poi.md#confirmation-confluence-
         und-anti-confluence--wie-eine-dealing-range-go-bekommt) — erster Schritt nur klickbare
         Chart-Objekte (Philip, Chat 2026-08-28), gleicher kind-Satz wie Bestätigungen/
         Zusatzargumente zusammen (Sweep/OB/Fib/Divergenz). Name bewusst englisch, nicht "Spricht
         dagegen" (Philip). Gesperrt ohne Range wie Zusatzargumente/Targets. -->
    <CrudListSection
      title="Anti-Confluences"
      icon="💀"
      :add-title="range ? 'Anti-Confluence hinzufügen (Trade-Modus, dann Sweep/OB/Fib/Divergenz anklicken)' : 'Erst eine Bestätigung (Sweep/OB) hinzufügen — legt die Richtung fest'"
      :disabled="!range"
      :items="antiConfluences"
      :item-key="(c) => c.id"
      :item-label="confirmationLabel"
      empty-text="Noch keine Anti-Confluences."
      @add="emit('add-anti-confluence')"
      @remove="(c) => emit('remove-anti-confluence', c)"
      @hover="(c) => emit('hover-evidence', c)"
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
      @hover="(t) => emit('hover-target', t)"
    >
      <template #extra-action>
        <!-- find_targets, erster Baustein (PLAN-find-targets.md, Chat 2026-08-27) — Vorschlagsliste
             statt Chart-Klick, erst ab 2 Bestätigungen sinnvoll (die legen Richtung/Kontext fest). -->
        <button
          class="tsc-target-picker-btn"
          title="Target-Vorschläge (nächste LQ-Level)"
          :disabled="confirmations.length < 2"
          @click="emit('open-target-picker')"
        >
          🔎
        </button>
      </template>
    </CrudListSection>

    <InvalidationField
      v-if="range"
      v-model="invalidation"
      :saving="savingInvalidation"
      :just-saved="invalidationJustSaved"
      @save="saveInvalidation"
      @request-chart-click="emit('request-set-invalidation')"
    />

    <!-- Überführt die Range als leere Ausführung in die Trades-Liste (Chat 2026-08-27, Philip:
         "bau jetzt einen Button, wo ich die DR in die trading-liste überführen kann") — Entry-
         Preis/Stop-Loss/etc. füllt das sich öffnende Trade-Edit-Modal aus, kein zweites Formular
         hier. Nur sichtbar, wenn überhaupt schon eine Range existiert. -->
    <button
      v-if="range"
      class="tsc-transfer-btn"
      :disabled="!canTransfer"
      :title="canTransfer ? '' : transferBlockReason"
      @click="emit('transfer-to-trades')"
    >
      Dealing Range anlegen
    </button>
  </div>
</template>

<style scoped>
/* Bis Chat 2026-08-28 ein position:absolute-Overlay über dem Chart (siehe Git-Historie vor diesem
   Commit für den früheren rechts/vertikal-zentrierten Overlay-Stil) — Philip: "übersichtlicher,
   wenn der TSC nicht mehr über dem Chart liegt", jetzt eine eigene, statische Spalte rechts neben
   dem Chart (siehe Dashboard.vue: .chart-tsc-row/.chart-tsc-row-tsc). Feste Breite statt der
   früheren max-width (Philip: "Chart-Breite soll sich nicht ändern" — eine feste Spaltenbreite
   erfüllt das automatisch, kein Reflow nötig). overflow-y: auto + Höhe von der Flex-Row geerbt
   (align-items: stretch, Default), damit eine lange Anti-Confluences/Zusatzargumente-Liste selbst
   scrollt statt die ganze Seite zu strecken.
*/
.tsc-card {
  /* 360px (nicht 320px) — Philip hatte die Karte kurz zuvor schon fürs Tag-Label im Header
     verbreitert (Chat 2026-08-28), das bleibt bei diesem Umbau erhalten. */
  width: 360px;
  flex: none;
  overflow-y: auto;
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

.tsc-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Tag-Label (Chat 2026-08-28) — neutral/dezent statt akzentuiert wie .tsc-direction, ist reine
   Orientierung ("für welchen Tag gilt das gerade"), keine Statusfarbe wie Long/Short. */
.tsc-date {
  font-size: 12px;
  font-weight: 600;
  color: #9aa0ac;
  white-space: nowrap;
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

/* Trend-Kette (Chat 2026-08-29) — dieselbe Chip-Optik wie .tsc-direction, aber neutral/grau
   umrandet statt akzentuiert (mehrere gleichzeitig sichtbare Chips, keine einzelne Statusfarbe wie
   Long/Short) und je Chip über --level-color eingefärbt (Uptrend/Downtrend/Unbekannt, siehe
   trendChainLevelDisplay). Eigene Zeile mit Bottom-Border statt im Header (dort schon Datum/
   Richtung/Reset-Icon, für 3 Chips zu eng), aber ohne den Header-Bleed-Trick (kein eigener
   Hintergrundbalken nötig). Nebeneinander mit Umbruch (Philip: erst "übereinander" gewünscht,
   nach der Text-Kürzung auf nur noch das Alter — "4 Tage" statt "4 Tage Trend: Downtrend" — dann
   "jetzt kannst du die chips doch nebeneinander tun" — die Zeilen sind jetzt kurz genug, dass
   Nebeneinander wieder passt). flex-wrap für den Fall, dass mal mehr als 3 Ebenen nicht mehr in
   die 360px-Kartenbreite passen. */
.tsc-trend-chain {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(120, 123, 134, 0.25);
}

/* Trend-Ausrichtung (Chat 2026-08-30) — volle Kartenbreite statt eines schmalen Chips (Philip:
   "über die ganze Breite"). with_trend NICHT grün (Bug-Report Philip: "suggeriert irgendwie nen
   Long", würde mit .tsc-direction.long kollidieren) — stattdessen derselbe Indigo wie
   tradeConfirmation (src/chartColors.js: Bestätigungs-Linien im Chart), semantisch dieselbe
   Bedeutung ("das bestätigt etwas Gutes"), aber richtungsneutral. countertrend bleibt Rot (dieselbe
   Warnsemantik wie überall sonst, candleDown/tradeLoss/NO_GO_COLOR) — dagegen hatte Philip nichts
   einzuwenden. */
.tsc-trend-alignment {
  display: block;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  font-weight: 600;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.tsc-trend-alignment.with_trend {
  /* Bug-Report Philip 2026-08-30: erste Version zu unauffällig — kräftigerer Fill + hellerer,
     stärker gesättigter Indigo-Ton statt des gedeckten Basis-Tons. */
  background: rgba(92, 107, 192, 0.4);
  color: #8c9eff;
}

.tsc-trend-alignment.countertrend {
  background: rgba(239, 83, 80, 0.18);
  color: #ef5350;
}

/* Icon + Chip nebeneinander innerhalb einer Ebene (Philip: "Pfeil links von dem Chip") — die Ebenen
   selbst laufen jetzt in einer Reihe (siehe .tsc-trend-chain: flex-wrap statt flex-direction:column). */
.tsc-trend-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tsc-trend-icon {
  /* Deutlich größer als der Chip-Text (Philip: "bissl größer") — als eigenständiges Richtungssymbol
     links vom Chip, nicht mehr als kleiner Text-Präfix darin. */
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.tsc-trend-level {
  font-weight: 600;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--level-color, rgba(120, 123, 134, 0.4));
  color: var(--level-color, #9aa0ac);
}

.tsc-transfer-btn {
  display: block;
  width: 100%;
  margin-top: 4px;
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.tsc-transfer-btn:hover:not(:disabled) {
  background: rgba(41, 98, 255, 0.12);
}

.tsc-transfer-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Icon-only, destruktive Farbe wie TradeEditModal.vue: .tem-delete-btn — bewusst klein, weil der
   Header nur 10px Padding hat (Philip: "icon reicht ... rechts neben dem Short-Label"). */
.tsc-reset-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: 1px solid rgba(239, 83, 80, 0.4);
  color: #ef5350;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.tsc-reset-icon-btn:hover {
  background: rgba(239, 83, 80, 0.12);
}

/* Target-Picker-Button (Chat 2026-08-27, PLAN-find-targets.md) — sitzt per CrudListSection.vue:
   extra-action-Slot direkt neben deren eigenem Add-Icon, deshalb dieselbe 34x34-Optik wie
   .cls-icon-btn dort (scoped styles greifen komponentenübergreifend nicht, daher hier dupliziert
   statt importiert). */
.tsc-target-picker-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.tsc-target-picker-btn:hover:not(:disabled) {
  border-color: #2962ff;
  color: #d1d4dc;
}

.tsc-target-picker-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
