<script setup>
import {computed} from 'vue';
import {formatDatedTime} from '../berlinTime.js';
import {reviewGroups} from '../simulationRunComparison.js';
import LiveEvidenceProvenance from './LiveEvidenceProvenance.vue';
import SimulationFeatureChips from './SimulationFeatureChips.vue';
const props=defineProps({snapshots:Array,isPinned:{type:Function,default:()=>false},pinNote:{type:Function,default:()=>undefined}});
const emit=defineEmits(['pin-menu']);
const reviews=computed(()=>[...new Map((props.snapshots ?? []).flatMap(snapshot=>snapshot?.additionalChecks ?? []).map(snapshot=>[snapshot.evidenceRecordId ?? snapshot.liveEventId,snapshot])).values()].map(snapshot=>reviewGroups([snapshot])[0]));
</script>
<template>
  <details v-if="reviews.length" class="additional-checks">
    <summary>Weitere gespeicherte Prüfbelege ({{ reviews.length }})</summary>
    <section v-for="group in reviews" :key="group.snapshot.evidenceRecordId ?? group.snapshot.liveEventId">
      <strong>{{ group.snapshot.entry?'Entry':'DR' }} · Prüfstand {{ formatDatedTime(group.snapshot.knownAt) }}</strong>
      <LiveEvidenceProvenance :snapshot="group.snapshot" review />
      <p v-if="Number.isFinite(group.snapshot.liveDetectedAt)">Erkennung gespeichert {{ formatDatedTime(group.snapshot.liveDetectedAt) }}</p>
      <SimulationFeatureChips :features="group.features" :is-pinned="feature=>isPinned(group,feature)" :pin-note="feature=>pinNote(group,feature)" @pin-menu="(feature,event)=>emit('pin-menu',{kind:'simulation_checkpoint',group,feature},event)" />
    </section>
  </details>
</template>
<style scoped>.additional-checks{font-size:12px;margin:12px 0;color:#b1b7c5}summary{cursor:pointer}section{border-top:1px solid #434651;padding:12px 0}summary:focus-visible{outline:2px solid #91b8ff;outline-offset:3px}</style>
