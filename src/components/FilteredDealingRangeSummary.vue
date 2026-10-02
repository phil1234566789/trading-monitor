<script setup>
import { computed } from 'vue';
import { filteredDealingRangeStatistics, MIN_SIMULATION_WINRATE_CASES } from '../tradeSetupSimulationStatistics.js';
import { fmtMoney, fmtR, pnlClass } from '../format.js';
const props = defineProps({ groups: { type: Array, required: true }, results: { type: Array, required: true }, variant: String });
const summaries = computed(() => filteredDealingRangeStatistics(props.groups, props.results, props.variant));
</script>
<template>
  <section class="filtered-summary" aria-label="Kennzahlen der gefilterten Dealing Ranges">
    <h3>Gefilterte DRs · {{ variant === 'narrow' ? 'Enger SL' : 'Weiter SL' }} · alle Seiten</h3>
    <p v-if="summaries.length > 1">{{ summaries.length }} alternative Laufstände: dieselben Trades können mehrfach vorkommen. PnL und Winrate werden deshalb je Lauf ausgewiesen.</p>
    <p v-if="!summaries.length">Keine DRs für diese Filterauswahl.</p>
    <div v-if="summaries.length" class="summary-scroll" tabindex="0" aria-label="Gefilterte Kennzahlen horizontal scrollen">
      <table>
        <caption>Netto-Kennzahlen je Lauf · PnL aus abgeschlossenen Entries</caption>
        <thead><tr><th scope="col">Lauf</th><th scope="col">DRs</th><th scope="col">Entries</th><th scope="col">Ohne Entry</th><th scope="col">Netto USD</th><th scope="col">Netto R</th><th scope="col">Winrate · n</th><th scope="col">Gewinne / Verluste / BE</th><th scope="col">Offen / Uneindeutig / Nicht ausführbar / Unbekannt</th></tr></thead>
        <tbody><tr v-for="item in summaries" :key="item.runId" :data-summary-run="item.runId">
          <th scope="row" :title="item.runId">{{ item.runId?.slice(-8) }}</th>
          <td>{{ item.ranges }}</td><td>{{ item.total + item.missingResults }}</td><td>{{ item.withoutEntry }}</td>
          <td :class="pnlClass(item.pnlUsd)">{{ fmtMoney(item.pnlUsd) }}<small v-if="item.counts.open">Offen realisiert: {{ fmtMoney(item.openRealizedNetPnlUsd) }}<template v-if="item.openRealizedUnknown"> · {{ item.openRealizedUnknown }} unbekannt</template></small></td>
          <td :class="pnlClass(item.totalR)">{{ fmtR(item.totalR) }}</td>
          <td>{{ item.winrate == null ? '–' : `${item.winrate.toFixed(1)} %` }}<small>{{ item.closed < MIN_SIMULATION_WINRATE_CASES ? 'vorläufig · ' : '' }}n = {{ item.closed }}</small></td>
          <td>{{ item.wins }} / {{ item.losses }} / {{ item.closed - item.wins - item.losses }}</td>
          <td>{{ item.counts.open }} / {{ item.counts.ambiguous }} / {{ item.counts.notExecutable }} / {{ item.missingResults }}</td>
        </tr></tbody>
      </table>
    </div>
    <p>Winrate = Netto-Gewinne / eindeutig abgeschlossene Entries. Ohne Entry, offen, uneindeutig und nicht ausführbar zählen nicht zum Nenner. Kleine Stichproben sind vorläufig.</p>
  </section>
</template>
<style scoped>
.filtered-summary { margin: 16px 0; padding: 12px 16px; border: 1px solid #434651; border-radius: 4px; }
h3 { margin: 0 0 8px; font-size: 14px; }
.summary-scroll { overflow-x: auto; }
.summary-scroll:focus-visible { outline: 2px solid #91b8ff; outline-offset: 3px; }
table { border-collapse: collapse; width: 100%; text-align: left; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid #434651; }
td { white-space: nowrap; } th { font-size: 12px; }
caption { text-align: left; color: #b1b7c5; font-size: 12px; margin: 6px 0; }
small { display: block; }
p, small { color: #b1b7c5; font-size: 12px; margin: 6px 0; }
.positive { color: #71c8b3; } .negative { color: #ef5350; }
</style>
