<script setup>
import {ref} from 'vue';
import IconButton from './ui/IconButton.vue';
import ActionButton from './ui/ActionButton.vue';
const props=defineProps({rows:Array,dragging:Boolean});
const emit=defineEmits(['move','split','nudge','share','save']);
const editing=ref(null),percent=ref('');
const key=row=>`${row.orderId}:${row.index}`;
const editingOrder=row=>editing.value?.startsWith(row.orderId+':');
const percentLabel=value=>Number(value.toFixed(2));
function edit(row){editing.value=key(row);percent.value=percentLabel(row.percent);}
function save(row){const value=Number(percent.value);if(value>0&&value<row.totalPercent){emit('share',row,value);editing.value=null;}}
function pointer(event,row,action){if(event.button===0){event.preventDefault();event.stopPropagation();emit(action,row,event);}}
function keyboard(event,row,action){if(event.key==='Enter'||event.key===' '){event.preventDefault();emit(action,row);}}
</script>
<template>
 <div class="mmt-tp-overlay" :class="{dragging}" aria-label="TP-Linien im Chart">
  <span v-for="row in rows.filter(r=>r.y!==r.lineY)" :key="`connector:${key(row)}`" class="tp-connector" :style="{right:(row.right+2)+'px',top:Math.min(row.y,row.lineY)+'px',height:Math.abs(row.y-row.lineY)+'px'}" aria-hidden="true"></span>
  <div v-for="row in rows" :key="key(row)" class="tp-controls" :class="{selected:row.selected}" :style="{top:row.y+'px',right:row.right+'px'}" :aria-label="`${row.accountLabel} · Position ${row.positionId} · TP ${row.index+1}`" @pointerdown.stop @click.stop @wheel.stop>
   <span class="tp-label" :title="`${row.accountLabel} · Position ${row.positionId}`">{{row.accountLabel}}</span><span class="tp-price">TP{{row.index+1}} · {{row.price}}<span v-if="row.dirty"> *</span></span>
   <IconButton class="tp-icon tp-move" :armed="row.selected" :title="`TP ${row.index+1} verschieben · Pfeiltasten für Feinschritte`" :aria-label="`TP ${row.index+1} verschieben`" @pointerdown="pointer($event,row,'move')" @keydown="keyboard($event,row,'move')" @keydown.up.prevent="emit('nudge',row,1)" @keydown.down.prevent="emit('nudge',row,-1)">↕</IconButton>
   <span :title="row.targetCount>=5?'Maximal fünf Teilziele':`TP ${row.index+1} teilen und neue Linie herausziehen`">
    <IconButton class="tp-icon" :disabled="row.targetCount>=5" :aria-label="`TP ${row.index+1} teilen`" @pointerdown="pointer($event,row,'split')" @keydown="keyboard($event,row,'split')">⊕</IconButton>
   </span>
   <ActionButton class="tp-share" :disabled="row.targetCount<2" :title="row.targetCount<2?'Zuerst teilen':'Anteil ändern; andere Ziele werden proportional angepasst, nicht verplanter Rest bleibt frei'" :aria-label="`TP ${row.index+1} Anteil ${percentLabel(row.percent)} Prozent ändern`" @click="edit(row)">{{percentLabel(row.percent)}}%</ActionButton>
   <form v-if="editing===key(row)" class="tp-percent" @submit.prevent="save(row)">
    <label>Anteil %<input v-model="percent" type="number" min="0.01" :max="row.totalPercent-0.01" step="any" required :aria-label="`Anteil TP ${row.index+1} in Prozent`" @keydown.esc="editing=null"></label>
    <ActionButton type="submit">OK</ActionButton><IconButton class="tp-icon" aria-label="Anteilbearbeitung abbrechen" title="Abbrechen" @click="editing=null">×</IconButton>
   </form>
   <div v-if="row.showSave" class="tp-savebar" :aria-label="`TP-Plan ${row.accountLabel} · Position ${row.positionId}`">
    <span :title="editingOrder(row)?'Anteil zuerst mit OK übernehmen':row.saveState.reason||'Speichert den gesamten TP-Plan dieser Position'">
     <ActionButton class="tp-save" :disabled="row.saveState.disabled||editingOrder(row)" :title="editingOrder(row)?'Anteil zuerst mit OK übernehmen':row.saveState.reason||undefined" @click="emit('save',row)">TP-Plan speichern</ActionButton>
    </span>
    <span class="tp-save-status" role="status" :title="row.saveState.status">{{row.saveState.status}}</span>
   </div>
  </div>
 </div>
</template>
<style scoped>
.mmt-tp-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}
.tp-controls{position:absolute;display:flex;align-items:center;gap:4px;transform:translateY(-50%);pointer-events:auto;background:var(--mmt-bg,#131722);border:1px solid var(--mmt-border,#303746);border-radius:4px;padding:2px;max-width:calc(100% - 8px);color:var(--mmt-text,#d1d4dc);font-size:10px;line-height:1}
.tp-controls.selected{border-color:var(--mmt-accent,#26a69a)}
.tp-label{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}.tp-price{white-space:nowrap}.tp-connector{position:absolute;border-right:1px solid var(--mmt-accent,#26a69a);pointer-events:none}
.tp-icon{width:24px;height:24px;font-size:14px;border-radius:3px;flex:none;touch-action:none}.dragging :deep(button){cursor:ns-resize!important}
.tp-move{cursor:ns-resize}.tp-share{padding:4px;font-size:11px;white-space:nowrap;min-height:24px}
.tp-savebar{position:absolute;top:100%;right:-1px;display:flex;align-items:center;gap:4px;background:var(--mmt-bg,#131722);border:1px solid var(--mmt-border,#303746);padding:2px;border-radius:0 0 4px 4px;max-width:100%;font-size:10px}.tp-save{font-size:11px;white-space:nowrap;padding:4px;min-height:24px}.tp-save-status{max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button:focus-visible,input:focus-visible{outline:2px solid var(--mmt-accent,#26a69a);outline-offset:2px}
.tp-percent{display:flex;align-items:end;gap:4px}.tp-percent label{display:grid;gap:2px}.tp-percent input{width:56px;background:var(--mmt-bg,#131722);color:inherit;border:1px solid var(--mmt-border,#303746);padding:3px}
@media(max-width:480px){.tp-label{max-width:68px}.tp-controls{gap:2px}.tp-percent label{font-size:9px}.tp-percent input{width:42px}}
</style>
