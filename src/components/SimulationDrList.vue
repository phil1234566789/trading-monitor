<script setup>
import SimulationPinFlag from './SimulationPinFlag.vue';
import { ref,watch } from 'vue';
import { formatDatedTime } from '../berlinTime.js';
import { simulationChartLink } from '../tradeSetupSimulationStatistics.js';
import { dealingRangeLabel } from '../tradeSetup2DealingRange.js';
import { SETUP_TYPE_LABELS,groupResults,variantMetrics } from '../simulationRunComparison.js';
import { fmtR,pnlClass } from '../format.js';
import SimulationFeatureChips from './SimulationFeatureChips.vue';
import SimulationEntryTable from './SimulationEntryTable.vue';
const props=defineProps({groups:Array,results:Array,pinCount:{type:Number,default:0},isPinned:{type:Function,default:()=>false},pinNote:{type:Function,default:()=>undefined}});
const emit=defineEmits(['pin-menu','show-pins']);
const limit=ref(25);watch(()=>props.groups,()=>{limit.value=25;});
const summary=(g,v)=>variantMetrics(groupResults([g],props.results),v).totalR;
</script>
<template>
  <section class="dr-list"><div class="list-heading"><h2>Dealing Ranges und Entries · {{ groups.length }}</h2><button @click="emit('show-pins')">Alle Pins anschauen ({{ pinCount }})</button></div><p class="note">Neueste Erkennung zuerst · Zeiten in Europe/Berlin. Rechtsklick auf DR, Checkpoint oder Entry öffnet das Pin-Menü.</p>
    <p v-if="!groups.length" role="status">Keine DRs für diese Filterauswahl.</p>
    <article v-for="group in groups.slice(0,limit)" :key="group.key" class="dr-card">
      <header tabindex="0" @contextmenu.prevent="emit('pin-menu',{kind:'simulation_dr',group},$event)">
        <div><h3><SimulationPinFlag v-if="isPinned(group)" :note="pinNote(group)" />{{ group.direction==='long'?'Long':'Short' }} · {{ group.instrument }}</h3><span>{{ formatDatedTime(group.recognizedAt) }}</span></div>
        <span class="chip">{{ SETUP_TYPE_LABELS[group.setupType] ?? group.setupType }}</span><span class="chip">{{ dealingRangeLabel(group.latestCandidate ?? group.snapshot) }}</span><span>{{ group.outcome.label }}</span><span>{{ group.entries.length }} Entries</span><span>Weit <b :class="pnlClass(summary(group,'wide'))">{{ fmtR(summary(group,'wide')) }}</b> · Eng <b :class="pnlClass(summary(group,'narrow'))">{{ fmtR(summary(group,'narrow')) }}</b></span>
        <RouterLink :to="simulationChartLink({...group.snapshot,drReplayTime:group.outcome.replayTime,variant:'both'},group.snapshot.runId)" target="_blank" rel="noopener noreferrer">Im Chart</RouterLink>
        <button type="button" class="more" :aria-label="`Pin-Menü für ${group.instrument} DR ${formatDatedTime(group.recognizedAt)}`" @click="emit('pin-menu',{kind:'simulation_dr',group},$event)">…</button>
      </header>
      <SimulationFeatureChips :features="group.features" :is-pinned="f=>isPinned(group,f)" :pin-note="f=>pinNote(group,f)" @pin-menu="(feature,event)=>emit('pin-menu',{kind:'simulation_checkpoint',group,feature},event)" />
      <SimulationEntryTable :entries="group.entries" :results="results" :is-pinned="entry=>isPinned(group,null,entry)" :pin-note="entry=>pinNote(group,null,entry)" @pin-menu="(entry,event)=>emit('pin-menu',{kind:'simulation_entry',group,entry},event)" />
    </article>
    <button v-if="limit<groups.length" type="button" @click="limit+=25">Weitere 25 DRs laden ({{ Math.min(limit,groups.length) }} / {{ groups.length }})</button>
  </section>
</template>
<style scoped>
.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.dr-list{margin:24px 0}h2{font-size:18px}h3{font-size:14px;margin:0 0 4px}.note{color:#b1b7c5;font-size:12px;line-height:1.6}.dr-card{background:#171c28;border:1px solid #434651;border-radius:6px;padding:16px;margin:12px 0;min-width:0;font-size:12px}header{display:flex;flex-wrap:wrap;align-items:center;gap:12px}header div{min-width:130px}.chip{background:#1e222d;padding:4px 8px;border:1px solid #434651;border-radius:4px}.more{margin-left:auto}a{color:#91b8ff}button{background:#1e222d;color:#d1d4dc;border:1px solid #626b7f;border-radius:4px;padding:8px;cursor:pointer}.pin-flag{color:var(--pin-color)}:is(header,button,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}@media(max-width:600px){.dr-card{padding:12px}}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
