<script setup>
import { computed } from "vue";
import { formatDatedTime } from "../berlinTime.js";
import ChecklistStatusIcon from "./ChecklistStatusIcon.vue";
import ChecklistOrderBlock from "./ChecklistOrderBlock.vue";
import { checklistPresentation } from "../tradeSetupChecklistPresentation.js";

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
  { key: "confluences", label: "Weitere Confluences" },
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
  loading: { label: "Auswertung lädt", symbol: "↻" },
  ready: { label: "Daten ausgewertet", symbol: "✓" },
  missing: { label: "Daten fehlen", symbol: "?" },
  stale: { label: "Daten veraltet", symbol: "◷" },
  error: { label: "Auswertung fehlgeschlagen", symbol: "!" },
};
// Ein verspätetes Ergebnis eines anderen Instruments darf keine grünen Prüfpunkte liefern.
const state = computed(() => props.checklistState?.instrument === props.instrument ? props.checklistState : null);
const dataStatus = computed(() => state.value
  ? dataStates[state.value.status] ?? { label: "Datenstatus unbekannt", symbol: "?" }
  : { label: "Auswertung ausstehend", symbol: "…" });
const evaluatedAt = computed(() => {
  const time = state.value?.evaluatedAt;
  return Number.isFinite(time) && Number.isFinite(new Date(time * 1000).getTime()) ? formatDatedTime(time) : null;
});
const presentation = computed(() => checklistPresentation(state.value));
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
    detailStatuses: result?.detailStatuses ?? [],
    ...presentation.value[definition.key],
  };
}));
</script>

<template>
  <section class="trade-setup-checklist" aria-labelledby="checklist-title" :aria-busy="state?.status === 'loading'">
    <header class="checklist-header">
      <div>
        <h2 id="checklist-title">Trade Setup Checklist <span>{{ instrument }}</span></h2>
      </div>
      <button type="button" class="checklist-close" aria-label="Trade Setup Checklist schließen" @click="$emit('close')">×</button>
    </header>
    <div class="checklist-evaluation" role="status">
      <div class="checklist-timestamp">
        <span>Algorithmus-Bewertungsstand</span>
        <time v-if="evaluatedAt" :datetime="new Date(state.evaluatedAt * 1000).toISOString()">{{ evaluatedAt }} Uhr (Europe/Berlin)</time>
        <strong v-else>Bewertungsstand unbekannt</strong>
      </div>
      <ChecklistStatusIcon v-bind="dataStatus" />
    </div>
    <p v-if="state?.tradeability === 'blocked'" class="checklist-not-tradeable" role="status">Nicht tradebar</p>
    <p v-else class="checklist-notice">Die Einzelprüfungen ergeben noch keine endgültige Setup-Freigabe.</p>
    <ol class="checklist-checks" tabindex="0" aria-label="Checklist-Prüfungen">
      <li v-for="check in checks" :key="check.key" :data-status="check.status">
        <div class="checklist-check-heading">
          <h3><span class="checklist-letter">{{ check.letter }}</span>{{ check.title }}</h3>
          <ChecklistStatusIcon class="checklist-status" :symbol="check.symbol" :label="check.explanation ? `${check.label} — ${check.explanation}` : check.label" />
        </div>
        <p v-if="check.note" class="checklist-note">{{ check.note }}</p>
        <ChecklistOrderBlock v-if="check.orderBlock" :preview="check.orderBlock" :instrument="instrument" />
        <ul v-else-if="check.details.length" class="checklist-details">
          <li v-for="(detail, index) in check.details" :key="index">{{ detail }}
            <ChecklistStatusIcon v-if="statuses[check.detailStatuses?.[index]]" class="checklist-detail-status"
              :data-status="check.detailStatuses[index]" v-bind="statuses[check.detailStatuses[index]]" />
          </li>
        </ul>
        <p v-else class="checklist-note">{{ state ? 'Noch keine Prüfdaten verfügbar.' : 'Wartet auf die automatische Auswertung.' }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.trade-setup-checklist { width: 340px; flex: none; align-self: flex-start; box-sizing: border-box; display: flex; flex-direction: column; min-height: 0; padding: 16px; border: 1px solid #2a2e39; border-radius: 8px; background: #131722; color: #d1d4dc; }
.trade-setup-checklist > :not(.checklist-checks) { flex-shrink: 0; }
.checklist-header, .checklist-check-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2, h3, p { margin: 0; }
h2 { font-size: 15px; }
h2 span { margin-left: 8px; color: #a5aab5; font-weight: 400; }
.checklist-header p, .checklist-notice, .checklist-note { font-size: 13px; color: #a5aab5; line-height: 1.5; }
.checklist-header p { margin-top: 4px; }
.checklist-not-tradeable { color: #ff8a87; font-size: 14px; font-weight: 600; }
.checklist-detail-status[data-status="passed"] { color: #71c8b3; }
.checklist-detail-status[data-status="blocked"] { color: #ff8a87; }
.checklist-close { flex: none; background: transparent; border: 1px solid #434957; border-radius: 4px; color: #d1d4dc; cursor: pointer; width: 32px; height: 32px; font-size: 20px; }
.checklist-close:hover { background: #2a2e39; }
.checklist-close:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.checklist-evaluation { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 12px 0 8px; font-size: 13px; }
.checklist-timestamp { display: grid; gap: 4px; }
.checklist-timestamp > span { color: #a5aab5; font-size: 12px; }
.checklist-timestamp time { font-weight: 600; }
/* Nur die Prüfungen scrollen; Charthöhe, Kopf und Bewertungsstand bleiben unabhängig vom Inhalt. */
.checklist-checks { display: grid; align-content: start; gap: 12px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-gutter: stable; list-style: none; padding: 0; margin: 16px 0 0; }
.checklist-checks:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.checklist-checks > li { min-width: 0; border-top: 1px solid #2a2e39; padding-top: 12px; overflow-wrap: anywhere; }
h3 { font-size: 13px; line-height: 1.5; }
.checklist-letter { display: inline-block; margin-right: 8px; color: #a5aab5; }
.checklist-status { color: #a5aab5; }
[data-status="passed"] .checklist-status { color: #71c8b3; }
[data-status="blocked"] .checklist-status { color: #ff8a87; }
.checklist-note { margin-top: 4px; }
.checklist-details { padding-left: 16px; margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
@media (max-width: 480px) {
  .trade-setup-checklist { padding: 12px; }
  .checklist-check-heading { flex-wrap: wrap; gap: 4px; }
}
</style>
