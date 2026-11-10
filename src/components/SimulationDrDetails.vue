<script setup>
import SimulationRunDerivation from './SimulationRunDerivation.vue';
import LiveEvidenceReviews from './LiveEvidenceReviews.vue';
import LiveEvidenceProvenance from './LiveEvidenceProvenance.vue';
import SimulationFeatureChips from './SimulationFeatureChips.vue';
import SimulationEntryTable from './SimulationEntryTable.vue';
defineProps({run:Object,group:Object,results:Array,loadSnapshot:Function,isPinned:Function,pinNote:Function});
const emit=defineEmits(['pin-menu']);
</script>
<template>
      <SimulationRunDerivation :run="run" :setup-key="group.snapshot.setupKey" />
      <LiveEvidenceProvenance :snapshot="group.latestCandidate ?? group.snapshot" />
      <SimulationFeatureChips :features="group.features" :snapshot="group.snapshot" :load-snapshot="loadSnapshot" :is-pinned="f=>isPinned(group,f)" :pin-note="f=>pinNote(group,f)" @pin-menu="(feature,event)=>emit('pin-menu',{kind:'simulation_checkpoint',group,feature},event)" />
      <LiveEvidenceReviews :snapshots="[group.snapshot,group.latestCandidate,...group.entries]" :is-pinned="isPinned" :pin-note="pinNote" @pin-menu="(target,event)=>emit('pin-menu',target,event)" />
      <SimulationEntryTable :entries="group.entries" :results="results" :is-pinned="entry=>isPinned(group,null,entry)" :pin-note="entry=>pinNote(group,null,entry)" @pin-menu="(entry,event)=>emit('pin-menu',{kind:'simulation_entry',group,entry},event)" />
</template>
