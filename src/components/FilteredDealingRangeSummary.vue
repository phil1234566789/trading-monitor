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
    <div v-for="item in summaries" :key="item.runId" class="run-summary" :data-summary-run="item.runId">
      <strong v-if="summaries.length > 1">Lauf {{ item.runId?.slice(-8) }}</strong>
      <span>{{ item.ranges }} DRs · {{ item.total + item.missingResults }} Entries · {{ item.withoutEntry }} ohne Entry</span>
      <span :class="pnlClass(item.pnlUsd)">Gesamt-Netto-PnL abgeschlossen: {{ fmtMoney(item.pnlUsd) }} · {{ fmtR(item.totalR) }}</span>
      <span>Winrate: {{ item.winrate == null ? '–' : `${item.winrate.toFixed(1)} %` }} · {{ item.closed < MIN_SIMULATION_WINRATE_CASES ? 'vorläufig · ' : '' }}n = {{ item.closed }} ({{ item.wins }} Gewinne / {{ item.losses }} Verluste / {{ item.closed - item.wins - item.losses }} BE)</span>
      <small>{{ item.counts.open }} offen · {{ item.counts.ambiguous }} uneindeutig · {{ item.counts.notExecutable }} nicht ausführbar · {{ item.missingResults }} Ergebnis unbekannt / außerhalb Entry-Filter</small>
      <small v-if="item.counts.open">Offene Entries bisher realisiert netto: {{ fmtMoney(item.openRealizedNetPnlUsd) }}<template v-if="item.openRealizedUnknown"> · {{ item.openRealizedUnknown }} unbekannt</template></small>
    </div>
    <p>Winrate = Netto-Gewinne / eindeutig abgeschlossene Entries. Ohne Entry, offen, uneindeutig und nicht ausführbar zählen nicht zum Nenner. Kleine Stichproben sind vorläufig.</p>
  </section>
</template>
<style scoped>
.filtered-summary { margin: 16px 0; padding: 12px 16px; border: 1px solid #434651; border-radius: 4px; }
h3 { margin: 0 0 8px; font-size: 14px; }
.run-summary { display: flex; flex-wrap: wrap; gap: 4px 20px; padding: 8px 0; }
.run-summary strong, .run-summary small { flex-basis: 100%; }
p, small { color: #b1b7c5; font-size: 12px; margin: 6px 0; }
.positive { color: #71c8b3; } .negative { color: #ef5350; }
</style>
