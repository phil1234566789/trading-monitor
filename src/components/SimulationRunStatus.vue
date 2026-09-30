<script setup>
import { computed } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { simulationRunStatusLabel } from '../tradeSetupSimulationStatistics.js';

const props = defineProps({ run: { type: Object, required: true } });
const phaseLabels = { download: 'Kerzen laden', scan: 'Setups auswerten', publish: 'Ergebnisse speichern', complete: 'Auswertung beendet' };
const progress = computed(() => props.run.progress ?? {});
const measurableProgress = computed(() => Number.isFinite(progress.value.completed) && Number.isFinite(progress.value.total) && progress.value.total > 0);
const timeframes = computed(() => (props.run.coverage?.instruments ?? []).flatMap(item => Object.entries(item.timeframes ?? {}).map(([bar, coverage]) => ({ instrument: item.instrument, bar, ...coverage }))));
const at = value => value == null ? '–' : formatDatedTime(value);
const h1Start = computed(() => {
  const config = props.run.configuration ?? {};
  const settings = config.settings ?? config;
  if (config.startPolicy === 'historical-d1-p4') return 'Jeweils damals bestätigter Tagespivot (D1, Periode 4)';
  if (settings.rangesFixedStartActive && Number.isFinite(settings.rangesFixedStartTime)) return `Manuell fixiert: ${at(settings.rangesFixedStartTime)} (Replay)`;
  return 'Im Lauf nicht angegeben';
});
</script>

<template>
  <section class="run-status" aria-label="Auswertungslauf">
    <div class="run-summary">
      <strong>{{ simulationRunStatusLabel(run) }}</strong>
      <span>Angeforderter Zeitraum {{ at(run.from) }} – {{ at(run.to) }} (Ende exklusiv)</span>
      <span>Datenstand {{ at(run.evaluatedAt) }} · Europe/Berlin</span>
    </div>
    <p>H1-Start: {{ h1Start }}</p>
    <p v-if="run.status === 'running'" role="status" class="progress-label">
      {{ phaseLabels[progress.phase] ?? 'Auswertung läuft' }}<template v-if="progress.instrument"> · {{ progress.instrument }}</template>
      <template v-if="measurableProgress"> · {{ progress.completed }} / {{ progress.total }} {{ progress.phase === 'download' ? 'Instrumente' : 'Schritte' }}</template>
      <template v-if="progress.loadedRows != null"> · {{ progress.loadedRows }} Kerzen geladen ({{ progress.bar }})</template>
      <template v-if="progress.daysTotal != null"> · {{ progress.daysCompleted }} / {{ progress.daysTotal }} Tage</template>
    </p>
    <progress v-if="run.status === 'running' && measurableProgress" :value="progress.completed" :max="progress.total" aria-label="Fortschritt der aktuellen Phase" />
    <p v-if="run.status === 'running'">Zwischenstand: Ergebnisse und Zählungen enthalten nur bisher gespeicherte Daten.</p>
    <p v-if="run.status === 'failed'" role="alert" class="failed">Der Lauf wurde nicht vollständig abgeschlossen. Gespeicherte Ergebnisse bilden nur den erreichten Stand ab.</p>
    <p v-if="!run.coverage?.instruments?.length" class="coverage-hint">Für diesen Lauf ist noch kein ausgewerteter Datenumfang angegeben.</p>
    <p v-for="item in run.coverage?.instruments ?? []" :key="item.instrument" class="coverage-hint">{{ item.instrument }} · {{ run.status === 'complete' ? 'ausgewertetes Fenster' : 'geladenes Datenfenster' }} {{ at(item.from) }} – {{ at(item.to) }} (Ende exklusiv)</p>
    <details>
      <summary>Datenumfang und Messgrenzen</summary>
      <p>Quelle: {{ run.provenance?.source ?? 'Noch nicht angegeben' }} · Regel: {{ run.version }}</p>
      <p v-if="!run.provenance?.limitations?.length">Für diesen Lauf sind noch keine weiteren Messgrenzen hinterlegt.</p>
      <ul v-else><li v-for="limit in run.provenance.limitations" :key="limit">{{ limit }}</li></ul>
      <p v-for="item in run.coverage?.excluded ?? []" :key="item.instrument">{{ item.instrument }} ausgeschlossen: {{ item.reason === 'noM1Archive' ? 'Kein M1-Archiv verfügbar.' : 'Für diesen Lauf nicht auswertbar.' }}</p>
      <div v-if="timeframes.length" class="coverage-table"><table>
        <caption>Geladene Kerzen einschließlich Vorlauf. Zeitlücken sind keine bereinigte Marktausfallquote.</caption>
        <thead><tr><th>Instrument</th><th>Zeiteinheit</th><th>Von</th><th>Bis exklusiv</th><th>Kerzen</th><th>Zeitlücken</th><th>Fehlende Intervalle</th></tr></thead>
        <tbody><tr v-for="item in timeframes" :key="`${item.instrument}:${item.bar}`"><td>{{ item.instrument }}</td><td>{{ item.bar }}</td><td>{{ at(item.from) }}</td><td>{{ at(item.to) }}</td><td>{{ item.count }}</td><td>{{ item.gapCount }}</td><td>{{ item.missingBars }}</td></tr></tbody>
      </table></div>
      <p class="run-id">Lauf: {{ run.id }}</p>
    </details>
  </section>
</template>

<style scoped>
.run-status { margin-bottom: 20px; font-size: 12px; line-height: 1.6; color: #a5a9b4; }
.run-summary { display: flex; flex-wrap: wrap; gap: 8px 20px; }
strong { color: #d1d4dc; } p { margin: 8px 0; }
progress { width: min(100%, 360px); accent-color: #71c8b3; }
.failed { color: #ef5350; }
details { margin-top: 12px; padding: 10px 12px; border: 1px solid #2a2e39; border-radius: 4px; }
summary { cursor: pointer; color: #d1d4dc; }
.coverage-table { overflow-x: auto; }
table { border-collapse: collapse; white-space: nowrap; text-align: left; width: 100%; }
caption { text-align: left; padding: 8px 0; }
th, td { padding: 6px 12px 6px 0; border-bottom: 1px solid #2a2e39; }
th { font-weight: 500; }
.run-id { overflow-wrap: anywhere; }
</style>
