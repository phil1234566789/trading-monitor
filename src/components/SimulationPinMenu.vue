<script setup>
import { ref,watch,nextTick } from 'vue';
const props=defineProps({target:Object,saving:Boolean,error:String});
const emit=defineEmits(['close','save','remove']);
const dialog=ref(null),note=ref(''),edit=ref(false);
watch(()=>props.target,async target=>{
  if(target){note.value=target.note ?? '';edit.value=false;await nextTick();if(!dialog.value.open)dialog.value.showModal();}
  else dialog.value?.close();
});
</script>
<template>
  <dialog ref="dialog" class="pin-menu" aria-labelledby="simulation-pin-title" @cancel="emit('close')" @close="emit('close')">
    <h2 id="simulation-pin-title">{{ target?.kind==='simulation_checkpoint'?target.feature.label:target?.kind==='simulation_entry'?'Entry an den Chat übergeben':'DR an den Chat übergeben' }}</h2>
    <button type="button" :disabled="saving" @click="emit('save',note)">Anpinnen (an den Chat übergeben)</button>
    <button type="button" :disabled="saving" @click="edit=!edit">Anliegen eintragen: was soll analysiert werden</button>
    <label v-if="edit">Anliegen (optional)<textarea v-model="note" rows="3" :disabled="saving" /></label>
    <button type="button" :disabled="saving || !target?.existingId" @click="emit('remove')">Pin entfernen</button>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="saving" role="status">Pin wird gespeichert…</p>
    <button type="button" :disabled="saving" @click="emit('close')">Schließen</button>
  </dialog>
</template>
<style scoped>
.pin-menu{max-width:440px;width:calc(100% - 48px);box-sizing:border-box;color:#d1d4dc;background:#1e222d;border:1px solid #626b7f;border-radius:6px;padding:16px}h2{font-size:16px;margin:0 0 12px}.pin-menu::backdrop{background:rgba(0,0,0,.6)}button{display:block;width:100%;text-align:left;margin:8px 0;padding:10px;background:#171c28;color:#d1d4dc;border:1px solid #434651;border-radius:4px;cursor:pointer}button:disabled{opacity:.5}label{display:block;font-size:12px}textarea{width:100%;box-sizing:border-box;background:#131722;color:#d1d4dc;border:1px solid #626b7f;padding:8px;margin-top:8px}p{font-size:12px;color:#ff8b91}:is(button,textarea):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
