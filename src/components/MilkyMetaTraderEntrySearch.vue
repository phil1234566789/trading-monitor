<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import ActionButton from './ui/ActionButton.vue';
import {riskPreviewMetrics} from '../../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import { useRoute } from 'vue-router';
const props=defineProps({api:{type:Function,required:true},status:Object,account:Object,compact:Boolean,chartSymbol:String,idea:Object,disabled:Boolean});
const emit=defineEmits(['submitted']);
const route=useRoute();
const symbol=ref(''),direction=ref('short'),sl=ref(''),tp=ref('');
// Auch ein neuer Link ohne TP muss einen zuvor gesetzten Zielpreis entfernen.
watch(()=>route.query,query=>{
  if(props.compact)return;
  symbol.value=typeof query.symbol==='string'?query.symbol:'';
  direction.value=query.direction==='long'?'long':'short';
  sl.value=typeof query.sl==='string'?query.sl:'';
  tp.value=typeof query.tp==='string'?query.tp:'';
},{immediate:true,deep:true});
watch(()=>[props.compact,props.chartSymbol,props.idea],()=>{
 if(!props.compact)return;
 symbol.value=props.chartSymbol??'';direction.value=props.idea?.direction??'short';
 sl.value=props.idea?.sl??'';tp.value=props.idea?.tp??'';
},{immediate:true,deep:true});
const riskMode=ref(props.compact?'risky':'');
const durationMinutes=ref(props.compact?30:10);
const preview=ref(null),confirmation=ref(''),busy=ref(false),error=ref(''),receipt=ref('');
const inputKey=computed(()=>JSON.stringify([symbol.value,direction.value,sl.value,tp.value,durationMinutes.value,riskMode.value,props.account?.id,props.disabled,props.status?.risk_policy?.revision]));
const pendingKey='mmt-pending-confirmation';
let pending;
try {pending=JSON.parse(sessionStorage.getItem(pendingKey)??'null');} catch {}
const pendingId=ref(pending?.id??null);
const now=ref(Date.now());
function clearPending() {sessionStorage.removeItem(pendingKey);pendingId.value=null;}
async function reconcile() {
  if(!pendingId.value||busy.value)return;
  busy.value=true;error.value='';
  try {
    const order=await props.api('status',{id:pendingId.value});
    if(!order) {error.value='Noch keine sichere Rückmeldung. Kein neuer Auftrag wird gesendet. Bitte den Status erneut prüfen.';return;}
    receipt.value='Auftrag '+order.id+': '+order.status;
    clearPending();emit('submitted');
  } catch(e) {error.value=e.message;} finally {busy.value=false;}
}
const timer=setInterval(()=>{now.value=Date.now();},250);
onUnmounted(()=>clearInterval(timer));
const quotes=computed(()=>props.status?.bridge?.snapshot?.quotes??[]);
const liveMetrics=computed(()=>{
 try{
  if(!props.status?.online)throw new Error('quote_stale');
  const snapshot=props.status?.bridge?.snapshot??{};
  if(props.account?.login!=null&&(snapshot.account_login!==Number(props.account.login)||snapshot.account_server!==props.account.server))throw new Error('risk_exposure_unavailable');
  const value=riskPreviewMetrics({symbol:symbol.value,direction:direction.value,stop_loss:Number(sl.value),take_profit:tp.value===''?null:Number(tp.value),...(riskMode.value?{risk_mode:riskMode.value}:{})},props.status?.bridge?.snapshot??{},props.status?.risk_policy,now.value/1000);
  return {value:{...value,price:value.reference_price}};
 }catch(e){return {value:null,reason:e.message};}
});
const metrics=computed(()=>liveMetrics.value.value);
const riskReasons={risk_limits_unconfirmed:'Heutige Risikobasis und Kontogrenzen zuerst unter MMT bestätigen.',risk_guard_unavailable:'Frische Tagesstopp-/Risikoprüfung des Workers fehlt oder ist gesperrt.',risk_floor_reconfirmation_required:'Neuer Kontohöchststand: aktuelle Drawdown-Grenze erneut unter MMT bestätigen.',risk_exposure_unavailable:'Offene Risiken oder Brokeraufträge noch nicht vollständig geklärt.',risk_budget_exhausted:'Kein freies Markt-/Tages-/Drawdownbudget.',risk_sizing_unavailable:'Native Broker-Lotspezifikation fehlt.',quote_stale:'Frischer Brokerkurs oder native Spezifikation fehlt.',invalid_stop_or_target:'SL oder Ziel passt nicht zum aktuellen Brokerkurs.',minimum_volume_exceeds_budget:'Das Restbudget reicht nicht für das Broker-Mindestlot.'};
const ready=computed(()=>props.status?.online&&quotes.value.length>0);
const executionReady=computed(()=>props.status?.bridge?.snapshot?.execution_ready&&props.status?.bridge?.snapshot?.trade_allowed);
const expired=computed(()=>!preview.value||now.value>=preview.value.confirmation_expires_sec*1000);
const liveEnabled=computed(()=>props.account?.mode==='demo'||props.status?.server_live_allowed);
watch([symbol,direction,sl,tp,durationMinutes,riskMode,()=>props.status?.risk_policy?.revision,()=>props.account?.id,()=>props.disabled],()=>{preview.value=null;confirmation.value='';receipt.value='';});
watch(quotes,list=>{if(!symbol.value&&list.length===1) symbol.value=list[0].symbol;});
async function showPreview() {
  if(busy.value||pendingId.value||props.disabled||!metrics.value)return;
  busy.value=true;error.value='';preview.value=null;confirmation.value='';receipt.value='';
  const requested=inputKey.value;
  try {
    const data=await props.api('search_preview',{order:{symbol:symbol.value,direction:direction.value,...(riskMode.value?{risk_mode:riskMode.value}:{}),
      stop_loss:Number(sl.value),take_profit:tp.value===''?null:Number(tp.value),duration_sec:Number(durationMinutes.value)*60}});
    if(requested!==inputKey.value)return;
    preview.value=data.preview;confirmation.value=data.confirmation;now.value=Date.now();
  } catch(e) {error.value=e.message;} finally {busy.value=false;}
}
async function confirm() {
  if(props.disabled||!metrics.value||busy.value||expired.value||!ready.value||!liveEnabled.value||!executionReady.value)return;
  busy.value=true;error.value='';
  const token=confirmation.value;
  try {
    sessionStorage.setItem(pendingKey,JSON.stringify({id:preview.value.intent.id}));
    pendingId.value=preview.value.intent.id;
  } catch {error.value='Sitzungsspeicher nicht verfügbar. Aus Sicherheitsgründen wurde nichts gesendet.';busy.value=false;return;}
  try {
    const data=await props.api('search_confirm',{confirmation:token});
    receipt.value='Auftrag angenommen: '+data.order.id+'. Der Brokerstatus erscheint bei den Entry-Aufträgen.';
    clearPending();confirmation.value='';preview.value=null;emit('submitted');
  } catch(e) {
    if(e.definitiveRejection) {clearPending();error.value=e.message;}
    else error.value='Rückmeldung unklar. Bitte den Auftragstatus prüfen; keinen neuen Auftrag anlegen.';
    preview.value=null;
  } finally {busy.value=false;}
}
</script>

<template>
  <section class="mmt-panel mmt-ticket" aria-labelledby="mmt-entry-search-title">
    <h2 id="mmt-entry-search-title">Entry suchen</h2>
    <details v-if="!compact" class="mmt-help"><summary>M1-Entry-Regel</summary><p>Short nach einer neu geschlossenen roten M1-Kerze, Long nach einer grünen. Dojis zählen nicht. Nur das ausgewählte Konto. Pilot nutzt Mindestlot; Risky/Full teilen sich das Marktbudget.</p></details>
    <p v-if="!ready">Der lokale MT5-Worker muss verbunden sein, bevor ein aktueller Brokerkurs und eine Vorschau verfügbar sind.</p>
    <p v-if="status?.online&&!status?.bridge?.snapshot?.trade_allowed">MT5 meldet Handel gesperrt. Bitte in MT5 Algo Trading einschalten.</p>
    <p v-if="status?.online&&!status?.bridge?.snapshot?.execution_ready">Worker im Lesebetrieb: Vorschau verfügbar, Orderversand gesperrt.</p>
    <p v-if="!liveEnabled">Live-Ausführung ist serverseitig noch gesperrt.</p>
    <p v-if="error" role="alert">{{error}}</p>
    <p v-if="receipt" role="status">{{receipt}}</p>
    <div v-if="pendingId"><p>Rückmeldung für Auftrag {{pendingId}} wird abgeglichen.</p><ActionButton :disabled="busy" @click="reconcile">Auftragstatus prüfen</ActionButton></div>
    <div v-if="compact" class="mmt-idea-summary">
      <strong>{{idea?(direction==='long'?'Long':'Short'):'Keine eindeutige Idee'}} · SL {{idea?.sl??'—'}}</strong>
      <p>RR {{metrics?.rr?.toFixed(2)??'—'}} · {{metrics?.volume??'—'}} Lot {{riskMode?'dynamisch':'(Pilot)'}}<br>Risiko bis SL {{metrics?.risk?.toFixed(2)??'—'}} {{status?.bridge?.snapshot?.currency}}</p>
      <small>Brokerkurs {{metrics?.price??'—'}} · native Brokerberechnung. {{riskMode?'Lotgröße wird vor dem Fill erneut geprüft.':'Pilot: Mindestlot, maximal 0,01.'}}</small>
    </div>
    <p v-if="liveMetrics.reason" role="status">{{riskReasons[liveMetrics.reason]??'Risikoberechnung noch nicht verfügbar.'}}</p>
    <p v-if="metrics?.budget">Markt frei {{metrics.budget.market_left.toFixed(2)}} · Tagesrest {{metrics.budget.daily_left.toFixed(2)}} · Drawdownrest {{metrics.budget.drawdown_left.toFixed(2)}} {{metrics.currency}}. Puffer {{metrics.budget.cost_buffer.toFixed(2)}}.</p>
    <form class="mmt-form" @submit.prevent="showPreview">
      <label v-if="!compact" class="mmt-wide">Broker-Symbol<select v-model="symbol" required :disabled="busy"><option value="" disabled>Symbol wählen</option><option v-for="q in quotes" :key="q.symbol" :value="q.symbol">{{q.symbol}}</option></select></label>
      <fieldset v-if="!compact" class="mmt-direction"><legend>Richtung</legend><label><input v-model="direction" type="radio" value="long" :disabled="busy"><span>Long</span></label><label><input v-model="direction" type="radio" value="short" :disabled="busy"><span>Short</span></label></fieldset>
      <label v-if="!compact">Stop-Loss<input v-model="sl" type="number" min="0" step="any" required :disabled="busy"></label>
      <label v-if="!compact">Take-Profit (optional)<input v-model="tp" type="number" min="0" step="any" placeholder="Kein TP" :disabled="busy"></label>
      <label class="mmt-wide">Risiko<select v-model="riskMode" :disabled="busy"><option value="">Pilot · Mindestlot ≤ 0,01</option><option value="risky">Risky · 0,5 %</option><option value="full">Full · 0,9 %</option></select></label>
      <label class="mmt-wide">Suche gültig für (Minuten)<input v-model="durationMinutes" type="number" min="1" max="60" step="1" required :disabled="busy"></label>
      <ActionButton class="mmt-primary mmt-wide" type="submit" :disabled="disabled||busy||pendingId||!ready||!account||!symbol||(compact&&!idea)||!metrics">{{busy?'Wird vorbereitet …':compact?'Entry suchen':'Suchauftrag vorbereiten'}}</ActionButton>
    </form>
    <div v-if="preview" class="mmt-preview" role="region" aria-label="Suchauftrag zur Bestätigung">
      <p><strong>{{preview.account_name}} · {{preview.intent.symbol}} · {{preview.intent.direction==='short'?'Short':'Long'}}</strong><br>
        {{preview.volume}} Lot · Kurs bei Vorbereitung circa {{preview.reference_price}}<br>
        SL {{preview.intent.stop_loss}} · TP {{preview.intent.take_profit??'Kein TP'}}<br>
        Verlust bis SL beim aktuellen Kurs circa {{preview.risk.toFixed(2)}} {{preview.currency}} vor Gebühren und Slippage.</p>
      <p>Nach deiner einmaligen Bestätigung wartet der Worker selbstständig auf die passende M1-Kerze und sendet dann zum aktuellen Brokerkurs. Kein weiterer Klick und keine Bindung an den Vorbereitungskurs. Konto, SL/TP, Broker-Lotschritt und verfügbares Risikobudget werden beim Entry erneut geprüft.</p>
      <p v-if="preview.budget">Freigegeben bis {{preview.budget.allocation.toFixed(2)}} {{preview.currency}} einschließlich {{preview.budget.cost_buffer.toFixed(2)}} Kosten-/Slippagepuffer. Alle offenen Risiken zählen mit; die endgültige Lotgröße bleibt bis zum Fill dynamisch.</p>
      <p>Suchende bis {{new Date(preview.intent.expires_sec*1000).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}} (Berlin). Nach einem ausgeführten Trade ist dieser Auftrag beendet.</p>
      <p v-if="expired">Bestätigungsansicht abgelaufen. Bitte den Suchauftrag erneut vorbereiten.</p>
      <ActionButton class="mmt-primary" :disabled="disabled||!metrics||busy||expired||!confirmation||!ready||!liveEnabled||!executionReady" @click="confirm">Entry-Suche verbindlich starten</ActionButton>
    </div>
  </section>
</template>
