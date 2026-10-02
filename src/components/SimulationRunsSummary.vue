<script setup>
import { computed } from 'vue';
import { simulationRunStatistics, simulationRunLink, simulationRunStatusLabel, MIN_SIMULATION_WINRATE_CASES } from '../tradeSetupSimulationStatistics.js';
import { formatDatedTime } from '../berlinTime.js';
import { fmtMoney, fmtR } from '../format.js';

const props = defineProps({ runs: { type: Array, required: true }, rows: { type: Array, required: true }, variant: String });
const summaries = computed(() => simulationRunStatistics(props.rows, props.runs, props.variant));
const at = value => value == null ? '–' : formatDatedTime(value);
const name = run => run.configuration?.label || (run.id.startsWith('setup2-') ? 'Forschungslauf' : `${run.configuration?.instrument ?? 'Instrument'} · Tageslauf`);
</script>

<template>
  <section class="runs-summary" aria-label="Ergebnisse aller Läufe">
    <h2>Ergebnisse aller Läufe</h2>
    <p>{{ variant === 'wide' ? 'Weiter SL' : 'Enger SL' }} · eine Zeile pro Lauf. Alternative Forschungsläufe bleiben getrennt; die Instrumentauswahl gilt für alle Ergebniszahlen.</p>
    <div class="runs-scroll" tabindex="0" aria-label="Laufergebnisse horizontal scrollen">
      <table>
        <caption>Gespeicherte Laufresultate · Zeiten in Europe/Berlin · PnL aus abgeschlossenen Fällen</caption>
        <thead><tr><th scope="col">Lauf / Zeitraum</th><th scope="col">Entries</th><th scope="col">Netto Gewinne / Verluste</th><th scope="col">Offen / Uneindeutig / Nicht ausführbar</th><th scope="col">Brutto USD</th><th scope="col">Netto USD</th><th scope="col">Netto R</th><th scope="col">Netto Winrate · n</th></tr></thead>
        <tbody><tr v-for="item in summaries" :key="item.run.id" :data-run-id="item.run.id">
          <th scope="row"><RouterLink :to="simulationRunLink(item.run.id, variant)">{{ name(item.run) }}</RouterLink><small>{{ at(item.run.from) }} – {{ at(item.run.to) }} (Ende exklusiv)</small><small>{{ simulationRunStatusLabel(item.run) }} · {{ item.run.id.slice(-8) }} · {{ item.run.version }}</small></th>
          <td>{{ item.net.total }}</td><td>{{ item.net.wins }} / {{ item.net.losses }}</td><td>{{ item.net.counts.open }} / {{ item.net.counts.ambiguous }} / {{ item.net.counts.notExecutable }}</td>
          <td>{{ fmtMoney(item.gross.pnlUsd) }}</td><td>{{ fmtMoney(item.net.pnlUsd) }}</td><td>{{ fmtR(item.net.totalR) }}</td><td>{{ item.net.winrate == null ? '–' : `${item.net.winrate.toFixed(1)} %` }} · n = {{ item.net.closed }}</td>
        </tr></tbody>
      </table>
    </div>
    <p>Winrate ab {{ MIN_SIMULATION_WINRATE_CASES }} eindeutig abgeschlossenen Fällen je Lauf. Offene und uneindeutige Fälle zählen nicht zum Nenner; PnL und Fallzahlen sind bereits sichtbar.</p>
  </section>
</template>

<style scoped>
h2 { font-size: 18px; margin: 20px 0 12px; }
p, caption, small { color: #a5a9b4; font-size: 12px; line-height: 1.6; }
.runs-scroll { overflow-x: auto; }
.runs-scroll:focus-visible, a:focus-visible { outline: 2px solid #82aaff; outline-offset: 2px; }
table { border-collapse: collapse; width: 100%; text-align: left; font-size: 13px; }
caption { text-align: left; padding-bottom: 10px; }
th, td { padding: 10px; border-bottom: 1px solid #434651; }
td { white-space: nowrap; font-variant-numeric: tabular-nums; }
th[scope="row"] { min-width: 260px; max-width: 460px; font-weight: 400; }
small { display: block; overflow-wrap: anywhere; }
a { color: #91b8ff; }
</style>
