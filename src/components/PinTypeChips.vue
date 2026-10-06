<script setup>
import {PIN_TYPES,pinTypeLabel} from '../pinType.js';
defineProps({modelValue:String,disabled:Boolean});
const emit=defineEmits(['update:modelValue']);
</script>
<template>
  <div class="pin-type" role="group" aria-label="Pin-Typ">
    <span>Pin-Typ: {{ pinTypeLabel(modelValue) }}</span>
    <button v-for="(label,type) in PIN_TYPES" :key="type" type="button" :aria-pressed="modelValue===type" :disabled="disabled" @click="emit('update:modelValue',type)">{{ label }}</button>
  </div>
</template>
<style scoped>
.pin-type{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px}.pin-type button{width:auto;margin:0;padding:6px 10px;border:1px solid #626b7f;border-radius:16px;background:#171c28;color:#d1d4dc;cursor:pointer}.pin-type button[aria-pressed=true]{background:#304b74;border-color:#91b8ff}.pin-type button:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}.pin-type button:disabled{opacity:.5}
</style>
