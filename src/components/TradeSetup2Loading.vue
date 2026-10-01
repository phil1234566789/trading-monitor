<script setup>
import { computed } from 'vue';
const props = defineProps({ steps: { type: Array, required: true }, error: String });
defineEmits(['retry']);
const completed = computed(() => props.steps.filter(step => step.done).length);
</script>
<template>
  <section v-if="error || completed < steps.length" class="setup-loading" aria-label="Setup laden" aria-live="polite" :aria-busy="!error">
    <div>
      <h2>{{ error ? 'Setup konnte nicht geladen werden' : 'Setup wird geladen' }}</h2>
      <progress aria-label="Abgeschlossene Ladeschritte" :value="completed" :max="steps.length"></progress>
      <p>{{ completed }} von {{ steps.length }} Schritten abgeschlossen</p>
      <ul><li v-for="step in steps" :key="step.label">{{ step.done ? '✓' : '○' }} {{ step.label }}</li></ul>
      <p v-if="error" role="alert">{{ error }}</p>
      <button v-if="error" @click="$emit('retry')">Erneut versuchen</button>
    </div>
  </section>
</template>
<style scoped>
.setup-loading{position:absolute;inset:0;z-index:20;background:#131722e8;display:grid;place-items:center;padding:24px;color:#edf2ff}
.setup-loading>div{width:min(100%,420px);padding:24px;border:1px solid #5687ee;border-radius:8px;background:#1e2638;box-shadow:0 8px 30px #0008}
h2{font-size:20px;margin:0 0 18px}progress{width:100%;height:20px;accent-color:#6fa8ff}p,li{font-size:14px;line-height:1.6}ul{padding:0;list-style:none}button{padding:8px 14px;cursor:pointer}
</style>
