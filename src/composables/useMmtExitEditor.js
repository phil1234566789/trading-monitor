import {computed,ref,watch,onUnmounted} from 'vue';
import {chartInstrument} from '../tradeIdeas.js';
import {findOrderPosition} from '../milkyMetaTraderMonitoring.js';
import {targetDraftAllocation,validateTargetAllocation} from '../../supabase/functions/trading-monitor-mcp/targetPlanContract.js';
import {validateStopAllocation,stopDraftAllocation} from '../../supabase/functions/trading-monitor-mcp/stopPlanContract.js';
import {setTargetDraft,removeTargetDraft,useTargetDraft,selectTargetDraft,addStopDraft,draftRiskBasis,targetDraftLines} from '../mmtTargetDrafts.js';
import {registerTargetSave,targetSaveRejected,nativeTargetKey} from '../mmtTargetSave.js';

const stateNames={pending:'Wird beim Worker installiert',sending:'Brokeränderung läuft – Ausgang wird abgeglichen',active:'Aktiv',paused:'Pausiert',unknown:'Ausgang ungeklärt – kein automatischer Retry',completed:'Plan beendet'};
const messages={invalid_target_precision:'TP-Preis passt nicht zur Broker-Preispräzision.',invalid_target_count:'Ein bis fünf TPs angeben.',invalid_target_volume:'TP-Aufteilung mit Broker-Mindestlot und Lot-Schritt nicht ausführbar.',invalid_remaining_volume:'Der Rest wäre kleiner als das Broker-Mindestlot.',target_volume_exceeds_position:'TP-Mengen überschreiten das offene Volumen.',invalid_position_volume:'Broker-Volumen passt nicht zum Lot-Schritt.',invalid_target_price:'TPs müssen in Gewinnrichtung noch vor uns liegen, mit Broker-Mindestabstand.',target_specs_unavailable:'Native Broker-Spezifikation fehlt; Worker aktualisieren.',invalid_target_basis:'Entry und Risikobasis müssen belegt sein.',invalid_position_stop:'Ungültiger SL im Brokerstand.',invalid_stop_count:'Ein bis fünf SLs angeben.',invalid_stop_volume:'SL-Aufteilung mit Broker-Mindestlot und Lot-Schritt nicht ausführbar.',invalid_stop_price:'SL muss hinter dem aktuellen Brokerkurs liegen, mit Broker-Mindestabstand.',invalid_stop_precision:'SL-Preis passt nicht zur Broker-Preispräzision.',stop_volume_must_cover_position:'SL-Anteile müssen zusammen die gesamte offene Position absichern.',invalid_stop_basis:'Frischer Brokerkurs für den SL fehlt.'};
const noChangesReason='Keine ungespeicherten Änderungen.';
const draftKey=d=>JSON.stringify({targets:d?.targets,stops:d?.stops,riskMode:d?.riskMode,stopsDirty:d?.stopsDirty});

export function useMmtExitEditor(props,emit){
 const plan=ref(null),busy=ref(false),error=ref(''),receipt=ref(''),loaded=ref(false),refreshError=ref(''),uncertain=ref(null),costs=ref(null),stopPreviews=ref({});
 let disposed=false,generation=0;
 const context=computed(()=>props.nativePosition?{
  key:nativeTargetKey(props.nativePosition.accountId,props.nativePosition.ticket),request:{position_ticket:props.nativePosition.ticket},
  symbol:props.nativePosition.symbol,direction:props.nativePosition.direction,entry:props.nativePosition.entryPrice,initialSl:null,
  login:props.nativePosition.login,ticket:props.nativePosition.ticket,filledVolume:null,
 }: {key:props.order.id,request:{order_id:props.order.id},symbol:props.order.intent.symbol,direction:props.order.intent.direction,
  entry:props.order.result.price,initialSl:props.order.result.initial_sl??props.order.intent.stop_loss,
  login:props.order.intent.account_login,ticket:props.order.result.position??props.order.result.order,filledVolume:props.order.result.volume});
 const position=computed(()=>props.nativePosition?(props.snapshot?.account_login===props.nativePosition.login&&props.snapshot?.account_server===props.nativePosition.server?props.snapshot?.positions?.find(p=>p.ticket===context.value.ticket&&p.symbol===context.value.symbol&&p.magic===props.nativePosition.magic&&p.type===props.nativePosition.type):undefined):findOrderPosition(props.order,props.snapshot));
 const quote=computed(()=>props.snapshot?.quotes?.find(q=>q.symbol===context.value.symbol));
 const draft=useTargetDraft(()=>context.value.key);
 // API und Worker prüfen Kursfrische beim Speichern/Anwenden; ein langsamer UI-Poll sperrt keinen Entwurf.
 const ready=computed(()=>Boolean(props.online&&props.snapshot?.target_plans_ready&&props.snapshot?.execution_ready&&props.snapshot?.trade_allowed&&!props.snapshot?.worker_error&&quote.value));
 const hasSavedStops=computed(()=>Boolean(plan.value?.plan.stops?.length));
 const withStops=computed(()=>Boolean(draft.value?.stopsDirty||hasSavedStops.value));
 const allocation=computed(()=>targetDraftAllocation(draft.value?.targets??[],position.value?.volume,quote.value?.volume_step));
 const stopAllocation=computed(()=>stopDraftAllocation(draft.value?.stops??[],position.value?.volume,quote.value,context.value.direction));
 const validation=computed(()=>{
  try{
   const basis=draft.value&&draftRiskBasis(draft.value);
   const targets=allocation.value.targets.length?validateTargetAllocation(allocation.value.targets,position.value,quote.value,context.value.entry,basis):withStops.value?{targets:[],remainder:position.value?.volume,native_tp:0}:validateTargetAllocation([],position.value,quote.value,context.value.entry,basis);
   return {value:{...targets,...(withStops.value?validateStopAllocation(stopAllocation.value.targets,position.value,quote.value,context.value.entry,basis):{})},error:null};
  }catch(e){return {value:null,error:e.message};}
 });
 const stopReason=computed(()=>!loaded.value?'SL-Berechnung wird geladen.':busy.value?'Plan wird gespeichert.':uncertain.value||plan.value?.state==='unknown'?'Ausgang ungeklärt; kein neuer Auftrag.':['pending','sending'].includes(plan.value?.state)?stateNames[plan.value.state]:!position.value?'Keine passende offene Brokerposition.':!props.snapshot?.exit_plans_ready?'SL-Verwaltung benötigt ein Worker-Update.':!ready.value?'Worker oder Handelsfreigabe fehlt.':'');
 const canAddStop=computed(()=>!stopReason.value);
 const saveReason=computed(()=>{
  if(busy.value)return 'Plan wird gespeichert.';
  if(!loaded.value)return 'Gespeicherter Plan wird geladen.';
  if(uncertain.value||plan.value?.state==='unknown')return 'Speicherausgang ungeklärt. Status wird abgeglichen; kein erneuter Versand.';
  if(['pending','sending'].includes(plan.value?.state))return stateNames[plan.value.state];
  if(!position.value)return 'Keine passende offene Brokerposition.';
  if(!ready.value)return 'Frischer Brokerstand oder TP-Handelsfreigabe fehlt.';
  if(hasSavedStops.value&&!draft.value.stopsDirty&&plan.value?.checkpoint?.sl!=null&&position.value.sl!==plan.value.checkpoint.sl)return 'Broker-SL wurde außerhalb dieses Plans geändert. SL-Plan ausdrücklich prüfen und anpassen.';
  if(withStops.value&&!props.snapshot?.exit_plans_ready)return 'SL-Verwaltung benötigt ein Worker-Update.';
  if(!withStops.value&&position.value.sl===0&&!props.snapshot?.target_without_sl_ready)return 'Position hat keinen SL. TP-Verwaltung benötigt ein Worker-Update; der SL bleibt unverändert.';
  if(!draft.value?.dirty)return noChangesReason;
  if(validation.value.error)return messages[validation.value.error]??validation.value.error;
  return '';
 });
 const cancelReason=computed(()=>busy.value?'Plan wird bereits gespeichert.':uncertain.value||plan.value?.state==='unknown'?'Speicherausgang ungeklärt; bereits gesendete Änderungen können nicht zurückgenommen werden.':['pending','sending'].includes(plan.value?.state)?'Gespeicherter Plan wird bereits vom Worker verarbeitet.':!loaded.value?'Gespeicherter Plan wird geladen.':!position.value?'Keine passende offene Brokerposition.':'');
 const saveState=computed(()=>({unchanged:saveReason.value===noChangesReason&&!cancelReason.value&&!error.value&&!refreshError.value&&(!plan.value||(['active','completed'].includes(plan.value.state)&&!plan.value.reason)),cancelDisabled:!!cancelReason.value,cancelReason:cancelReason.value,disabled:!!saveReason.value,reason:saveReason.value,status:busy.value?'Wird gespeichert …':uncertain.value?'Ausgang ungeklärt':error.value?`Ungespeichert · Fehler: ${error.value}`:refreshError.value?`Statusfehler: ${refreshError.value}`:draft.value?.dirty?'Ungespeichert':receipt.value||stateNames[plan.value?.state]||(loaded.value?'Keine Änderungen':'Wird geladen'),dirty:!!draft.value?.dirty}));
 const runtimeMetadata=()=>({symbol:chartInstrument(context.value.symbol),entryTime:props.entryTime??position.value?.opened_at_sec??null,digits:quote.value?.digits,
  entryPrice:context.value.entry,initialSl:context.value.initialSl,basisSl:plan.value?.plan.risk_basis_sl??context.value.initialSl,basisSource:plan.value?.plan.risk_basis_source??null,direction:context.value.direction,
  accountLabel:props.accountName||`Konto ${context.value.login}`,positionId:context.value.ticket,positionVolume:position.value?.volume,
  quote:quote.value,currency:props.snapshot?.currency,swap:position.value?.swap,costs:costs.value,stopPreviews:stopPreviews.value,canAddStop:canAddStop.value,stopReason:stopReason.value,needsStop:position.value?.sl===0,brokerStop:position.value?.sl});
 function savedLevels(kind){
  const levels=plan.value?.plan[kind==='stop'?'stops':'targets'];
  if(levels)return levels.slice(plan.value[kind==='stop'?'next_stop_index':'next_index']??0);
  const price=position.value?.[kind==='stop'?'sl':'tp'];return price?[{price,volume:position.value.volume}]:[];
 }
 function initTargets(targets,stops=savedLevels('stop')){
  setTargetDraft(context.value.key,{...runtimeMetadata(),targets,stops,riskMode:plan.value?.plan.risk_mode??props.order?.intent.risk_mode??'full',dirty:false,stopsDirty:false,selectedIndex:null,selectedKind:null});
 }
 function update(index,key,value,kind='target'){
  const list=kind==='stop'?'stops':'targets',levels=draft.value[list].map((t,i)=>i===index?{...t,[key]:value}:t);
  setTargetDraft(context.value.key,{...draft.value,[list]:levels,dirty:true,...(kind==='stop'?{stopsDirty:true}:{})});
 }
 function add(kind='target'){
  const list=kind==='stop'?'stops':'targets',previous=draft.value?.[list]??[];if(previous.length>=5)return;
  const last=previous.findLast(t=>Number(t.price)>0),levels=[...previous,{price:last?.price??'',volume:''}];
  setTargetDraft(context.value.key,{...draft.value,[list]:levels,dirty:true,...(kind==='stop'?{stopsDirty:true}:{})});selectTargetDraft(context.value.key,levels.length-1,kind);
 }
 function remove(index,kind='target'){
  const list=kind==='stop'?'stops':'targets',selected=draft.value.selectedKind===kind?draft.value.selectedIndex:null;
  setTargetDraft(context.value.key,{...draft.value,[list]:draft.value[list].filter((_,i)=>i!==index),dirty:true,...(kind==='stop'?{stopsDirty:true}:{}),...(selected===null?{}:{selectedIndex:selected===index?null:selected>index?selected-1:selected})});
 }
 function changeRiskMode(mode){setTargetDraft(context.value.key,{...draft.value,riskMode:mode,dirty:true,stopsDirty:true});}
 async function refresh(){
  if(disposed||busy.value||!props.online)return;
  const requested=generation;
  try{
   const value=await props.api('target_state',context.value.request,{background:true});
   if(disposed||requested!==generation)return;plan.value=value.plan;costs.value=value.costs??null;stopPreviews.value=value.stop_previews??{};loaded.value=true;refreshError.value='';
   if(uncertain.value&&value.plan?.revision===uncertain.value.revision){
    if(draftKey(draft.value)===uncertain.value.key)initTargets(uncertain.value.targets,uncertain.value.stops);
    uncertain.value=null;error.value='';receipt.value='Gespeichert. Worker-/Brokerbestätigung steht noch aus.';
   }
   if(value.plan?.state!=='pending')receipt.value='';
   if(!position.value){removeTargetDraft(context.value.key);return;}
   if(!draft.value||!draft.value.dirty)initTargets(savedLevels('target'));
  }catch(e){if(!disposed&&requested===generation)refreshError.value=e.message;}
 }
 async function save(){
  if(saveReason.value)return false;
  const requested=++generation,orderId=context.value.key,submitted=allocation.value.targets.map(t=>({...t})),submittedStops=stopAllocation.value.targets.map(t=>({...t})),submittedKey=draftKey(draft.value),revision=crypto.randomUUID();
  const stopFields=withStops.value?{stops:submittedStops,risk_mode:draft.value.riskMode,stops_changed:!!draft.value.stopsDirty}:{};
  busy.value=true;error.value='';receipt.value='';
  try{
   const value=await props.api('target_save',{...context.value.request,revision,expected_revision:plan.value?.revision??null,targets:submitted,...stopFields,observed:{volume:position.value.volume,sl:position.value.sl,tp:position.value.tp}});
   if(disposed||requested!==generation||orderId!==context.value.key)return false;
   plan.value=value.plan;if(draftKey(draft.value)===submittedKey)initTargets(submitted,submittedStops);receipt.value='Gespeichert. Worker-/Brokerbestätigung steht noch aus.';emit('saved');return true;
  }catch(e){
   if(disposed||requested!==generation||orderId!==context.value.key)return false;error.value=e.message;
   if(!targetSaveRejected(e))uncertain.value={revision,targets:submitted,stops:submittedStops,key:submittedKey};return false;
  }finally{if(!disposed&&requested===generation)busy.value=false;}
 }
 function reset(){if(cancelReason.value)return false;initTargets(savedLevels('target'));error.value='';refreshError.value='';receipt.value='';return true;}
 watch(()=>context.value.key,(id,previous,onCleanup)=>{
  generation++;loaded.value=false;busy.value=false;plan.value=null;error.value='';receipt.value='';uncertain.value=null;costs.value=null;stopPreviews.value={};
  const unregister=registerTargetSave(id,()=>context.value.key===id?save():false,saveState,()=>context.value.key===id?reset():false);
  onCleanup(()=>{if(unregister())removeTargetDraft(id);});void refresh();
 },{immediate:true});
 watch(runtimeMetadata,metadata=>{
  if(!draft.value)return;
  // Ein TP-Entwurf friert den echten Broker-SL nicht ein; absichtliche SL-Entwürfe bleiben erhalten.
  const changedOutside=hasSavedStops.value&&plan.value?.checkpoint?.sl!=null&&position.value?.sl!==plan.value.checkpoint.sl;
  const stops=!draft.value.stopsDirty?(changedOutside?(position.value?.sl?[{price:position.value.sl,volume:position.value.volume}]:[]):savedLevels('stop')):draft.value.stops;
  setTargetDraft(context.value.key,{...draft.value,...metadata,stops});
 },{deep:true});
 const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},2000);
 onUnmounted(()=>{disposed=true;generation++;clearInterval(timer);});
 const lines=computed(()=>targetDraftLines(chartInstrument(context.value.symbol)).filter(line=>line.orderId===context.value.key));
 const legs=computed(()=>[{kind:'target',label:'TP',levels:draft.value?.targets??[],allocation:allocation.value},{kind:'stop',label:'SL',levels:draft.value?.stops??[],allocation:stopAllocation.value}]);
 return {context,position,quote,draft,ready,allocation,stopAllocation,validation,saveReason,cancelReason,saveState,plan,busy,error,receipt,loaded,refreshError,uncertain,costs,stopPreviews,stopReason,canAddStop,legs,lines,stateNames,messages,
  initTargets,update,add,remove,refresh,save,reset,changeRiskMode,selectForDrag:(index,kind='target')=>selectTargetDraft(context.value.key,index,kind),addStop:mode=>addStopDraft(context.value.key,mode)};
}
