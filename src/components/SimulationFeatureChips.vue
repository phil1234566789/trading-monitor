<script setup>
import SimulationPinFlag from './SimulationPinFlag.vue';
import { ref,computed } from 'vue';
import { FEATURE_VALUES,featureDetails } from '../simulationReviewFeatures.js';
const props=defineProps({features:Array,selectedKey:String,isPinned:{type:Function,default:()=>false},pinNote:{type:Function,default:()=>undefined}});
const emit=defineEmits(['pin-menu']);
const selected=ref(props.selectedKey ?? '');
const active=computed(()=>props.features.find(f=>f.key===selected.value));
</script>
<template>
  <div class="feature-chips" aria-label="Gespeicherte Checkpoints">
    <button v-for="f in features.filter(f=>f.group==='checkpoint').toSorted((a,b)=>a.label.localeCompare(b.label))" :key="f.key" type="button" :class="f.value" :aria-expanded="selected===f.key" @click="selected=selected===f.key?'':f.key" @contextmenu.prevent="emit('pin-menu',f,$event)">
      <SimulationPinFlag v-if="isPinned(f)" :note="pinNote(f)" />{{ FEATURE_VALUES[f.value]?.slice(0,1) ?? '?' }} {{ f.label.split(' · ')[0] }}
      <span class="sr-only"> · {{ FEATURE_VALUES[f.value] }}</span>
    </button>
  </div>
  <section v-if="active" class="feature-details" :aria-label="active.label"><h4>{{ active.label }} · {{ FEATURE_VALUES[active.value] }}</h4>
    <div v-for="f in featureDetails(features,active)" :key="f.key"><strong v-if="f.key!==active.key">{{ f.label }} · {{ FEATURE_VALUES[f.value] }}</strong><p v-for="(detail,index) in f.details" :key="index">{{ detail }}</p><p v-if="!f.details?.length">Keine Prüfung gespeichert.</p></div>
  </section>
</template>
<style scoped>
.feature-chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}button{background:#1e222d;color:#b1b7c5;border:1px solid #626b7f;border-radius:4px;padding:7px;cursor:pointer;font-size:12px}.met{color:#81d993}.unmet{color:#ff8b91}.observed{color:#b1b7c5}.feature-details{padding:12px;background:#1e222d;border:1px solid #434651;margin-bottom:12px;font-size:12px}h4{margin:0 0 8px}p{margin:6px 0;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}button:focus-visible{outline:2px solid #91b8ff;outline-offset:3px}.pin-flag{color:var(--pin-color);margin-right:4px}
</style>
