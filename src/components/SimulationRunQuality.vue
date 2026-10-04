<script setup>
import { computed } from 'vue';
import { runFunnel,rangeEntryCrossTable,variantMetrics } from '../simulationRunComparison.js';
import { SIMULATION_OUTCOME_LABELS } from '../tradeSetupSimulationStatistics.js';
const props=defineProps({current:Object,previous:Object,compare:Boolean});
const stages={recognized:'Setups 1.0 erkannt*',confirmed:'Bestätigt',invalidated:'Invalidiert',validated:'Validiert',target1:'T1 vor Invalidierung',withEntry:'DRs mit Entry',entries:'Entries'};
const runs=computed(()=>[...(props.compare?[{label:'Alt',data:props.previous}]:[]),{label:props.compare?'Neu':'Gewählter Lauf',data:props.current}].map(r=>({...r,funnel:runFunnel(r.data.groups,r.data.results)})));
</script>
<template>
  <section class="run-quality"><h2>Entscheidungsbaum</h2>
    <div v-for="run in runs" :key="run.label"><h3>{{ run.label }}</h3><dl class="funnel"><div v-for="(label,key) in stages" :key="key"><dd>{{ run.funnel[key] }}</dd><dt>{{ label }}</dt></div></dl>
      <p v-for="variant in ['wide','narrow']" :key="variant" class="outcomes"><strong>Ausgang der Entries · {{ variant==='wide'?'weiter':'enger' }} SL:</strong> <span v-for="(label,key) in SIMULATION_OUTCOME_LABELS" :key="key">{{ label }}: {{ variantMetrics(run.data.results,variant).counts[key] }}</span></p>
    </div>
    <p class="note">* Im gespeicherten Review belegte Ursprungs-Setups. Erkennungen ohne gespeicherten Snapshot sind nicht belegt. Alle Zahlen folgen derselben Filterauswahl.</p>
    <h2>DR gegen Entry</h2><p class="note">Nur validierte DRs. DR-Verlauf unabhängig vom Entry-Ergebnis, Gewinne und Verluste netto. Der gespeicherte Verlauf endet teils bei T1 oder beim Schließen aller Entries: späteres T2 ist dann nicht belegt.</p>
    <div v-for="run in runs" :key="`${run.label}-cross`"><h3>{{ run.label }}</h3>
      <div v-for="variant in ['wide','narrow']" :key="variant" class="table-scroll" tabindex="0" :aria-label="`DR gegen Entry · ${variant} horizontal scrollen`">
        <table><caption>{{ variant==='wide'?'Weiter SL':'Enger SL' }}</caption><thead><tr><th scope="col">DR-Verlauf</th><th scope="col">DRs gesamt</th><th scope="col">Ohne Entry</th><th scope="col">Mind. ein Gewinn</th><th scope="col">Nur Verluste</th><th scope="col">Offen / uneindeutig / unvollständig</th></tr></thead><tbody><tr v-for="row in rangeEntryCrossTable(run.data.groups,run.data.results,variant)" :key="row.key"><th scope="row">{{ row.label }}</th><td>{{ row.total }}</td><td>{{ row.without }}</td><td>{{ row.win }}</td><td>{{ row.loss }}</td><td>{{ row.pending }}</td></tr></tbody></table>
      </div>
    </div>
  </section>
</template>
<style scoped>
.run-quality{margin:24px 0}h2{font-size:18px}h3{font-size:14px}.funnel{display:flex;flex-wrap:wrap;gap:8px}.funnel div{flex:1 1 110px;padding:12px;border:1px solid #434651;background:#1e222d;border-radius:4px}.funnel dd{margin:0;font-size:20px;font-variant-numeric:tabular-nums}.funnel dt{font-size:12px;color:#b1b7c5;margin-top:6px}.outcomes{font-size:12px;display:flex;flex-wrap:wrap;gap:8px 16px}.note{color:#b1b7c5;font-size:12px;line-height:1.6}.table-scroll{overflow-x:auto;max-width:100%;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}caption{text-align:left;margin-bottom:8px}th,td{padding:8px;border-bottom:1px solid #434651}th{text-align:left;font-weight:400}td{text-align:right;font-variant-numeric:tabular-nums}thead{background:#222a3a}.table-scroll:focus-visible{outline:2px solid #91b8ff}
</style>
