<script setup>
import {onBeforeUnmount,onMounted} from 'vue';
import {formatDatedTime} from '../berlinTime.js';
import {clampTime,jumpTarget as findJump} from '../composables/useDebuggerTime.js';

// Zeitbalken aller Chart-Debugger-Sektionen; der Slot sitzt zwischen den Sprüngen und der evaluatedAt-Anzeige.
const props=defineProps({modelValue:{type:Number,default:0},from:{type:Number,required:true},through:{type:Number,required:true},
 step:{type:Number,default:60},stepLabel:{type:String,default:'M1-Kerze'},changeHint:{type:String,default:'im Knotenplan'},
 // null = Änderungsliste (noch) nicht bekannt, Sprünge deaktiviert.
 changeTimes:{type:Array,default:null},
 // Die Fall-Sektion bleibt per v-show montiert; ohne active fingen ihre Pfeiltasten auch in anderen Sektionen.
 active:{type:Boolean,default:true}});
const emit=defineEmits(['update:modelValue']);

const jumpTarget=delta=>findJump(props.changeTimes,props.modelValue,delta);
const jump=delta=>{const target=jumpTarget(delta);if(target!=null)emit('update:modelValue',target);};
const move=delta=>emit('update:modelValue',clampTime(props.modelValue+delta*props.step,props,props.step));
function onKey(e){
 if(!props.active||e.target.tagName==='SELECT'||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 // Sonst bewegt ein fokussierter Slider sich zusätzlich selbst.
 e.preventDefault();
 (e.shiftKey?jump:move)(e.key==='ArrowLeft'?-1:1);
}
onMounted(()=>window.addEventListener('keydown',onKey));
onBeforeUnmount(()=>window.removeEventListener('keydown',onKey));
</script>

<template>
 <button @click="jump(-1)" :disabled="jumpTarget(-1)==null" :title="`Zur vorigen Änderung ${changeHint} (Shift+←)`">◀ vorige Änderung</button>
 <button @click="move(-1)" :title="`Eine ${stepLabel} zurück (←)`">◀</button>
 <input class="time-range" type="range" :min="from" :max="through" :step="step" :value="modelValue" @input="emit('update:modelValue',Number($event.target.value))">
 <button @click="move(1)" :title="`Eine ${stepLabel} vor (→)`">▶</button>
 <button @click="jump(1)" :disabled="jumpTarget(1)==null" :title="`Zur nächsten Änderung ${changeHint} (Shift+→)`">nächste Änderung ▶</button>
 <slot/>
 <span class="at">evaluatedAt {{ modelValue ? formatDatedTime(modelValue) : '–' }}</span>
</template>

<style scoped>
.time-range{flex:1;min-width:120px}
.at{font-variant-numeric:tabular-nums;white-space:nowrap}
</style>
