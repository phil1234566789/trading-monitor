<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { simulationPinOutcomeLabel } from '../simulationPinPresentation.js';
const props = defineProps({ open:Boolean, pins:Array, unmatched:{type:Array,default:()=>[]}, runId:String, loading:Boolean, saving:Boolean, error:String });
const emit = defineEmits(['close','remove','refresh','edit']);
const dialog = ref(null), confirmation = ref(null);
const removable=computed(()=>props.pins.filter(p=>!props.runId || p.simulationRunId===props.runId));
const sections=computed(()=>[{label:'Zugeordnet',pins:props.pins},{label:'Nicht zugeordnet',pins:props.unmatched}]);
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
    <header><h2 id="pin-list-title">Alle Pins · Lauf neu ({{ pins.length+unmatched.length }})</h2><button :disabled="saving" @click="emit('close')">Schließen</button></header>
    <p>Pins dieses und früherer Läufe, unabhängig von den Seitenfiltern. Kommentare und Ursprung bleiben erhalten.</p>
    <p v-if="error" role="alert">{{ error }} <button @click="emit('refresh')">Erneut laden</button></p>
    <p v-if="loading || saving" role="status">{{ saving ? 'Pins werden gespeichert…' : 'Pins werden geladen…' }}</p>
    <template v-else>
      <p v-if="!pins.length && !unmatched.length" role="status">Keine Pins vorhanden.</p>
      <button v-if="removable.length" :disabled="!!error" @click="confirmation=removable.map(p=>p.id)">Alle {{ removable.length }} Pins dieses Laufs entfernen</button>
      <div v-if="confirmation" class="confirmation" role="alert">
        <p>{{ confirmation.length }} {{ confirmation.length===1?'Pin wirklich entfernen?':'Pins wirklich entfernen?' }} Dies lässt sich nicht rückgängig machen.</p>
        <button @click="removeConfirmed">Ja, entfernen</button> <button @click="confirmation=null">Abbrechen</button>
      </div>
      <section v-for="section in sections" :key="section.label">
      <h3>{{ section.label }} ({{ section.pins.length }})</h3>
      <p v-if="!section.pins.length">Keine Pins.</p>
      <ul><li v-for="pin in section.pins" :key="pin.id">
        <strong><span class="flag">⚑</span> {{ label(pin) }} · {{ pin.simulationContext?.instrument }}</strong>
        <p>{{ pin.simulationContext?.direction==='long'?'Long':'Short' }} · {{ pin.simulationContext?.entry?.time?.berlin ?? pin.simulationContext?.recognizedAt?.berlin }} · {{ simulationPinOutcomeLabel(pin.simulationContext) }}</p>
        <p>{{ pin.note || 'Kein Anliegen eingetragen.' }}</p>
        <button @click="emit('edit',pin)">Bearbeiten</button>
        <p v-if="pin.unmatchedReason">{{ pin.unmatchedReason }}</p>
        <p v-if="pin.originLabel">Ursprung: {{ pin.originLabel }}</p>
        <RouterLink v-if="pin.currentChartLink" :to="pin.currentChartLink" target="_blank" rel="noopener noreferrer">Im aktuellen Chart</RouterLink>
        <RouterLink v-if="pin.simulationContext?.chartLink" :to="pin.simulationContext.chartLink" target="_blank" rel="noopener noreferrer">Ursprünglicher Chart / Snapshot</RouterLink>
        <button v-if="!runId || pin.simulationRunId===runId" @click="confirmation=[pin.id]">Pin entfernen</button>
      </li></ul>
      </section>
    </template>
  </dialog>
</template>
<style scoped>
.pin-list{max-width:720px;width:calc(100% - 32px);max-height:85vh;box-sizing:border-box;overflow:auto;background:#1e222d;color:#d1d4dc;border:1px solid #626b7f;border-radius:6px;padding:16px;font-size:13px}.pin-list::backdrop{background:rgba(0,0,0,.6)}header{display:flex;justify-content:space-between;align-items:center;gap:12px}h2{font-size:17px;margin:0}p{color:#b1b7c5;line-height:1.5;overflow-wrap:anywhere}ul{padding:0;list-style:none}li{padding:14px 0;border-top:1px solid #434651}button{background:#171c28;color:#d1d4dc;border:1px solid #626b7f;border-radius:4px;padding:8px;margin:4px;cursor:pointer}button:disabled{opacity:.5}.flag{color:var(--pin-color)}a{color:#91b8ff}.confirmation{padding:12px;border:1px solid #ff7043;margin-top:12px}:is(button,a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
