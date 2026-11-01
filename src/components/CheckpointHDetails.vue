<script setup>
import {computed,ref,shallowRef,watch,onScopeDispose} from 'vue';
import {checkpointHExplanation} from '../checkpointHExplanation.js';
const props=defineProps({snapshot:{type:Object,required:true},asOf:Number,loadSnapshot:Function});
const full=shallowRef(null),loading=ref(false),error=ref('');let revision=0;
async function load(){
  const ticket=++revision;full.value=null;error.value='';loading.value=false;
  if(!props.loadSnapshot||props.snapshot.checklistHistory)return;
  loading.value=true;
  try{const value=await props.loadSnapshot(props.snapshot);if(ticket===revision)full.value=value;}
  catch(cause){if(ticket===revision)error.value=cause.message;}
  finally{if(ticket===revision)loading.value=false;}
}
watch(()=>props.snapshot,load,{immediate:true});onScopeDispose(()=>revision++);
const explanation=computed(()=>checkpointHExplanation(full.value ?? props.snapshot,props.asOf ?? (full.value ?? props.snapshot).knownAt));
</script>
<template>
  <section class="checkpoint-h" aria-label="H · Entry finden" :aria-busy="loading">
    <h4>H · Entry finden</h4>
    <p v-if="loading" role="status">Gespeicherte H-Prüfbelege laden…</p>
    <template v-else>
      <p v-if="error" class="negative" role="alert"><strong>! Technischer Ladefehler</strong> · {{ error }} <button type="button" @click="load">Erneut laden</button></p>
      <p v-if="!explanation.candidates.length" class="neutral">{{ explanation.empty }}</p>
      <article v-for="candidate in explanation.candidates" :key="candidate.at" class="candidate-check">
        <h5>{{ candidate.pattern }} · {{ candidate.sourceLabel }} · {{ candidate.version ? `historische Regeln ${candidate.version.match(/v\d+$/)?.[0] ?? candidate.version}` : 'Regelversion nicht gespeichert' }}</h5>
        <p v-if="candidate.versionNote" class="version-note">{{ candidate.versionNote }}</p>
        <ul class="states"><li v-for="row in candidate.rows" :key="row.key" :class="row.tone">
          <strong>{{ row.icon }} {{ row.label }}</strong><span class="rule-status">{{ row.required ? 'Pflicht' : 'Optional' }} · {{ row.stateLabel }}</span>
          <details v-if="row.details.length"><summary>Beleg</summary><p v-for="detail in row.details" :key="detail">{{ detail }}</p></details>
        </li></ul>
        <p v-if="candidate.technicalNote" class="negative">{{ candidate.technicalNote }}</p>
        <details v-if="candidate.timeline.length" class="neutral"><summary>Späterer Verlauf (ändert diese Prüfung nicht)</summary><p v-for="event in candidate.timeline" :key="event">{{ event }}</p></details>
        <p class="entry-result" :class="candidate.state==='fulfilled'?'positive':candidate.state==='missing'?'negative':'neutral'"><strong>{{ candidate.summary }}</strong></p>
      </article>
      <p v-for="note in explanation.technicalNotes" :key="note" class="negative">{{ note }}</p>
    </template>
  </section>
</template>
<style scoped>
.checkpoint-h{font-size:12px;line-height:1.55;min-width:0;overflow-wrap:anywhere;color:#d1d4dc}h4{font-size:13px;margin:8px 0}h5{font-size:13px;margin:12px 0}p{margin:6px 0}.positive{color:#81d993}.warning{color:#f5d772}.negative{color:#ff8b91}.neutral{color:#b1b7c5}.states{list-style:none;padding:0;margin:8px 0}.states>li{padding:8px 0;border-top:1px solid #434651}.states p{color:#d1d4dc}.rule-status{display:block;font-size:11px}summary{cursor:pointer;padding:4px 0;color:#b1b7c5}.version-note{border-left:3px solid #b1b7c5;padding:6px 10px}.entry-result{border-top:2px solid currentColor;padding:10px 0}.candidate-check+.candidate-check{margin-top:20px;border-top:2px solid #626b7f}button{background:#1e222d;color:inherit;border:1px solid #626b7f;border-radius:4px;padding:6px}:is(button,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
