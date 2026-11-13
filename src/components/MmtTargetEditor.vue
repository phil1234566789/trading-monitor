<script setup>
import {computed,ref,watch,onUnmounted} from 'vue';
import {chartInstrument} from '../tradeIdeas.js';
import {findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {targetDraftAllocation,validateTargetAllocation} from '../../supabase/functions/trading-monitor-mcp/targetPlanContract.js';
import {setTargetDraft,removeTargetDraft,useTargetDraft,selectTargetDraft} from '../mmtTargetDrafts.js';
import {registerTargetSave,targetSaveRejected} from '../mmtTargetSave.js';
import ActionButton from './ui/ActionButton.vue';
const props=defineProps({order:{type:Object,required:true},api:{type:Function,required:true},snapshot:Object,online:Boolean,entryTime:Number,accountName:String});
const emit=defineEmits(['saved']);
const plan=ref(null),busy=ref(false),error=ref(''),receipt=ref(''),now=ref(Date.now());
const loaded=ref(false),refreshError=ref(''),uncertain=ref(null);
const position=computed(()=>findOrderPosition(props.order,props.snapshot));
const quote=computed(()=>props.snapshot?.quotes?.find(q=>q.symbol===props.order.intent.symbol));
const draft=useTargetDraft(()=>props.order.id);
const ready=computed(()=>{
 // Ein neuer Worker-Tick darf gegenüber dem zweisekündigen UI-Timer nicht fälschlich als Zukunft gelten.
 const time=Math.max(now.value,Date.now())/1000;
 return props.online&&props.snapshot?.target_plans_ready&&props.snapshot?.execution_ready&&props.snapshot?.trade_allowed&&!props.snapshot?.worker_error&&quote.value&&time-quote.value.time<=5&&quote.value.time<=time+1;
});
const stateNames={pending:'Wird beim Worker installiert',sending:'Brokeränderung läuft – Ausgang wird abgeglichen',active:'Aktiv',paused:'Pausiert',unknown:'Ausgang ungeklärt – kein automatischer Retry',completed:'Plan beendet'};
let timer,disposed=false,generation=0;
const allocation=computed(()=>targetDraftAllocation(draft.value?.targets??[],position.value?.volume,quote.value?.volume_step));
const validation=computed(()=>{
 try{return {value:validateTargetAllocation(allocation.value.targets,position.value,quote.value,props.order.result.price,(props.order.result.initial_sl??props.order.intent.stop_loss)),error:null};}
 catch(e){return {value:null,error:e.message};}
});
const messages={invalid_target_precision:'Zielpreis passt nicht zur Broker-Preispräzision.',invalid_target_count:'Ein bis fünf Ziele angeben.',invalid_target_volume:'Aufteilung mit Broker-Mindestlot und Lot-Schritt nicht ausführbar.',invalid_remaining_volume:'Der Rest wäre kleiner als das Broker-Mindestlot.',target_volume_exceeds_position:'Zielmengen überschreiten das offene Volumen.',invalid_position_volume:'Broker-Volumen passt nicht zum Lot-Schritt.',invalid_target_price:'Ziele müssen in Gewinnrichtung noch vor uns liegen, mit Broker-Mindestabstand.',target_specs_unavailable:'Native Broker-Spezifikation fehlt; Worker aktualisieren.',invalid_target_basis:'Fester Fill und initialer SL müssen belegt sein.'};
const saveReason=computed(()=>{
 if(busy.value)return 'TP-Plan wird gespeichert.';
 if(!loaded.value)return 'Gespeicherter TP-Plan wird geladen.';
 if(uncertain.value||plan.value?.state==='unknown')return 'Speicherausgang ungeklärt. Status wird abgeglichen; kein erneuter Versand.';
 if(['pending','sending'].includes(plan.value?.state))return stateNames[plan.value.state];
 if(!position.value)return 'Keine passende offene Brokerposition.';
 if(!draft.value?.dirty)return 'Keine ungespeicherten Änderungen.';
 if(validation.value.error)return messages[validation.value.error]??validation.value.error;
 if(!ready.value)return 'Frischer Brokerstand oder TP-Handelsfreigabe fehlt.';
 return '';
});
const saveState=computed(()=>({disabled:!!saveReason.value,reason:saveReason.value,status:busy.value?'Wird gespeichert …':uncertain.value?'Ausgang ungeklärt':error.value?`Ungespeichert · Fehler: ${error.value}`:refreshError.value?`Statusfehler: ${refreshError.value}`:draft.value?.dirty?'Ungespeichert':receipt.value||stateNames[plan.value?.state]||(loaded.value?'Keine Änderungen':'Wird geladen'),dirty:!!draft.value?.dirty}));
function initTargets(targets){
 setTargetDraft(props.order.id,{symbol:chartInstrument(props.order.intent.symbol),entryTime:props.entryTime??position.value?.opened_at_sec??null,digits:quote.value?.digits,
  entryPrice:props.order.result.price,initialSl:(props.order.result.initial_sl??props.order.intent.stop_loss),direction:props.order.intent.direction,
  accountLabel:props.accountName||`Konto ${props.order.intent.account_login}`,positionId:props.order.result.position??props.order.result.order,positionVolume:position.value?.volume,
  targets,dirty:false,selectedIndex:null});
}
function update(index,key,value){
 const targets=draft.value.targets.map((t,i)=>i===index?{...t,[key]:value}:t);
 setTargetDraft(props.order.id,{...draft.value,targets,dirty:true});
}
function add(){
 if((draft.value?.targets.length??0)>=5)return;
 const previous=draft.value?.targets??[],last=previous.findLast(t=>Number(t.price)>0);
 const targets=[...previous,{price:last?.price??'',volume:''}];
 setTargetDraft(props.order.id,{...draft.value,targets,dirty:true});
 selectTargetDraft(props.order.id,targets.length-1);
}
function selectForDrag(index){selectTargetDraft(props.order.id,index);}
function remove(index){
 const selected=draft.value.selectedIndex;
 setTargetDraft(props.order.id,{...draft.value,targets:draft.value.targets.filter((_,i)=>i!==index),dirty:true,selectedIndex:selected===index?null:selected>index?selected-1:selected});
}
async function refresh(){
 if(disposed||busy.value||!props.online)return;
 const requested=generation;
 try{
  const value=await props.api('target_state',{order_id:props.order.id},{background:true});
  if(disposed||requested!==generation)return;plan.value=value.plan;loaded.value=true;refreshError.value='';
  if(uncertain.value&&value.plan?.revision===uncertain.value.revision){
   if(JSON.stringify(draft.value?.targets)===uncertain.value.key)initTargets(uncertain.value.targets);
   uncertain.value=null;error.value='';receipt.value='Gespeichert. Worker-/Brokerbestätigung steht noch aus.';
  }
  if(value.plan?.state!=='pending')receipt.value='';
  if(!position.value){removeTargetDraft(props.order.id);return;}
  if(!draft.value||!draft.value.dirty)initTargets(value.plan?.plan.targets.slice(value.plan.next_index)??(position.value?.tp?[{price:position.value.tp,volume:position.value.volume}]:[]));
 }catch(e){if(!disposed&&requested===generation)refreshError.value=e.message;}
}
async function save(){
 if(saveReason.value)return false;
 const requested=++generation,orderId=props.order.id;
 busy.value=true;error.value='';receipt.value='';
 const submitted=allocation.value.targets.map(t=>({...t})),submittedKey=JSON.stringify(draft.value.targets),revision=crypto.randomUUID();
 try{
  const value=await props.api('target_save',{order_id:orderId,revision,expected_revision:plan.value?.revision??null,
   targets:submitted,observed:{volume:position.value.volume,sl:position.value.sl,tp:position.value.tp}});
  if(disposed||requested!==generation||orderId!==props.order.id)return false;
  plan.value=value.plan;if(JSON.stringify(draft.value?.targets)===submittedKey)initTargets(submitted);receipt.value='Gespeichert. Worker-/Brokerbestätigung steht noch aus.';emit('saved');return true;
 }catch(e){
  if(disposed||requested!==generation||orderId!==props.order.id)return false;
  error.value=e.message;
  if(!targetSaveRejected(e))uncertain.value={revision,targets:submitted,key:submittedKey};
  return false;
 }finally{if(!disposed&&requested===generation)busy.value=false;}
}
function reset(){initTargets(plan.value?.plan.targets.slice(plan.value.next_index)??(position.value?.tp?[{price:position.value.tp,volume:position.value.volume}]:[]));error.value='';}
watch(()=>props.order.id,(id,previous,onCleanup)=>{
 generation++;loaded.value=false;busy.value=false;plan.value=null;error.value='';receipt.value='';uncertain.value=null;
 const unregister=registerTargetSave(id,()=>props.order.id===id?save():false,saveState);
 onCleanup(()=>{if(unregister())removeTargetDraft(id);});
 void refresh();
},{immediate:true});
watch(()=>position.value?.volume,volume=>{if(draft.value)setTargetDraft(props.order.id,{...draft.value,positionVolume:volume});});
timer=setInterval(()=>{now.value=Date.now();if(document.visibilityState==='visible')void refresh();},2000);
onUnmounted(()=>{disposed=true;generation++;clearInterval(timer);});
</script>
<template>
 <section class="mmt-target-editor" aria-label="TP-Verwaltung">
  <h3>TP verwalten · {{order.intent.symbol}}</h3>
  <p>Fill {{order.result.price}} · {{order.result.volume}} Lot fest · initialer SL {{order.result.initial_sl??order.intent.stop_loss}}</p>
  <p v-if="!position">Keine passende offene Brokerposition im aktuellen Stand.</p>
  <template v-else>
   <p>Offen {{position.volume}} Lot · Broker-SL {{position.sl}} · Broker-TP {{position.tp||'keiner'}}</p>
   <p v-if="plan">{{stateNames[plan.state]??plan.state}}<span v-if="plan.reason"> · {{plan.reason}}</span></p>
   <p v-if="plan?.state==='active'">{{plan.plan.native_tp?'Ein Ziel als nativer Broker-TP.':'Teilziele werden vom laufenden Worker überwacht; sie sind keine brokerseitig gesicherten TPs.'}}</p>
   <p v-if="!snapshot?.target_plans_ready">Worker unterstützt TP-Verwaltung noch nicht.</p>
   <div v-for="(target,index) in draft?.targets??[]" :key="index" class="mmt-target-row">
    <label>TP {{index+1}}<input :value="target.price" type="number" min="0" step="any" @input="update(index,'price',$event.target.value)"></label>
    <label>Lot<input :value="target.volume" type="number" min="0" :step="quote?.volume_step??'any'" @input="update(index,'volume',$event.target.value);update(index,'percent',null)"></label>
    <label>% offen<input :value="target.percent??''" type="number" min="0" max="100" step="any" @input="update(index,'percent',$event.target.value===''?null:Number($event.target.value))"></label>
    <button :aria-label="`TP ${index+1} entfernen`" @click="remove(index)">×</button>
    <button class="mmt-target-select" :aria-label="`TP ${index+1} im Chart ziehen`" :aria-pressed="draft.selectedIndex===index" :disabled="!Number(target.price)" @click="selectForDrag(index)">{{draft.selectedIndex===index?'Im Chart ausgewählt · Linie ziehen':'Im Chart ziehen'}}</button>
    <small>Ausführbar {{allocation.targets[index]?.volume??'—'}} Lot · RR {{validation.value?.targets.find(t=>t.price===Number(target.price))?.rr.toFixed(2)??'—'}}</small>
   </div>
   <ActionButton :disabled="busy||(draft?.targets.length??0)>=5" @click="add">+ Teilziel</ActionButton>
   <p>Rest {{allocation.remainder??'—'}} Lot · Mindestlot {{quote?.minimum_volume??'—'}} · Schritt {{quote?.volume_step??'—'}}. Prozentmengen werden abgerundet; der Rest bleibt sichtbar.</p>
   <p v-if="validation.error" role="status">{{messages[validation.error]??validation.error}}</p>
   <p v-if="draft?.dirty">Menge pro Teilziel frei angeben. Entwurf: Ziehen und Eingaben ändern noch keinen Broker-TP.</p>
   <ActionButton :disabled="!!saveReason" :title="saveReason||undefined" @click="save">TP-Plan verbindlich speichern</ActionButton>
   <ActionButton :disabled="busy" @click="reset">Entwurf verwerfen</ActionButton>
  </template>
  <p v-if="error||refreshError" role="alert">{{error||refreshError}}</p><p v-if="receipt" role="status">{{receipt}}</p>
 </section>
</template>
<style scoped>
.mmt-target-editor{border-top:1px solid #303746;padding-top:8px;font-size:11px}
.mmt-target-row{display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:5px;align-items:end;margin:6px 0}
label{display:flex;flex-direction:column;gap:3px;min-width:0}input{width:100%;min-width:0;background:#131722;color:#d1d4dc;border:1px solid #303746;border-radius:3px;padding:4px}
.mmt-target-select{grid-column:1/-1;text-align:left;font-size:11px}
small{grid-column:1/-1}button{cursor:pointer}
</style>
