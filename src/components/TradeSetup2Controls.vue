<script setup>
import {formatDatedTime} from '../berlinTime.js';
defineProps({positions:Array,selected:Object,loading:Boolean,status:String,error:String});
const emit=defineEmits(['select','close','refresh']);
function choose(event,positions){const p=positions.find(p=>p.id===event.target.value);if(p)emit('select',p.snapshotId,p.runId);}
</script>
<template>
  <div class="setup2-controls" aria-label="Trade Setups 2.0">
    <strong>Trade Setups 2.0</strong>
    <select aria-label="Trade Setup 2.0 auswählen" @change="choose($event,positions)">
      <option value="">{{ positions.length ? 'Setup im Chart oder hier auswählen' : 'Noch kein Setup in dieser Ansicht' }}</option>
      <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.direction==='short'?'Short':'Long' }} · {{ formatDatedTime(p.displayTime) }} · {{ p.kind==='candidate'?p.candidateStatus:p.status==='ambiguous'?'unklar':p.isOpen?'offen':p.outcome }}</option>
    </select>
    <button v-if="selected" @click="emit('close')">Zur Übersicht</button>
    <button v-else :disabled="loading" @click="emit('refresh')">↻</button>
    <small v-if="selected">Gespeicherter Stand: {{ formatDatedTime(selected.knownAt) }} Uhr{{ selected.entry?'':' · ohne Entry · Historie' }}</small>
    <small v-else role="status">{{ loading ? status : status || 'Gespeicherte Setups · Details per Klick' }}</small>
    <span v-if="error" role="alert">{{ error }}</span>
  </div>
</template>
<style scoped>
.setup2-controls{position:absolute;top:10px;left:12px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:calc(100% - 120px);padding:8px 10px;background:#131722ee;border:1px solid #2a2e39;border-radius:4px;font-size:12px;color:#d1d4dc}
select,button{background:#1e222d;color:inherit;border:1px solid #434651;border-radius:3px;padding:4px;max-width:320px}small{color:#a5aab5}span[role=alert]{color:#ff8a87;flex-basis:100%}
</style>
