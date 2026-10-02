<script setup>
import { computed, ref } from 'vue';
import { applySimulationCommission, SIMULATION_COST_VERSION } from '../tradeSetupSimulationCosts.js';
import { supabase } from '../supabaseClient.js';
import { createSimulationRepository } from '../tradeSetupSimulationRepository.js';
import { useSimulationStatistics } from '../composables/useSimulationStatistics.js';
import { SIMULATION_OUTCOME_LABELS, simulationStatistics, simulationRunStatusLabel } from '../tradeSetupSimulationStatistics.js';
import { formatDatedTime } from '../berlinTime.js';
import { fmtMoney, fmtR } from '../format.js';
import ToggleButton from '../components/ui/ToggleButton.vue';
import SimulationResultsTable from '../components/SimulationResultsTable.vue';
import SimulationRunStatus from '../components/SimulationRunStatus.vue';
import SimulationSetupsTable from '../components/SimulationSetupsTable.vue';

const repository = createSimulationRepository(supabase);
const setupTable = ref(null);
const { runs, runId, selectedRun, instrument, variant, from, to, rows, loading, error, refresh } = useSimulationStatistics(repository);
function refreshAll() { refresh(); setupTable.value?.refresh(); }
const basis = ref('net');
const costRows = computed(() => rows.value.map(applySimulationCommission));
const stats = computed(() => simulationStatistics(costRows.value, variant.value, basis.value));
const basisLabel = computed(() => basis.value === 'net' ? 'Netto' : 'Brutto');
const at = value => value == null ? '–' : formatDatedTime(value);
const runLabel = run => `${at(run.from)} – ${at(run.to)} · ${run.version} · ${simulationRunStatusLabel(run)} · ${run.id.slice(-8)}`;
</script>

<template>
  <main class="statistics-page">
    <header class="statistics-header">
      <div><h1>Statistik</h1><p>Trade Setups 2.0 · automatisch simulierte Positionen</p></div>
      <ToggleButton variant="bordered" :disabled="loading" @click="refreshAll">{{ loading ? 'Wird geladen…' : 'Aktualisieren' }}</ToggleButton>
    </header>

    <section class="simulation-rules" aria-label="Simulationsannahmen">
      <strong>50.000 USD Referenzkonto · festes Risikobudget 500 USD pro Entry</strong>
      <p>Anfangsgröße auf ganze Standardlots abgerundet. 50 % an T1 schließen, Reststop auf Entry, übrige Hälfte bis T2 oder Break-even. Kein Compounding.</p>
      <p>5 USD Kommission je Standardlot insgesamt für Entry und Exit, einmal auf das Eröffnungsvolumen. Für die Kostenansicht wird die volle Gebühr ab Entry angesetzt; Teilverkäufe kosten nicht zusätzlich. Kein Spread und keine Slippage berücksichtigt.</p>
      <p>Weiter und enger SL sind alternative Szenarien. Diese Ergebnisse gehören zur Simulation und werden getrennt vom Journal ausgewertet.</p>
    </section>

    <form class="statistics-filters" @submit.prevent="refresh">
      <label class="run-filter">Regel / Lauf<select v-model="runId" :disabled="!runs.length">
        <option value="">Alle Läufe</option>
        <option v-for="run in runs" :key="run.id" :value="run.id">{{ runLabel(run) }}</option>
      </select></label>
      <label>Instrument<select v-model="instrument"><option value="">Alle Instrumente</option><option value="GBPUSD">GBPUSD</option><option value="EURUSD">EURUSD</option><option value="XAUUSD">XAUUSD</option></select></label>
      <label>Stoppvariante<select v-model="variant"><option value="wide">Weiter SL</option><option value="narrow">Enger SL</option></select></label>
      <label v-if="runId">Ergebnis / Winrate<select v-model="basis"><option value="net">Netto nach Kommission</option><option value="gross">Brutto vor Kommission</option></select></label>
      <label v-if="runId">Entry ab<input v-model="from" type="date" /></label>
      <label v-if="runId">Entry bis einschließlich<input v-model="to" type="date" /></label>
    </form>

    <SimulationRunStatus v-if="selectedRun" :run="selectedRun" />
    <SimulationSetupsTable ref="setupTable" :repository="repository" :run-id="runId" :runs="runs" :instrument="instrument" :variant="variant" />

    <div :aria-busy="loading">
      <p v-if="error" role="alert" class="error">{{ error }} <button type="button" @click="refresh">Erneut versuchen</button></p>
      <p v-else-if="loading" role="status" class="empty">Gespeicherte Ergebnisse werden geladen…</p>
      <p v-else-if="!runs.length" class="empty">Noch keine gespeicherten Simulationsläufe. Sobald ein Lauf Ergebnisse gespeichert hat, erscheinen sie hier.</p>
      <p v-else-if="!runId" class="denominator">Für Ergebnisstatistik und Winrate bitte einen einzelnen Lauf wählen. „Alle Läufe“ enthält auch wiederholte Setups aus Tests und unterschiedlichen Regelversionen; daraus wird keine gemeinsame Winrate berechnet.</p>
      <template v-else>
        <p class="denominator">Kostenansicht {{ SIMULATION_COST_VERSION }}: aus gespeicherten Bruttoergebnissen berechnet. Ältere Bruttoläufe werden nachträglich umgerechnet; ihre gespeicherten Originalergebnisse bleiben unverändert.</p>
        <section class="statistics-summary" aria-label="Statistik der gewählten Variante">
          <div><span>Entry-Signale</span><strong>{{ stats.total }}</strong></div>
          <div><span>{{ basisLabel }} Gewinne / Verluste</span><strong>{{ stats.wins }} / {{ stats.losses }}</strong></div>
          <div><span>{{ basisLabel }} Winrate · n = {{ stats.closed }}</span><strong>{{ stats.winrate == null ? '–' : `${stats.winrate.toFixed(1)} %` }}</strong></div>
          <div><span>{{ basisLabel }} USD · abgeschlossen</span><strong :class="{ positive: stats.pnlUsd > 0, negative: stats.pnlUsd < 0 }">{{ fmtMoney(stats.pnlUsd) }}</strong></div>
          <div><span>{{ basisLabel }} R · abgeschlossen</span><strong>{{ fmtR(stats.totalR) }}</strong></div>
        </section>
        <p class="denominator">{{ basisLabel }}-Winrate: positive {{ basisLabel }}-Ergebnisse / eindeutig abgeschlossene, ausführbare Positionen ({{ stats.wins }} / {{ stats.closed }}). Prozent ab 50 abgeschlossenen Fällen. Offene und uneindeutige Fälle zählen nicht zum Nenner. T1 + Break-even ist netto nur dann ein Gewinn, wenn der Teilgewinn die Kommission übersteigt.</p>
        <dl class="outcome-counts"><div v-for="(label, key) in SIMULATION_OUTCOME_LABELS" :key="key"><dt>{{ label }}</dt><dd>{{ stats.counts[key] }}</dd></div></dl>
        <p class="denominator">Brutto- und Netto-R beziehen sich auf das tatsächliche Preisrisiko nach Lotrundung. Die Obergrenze von 500 USD gilt vor Kommission. Bei offenen Positionen ist nur das bereits realisierte Ergebnis abzüglich der vollen Entry-Kommission bekannt.</p>
        <SimulationResultsTable v-if="rows.length" :rows="costRows" :run-id="runId" />
        <p v-else class="empty">Keine gespeicherten Entries für diese Filterauswahl.</p>
      </template>
    </div>
  </main>
</template>

<style scoped>
.statistics-page { padding: 24px; color: #d1d4dc; max-width: 1600px; width: 100%; box-sizing: border-box; margin: 0 auto; }
.statistics-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; }
h1 { margin: 0; font-size: 20px; font-weight: 600; }
.statistics-header p { margin: 6px 0 0; color: #a5a9b4; font-size: 13px; }
.simulation-rules { background: #1e222d; border: 1px solid #2a2e39; border-radius: 4px; padding: 16px; font-size: 13px; line-height: 1.6; }
.simulation-rules p { margin: 5px 0 0; color: #a5a9b4; }
.statistics-filters { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin: 20px 0; }
.statistics-filters label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #a5a9b4; }
.run-filter { flex: 1 1 340px; min-width: 0; }
select, input { box-sizing: border-box; width: 100%; min-height: 36px; border: 1px solid #434651; border-radius: 4px; color: #d1d4dc; background: #1e222d; padding: 7px 10px; color-scheme: dark; }
select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid #82aaff; outline-offset: 2px; }
.statistics-summary { display: flex; flex-wrap: wrap; gap: 20px 36px; border-top: 1px solid #2a2e39; padding-top: 20px; }
.statistics-summary div { display: flex; flex-direction: column; gap: 6px; }
.statistics-summary span { color: #a5a9b4; font-size: 12px; }
.statistics-summary strong { font-size: 20px; font-variant-numeric: tabular-nums; font-weight: 600; }
.positive { color: #71c8b3; } .negative, .error { color: #ef5350; }
.denominator { color: #a5a9b4; font-size: 12px; line-height: 1.6; margin: 16px 0; }
.outcome-counts { display: flex; flex-wrap: wrap; gap: 12px 28px; padding: 12px 0; border-block: 1px solid #2a2e39; }
.outcome-counts div { display: flex; gap: 8px; font-size: 12px; }
.outcome-counts dt { color: #a5a9b4; } .outcome-counts dd { margin: 0; font-weight: 600; }
.empty { padding: 32px 16px; text-align: center; border: 1px solid #2a2e39; border-radius: 4px; color: #a5a9b4; font-size: 13px; line-height: 1.6; }
.error { padding: 16px; background: #1e222d; line-height: 1.6; }
.error button { background: transparent; border: 1px solid #a5a9b4; color: #d1d4dc; border-radius: 4px; cursor: pointer; padding: 6px 10px; margin-left: 8px; }
@media (max-width: 600px) { .statistics-page { padding: 16px; } .statistics-filters label { flex: 1 1 160px; } .statistics-header { align-items: flex-start; } }
</style>
