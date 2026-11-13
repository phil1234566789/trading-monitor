<script setup>
import ActionButton from './ui/ActionButton.vue';
import {useMmtExitEditor} from '../composables/useMmtExitEditor.js';
import {exitForecastLabel,stopChoiceLabel,stopPreviewReason} from '../mmtExitPresentation.js';
const props=defineProps({headless:Boolean,order:Object,nativePosition:Object,api:{type:Function,required:true},snapshot:Object,online:Boolean,entryTime:Number,accountName:String});
const emit=defineEmits(['saved']);
const {context,position,quote,draft,ready,allocation,stopAllocation,validation,saveReason,cancelReason,saveState,plan,busy,error,receipt,loaded,refreshError,uncertain,costs,stopPreviews,stopReason,canAddStop,legs,lines,stateNames,messages,
 initTargets,update,add,remove,refresh,save,reset,changeRiskMode,selectForDrag,addStop}=useMmtExitEditor(props,emit);
const forecast=(kind,index)=>lines.value.find(line=>line.kind===kind&&line.index===index)?.forecast;
</script>
<template>
 <p v-if="headless&&(error||refreshError||!online||!loaded)" :class="error||refreshError||!online?'mmt-error':'mmt-muted'" :role="error||refreshError||!online?'alert':'status'">SL/TP · {{accountName||`Konto ${context.login}`}} · #{{context.ticket}} · {{error||refreshError||(!online?'Worker nicht verbunden; Verwaltung nicht bereit.':'Verwaltung wird geladen.')}}</p>
 <section v-if="!headless" class="mmt-target-editor" aria-label="SL- und TP-Verwaltung">
  <h3>SL / TP · {{context.symbol}}</h3>
  <p>Entry {{context.entry}}<template v-if="context.initialSl"> · initialer SL {{context.initialSl}}</template><template v-else-if="draft?.basisSl"> · R-Basis {{draft.basisSl}} (SL-Plan)</template><template v-else> · ursprünglicher SL unbekannt · RR —</template></p>
  <p v-if="!position">Keine passende offene Brokerposition im aktuellen Stand.</p>
  <template v-else>
   <p>Offen {{position.volume}} Lot · Broker-SL {{position.sl||'keiner'}} · Broker-TP {{position.tp||'keiner'}}</p>
   <p v-if="plan">{{stateNames[plan.state]??plan.state}}<span v-if="plan.reason"> · {{plan.reason}}</span></p>
   <div v-if="!draft?.stops.length" class="mmt-stop-add" aria-label="SL hinzufügen">
    <span v-for="mode in ['risky','full']" :key="mode" :title="stopPreviewReason(stopPreviews[mode],stopReason)">
     <ActionButton :disabled="!canAddStop||!stopPreviews[mode]?.price" :title="stopPreviewReason(stopPreviews[mode],stopReason)" @click="addStop(mode)">{{stopChoiceLabel(mode,stopPreviews[mode])}}</ActionButton>
    </span>
   </div>
   <template v-for="leg in legs" :key="leg.kind">
    <h4 v-if="leg.levels.length">{{leg.label}}</h4>
    <label v-if="leg.kind==='stop'&&leg.levels.length" class="mmt-stop-risk">Risiko-Obergrenze
     <select :value="draft.riskMode" :disabled="!snapshot?.exit_plans_ready||busy" @change="changeRiskMode($event.target.value)"><option value="risky">0,5 %</option><option value="full">0,9 %</option></select>
     <small>{{stopPreviewReason(stopPreviews[draft.riskMode])}}</small>
    </label>
    <div v-for="(level,index) in leg.levels" :key="index" class="mmt-target-row">
     <label>{{leg.label}} {{index+1}}<input :value="level.price" type="number" min="0" step="any" @input="update(index,'price',$event.target.value,leg.kind)"></label>
     <label>Lot<input :value="level.volume" type="number" min="0" :step="quote?.volume_step??'any'" @input="update(index,'volume',$event.target.value,leg.kind);update(index,'percent',null,leg.kind)"></label>
     <label>% offen<input :value="level.percent??''" type="number" min="0" max="100" step="any" @input="update(index,'percent',$event.target.value===''?null:Number($event.target.value),leg.kind)"></label>
     <button :aria-label="`${leg.label} ${index+1} entfernen`" @click="remove(index,leg.kind)">×</button>
     <button class="mmt-target-select" :aria-label="`${leg.label} ${index+1} im Chart ziehen`" :aria-pressed="draft.selectedKind===leg.kind&&draft.selectedIndex===index" :disabled="!Number(level.price)" @click="selectForDrag(index,leg.kind)">{{draft.selectedKind===leg.kind&&draft.selectedIndex===index?'Im Chart ausgewählt · Linie ziehen':'Im Chart ziehen'}}</button>
     <small>Ausführbar {{leg.allocation.targets[index]?.volume??'—'}} Lot · {{exitForecastLabel(forecast(leg.kind,index))}}</small>
    </div>
    <ActionButton v-if="leg.kind==='target'||leg.levels.length" :disabled="busy||leg.levels.length>=5||(leg.kind==='stop'&&!snapshot?.exit_plans_ready)" @click="add(leg.kind)">{{leg.kind==='stop'?'+ Teil-SL':'+ Teilziel'}}</ActionButton>
   </template>
   <p>TP-Rest {{allocation.remainder??'—'}} Lot · Mindestlot {{quote?.minimum_volume??'—'}} · Schritt {{quote?.volume_step??'—'}}. SL-Anteile sichern die gesamte Position ab.</p>
   <p v-if="validation.error" role="status">{{messages[validation.error]??validation.error}}</p>
   <p class="mmt-muted">Netto geschätzt aus anteiligen Entrykosten, aktuellem Swap und belegten Exitgebühren. Künftige Gebühren, Swap und Slippage können abweichen; der Risikopuffer ist keine Gebühr.</p>
   <p v-if="draft?.stops.length>1" class="mmt-muted">Teil-SLs benötigen den Worker. Bei Ausfall greift der äußerste Broker-SL für die gesamte Restposition.</p>
   <ActionButton :disabled="!!saveReason" :title="saveReason||undefined" @click="save">Speichern</ActionButton>
   <ActionButton :disabled="!!cancelReason" :title="cancelReason||undefined" @click="reset">Abbrechen</ActionButton>
  </template>
  <p v-if="error||refreshError" role="alert">{{error||refreshError}}</p><p v-if="receipt" role="status">{{receipt}}</p>
 </section>
</template>
<style scoped>
.mmt-target-editor{border-top:1px solid var(--mmt-border,#303746);padding-top:8px;font-size:11px}
.mmt-target-row{display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:5px;align-items:end;margin:6px 0}
label{display:flex;flex-direction:column;gap:3px;min-width:0}input,select{width:100%;min-width:0;background:var(--mmt-bg,#131722);color:var(--mmt-text,#d1d4dc);border:1px solid var(--mmt-border,#303746);border-radius:3px;padding:4px}
.mmt-target-select{grid-column:1/-1;text-align:left;font-size:11px}
.mmt-stop-add{display:flex;gap:4px;flex-wrap:wrap}.mmt-stop-risk{margin:4px 0}.mmt-stop-risk select{max-width:110px}
h4{margin:8px 0 4px}small{grid-column:1/-1}button,select{cursor:pointer}button:disabled,select:disabled{cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--mmt-accent,#2962ff);outline-offset:2px}
</style>
