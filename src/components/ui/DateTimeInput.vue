<script setup>
import {toDatetimeLocal,fromDatetimeLocal} from '../../datetimeLocal.js';
// Zeitpunkt-Feld auf Unix-Sekunden (null = leer), z. B. fester Strukturstart im Dashboard und im TS1.1-Debugger.
defineProps({modelValue:{type:Number,default:null}});
const emit=defineEmits(['update:modelValue']);
</script>

<template>
  <input type="datetime-local" :value="modelValue==null?'':toDatetimeLocal(modelValue)"
    @input="emit('update:modelValue',fromDatetimeLocal($event.target.value))">
</template>
