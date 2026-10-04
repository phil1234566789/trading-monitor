<script setup>
import { ref, watch, nextTick } from 'vue';
import { simulationPinOutcomeLabel } from '../simulationPinPresentation.js';
const props = defineProps({ open:Boolean, pins:Array, loading:Boolean, saving:Boolean, error:String });
const emit = defineEmits(['close','remove','refresh']);
const dialog = ref(null), confirmation = ref(null);
watch(() => props.open, async open => {
  confirmation.value = null;
  if (open) { await nextTick(); if (!dialog.value.open) dialog.value.showModal(); }
  else dialog.value?.close();
});
watch(() => props.pins, () => { confirmation.value = null; });
const label = pin => pin.simulationContext?.checkpoint?.label ?? (pin.kind === 'simulation_entry' ? 'Entry' : 'Dealing Range');
function removeConfirmed() {
  const ids = confirmation.value;
  confirmation.value = null;
  emit('remove', ids);
}
</script>
<template>
  <dialog ref="dialog" class="pin-list" aria-labelledby="pin-list-title" @cancel="emit('close')" @close="emit('close')">
    <header><h2 id="pin-list-title">Alle Pins · Lauf neu ({{ pins.length }})</h2><button :disabled="saving" @click="emit('close')">Schließen</button></header>
    <p>Alle Pins dieses Laufs, unabhängig von den Seitenfiltern.</p>
    <p v-if="error" role="alert">{{ error }} <button @click="emit('refresh')">Erneut laden</button></p>
    <p v-if="loading || saving" role="status">{{ saving ? 'Pins werden entfernt…' : 'Pins werden geladen…' }}</p>
    <template v-else>
      <p v-if="!pins.length" role="status">Keine Pins in diesem Lauf.</p>
      <button v-else :disabled="!!error" @click="confirmation=pins.map(p=>p.id)">Alle {{ pins.length }} Pins dieses Laufs entfernen</button>
      <div v-if="confirmation" class="confirmation" role="alert">
        <p>{{ confirmation.length }} {{ confirmation.length===1?'Pin wirklich entfernen?':'Pins wirklich entfernen?' }} Dies lässt sich nicht rückgängig machen.</p>
        <button @click="removeConfirmed">Ja, entfernen</button> <button @click="confirmation=null">Abbrechen</button>
      </div>
      <ul><li v-for="pin in pins" :key="pin.id">
        <strong><span class="flag">⚑</span> {{ label(pin) }} · {{ pin.simulationContext?.instrument }}</strong>
        <p>{{ pin.simulationContext?.direction==='long'?'Long':'Short' }} · {{ pin.simulationContext?.entry?.time?.berlin ?? pin.simulationContext?.recognizedAt?.berlin }} · {{ simulationPinOutcomeLabel(pin.simulationContext) }}</p>
        <p>{{ pin.note || 'Kein Anliegen eingetragen.' }}</p>
        <RouterLink v-if="pin.simulationContext?.chartLink" :to="pin.simulationContext.chartLink" target="_blank" rel="noopener noreferrer">Im Chart</RouterLink>
        <button @click="confirmation=[pin.id]">Pin entfernen</button>
      </li></ul>
    </template>
  </dialog>
</template>
<style scoped>
.pin-list{max-width:720px;width:calc(100% - 32px);max-height:85vh;box-sizing:border-box;overflow:auto;background:#1e222d;color:#d1d4dc;border:1px solid #626b7f;border-radius:6px;padding:16px;font-size:13px}.pin-list::backdrop{background:rgba(0,0,0,.6)}header{display:flex;justify-content:space-between;align-items:center;gap:12px}h2{font-size:17px;margin:0}p{color:#b1b7c5;line-height:1.5;overflow-wrap:anywhere}ul{padding:0;list-style:none}li{padding:14px 0;border-top:1px solid #434651}button{background:#171c28;color:#d1d4dc;border:1px solid #626b7f;border-radius:4px;padding:8px;margin:4px;cursor:pointer}button:disabled{opacity:.5}.flag{color:var(--pin-color)}a{color:#91b8ff}.confirmation{padding:12px;border:1px solid #ff7043;margin-top:12px}:is(button,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
