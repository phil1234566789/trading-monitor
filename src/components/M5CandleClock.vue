<script setup>
import { computed } from 'vue';
const props = defineProps({ state: { type: Object, required: true } });
defineEmits(['retry']);
const countdown = computed(() => `${Math.floor(props.state.remaining / 60)}:${String(props.state.remaining % 60).padStart(2, '0')}`);
const latest = computed(() => props.state.latest == null ? 'keine'
  : new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(props.state.latest * 1000)));
</script>

<template>
  <div class="m5-clock" :class="{ 'm5-clock-stale': state.status === 'stale' }" data-testid="m5-candle-clock">
    <div class="m5-clock-countdown">M5 · Kerzenschluss in <strong>{{ countdown }}</strong></div>
    <div v-if="state.status === 'loading'" role="status">Kerze wird geladen…</div>
    <div v-else-if="state.status === 'stale'" role="alert">
      <strong>M5-Chart nicht aktuell</strong>
      <div>Letzte Kerze: {{ latest }} · Uhrzeit und Kerzenstand stimmen nicht überein.</div>
      <div>Automatische Wiederholung läuft. Bei Marktpause entstehen keine neuen Kerzen.</div>
      <button :disabled="state.busy" @click="$emit('retry')">{{ state.busy ? 'Lädt…' : 'Jetzt nachladen' }}</button>
      <span> Falls nötig, Seite neu laden.</span>
    </div>
    <div v-else class="m5-clock-current">Geschlossene Kerzen aktuell</div>
  </div>
</template>

<style scoped>
.m5-clock { position: absolute; top: 12px; right: 80px; z-index: 5; max-width: min(440px, calc(100% - 90px)); padding: 7px 10px; border: 1px solid #435065; border-radius: 6px; background: #141a25ee; color: #e2e8f0; font-size: 12px; line-height: 1.5; }
.m5-clock-countdown strong { font-variant-numeric: tabular-nums; font-size: 15px; }
.m5-clock-current { color: #89c9be; }
.m5-clock-stale { border-color: #ffb454; color: #ffd396; }
button { margin-top: 5px; padding: 4px 8px; background: #293447; color: #fff; border: 1px solid #718096; border-radius: 4px; cursor: pointer; }
button:disabled { opacity: .6; cursor: wait; }
</style>
