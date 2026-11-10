<script setup>
import {computed,ref,watch} from 'vue';
import {useTradePositionForm} from '../composables/useTradePositionForm.js';
import {deleteTrade} from '../tradeIntake.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
import {formatDatedTime} from '../berlinTime.js';
import {formatEvidenceLabel} from '../tradeEvidence';
import {accounts} from '../tradingAccounts.js';
import ActionButton from './ui/ActionButton.vue';
import CrudListSection from './CrudListSection.vue';
import M1FvgEntryControls from './M1FvgEntryControls.vue';
import TradeJournalComments from './TradeJournalComments.vue';

const props=defineProps({trade:{type:Object,required:true},number:Number,draft:Boolean,draftActive:Boolean,draftKey:Number,selected:Boolean,
 currentSymbol:String,armedAction:String,entryFvgMessage:String,canDelete:{type:Boolean,default:true}});
const emit=defineEmits(['saved','created','cancel','deleted','request-entry-fvg','prefill','add-evidence','remove-evidence','hover-evidence']);
const form=useTradePositionForm(()=>props.trade,{saved:()=>emit('saved'),created:(id,account)=>emit('created',id,account,props.draftKey)});
const {entryPrice,entryTimeInput,stopLoss,exitPrice,exitDateInput,exitClockInput,outcome,reasoning,tradingAccountId,
 size,netPl,commission,saving,saveError,createdPositionId,save}=form;
watch(()=>props.draft,active=>{if(active)form.beginPositionDraft();},{immediate:true});
const opened=ref(props.draft||props.selected);
watch(()=>props.selected,selected=>{if(selected)opened.value=true;});
// Die gespeicherten Summaries bleiben neben dem neuen Entwurf sichtbar; ihre Formularstates bleiben erhalten.
watch(()=>props.draftActive,active=>{if(active&&!props.draft)opened.value=false;});
const positionId=computed(()=>createdPositionId.value??(props.draft?null:props.trade.id));
const heading=computed(()=>`Ausführung ${props.number} · ${positionId.value!=null?'Position #'+positionId.value:'neue Position'}`);
const price=value=>value==null?'–':fmtPrice(value,pricePrecisionForInstrument(props.trade.instrument));
const time=value=>value==null?'–':formatDatedTime(value);
const summary=computed(()=>props.draft?'Neuer Entwurf · gespeichert wird erst mit „Position speichern“.':
 `Entry ${price(props.trade.entryPrice)} · ${time(props.trade.entryTime)} | Exit ${price(props.trade.exitPrice)} · ${time(props.trade.exitTime)} | SL ${price(props.trade.stopLoss)}`);
const categories=[{key:'confirmation',title:'Bestätigungen (GO für diesen Entry)',icon:'✔'},
 {key:'confluence',title:'Zusatzargumente (Entry)',icon:'💡'},{key:'anti_confluence',title:'Anti-Confluences (Entry)',icon:'💀'}];
const armKey=key=>key==='anti_confluence'?'antiConfluence':key;
const evidence=category=>(props.trade.confirmations??[]).filter(item=>item.level==='position'&&item.category===category);
const evidenceLabel=item=>formatEvidenceLabel(item,props.trade.instrument,Math.floor(Date.now()/1000));
function cancel(){if(saving.value)return;if(props.draft)emit('cancel');else form.cancelPositionDraft();}
function applyPrefill(prefill){
 if(!props.draft||saving.value||createdPositionId.value!=null)return false;
 form.beginPositionDraft(prefill);emit('prefill');return true;
}
async function remove(){
 if(!props.canDelete||!confirm(`Position #${props.trade.id} wirklich löschen?`))return;
 if(await deleteTrade(props.trade.id))emit('deleted',props.trade.id);
}
defineExpose({applyPrefill});
</script>
<template>
 <article class="execution-card" :aria-label="heading" :data-position-id="positionId" :data-draft-key="draft?draftKey:undefined">
  <details :open="opened" @toggle="opened=$event.target.open">
   <summary><strong>{{heading}}</strong><span>{{summary}}</span></summary>
   <div v-if="opened" class="execution-body">
    <M1FvgEntryControls v-if="draft" :range-id="trade.dealingRangeId" :instrument="trade.instrument" :direction="trade.direction"
     :armed-action="armedAction" :message="entryFvgMessage" :disabled="saving||currentSymbol!==trade.instrument||createdPositionId!=null"
     @request="variant=>emit('request-entry-fvg',{variant,draftKey})" />
    <template v-if="!draft">
     <CrudListSection v-for="category in categories" :key="category.key" :title="category.title" :icon="category.icon"
      add-title="Beleg für diese Ausführung im Chart anklicken" :items="evidence(category.key)" :item-key="item=>item.id"
      :item-label="evidenceLabel" empty-text="Noch keine Belege." :armed="armedAction===armKey(category.key)"
      @add="emit('add-evidence',category.key,trade)" @remove="item=>emit('remove-evidence',item)" @hover="item=>emit('hover-evidence',item)" />
    </template>
    <p class="execution-timezone">Datum und Uhrzeit · Europe/Berlin<span v-if="trade.brokerPrivate"> · Beträge in {{trade.accountCurrency}}</span></p>
    <form class="execution-form" autocomplete="off" @submit.prevent="save">
     <label>Entry-Preis<input v-model="entryPrice" type="number" step="any" :required="draft" :min="draft?0:undefined" placeholder="leer = nicht gefüllt" /></label>
     <label>Entry-Zeit<input v-model="entryTimeInput" type="datetime-local" :required="draft" /></label>
     <label>Stop-Loss<input v-model="stopLoss" type="number" step="any" placeholder="optional" /></label>
     <label>Exit-Preis<input v-model="exitPrice" type="number" step="any" placeholder="optional" /></label>
     <label>Exit-Datum<input v-model="exitDateInput" type="date" /></label>
     <label>Exit-Uhrzeit<input v-model="exitClockInput" type="time" /><small>Ohne Uhrzeit kein Exit-Zeitpunkt.</small></label>
     <label>Size (Lots)<input v-model="size" type="number" step="any" placeholder="optional" /></label>
     <label>Net P/L<input v-model="netPl" type="number" step="any" placeholder="optional" /></label>
     <label>Commission<input v-model="commission" type="number" step="any" placeholder="optional" /></label>
     <label>Trading-Konto<select v-model="tradingAccountId"><option :value="null">— kein Konto —</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{account.name}}</option></select></label>
     <label>Ergebnis<select v-model="outcome"><option value="">— (offen/kein Fill)</option><option value="open">Offen</option><option value="win">Win</option><option value="loss">Loss</option></select></label>
     <label class="execution-wide">Begründung<textarea v-model="reasoning" rows="2" autocomplete="off"></textarea></label>
     <p v-if="saveError" role="alert" class="execution-wide execution-error">{{saveError}}</p>
     <p v-if="createdPositionId!=null" role="status" class="execution-wide">Position #{{createdPositionId}} gespeichert · Liste wird aktualisiert.</p>
     <div class="execution-wide execution-actions">
      <ActionButton type="submit" :disabled="saving||createdPositionId!=null">{{draft?'Position speichern':'Speichern'}}</ActionButton>
      <ActionButton :disabled="saving||createdPositionId!=null" @click="cancel">{{draft?'Entwurf verwerfen':'Änderungen verwerfen'}}</ActionButton>
     </div>
    </form>
    <TradeJournalComments v-if="!draft" :position-id="trade.id" />
    <p v-if="!draft&&trade.brokerPrivate" class="execution-timezone">Private Brokerzuordnung · Original-Deals bleiben erhalten.</p>
    <ActionButton v-if="!draft&&!trade.brokerPrivate" tone="danger" :disabled="!canDelete" :title="canDelete?undefined:'Zuerst neuen Entwurf speichern oder verwerfen.'" @click="remove">🗑 Diese Ausführung löschen</ActionButton>
   </div>
  </details>
 </article>
</template>
<style scoped>
.execution-card{container-type:inline-size;border:1px solid #414857;border-radius:6px;background:#1a1e28;margin:10px 0;color:#d1d4dc}
summary{padding:10px;cursor:pointer;font-size:13px}summary strong{color:#d5dce8}summary>span{display:block;font-size:11px;color:#a9b0bf;margin-top:5px;line-height:1.5}
.execution-body{padding:0 10px 12px}.execution-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px}
label{display:flex;flex-direction:column;gap:4px;font-size:11px;min-width:0}input,select,textarea{box-sizing:border-box;width:100%;min-width:0;padding:7px;background:#131722;border:1px solid #343b4a;border-radius:4px;color:inherit;font:inherit}
.execution-wide{grid-column:1/-1}.execution-actions{display:flex;flex-wrap:wrap;gap:8px}.execution-timezone,small{font-size:11px;color:#929bac}.execution-error{color:#ff8a87}
</style>
