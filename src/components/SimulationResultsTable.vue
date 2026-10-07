<script setup>
import { computed, ref, watch } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { fmtMoney, fmtR } from '../format.js';
import { SIMULATION_OUTCOME_LABELS, SIMULATION_REASON_LABELS, simulationOutcomeKey, simulationChartLink } from '../tradeSetupSimulationStatistics.js';
import ToggleButton from './ui/ToggleButton.vue';
import {entryCategorySizeLabel,entryOptionalConditionLabel,entryBudgetLabel,entryLotsLabel} from '../entryPresentation.js';

const props = defineProps({ rows: { type: Array, required: true }, runId: { type: String, required: true } });
const page = ref(0);
const pageSize = 50;
const pages = computed(() => Math.max(1, Math.ceil(props.rows.length / pageSize)));
const visibleRows = computed(() => props.rows.slice(page.value * pageSize, (page.value + 1) * pageSize));
watch(() => props.rows, () => { page.value = 0; });
const lots = value => value == null ? '–' : value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
</script>

<template>
  <section aria-label="Simulationsergebnisse">
    <div class="table-scroll" tabindex="0" aria-label="Ergebnistabelle horizontal scrollen">
      <table>
        <caption>Simulierte Positionen · Zeiten in Europe/Berlin · Brutto und Netto getrennt</caption>
        <thead><tr>
          <th scope="col">Entry</th><th scope="col">Instrument</th><th scope="col">Richtung</th>
          <th scope="col">Entry-Größe / Grund</th><th scope="col">Lots</th><th scope="col" title="Geplanter Teilausstieg: exakt 50 % des Anfangsvolumens">T1-Anteil Lots</th><th scope="col">Risiko USD</th>
          <th scope="col">Ergebnis</th><th scope="col">Brutto R</th><th scope="col">Brutto USD</th><th scope="col">Kommission USD</th><th scope="col">Netto R</th><th scope="col">Netto USD</th><th scope="col">Realisiert brutto USD</th><th scope="col">Realisiert netto USD</th><th scope="col">Setup</th>
        </tr></thead>
        <tbody><tr v-for="row in visibleRows" :key="`${row.entryId}:${row.variant}`">
          <td>{{ row.entryTime == null ? '–' : formatDatedTime(row.entryTime) }}</td>
          <td>{{ row.instrument }}</td><td>{{ row.direction === 'long' ? 'Long' : row.direction === 'short' ? 'Short' : '–' }}</td>
          <td class="entry-sizing">{{ entryCategorySizeLabel(row) }}<small v-if="entryOptionalConditionLabel(row)">{{ entryOptionalConditionLabel(row) }}</small><small v-if="entryLotsLabel(row)">{{ entryLotsLabel(row) }}</small><small v-if="entryBudgetLabel(row)">{{ entryBudgetLabel(row) }}</small></td>
          <td class="number">{{ lots(row.lots) }}</td><td class="number">{{ lots(row.t1Lots) }}</td>
          <td class="number">{{ fmtMoney(row.actualRisk) }}</td>
          <td><span>{{ SIMULATION_OUTCOME_LABELS[simulationOutcomeKey(row)] ?? 'Unbekannt' }}</span><small v-if="row.reason">{{ SIMULATION_REASON_LABELS[row.reason] ?? 'Ergebnis nicht abschließend bestimmbar' }}</small></td>
          <td class="number" :class="{ positive: row.pnlUsd > 0, negative: row.pnlUsd < 0 }">{{ fmtR(row.rMultiple) }}</td>
          <td class="number" :class="{ positive: row.pnlUsd > 0, negative: row.pnlUsd < 0 }">{{ fmtMoney(row.pnlUsd) }}</td>
          <td class="number">{{ fmtMoney(row.commissionUsd) }}</td>
          <td class="number">{{ fmtR(row.netRMultiple) }}</td>
          <td class="number" :class="{ positive: row.netPnlUsd > 0, negative: row.netPnlUsd < 0 }">{{ fmtMoney(row.netPnlUsd) }}</td>
          <td class="number">{{ fmtMoney(row.realizedPnlUsd) }}</td>
          <td class="number">{{ fmtMoney(row.realizedNetPnlUsd) }}</td>
          <td><RouterLink :to="simulationChartLink(row, runId)" target="_blank" rel="noopener noreferrer" :aria-label="`Setup ${row.instrument} ${formatDatedTime(row.entryTime)} im Chart öffnen`">Im Chart</RouterLink></td>
        </tr></tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ rows.length }} Ergebnisse · Seite {{ page + 1 }} von {{ pages }}</span>
      <ToggleButton variant="bordered" :disabled="page === 0" @click="page--">Zurück</ToggleButton>
      <ToggleButton variant="bordered" :disabled="page + 1 >= pages" @click="page++">Weiter</ToggleButton>
    </div>
  </section>
</template>

<style scoped>
.table-scroll { overflow-x: auto; border: 1px solid #2a2e39; border-radius: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; white-space: nowrap; }
caption { text-align: left; padding: 12px; color: #a5a9b4; }
th { color: #a5a9b4; background: #1e222d; font-weight: 500; }
th, td { padding: 10px 12px; border-bottom: 1px solid #2a2e39; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: #1e222d; }
.number { font-variant-numeric: tabular-nums; text-align: right; }
.entry-sizing { min-width: 200px; max-width: 280px; white-space: normal; }
.positive { color: #71c8b3; } .negative { color: #ef5350; }
a { color: #82aaff; } small { display: block; color: #a5a9b4; margin-top: 4px; }
.pagination { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; margin-top: 12px; color: #a5a9b4; font-size: 12px; }
</style>
