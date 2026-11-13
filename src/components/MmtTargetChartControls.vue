<script setup>
import {ref,watch} from 'vue';
import IconButton from './ui/IconButton.vue';
import ActionButton from './ui/ActionButton.vue';
import {exitKindLabel,exitForecastLabel,stopChoiceLabel,stopPreviewReason} from '../mmtExitPresentation.js';
const props=defineProps({rows:Array,dragging:Boolean,guide:Object,cancellation:Object});
const emit=defineEmits(['move','split','nudge','share','save','cancel','add-stop']);
const editing=ref(null),percent=ref('');
const key=row=>`${row.orderId}:${row.kind??'target'}:${row.index}`;
const label=row=>exitKindLabel(row.kind);
const editingOrder=row=>editing.value?.startsWith(row.orderId+':');
watch(()=>props.cancellation,value=>{if(value&&editing.value?.startsWith(value.orderId+':'))editing.value=null;});
const percentLabel=value=>Number(value.toFixed(2));
function edit(row){editing.value=key(row);percent.value=percentLabel(row.percent);}
function save(row){const value=Number(percent.value);if(value>0&&value<row.totalPercent){emit('share',row,value);editing.value=null;}}
function cancel(row){editing.value=null;emit('cancel',row);}
function pointer(event,row,action){if(event.button===0){event.preventDefault();event.stopPropagation();emit(action,row,event);}}
function keyboard(event,row,action){if(event.key==='Enter'||event.key===' '){event.preventDefault();emit(action,row);}}
</script>
<template>
 <div class="mmt-tp-overlay" :class="{dragging}" aria-label="SL- und TP-Linien im Chart">
  <span v-if="guide" class="tp-drag-guide" :style="{top:guide.y+'px',left:guide.left+'px',width:guide.width+'px'}" aria-hidden="true"></span>
  <span v-for="row in rows.filter(r=>r.lineY!=null&&r.y!==r.lineY)" :key="`connector:${key(row)}`" class="tp-connector" :style="{right:(row.right+2)+'px',top:Math.min(row.y,row.lineY)+'px',height:Math.abs(row.y-row.lineY)+'px'}" aria-hidden="true"></span>
  <div v-for="row in rows" :key="key(row)" :data-tp-key="key(row)" class="tp-controls" :class="{selected:row.selected}" :style="{top:row.y+'px',right:row.right+'px'}" :title="`${row.accountLabel} · Position ${row.positionId} · ${label(row)} · ${row.price}`" :aria-label="`${row.accountLabel} · Position ${row.positionId} · ${label(row)}${row.kind==='entry'?'':' '+(row.index+1)} · ${row.price}${row.kind==='entry'?'':' · '+exitForecastLabel(row.forecast)+' · '+percentLabel(row.percent)+' Prozent'}`" @pointerdown.stop @click.stop @wheel.stop @keydown.esc.stop.prevent="cancel(row)">
   <span class="tp-label" :title="`${row.accountLabel} · Position ${row.positionId}`">{{row.accountLabel}}</span><span class="tp-price" :title="row.offscreen?'Preis außerhalb des sichtbaren Chartbereichs; Bedienung am Rand.':undefined">{{label(row)}}{{row.kind==='entry'?'':row.index+1}} · {{row.price}}<span v-if="row.offscreen"> ↗</span><span v-if="row.dirty"> *</span></span>
   <template v-if="row.kind==='entry'">
    <span v-for="mode in ['risky','full']" :key="mode" :title="stopPreviewReason(row.stopPreviews?.[mode],row.stopReason)">
     <ActionButton class="tp-share" :disabled="!row.canAddStop||!row.stopPreviews?.[mode]?.price" :title="stopPreviewReason(row.stopPreviews?.[mode],row.stopReason)" @click="emit('add-stop',row,mode)">{{stopChoiceLabel(mode,row.stopPreviews?.[mode])}}</ActionButton>
    </span>
   </template>
   <template v-else>
   <span class="tp-forecast" :title="row.forecast?.costsKnown?'Geschätztes Netto dieser Teilmenge; künftiger Swap und Slippage können abweichen.':'Netto unbekannt: Kostenbasis oder native Brokerberechnung fehlt.'">{{exitForecastLabel(row.forecast)}}</span>
   <IconButton class="tp-icon tp-move" :armed="row.selected" :title="`${label(row)} ${row.index+1} verschieben · Pfeiltasten für Feinschritte`" :aria-label="`${label(row)} ${row.index+1} verschieben`" @pointerdown="pointer($event,row,'move')" @keydown="keyboard($event,row,'move')" @keydown.up.prevent="emit('nudge',row,1)" @keydown.down.prevent="emit('nudge',row,-1)">↕</IconButton>
   <span :title="row.splitReason||(row.targetCount>=5?'Maximal fünf Teilmengen':`${label(row)} ${row.index+1} teilen und neue Linie herausziehen`)">
    <IconButton class="tp-icon" :disabled="row.targetCount>=5||!!row.splitReason" :aria-label="`${label(row)} ${row.index+1} teilen`" @pointerdown="pointer($event,row,'split')" @keydown="keyboard($event,row,'split')">⊕</IconButton>
   </span>
   <ActionButton class="tp-share" :disabled="row.targetCount<2" :title="row.roundedShare?`Gewünscht ${percentLabel(row.percent)} %, ausführbar gerundet ${percentLabel(row.actualPercent)} %.`:row.targetCount<2?'Zuerst teilen':'Anteil ändern; andere Linien werden proportional angepasst'" :aria-label="`${label(row)} ${row.index+1} Anteil ${percentLabel(row.percent)} Prozent ändern`" @click="edit(row)">{{percentLabel(row.percent)}}%{{row.roundedShare?' ≈':''}}</ActionButton>
   <form v-if="editing===key(row)" class="tp-percent" @submit.prevent="save(row)">
    <label>Anteil %<input v-model="percent" type="number" min="0.01" :max="row.totalPercent-0.01" step="any" required :aria-label="`Anteil ${label(row)} ${row.index+1} in Prozent`"></label>
    <ActionButton type="submit">OK</ActionButton><IconButton class="tp-icon" aria-label="Anteilbearbeitung abbrechen" title="Abbrechen" @click="editing=null">×</IconButton>
   </form>
   <div v-if="row.showSave" class="tp-savebar" :aria-label="`SL-/TP-Plan ${row.accountLabel} · Position ${row.positionId}`">
    <span :title="editingOrder(row)?'Anteil zuerst mit OK übernehmen':row.saveState.reason||'Speichert den gesamten SL-/TP-Plan dieser Position'">
     <ActionButton class="tp-save" :disabled="row.saveState.disabled||editingOrder(row)" :title="editingOrder(row)?'Anteil zuerst mit OK übernehmen':row.saveState.reason||undefined" @click="emit('save',row)">Speichern</ActionButton>
    </span>
    <ActionButton class="tp-save" :disabled="row.saveState.cancelDisabled||(!row.dirty&&!editingOrder(row)&&!dragging)" :title="row.saveState.cancelReason||'Entwurf dieser Position verwerfen'" @click="cancel(row)">Abbrechen</ActionButton>
    <span class="tp-save-status" role="status" :title="row.saveState.status">{{row.saveState.status}}</span>
   </div>
   </template>
  </div>
 </div>
</template>
<style scoped>
.mmt-tp-overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6;container-type:inline-size}
.tp-drag-guide{position:absolute;left:0;border-top:1px dashed var(--mmt-accent,#26a69a);pointer-events:none}
.tp-controls{position:absolute;display:flex;align-items:center;gap:4px;transform:translateY(-50%);pointer-events:auto;background:var(--mmt-bg,#131722);border:1px solid var(--mmt-border,#303746);border-radius:4px;padding:2px;max-width:calc(100% - 8px);color:var(--mmt-text,#d1d4dc);font-size:10px;line-height:1}
.tp-controls.selected{border-color:var(--mmt-accent,#26a69a)}
.tp-label{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}.tp-price,.tp-forecast{white-space:nowrap}.tp-connector{position:absolute;border-right:1px solid var(--mmt-accent,#26a69a);pointer-events:none}
.tp-icon{width:24px;height:24px;font-size:14px;border-radius:3px;flex:none;touch-action:none}
.tp-move{cursor:ns-resize}.tp-share{padding:4px;font-size:11px;white-space:nowrap;min-height:24px}
.tp-savebar{position:absolute;top:100%;right:-1px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;background:var(--mmt-bg,#131722);border:1px solid var(--mmt-border,#303746);padding:2px;border-radius:0 0 4px 4px;max-width:100%;font-size:10px}.tp-save{font-size:11px;white-space:nowrap;padding:4px;min-height:24px}.tp-save-status{max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button:focus-visible,input:focus-visible{outline:2px solid var(--mmt-accent,#26a69a);outline-offset:2px}
.tp-percent{display:flex;align-items:end;gap:4px}.tp-percent label{display:grid;gap:2px}.tp-percent input{width:56px;background:var(--mmt-bg,#131722);color:inherit;border:1px solid var(--mmt-border,#303746);padding:3px}
@media(max-width:480px){.tp-label{max-width:68px}.tp-controls{gap:2px}.tp-percent label{font-size:9px}.tp-percent input{width:42px}}
@container(max-width:480px){.tp-controls{flex-wrap:wrap;gap:3px}.tp-forecast{order:9;flex-basis:100%;padding:2px 4px}.tp-label{max-width:60px}.tp-price{font-size:10px}}
</style>
