<script setup>
import { computed, ref, shallowRef, watch, onScopeDispose } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { groupSetupSnapshots, setupEntryConditions } from '../tradeSetup2Review.js';
import { simulationChartLink, simulationDateFilter } from '../tradeSetupSimulationStatistics.js';
import SetupEntryConditions from './SetupEntryConditions.vue';
import ToggleButton from './ui/ToggleButton.vue';

const props = defineProps({ repository: { type: Object, required: true }, runId: String, runs: Array, instrument: String, variant: String });
const snapshots = shallowRef([]), loading = ref(false), error = ref('');
const filter = ref('all'), from = ref(''), to = ref(''), page = ref(0);
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
const groups = computed(() => groupSetupSnapshots(snapshots.value).filter(row => !props.instrument || row.instrument === props.instrument));
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
  const conditions = setupEntryConditions(row.snapshot).rows;
  return { ...row, summary: ['passed', 'unmet', 'unknown'].map(status => conditions.filter(c => c.status === status).length) };
}));
watch(rows, () => { page.value = 0; });
const chartLink = snapshot => simulationChartLink({ ...snapshot, variant: props.variant }, snapshot.runId);
const origin = snapshot => props.runs?.find(run => run.id === snapshot.runId);
</script>
<template>
  <section class="setup-review" aria-label="Gespeicherte Setups und Entry-Bedingungen" :aria-busy="loading">
    <h2>Setups prüfen · Entry 1</h2>
    <p>Eine Zeile je Lauf und Setup. Kandidat und zugehöriger Entry werden innerhalb desselben Laufs zusammengeführt. Stände aus unterschiedlichen Läufen bleiben wegen möglicher anderer Regeln oder Startpunkte getrennt. Alle Zeiten: Europe/Berlin.</p>
    <p>Bei einem Entry zeigen die Bedingungen den gespeicherten Entry-Stand, sonst den ersten Kandidatenstand.</p>
    <p v-if="loading" role="status">Gespeicherte Setup-Belege werden geladen…</p>
    <p v-else-if="error" role="alert">{{ error }} <button @click="refresh">Erneut versuchen</button></p>
    <template v-else>
      <p class="counts">{{ groups.length }} {{ runId ? 'Setups' : 'Setup-Stände über alle Läufe' }} · {{ withEntry }} mit Entry · {{ groups.length - withEntry }} ohne Entry</p>
      <div class="filters">
        <label>Setup-Filter<select v-model="filter"><option value="all">Alle</option><option value="with">Mit Entry</option><option value="without">Ohne Entry</option></select></label>
        <label>Bewertungsstand ab<input v-model="from" type="date" /></label>
        <label>Bewertungsstand bis einschließlich<input v-model="to" type="date" /></label>
      </div>
      <p v-if="dateError" role="alert">{{ dateError }}</p>
      <div v-else-if="rows.length" class="table-scroll" tabindex="0" aria-label="Setup-Tabelle horizontal scrollen">
        <table>
          <caption>Gespeicherte Setups · {{ rows.length }} Treffer</caption>
          <thead><tr><th scope="col">Bewertungsstand</th><th scope="col">Instrument</th><th scope="col">Richtung</th><th scope="col">Status</th><th scope="col">Lauf</th><th scope="col">Entry-Bedingungen</th><th scope="col">Chart</th></tr></thead>
          <tbody><tr v-for="row in visibleRows" :key="row.key">
            <td>{{ formatDatedTime(row.knownAt) }}</td><td>{{ row.instrument }}</td><td>{{ row.direction === 'long' ? 'Long' : 'Short' }}</td>
            <td>{{ row.entries.length ? 'Mit Entry' : 'Ohne Entry' }}<small>{{ row.entries.length ? 'Entry-Stand' : 'Erster Kandidatenstand' }}</small></td>
            <td :title="row.snapshot.runId">{{ row.snapshot.runId?.slice(-8) }}</td>
            <td><details @toggle="toggle(row.key, $event)"><summary>{{ row.summary[0] }} erfüllt · {{ row.summary[1] }} fehlen · {{ row.summary[2] }} unbekannt</summary>
              <template v-if="expanded.has(row.key)">
                <p class="origin">Lauf: {{ row.snapshot.runId }}<br />Regel: {{ origin(row.snapshot)?.version ?? 'nicht gespeichert' }}<br />
                  <template v-if="origin(row.snapshot)?.from != null">Zeitraum: {{ formatDatedTime(origin(row.snapshot).from) }} – {{ formatDatedTime(origin(row.snapshot).to) }}</template>
                </p>
                <SetupEntryConditions v-for="snapshot in row.entries.length ? row.entries : [row.snapshot]" :key="snapshot.id" :snapshot="snapshot" />
                <p v-if="row.entries.length && row.candidate">Erster Kandidatenstand: {{ formatDatedTime(row.candidate.knownAt) }} Uhr · <RouterLink :to="chartLink(row.candidate)">Kandidatenstand im Chart</RouterLink></p>
              </template>
            </details></td>
            <td><RouterLink :to="chartLink(row.snapshot)" :aria-label="`Setup-Stand ${row.instrument} ${formatDatedTime(row.knownAt)} im Chart öffnen`">Im Chart</RouterLink></td>
          </tr></tbody>
        </table>
      </div>
      <p v-else>Keine Setups für diese Filterauswahl.</p>
      <div class="pagination"><span>{{ rows.length }} Setups · Seite {{ page + 1 }} von {{ pages }}</span>
        <ToggleButton variant="bordered" :disabled="page === 0" @click="page--">Vorherige Setups</ToggleButton>
        <ToggleButton variant="bordered" :disabled="page + 1 >= pages" @click="page++">Weitere Setups</ToggleButton>
      </div>
    </template>
  </section>
</template>
<style scoped>
.setup-review { margin: 24px 0; padding: 20px; border: 1px solid #434651; border-radius: 6px; background: #171c28; font-size: 13px; line-height: 1.6; }
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
