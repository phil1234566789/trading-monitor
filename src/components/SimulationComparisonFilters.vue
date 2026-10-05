<script setup>
import {simulationRunLabel as label} from '../simulationRunPresentation.js';
import { DEALING_RANGE_LABELS } from '../tradeSetup2DealingRange.js';
import { SETUP_TYPE_LABELS, DR_OUTCOME_LABELS } from '../simulationRunComparison.js';
import { FEATURE_VALUES } from '../simulationReviewFeatures.js';
const props=defineProps({modelValue:Object,runs:Array,features:Array});
const emit=defineEmits(['update:modelValue']);
const set=(key,value)=>emit('update:modelValue',{...props.modelValue,[key]:value});
</script>
<template>
  <form class="statistics-filters" @submit.prevent>
    <label>Lauf neu<select :value="modelValue.run" @change="set('run',$event.target.value)"><option value="" disabled>Lauf wählen</option><option v-for="run in runs" :key="run.id" :value="run.id">{{ label(run) }}</option></select></label>
    <label>Vergleich mit Lauf alt<select :value="modelValue.compare" @change="set('compare',$event.target.value)"><option value="">Kein Vergleich</option><option v-for="run in runs.filter(r=>r.id!==modelValue.run)" :key="run.id" :value="run.id">{{ label(run) }}</option></select></label>
    <label>Instrument<select :value="modelValue.instrument" @change="set('instrument',$event.target.value)"><option value="">Alle</option><option v-for="name in ['GBPUSD','EURUSD','XAUUSD']" :key="name">{{ name }}</option></select></label>
    <label>Typ<select :value="modelValue.type" @change="set('type',$event.target.value)"><option value="">Alle</option><option v-for="key in ['countertrend','continuation']" :key="key" :value="key">{{ SETUP_TYPE_LABELS[key] }}</option></select></label>
    <label>Entry ab<input type="date" :value="modelValue.from" @input="set('from',$event.target.value)" /></label>
    <label>Entry bis einschließlich<input type="date" :value="modelValue.to" @input="set('to',$event.target.value)" /></label>
    <label>DR-Stufe<select :value="modelValue.stage" @change="set('stage',$event.target.value)"><option value="">Alle inkl. Altstand</option><option v-for="(name,key) in Object.fromEntries(Object.entries(DEALING_RANGE_LABELS).filter(([key])=>key!=='invalidated' || modelValue.stage==='invalidated'))" :key="key" :value="key">{{ name }}</option></select></label>
    <label>DR-Ausgang<select :value="modelValue.outcome" @change="set('outcome',$event.target.value)"><option value="">Alle</option><option v-for="(name,key) in DR_OUTCOME_LABELS" :key="key" :value="key">{{ name }}</option></select></label>
    <label>Entry<select :value="modelValue.entry" @change="set('entry',$event.target.value)"><option value="">Alle</option><option value="with">Mit Entry</option><option value="without">Ohne Entry</option></select></label>
    <label>Angepinnt<select :value="modelValue.pinned" @change="set('pinned',$event.target.value)"><option value="">Egal</option><option value="with">Nur angepinnt</option><option value="without">Ohne Pin</option></select></label>
    <label>Merkmal<select :value="modelValue.feature" @change="set('feature',$event.target.value)"><option value="">Alle</option><option v-for="f in features" :key="f.key" :value="f.key">{{ f.label }}</option></select></label>
    <label>Merkmalswert<select :value="modelValue.value" :disabled="!modelValue.feature" @change="set('value',$event.target.value)"><option value="">Egal</option><option v-for="(label,key) in FEATURE_VALUES" :key="key" :value="key">{{ label }}</option></select></label>
    <p v-if="modelValue.stage === 'invalidated'">Historischer Stufenfilter: enthält auch Preisenden. Der gespeicherte Grund trennt Preisenden von Disqualifikationen; der gespeicherte Grund steht auf der Karte. Die Trichterzahl zählt nur Disqualifikationen.</p>
  </form>
</template>
<style scoped>
.statistics-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#b1b7c5;min-width:0}select,input{width:100%;min-height:36px;box-sizing:border-box;background:#1e222d;color:#d1d4dc;border:1px solid #434651;border-radius:4px;padding:7px;color-scheme:dark}select:focus-visible,input:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
