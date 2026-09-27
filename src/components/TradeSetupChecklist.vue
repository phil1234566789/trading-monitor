<script setup>
import { computed } from "vue";
import { formatDatedTime } from "../berlinTime.js";

const props = defineProps({
  instrument: { type: String, required: true },
  checklistState: { type: Object, default: null },
});
defineEmits(["close"]);

const definitions = [
  { key: "h1Trend", label: "1-Stunden-Trend" },
  { key: "liquiditySweep", label: "Liquidity Sweep" },
  { key: "reaction", label: "Reaktion aus Liquidity Sweep" },
  { key: "targets", label: "Targets bestimmen" },
  { key: "antiConfluences", label: "Anti Confluences" },
  { key: "time", label: "Uhrzeit" },
  { key: "confluences", label: "Weitere Confluences", note: "Optionale Zusatzargumente" },
  { key: "m5Trend", label: "M5 Trend", fallback: "pending", note: "Frühe M5-Drehung noch zu präzisieren" },
  { key: "m1", label: "M1", fallback: "deferred", note: "Zurückgestellt · kein aktuelles Freigabekriterium" },
];
const statuses = {
  passed: { label: "Erfüllt", symbol: "✓" },
  pending: { label: "Ausstehend", symbol: "…" },
  blocked: { label: "No-Go", symbol: "×" },
  unknown: { label: "Unbekannt", symbol: "?" },
  deferred: { label: "Zurückgestellt", symbol: "–" },
};
const dataStates = {
  loading: "Auswertung lädt",
  ready: "Daten ausgewertet",
  missing: "Daten fehlen",
  stale: "Daten veraltet",
  error: "Auswertung fehlgeschlagen",
};
// Ein verspätetes Ergebnis eines anderen Instruments darf keine grünen Prüfpunkte liefern.
const state = computed(() => props.checklistState?.instrument === props.instrument ? props.checklistState : null);
const dataStatus = computed(() => state.value
  ? dataStates[state.value.status] ?? "Datenstatus unbekannt"
  : "Auswertung ausstehend");
const evaluatedAt = computed(() => {
  const time = state.value?.evaluatedAt;
  return Number.isFinite(time) && Number.isFinite(new Date(time * 1000).getTime()) ? formatDatedTime(time) : null;
});
const checks = computed(() => definitions.map((definition, index) => {
  const result = state.value?.checks?.[definition.key];
  const status = result?.status in statuses ? result.status : definition.fallback ?? "unknown";
  return {
    ...definition,
    letter: String.fromCharCode(65 + index),
    status,
    ...statuses[status],
    title: definition.label,
    details: Array.isArray(result?.details) ? result.details.filter(detail => typeof detail === "string") : [],
  };
}));
</script>

<template>
  <section class="trade-setup-checklist" aria-labelledby="checklist-title" :aria-busy="state?.status === 'loading'">
    <header class="checklist-header">
      <div>
        <h2 id="checklist-title">Trade Setup Checklist <span>{{ instrument }}</span></h2>
        <p>Automatische Prüfung zum Chart-/Replay-Zeitpunkt</p>
      </div>
      <button type="button" class="checklist-close" aria-label="Trade Setup Checklist schließen" @click="$emit('close')">×</button>
    </header>
    <div class="checklist-evaluation" role="status">
      <strong>{{ dataStatus }}</strong>
      <span>Bewertungsstand: {{ evaluatedAt ? `${evaluatedAt} Uhr (Europe/Berlin)` : 'noch nicht verfügbar' }}</span>
    </div>
    <p class="checklist-notice">Die Einzelprüfungen ergeben noch keine endgültige Setup-Freigabe.</p>
    <ol class="checklist-checks">
      <li v-for="check in checks" :key="check.key" :data-status="check.status">
        <div class="checklist-check-heading">
          <h3><span class="checklist-letter">{{ check.letter }}</span>{{ check.title }}</h3>
          <span class="checklist-status"><span aria-hidden="true">{{ check.symbol }}</span> {{ check.label }}</span>
        </div>
        <p v-if="check.note" class="checklist-note">{{ check.note }}</p>
        <ul v-if="check.details.length" class="checklist-details">
          <li v-for="(detail, index) in check.details" :key="index">{{ detail }}</li>
        </ul>
        <p v-else class="checklist-note">{{ state ? 'Noch keine Prüfdaten verfügbar.' : 'Wartet auf die automatische Auswertung.' }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.trade-setup-checklist { margin: 12px 0; padding: 16px; border: 1px solid #2a2e39; border-radius: 8px; background: #131722; color: #d1d4dc; }
.checklist-header, .checklist-check-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2, h3, p { margin: 0; }
h2 { font-size: 15px; }
h2 span { margin-left: 8px; color: #a5aab5; font-weight: 400; }
.checklist-header p, .checklist-notice, .checklist-note { font-size: 13px; color: #a5aab5; line-height: 1.5; }
.checklist-header p { margin-top: 4px; }
.checklist-close { flex: none; background: transparent; border: 1px solid #434957; border-radius: 4px; color: #d1d4dc; cursor: pointer; width: 32px; height: 32px; font-size: 20px; }
.checklist-close:hover { background: #2a2e39; }
.checklist-close:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.checklist-evaluation { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 12px 0 4px; font-size: 13px; }
.checklist-evaluation span { color: #a5aab5; }
.checklist-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 12px; list-style: none; padding: 0; margin: 16px 0 0; }
.checklist-checks > li { min-width: 0; border-top: 1px solid #2a2e39; padding-top: 12px; overflow-wrap: anywhere; }
h3 { font-size: 13px; line-height: 1.5; }
.checklist-letter { display: inline-block; margin-right: 8px; color: #a5aab5; }
.checklist-status { flex: none; font-size: 12px; line-height: 1.5; color: #a5aab5; }
[data-status="passed"] .checklist-status { color: #71c8b3; }
[data-status="blocked"] .checklist-status { color: #ff8a87; }
.checklist-note { margin-top: 4px; }
.checklist-details { padding-left: 16px; margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
@media (max-width: 480px) {
  .trade-setup-checklist { padding: 12px; }
  .checklist-check-heading { flex-wrap: wrap; gap: 4px; }
}
</style>
