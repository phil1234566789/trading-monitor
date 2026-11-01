<script setup>
import {computed,ref,shallowRef,watch,onScopeDispose} from 'vue';
import {checkpointHExplanation} from '../checkpointHExplanation.js';
import {formatDatedTime} from '../berlinTime.js';
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
const fulfilled=computed(()=>explanation.value.rows.filter(row=>row.state==='fulfilled'));
const other=computed(()=>explanation.value.rows.filter(row=>row.state!=='fulfilled'));
</script>
<template>
  <section class="checkpoint-h" aria-label="H · Entry finden" :aria-busy="loading">
    <h4>H · Entry finden</h4>
    <p v-if="loading" role="status">Gespeicherte H-Prüfbelege laden…</p>
    <template v-else>
      <p v-if="error" class="negative" role="alert"><strong>! Technischer Ladefehler</strong> · {{ error }} <button type="button" @click="load">Erneut laden</button></p>
      <div class="primary-cause" :class="explanation.tone"><strong>{{ explanation.icon }} {{ explanation.summary }}</strong><p v-for="proof in explanation.state===explanation.causality.state?explanation.causality.proof:[]" :key="proof">{{ proof }}</p></div>
      <p class="stand"><template v-if="explanation.sourceAt">Letzte gespeicherte M1-Prüfung: {{ formatDatedTime(explanation.sourceAt) }} Uhr (Europe/Berlin).</template><template v-else>Keine zeitlich belegte M1-Prüfung gespeichert.</template></p>
      <p v-if="explanation.context">{{ explanation.context }}</p>
      <p v-if="explanation.technicalNote" class="negative">{{ explanation.technicalNote }}</p>
      <ul class="states"><li v-for="row in other" :key="row.key" :class="row.tone"><strong>{{ row.icon }} {{ row.label }} · {{ row.stateLabel }}</strong><p v-for="detail in row.details" :key="detail">{{ detail }}</p></li></ul>
      <details v-if="fulfilled.length"><summary>Gespeicherte positive Einzelbelege ({{ fulfilled.length }})</summary><p>Diese Belege waren zu ihren jeweiligen Zeiten erfüllt. Das ist kein Nachweis eines gemeinsam zulässigen Entry-Patterns.</p><ul class="states"><li v-for="row in fulfilled" :key="row.key" class="positive"><strong>✓ {{ row.label }} · Einzelbeleg erfüllt</strong><p v-for="detail in row.details" :key="detail">{{ detail }}</p></li></ul></details>
    </template>
  </section>
</template>
<style scoped>
.checkpoint-h{font-size:12px;line-height:1.55;min-width:0;overflow-wrap:anywhere;color:#d1d4dc}h4{font-size:13px;margin:8px 0}p{margin:6px 0}.stand{color:#b1b7c5}.positive{color:#81d993}.warning{color:#f5ba72}.negative{color:#ff8b91}.neutral{color:#b1b7c5}.states{list-style:none;padding:0;margin:8px 0}.states>li{padding:8px 0;border-top:1px solid #434651}.states p{color:#d1d4dc}summary{cursor:pointer;padding:8px 0}button{background:#1e222d;color:inherit;border:1px solid #626b7f;border-radius:4px;padding:6px}:is(button,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
<style scoped>.primary-cause{border:1px solid currentColor;border-left-width:4px;border-radius:4px;padding:10px;margin:8px 0;font-size:13px}.primary-cause p{font-size:12px;color:#d1d4dc}</style>
