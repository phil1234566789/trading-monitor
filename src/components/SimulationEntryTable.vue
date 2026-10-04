<script setup>
import { computed } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { fmtPrice,fmtR,pnlClass,pricePrecisionForInstrument } from '../format.js';
import { simulationEntryResult,simulationOutcomeKey,SIMULATION_OUTCOME_LABELS } from '../tradeSetupSimulationStatistics.js';
import { toPips } from '../pipConfig.js';
const props=defineProps({entries:Array,results:Array,isPinned:{type:Function,default:()=>false}});
const emit=defineEmits(['pin-menu']);
const rows=computed(()=>props.entries.map(e=>({snapshot:e,variants:['wide','narrow'].map(v=>simulationEntryResult(props.results,e,v))})));
const pips=(r,e)=>Number.isFinite(r?.stopPrice)&&Number.isFinite(r?.entryPrice)?toPips(Math.abs(r.entryPrice-r.stopPrice),e.instrument).toFixed(1):'–';
const commission=r=>r?.commissionUsd!=null && r.actualRisk>0?fmtR(r.commissionUsd/r.actualRisk):'–';
</script>
<template>
  <p v-if="!entries.length" class="note">Kein Entry gespeichert.</p>
  <div v-else class="entry-scroll" tabindex="0" aria-label="Entry-Tabelle horizontal scrollen">
    <table><caption>Entries · Nettoergebnisse nach Kommission</caption><thead><tr><th scope="col" rowspan="2">Entry · Zeit · Preis</th><th scope="colgroup" colspan="4">Weiter SL</th><th scope="colgroup" colspan="4">Enger SL</th></tr><tr><template v-for="variant in ['wide','narrow']" :key="variant"><th scope="col">Ausgang</th><th scope="col">R netto</th><th scope="col">SL · Pips</th><th scope="col">Kommission · R</th></template></tr></thead>
      <tbody><tr v-for="(row,index) in rows" :key="row.snapshot.id" tabindex="0" @contextmenu.prevent="emit('pin-menu',row.snapshot,$event)">
        <th scope="row"><span v-if="isPinned(row.snapshot)" class="pin-flag" aria-label="Angepinnt">⚑ </span>#{{ index+1 }} · {{ formatDatedTime(row.snapshot.entry.recognizedAt) }}<small>{{ fmtPrice(row.snapshot.entry.price,pricePrecisionForInstrument(row.snapshot.instrument)) }}</small></th>
        <template v-for="(result,i) in row.variants" :key="i"><td class="outcome">{{ result?SIMULATION_OUTCOME_LABELS[simulationOutcomeKey(result)] ?? 'Unbekannt':'Nicht gespeichert / außerhalb des Zeitraums' }}</td><td :class="pnlClass(result?.netRMultiple)">{{ fmtR(result?.netRMultiple) }}</td><td>{{ pips(result,row.snapshot) }}</td><td>{{ commission(result) }}</td></template>
      </tr></tbody>
    </table>
  </div>
</template>
<style scoped>
.entry-scroll{overflow-x:auto;max-width:100%}table{min-width:850px;width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;table-layout:fixed}caption{text-align:left;color:#b1b7c5;margin-bottom:8px}th,td{padding:10px 8px;border-bottom:1px solid #434651;text-align:right;vertical-align:top}th:first-child{width:200px;text-align:left}thead{background:#222a3a}tbody th{font-weight:400}small{display:block;color:#b1b7c5}.outcome{text-align:left}.note{color:#b1b7c5;font-size:12px}.pin-flag{color:var(--pin-color)}:is(tr,.entry-scroll):focus-visible{outline:2px solid #91b8ff;outline-offset:-2px}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
