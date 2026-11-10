<script setup>
import SimulationDrDetails from './SimulationDrDetails.vue';
import { strategySetupLabel } from "../strategySetupLabels.js";
import SimulationPinFlag from './SimulationPinFlag.vue';
import SimulationEntryPatternBadges from './SimulationEntryPatternBadges.vue';
import {simulationGroupEntryPatterns} from '../simulationEntryPatterns.js';
import { formatDatedTime } from '../berlinTime.js';
import { simulationChartLink } from '../tradeSetupSimulationStatistics.js';
import { dealingRangeLabel } from '../tradeSetup2DealingRange.js';
import { groupResults,variantMetrics } from '../simulationRunComparison.js';
import { fmtR,pnlClass } from '../format.js';
const props=defineProps({run:Object,groups:Array,total:Number,pageLoading:Boolean,pageError:String,detailState:{type:Function,default:group=>({group})},openDetails:{type:Function,default:()=>{}},results:Array,loadSnapshot:Function,pinCount:{type:Number,default:0},isPinned:{type:Function,default:()=>false},pinNote:{type:Function,default:()=>undefined}});
const emit=defineEmits(['pin-menu','show-pins','more']);

const summary=(g,v)=>variantMetrics(groupResults([g],props.results),v).totalR;
</script>
<template>
  <section class="dr-list"><div class="list-heading"><h2>Dealing Ranges und Entries · {{ total??groups.length }}</h2><button @click="emit('show-pins')">Alle Pins anschauen ({{ pinCount }})</button></div><p class="note">Neueste Erkennung zuerst · Zeiten in Europe/Berlin. Rechtsklick auf DR, Checkpoint oder Entry öffnet das Pin-Menü.</p>
    <p v-if="!groups.length&&!pageLoading&&!pageError" role="status">Keine DRs für diese Filterauswahl.</p>
    <article v-for="group in groups" :key="group.key" class="dr-card">
      <header tabindex="0" @contextmenu.prevent="emit('pin-menu',{kind:'simulation_dr',group},$event)">
        <div><h3><SimulationPinFlag v-if="isPinned(group)" :note="pinNote(group)" />{{ group.direction==='long'?'Long':'Short' }} · {{ group.instrument }}</h3><span>{{ formatDatedTime(group.recognizedAt) }}</span></div>
        <span class="chip">{{ strategySetupLabel(group.setupType) }}</span><SimulationEntryPatternBadges v-if="group.entries.length" :patterns="simulationGroupEntryPatterns(group)" /><span class="chip">{{ dealingRangeLabel(group.latestCandidate ?? group.snapshot) }}</span><span>{{ group.outcome.label }}</span><span>{{ group.entries.length }} Entries</span><span>Weit <b :class="pnlClass(summary(group,'wide'))">{{ fmtR(summary(group,'wide')) }}</b> · Eng <b :class="pnlClass(summary(group,'narrow'))">{{ fmtR(summary(group,'narrow')) }}</b></span>
        <RouterLink :to="simulationChartLink({...group.snapshot,drReplayTime:group.outcome.replayTime,variant:'both'},group.snapshot.runId)" target="_blank" rel="noopener noreferrer">Im Chart</RouterLink>
        <button type="button" class="more" :aria-label="`Pin-Menü für ${group.instrument} DR ${formatDatedTime(group.recognizedAt)}`" @click="emit('pin-menu',{kind:'simulation_dr',group},$event)">…</button>
      </header>
      <details @toggle.self="event=>event.target.open && openDetails(group)">
        <summary>Details anzeigen</summary>
        <p v-if="detailState(group)?.loading" role="status">DR-Details werden geladen…</p>
        <p v-else-if="detailState(group)?.error" role="alert">{{ detailState(group).error }} <button @click="openDetails(group)">Erneut versuchen</button></p>
        <SimulationDrDetails v-else-if="detailState(group)?.group" :run="run" :group="detailState(group).group" :results="results" :load-snapshot="loadSnapshot" :is-pinned="isPinned" :pin-note="pinNote" @pin-menu="(target,event)=>emit('pin-menu',target,event)" />
      </details>
    </article>
    <p v-if="pageError" role="alert">{{ pageError }} <button @click="emit('more')">Erneut versuchen</button></p>
    <button v-if="groups.length<total" type="button" :disabled="pageLoading" @click="emit('more')">{{ pageLoading?'DRs werden geladen…':`Weitere 25 DRs laden (${groups.length} / ${total})` }}</button>
  </section>
</template>
<style scoped>
.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.dr-list{margin:24px 0}h2{font-size:18px}h3{font-size:14px;margin:0 0 4px}.note{color:#b1b7c5;font-size:12px;line-height:1.6}.dr-card{background:#171c28;border:1px solid #434651;border-radius:6px;padding:16px;margin:12px 0;min-width:0;font-size:12px}header{display:flex;flex-wrap:wrap;align-items:center;gap:12px}header div{min-width:130px}.chip{background:#1e222d;padding:4px 8px;border:1px solid #434651;border-radius:4px}details{margin-top:14px}summary{cursor:pointer;padding:8px 0}summary:focus-visible{outline:2px solid #91b8ff}.more{margin-left:auto}a{color:#91b8ff}button{background:#1e222d;color:#d1d4dc;border:1px solid #626b7f;border-radius:4px;padding:8px;cursor:pointer}.pin-flag{color:var(--pin-color)}:is(header,button,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}@media(max-width:600px){.dr-card{padding:12px}}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
