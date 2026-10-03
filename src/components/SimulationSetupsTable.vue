<script setup>
import { computed, ref, shallowRef, watch, onScopeDispose } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { groupSetupSnapshots, filterDealingRanges, setupEntryConditions, REVIEW_STATUS_ICONS } from '../tradeSetup2Review.js';
import { DEALING_RANGE_LABELS, savedDealingRangeStatus } from '../tradeSetup2DealingRange.js';
import { simulationChartLink, simulationDateFilter, simulationRunLink } from '../tradeSetupSimulationStatistics.js';
import SetupEntryConditions from './SetupEntryConditions.vue';
import ToggleButton from './ui/ToggleButton.vue';
import SimulationEntryResult from './SimulationEntryResult.vue';
import FilteredDealingRangeSummary from './FilteredDealingRangeSummary.vue';
import DealingRangeOutcome from './DealingRangeOutcome.vue';

const props = defineProps({ repository: { type: Object, required: true }, runId: String, runs: Array, instrument: String, variant: String, results: { type: Array, default: () => [] }, resultsLoading: Boolean, resultsError: String });
const snapshots = shallowRef([]), loading = ref(false), error = ref('');
const filter = ref('all'), from = ref(''), to = ref(''), page = ref(0);
const drFilter = ref('current');
const expanded = ref(new Set());
function toggle(key, event) { event.target.open ? expanded.value.add(key) : expanded.value.delete(key); }
const pageSize = 25;
let revision = 0;
async function refresh() {
  const ticket = ++revision;
  snapshots.value = []; error.value = ''; loading.value = true;
  try {
    const data = await props.repository.listReviewSnapshots(props.runId);
    if (ticket === revision) snapshots.value = data;
  } catch (cause) { if (ticket === revision) error.value = cause.message || 'Setups konnten nicht geladen werden.'; }
  finally { if (ticket === revision) loading.value = false; }
}
watch(() => props.runId, refresh, { immediate: true });
onScopeDispose(() => { revision++; });
defineExpose({ refresh });
const allGroups = computed(() => groupSetupSnapshots(snapshots.value).filter(row => !props.instrument || row.instrument === props.instrument));
const groups = computed(() => filterDealingRanges(allGroups.value, drFilter.value));
const legacyCount = computed(() => filterDealingRanges(allGroups.value, 'legacy').length);
const withEntry = computed(() => groups.value.filter(row => row.entries.length).length);
const dateError = computed(() => from.value && to.value && from.value > to.value ? 'Das Enddatum liegt vor dem Startdatum.' : '');
const rows = computed(() => {
  if (dateError.value) return [];
  const bounds = simulationDateFilter(from.value, to.value);
  return groups.value.filter(row => (filter.value === 'all' || (filter.value === 'with') === !!row.entries.length)
    && (bounds.from == null || row.knownAt >= bounds.from) && (bounds.to == null || row.knownAt < bounds.to));
});
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)));
const visibleRows = computed(() => rows.value.slice(page.value * pageSize, (page.value + 1) * pageSize).map(row => {
  return { ...row, review: setupEntryConditions(row.snapshot) };
}));
watch(rows, () => { page.value = 0; });
const chartLink = snapshot => simulationChartLink({ ...snapshot, variant: props.variant }, snapshot.runId);
const origin = snapshot => props.runs?.find(run => run.id === snapshot.runId);
</script>
<template>
  <section class="setup-review" aria-label="Gespeicherte Setups und Entry-Bedingungen" :aria-busy="loading">
    <h2>Dealing Ranges prüfen · Entry 1</h2>
    <p>Eine Zeile je Lauf und Setup. Kandidat und zugehöriger Entry werden innerhalb desselben Laufs zusammengeführt. Stände aus unterschiedlichen Läufen bleiben wegen möglicher anderer Regeln oder Startpunkte getrennt. Alle Zeiten: Europe/Berlin.</p>
    <p>Die neue Version zählt vollständig bestätigte ABC-Ranges, auch ohne Entry und bei gescheiterter Validierung. Bei einem Entry zeigen die Bedingungen den Entry-Stand, sonst den zuletzt gespeicherten DR-Stand.</p>
    <p>Validierte DRs ohne Entry zeigen den gespeicherten Verlauf ab erster Validierung bis T1 oder Invalidierung. Das ist kein Trade-Ergebnis und zählt nicht zu PnL oder Winrate.</p>
    <p v-if="loading" role="status">Gespeicherte Setup-Belege werden geladen…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="refresh">Erneut versuchen</button></p>
    <template v-else>
      <p class="counts">{{ groups.length }} {{ runId ? 'Setups' : 'Setup-Stände über alle Läufe' }} · {{ withEntry }} mit Entry · {{ groups.length - withEntry }} ohne Entry</p>
      <p v-if="legacyCount">{{ legacyCount }} Altstände enthalten keine gespeicherte DR-Stufe. Über „Altstände“ bleiben sie mit ihren ursprünglichen Belegen zugänglich.</p>
      <div class="filters">
        <label>DR-Stufe<select v-model="drFilter"><option value="current">Alle bestätigten Ranges · neue Version</option><option value="validated">Validierte Dealing Ranges</option><option value="invalidated">Invalidierte Dealing Ranges</option><option value="confirmed">Bestätigt · Validierung offen</option><option value="legacy">Altstände · ursprüngliche Kandidaten</option></select></label>
        <label>Setup-Filter<select v-model="filter"><option value="all">Alle</option><option value="with">Mit Entry</option><option value="without">Ohne Entry</option></select></label>
        <label>Bewertungsstand ab<input v-model="from" type="date" /></label>
        <label>Bewertungsstand bis einschließlich<input v-model="to" type="date" /></label>
      </div>
      <p v-if="dateError" role="alert">{{ dateError }}</p>
      <FilteredDealingRangeSummary v-if="!dateError && !resultsLoading && !resultsError" :groups="rows" :results="results" :variant="variant" />
      <p v-else-if="!dateError">{{ resultsLoading ? 'Kennzahlen werden geladen…' : 'Kennzahlen nicht verfügbar.' }}</p>
      <div v-if="!dateError && rows.length" class="table-scroll" tabindex="0" aria-label="Setup-Tabelle horizontal scrollen">
        <table>
          <caption>Gespeicherte Setups · {{ rows.length }} Treffer</caption>
          <thead><tr><th scope="col">Bewertungsstand</th><th scope="col">Instrument</th><th scope="col">Richtung</th><th scope="col">Status</th><th scope="col">Lauf</th><th scope="col">Entry-Ergebnis · {{ variant === 'narrow' ? 'Enger SL' : 'Weiter SL' }}</th><th scope="col">Entry-Bedingungen</th><th scope="col">Chart</th></tr></thead>
          <tbody><tr v-for="row in visibleRows" :key="row.key">
            <td>{{ formatDatedTime(row.knownAt) }}</td><td>{{ row.instrument }}</td><td>{{ row.direction === 'long' ? 'Long' : 'Short' }}</td>
            <td><strong>{{ DEALING_RANGE_LABELS[savedDealingRangeStatus(row.snapshot)] }}</strong><small>{{ row.entries.length ? 'Mit Entry · Entry-Stand' : 'Ohne Entry · gespeicherter DR-Stand' }}</small><small v-for="detail in row.snapshot.dealingRange?.details" :key="detail">{{ detail }}</small><strong :class="row.review.assessment.status">{{ REVIEW_STATUS_ICONS[row.review.assessment.status] }} {{ row.review.assessment.label }}</strong></td>
            <td :title="row.snapshot.runId"><RouterLink :to="simulationRunLink(row.snapshot.runId, variant)">{{ row.snapshot.runId?.slice(-8) }} · Ergebnisse</RouterLink></td>
            <td><template v-if="!row.entries.length">Kein Entry<DealingRangeOutcome :group="row" /></template><span v-else-if="resultsLoading">Ergebnis wird geladen…</span><span v-else-if="resultsError">Ergebnis nicht verfügbar</span><SimulationEntryResult v-else v-for="entry in row.entries" :key="entry.id" :snapshot="entry" :results="results" :variant="variant" /></td>
            <td>
              <ul v-if="row.review.missing.length" class="missing-conditions"><li v-for="condition in row.review.missing" :key="condition.key" class="unmet"><strong>✕ {{ condition.label }}: {{ condition.key === 'time' ? 'Nicht tradebar' : 'Fehlt' }}</strong><div v-for="(detail, index) in condition.details" :key="index">{{ detail }}</div></li></ul>
              <details @toggle="toggle(row.key, $event)"><summary><span class="passed">✓ {{ row.review.counts[0] }} erfüllt</span> · <span class="unmet">✕ {{ row.review.counts[1] }} {{ row.review.counts[1] === 1 ? 'fehlt' : 'fehlen' }}</span> · <span class="unknown">? {{ row.review.counts[2] }} unbekannt</span></summary>
              <template v-if="expanded.has(row.key)">
                <p class="origin">Lauf: {{ row.snapshot.runId }}<br />Regel: {{ origin(row.snapshot)?.version ?? 'nicht gespeichert' }}<br />
                  <template v-if="origin(row.snapshot)?.from != null">Zeitraum: {{ formatDatedTime(origin(row.snapshot).from) }} – {{ formatDatedTime(origin(row.snapshot).to) }}</template>
                </p>
                <SetupEntryConditions v-for="snapshot in row.entries.length ? row.entries : [row.snapshot]" :key="snapshot.id" :snapshot="snapshot" />
                <p v-if="row.entries.length && row.candidate">Erster Kandidatenstand: {{ formatDatedTime(row.candidate.knownAt) }} Uhr · <RouterLink :to="chartLink(row.candidate)" target="_blank" rel="noopener noreferrer">Kandidatenstand im Chart</RouterLink></p>
              </template>
            </details>
              <small v-if="!row.entries.length">Gespeicherter DR-Stand; keine vollständige spätere Entry-Prüfung.</small>
            </td>
            <td><RouterLink :to="chartLink(row.snapshot)" target="_blank" rel="noopener noreferrer" :aria-label="`Setup-Stand ${row.instrument} ${formatDatedTime(row.knownAt)} im Chart öffnen`">Im Chart</RouterLink></td>
          </tr></tbody>
        </table>
      </div>
      <p v-else-if="!dateError">Keine Setups für diese Filterauswahl.</p>
      <div class="pagination"><span>{{ rows.length }} Setups · Seite {{ page + 1 }} von {{ pages }}</span>
        <ToggleButton variant="bordered" :disabled="page === 0" @click="page--">Vorherige Setups</ToggleButton>
        <ToggleButton variant="bordered" :disabled="page + 1 >= pages" @click="page++">Weitere Setups</ToggleButton>
      </div>
    </template>
  </section>
</template>
<style scoped>
.setup-review { margin: 24px 0; padding: 20px; border: 1px solid #434651; border-radius: 6px; background: #171c28; font-size: 13px; line-height: 1.6; }
.passed { color: #81d993; } .unmet { color: #ff8b91; } .unknown { color: #b1b7c5; } .missing-conditions { padding-left: 18px; margin: 8px 0; }
h2 { font-size: 18px; margin: 0; } p, small { color: #b1b7c5; } .counts { font-weight: 600; color: #edf2ff; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; } label { display: flex; flex-direction: column; gap: 4px; }
select, input, button { color: #d1d4dc; background: #1e222d; border: 1px solid #626b7f; border-radius: 4px; padding: 7px; color-scheme: dark; }
.table-scroll { overflow-x: auto; } table { border-collapse: collapse; width: 100%; text-align: left; font-size: 12px; }
caption { text-align: left; color: #b1b7c5; padding: 8px 0; } th, td { padding: 12px 10px; border-bottom: 1px solid #434651; vertical-align: top; }
th { background: #222a3a; } td:first-child { white-space: nowrap; } small { display: block; } summary { cursor: pointer; min-width: 245px; }
a { color: #91b8ff; } .pagination { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: flex-end; margin-top: 12px; }
:is(select,input,button,summary,a):focus-visible { outline: 2px solid #91b8ff; outline-offset: 3px; }
@media(max-width:600px) { .setup-review { padding: 12px; } }
</style>
