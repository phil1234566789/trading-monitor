<script setup>
import { computed } from "vue";
import { formatDatedTime, formatBerlinTime } from "../berlinTime.js";
import ChecklistStatusIcon from "./ChecklistStatusIcon.vue";
import ChecklistOrderBlock from "./ChecklistOrderBlock.vue";
import { checklistPresentation } from "../tradeSetupChecklistPresentation.js";
import { unknownChecklistM5 } from "../tradeSetupChecklistM5.js";
import { inactiveM1Checklist } from "../m1Checklist.js";
import { usePreservedScroll } from "../composables/usePreservedScroll.js";
import { entryChecklist } from "../m1Entry.js";
import { useChecklistDisplay } from "../composables/useChecklistDisplay.js";
import { DEALING_RANGE_LABELS } from "../tradeSetup2DealingRange.js";

const props = defineProps({
  instrument: { type: String, required: true },
  checklistState: { type: Object, default: null },
  m1Check: { type: Object, default: null },
});
defineEmits(["close"]);
const { element: scrollElement, rememberScroll } = usePreservedScroll();

const definitions = [
  { key: "h1Trend", label: "1-Stunden-Trend" },
  { key: "liquiditySweep", label: "Liquidity Sweep" },
  { key: "reaction", label: "Reaktion aus Liquidity Sweep" },
  { key: "targets", label: "Targets bestimmen" },
  { key: "antiConfluences", label: "Anti Confluences" },
  { key: "time", label: "Uhrzeit" },
  { key: "confluences", label: "Weitere Confluences" },
  { key: "m5Trend", label: "M5 Trend", fallback: "unknown" },
  { key: "m1", label: "M1" },
  { key: "entry", label: "Entry" },
];
const statuses = {
  passed: { label: "Erfüllt", symbol: "✓" },
  pending: { label: "Ausstehend", symbol: "…" },
  unmet: { label: "Noch nicht erfüllt", symbol: "×" },
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
const { state, busy, retained, m1: displayedM1 } = useChecklistDisplay(props);
const dataStatus = computed(() => state.value
  ? dataStates[state.value.status] ?? { label: "Datenstatus unbekannt", symbol: "?" }
  : { label: "Auswertung ausstehend", symbol: "…" });
const evaluatedAt = computed(() => {
  const time = state.value?.evaluatedAt;
  return Number.isFinite(time) && Number.isFinite(new Date(time * 1000).getTime()) ? formatDatedTime(time) : null;
});
const presentation = computed(() => checklistPresentation(state.value));
const m1 = computed(() => displayedM1.value ?? inactiveM1Checklist('prerequisites'));
const checks = computed(() => definitions.map((definition, index) => {
  const result = definition.key === 'entry' ? entryChecklist(m1.value) : definition.key === 'm1'
    ? m1.value
    : state.value?.checks?.[definition.key] ?? (definition.key === 'm5Trend' ? unknownChecklistM5() : null);
  const status = result?.status in statuses ? result.status : definition.fallback ?? "unknown";
  return {
    ...definition,
    letter: String.fromCharCode(65 + index),
    status,
    ...statuses[status],
    title: definition.label,
    evaluatedAt: result?.evaluatedAt,
    details: Array.isArray(result?.details) ? result.details.filter(detail => typeof detail === "string") : [],
    detailStatuses: result?.detailStatuses ?? [],
    ...presentation.value[definition.key],
  };
}));
</script>

<template>
  <section class="trade-setup-checklist" aria-labelledby="checklist-title" :aria-busy="!!busy">
    <header class="checklist-header">
      <div>
        <h2 id="checklist-title">Trade Setup Checklist <span>{{ instrument }}</span></h2>
        <p class="checklist-loading" role="status"><template v-if="busy"><span class="checklist-spinner" aria-hidden="true"></span>{{ retained ? 'Wird aktualisiert… · vorheriger Stand' : 'Wird aktualisiert…' }}</template></p>
      </div>
      <button type="button" class="checklist-close" aria-label="Trade Setup Checklist schließen" @click="$emit('close')">×</button>
    </header>
    <div class="checklist-evaluation" role="status">
      <div class="checklist-timestamp">
        <time v-if="evaluatedAt" :datetime="new Date(state.evaluatedAt * 1000).toISOString()">{{ evaluatedAt }} Uhr (Europe/Berlin)</time>
        <strong v-else>Bewertungsstand unbekannt</strong>
      </div>
      <ChecklistStatusIcon v-if="!busy" v-bind="dataStatus" />
    </div>
    <p v-if="state?.dealingRange" class="checklist-notice"><strong>{{ DEALING_RANGE_LABELS[state.dealingRange.status] }}</strong><br />{{ state.dealingRange.details?.join(' ') }}</p>
    <p v-if="state?.tradeability === 'blocked'" class="checklist-not-tradeable" role="status">Nicht tradebar</p>
    <p v-if="state?.statistics?.status === 'error'" class="checklist-notice" role="alert">Target-Statistik konnte nicht gespeichert werden. Neuer Versuch bei der nächsten Auswertung.</p>
    <ol ref="scrollElement" class="checklist-checks" tabindex="0" aria-label="Checklist-Prüfungen" @scroll="rememberScroll">
      <li v-for="check in checks" :key="check.key" :data-status="check.status">
        <div class="checklist-check-heading">
          <h3><span class="checklist-letter">{{ check.letter }}</span>{{ check.title }}</h3>
          <ChecklistStatusIcon class="checklist-status" :symbol="check.symbol" :label="check.explanation ? `${check.label} — ${check.explanation}` : check.label" />
        </div>
        <p v-if="check.note" class="checklist-note">{{ check.note }}</p>
        <p v-if="check.key === 'm1' && Number.isFinite(check.evaluatedAt)" class="checklist-note">M1-Stand um {{ formatBerlinTime(check.evaluatedAt) }} Uhr</p>
        <ChecklistOrderBlock v-if="check.orderBlock" :preview="check.orderBlock" :instrument="instrument" />
        <ul v-else-if="check.details.length" class="checklist-details">
          <li v-for="(detail, index) in check.details" :key="index" :data-detail-status="check.detailStatuses[index]">{{ detail }}
            <ChecklistStatusIcon v-if="statuses[check.detailStatuses?.[index]]" class="checklist-detail-status"
              :data-status="check.detailStatuses[index]" v-bind="statuses[check.detailStatuses[index]]" />
          </li>
        </ul>
        <p v-else-if="check.key !== 'entry'" class="checklist-note">{{ state ? 'Noch keine Prüfdaten verfügbar.' : 'Wartet auf die automatische Auswertung.' }}</p>
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
.checklist-header .checklist-loading { display: flex; align-items: center; gap: 6px; min-height: 18px; font-size: 11px; }
.checklist-spinner { width: 11px; height: 11px; flex: none; border: 2px solid rgba(209, 212, 220, 0.3); border-top-color: #d1d4dc; border-radius: 50%; animation: checklist-spin 0.8s linear infinite; }
@keyframes checklist-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .checklist-spinner { animation: none; } }
.checklist-not-tradeable { color: #ff8a87; font-size: 14px; font-weight: 600; }
.checklist-detail-status[data-status="passed"] { color: #71c8b3; border: none; }
.checklist-detail-status[data-status="blocked"], .checklist-detail-status[data-status="unmet"] { color: #ff8a87; }
.checklist-close { flex: none; background: transparent; border: 1px solid #434957; border-radius: 4px; color: #d1d4dc; cursor: pointer; width: 32px; height: 32px; font-size: 20px; }
.checklist-close:hover { background: #2a2e39; }
.checklist-close:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.checklist-evaluation { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 26px; margin: 12px 0 8px; font-size: 13px; }
.checklist-timestamp { display: grid; gap: 4px; }
.checklist-timestamp time { font-weight: 600; }
/* Nur die Prüfungen scrollen; Charthöhe, Kopf und Bewertungsstand bleiben unabhängig vom Inhalt. */
.checklist-checks { display: grid; align-content: start; gap: 12px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-gutter: stable; list-style: none; padding: 0; margin: 16px 0 0; }
.checklist-checks:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.checklist-checks > li { min-width: 0; border-top: 1px solid #2a2e39; padding-top: 12px; overflow-wrap: anywhere; }
h3 { font-size: 13px; line-height: 1.5; }
.checklist-letter { display: inline-block; margin-right: 8px; color: #a5aab5; }
.checklist-status { color: #a5aab5; }
[data-status="passed"] .checklist-status { color: #131722; background: #71c8b3; border-color: #71c8b3; font-weight: 700; }
[data-status="blocked"] .checklist-status { color: #ff8a87; }
.checklist-note { margin-top: 4px; }
.checklist-details { padding-left: 16px; margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
.checklist-details > li[data-detail-status="blocked"], .checklist-details > li[data-detail-status="unmet"] { color: #ff8a87; font-weight: 700; }
@media (max-width: 480px) {
  .trade-setup-checklist { padding: 12px; }
  .checklist-check-heading { flex-wrap: wrap; gap: 4px; }
}
</style>
