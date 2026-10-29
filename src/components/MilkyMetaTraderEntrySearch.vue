<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import ActionButton from './ui/ActionButton.vue';
import { useRoute } from 'vue-router';
const props=defineProps({api:{type:Function,required:true},status:Object,account:Object});
const emit=defineEmits(['submitted']);
const route=useRoute();
const symbol=ref(typeof route.query.symbol==='string'?route.query.symbol:''),
  direction=ref(route.query.direction==='long'?'long':'short'),
  sl=ref(typeof route.query.sl==='string'?route.query.sl:''),tp=ref(typeof route.query.tp==='string'?route.query.tp:'');
const durationMinutes=ref(10);
const preview=ref(null),confirmation=ref(''),busy=ref(false),error=ref(''),receipt=ref('');
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
const ready=computed(()=>props.status?.online&&quotes.value.length>0);
const executionReady=computed(()=>props.status?.bridge?.snapshot?.execution_ready&&props.status?.bridge?.snapshot?.trade_allowed);
const expired=computed(()=>!preview.value||now.value>=preview.value.confirmation_expires_sec*1000);
const liveEnabled=computed(()=>props.account?.mode==='demo'||props.status?.server_live_allowed);
watch([symbol,direction,sl,tp,durationMinutes,()=>props.account?.id],()=>{preview.value=null;confirmation.value='';receipt.value='';});
watch(quotes,list=>{if(!symbol.value&&list.length===1) symbol.value=list[0].symbol;});
async function showPreview() {
  if(busy.value||pendingId.value)return;
  busy.value=true;error.value='';preview.value=null;confirmation.value='';receipt.value='';
  try {
    const data=await props.api('search_preview',{order:{symbol:symbol.value,direction:direction.value,
      stop_loss:Number(sl.value),take_profit:Number(tp.value),duration_sec:Number(durationMinutes.value)*60}});
    preview.value=data.preview;confirmation.value=data.confirmation;now.value=Date.now();
  } catch(e) {error.value=e.message;} finally {busy.value=false;}
}
async function confirm() {
  if(busy.value||expired.value||!ready.value||!liveEnabled.value||!executionReady.value)return;
  busy.value=true;error.value='';
  const token=confirmation.value;
  try {
    sessionStorage.setItem(pendingKey,JSON.stringify({id:preview.value.intent.id}));
    pendingId.value=preview.value.intent.id;
  } catch {error.value='Sitzungsspeicher nicht verfügbar. Aus Sicherheitsgründen wurde nichts gesendet.';busy.value=false;return;}
  try {
    const data=await props.api('search_confirm',{confirmation:token});
    receipt.value='Auftrag angenommen: '+data.order.id+'. Der Brokerstatus erscheint unten bei den Aufträgen.';
    clearPending();confirmation.value='';preview.value=null;emit('submitted');
  } catch(e) {
    if(e.definitiveRejection) {clearPending();error.value=e.message;}
    else error.value='Rückmeldung unklar. Bitte den Auftragstatus prüfen; keinen neuen Auftrag anlegen.';
    preview.value=null;
  } finally {busy.value=false;}
}
</script>

<template>
  <section class="mmt-panel" aria-labelledby="mmt-entry-search-title">
    <h2 id="mmt-entry-search-title">Asynchronen Entry suchen</h2>
    <p>Testregel: Short nach einer neu geschlossenen roten M1-Kerze, Long nach einer grünen. Dojis zählen nicht. Nur das ausgewählte Konto, kleinste Broker-Lotgröße.</p>
    <p v-if="!ready">Der lokale MT5-Worker muss verbunden sein, bevor ein aktueller Brokerkurs und eine Vorschau verfügbar sind.</p>
    <p v-if="status?.online&&!status?.bridge?.snapshot?.trade_allowed">MT5 meldet Handel gesperrt. Bitte in MT5 Algo Trading einschalten.</p>
    <p v-if="status?.online&&!status?.bridge?.snapshot?.execution_ready">Worker im Lesebetrieb: Vorschau verfügbar, Orderversand gesperrt.</p>
    <p v-if="!liveEnabled">Live-Ausführung ist serverseitig noch gesperrt.</p>
    <p v-if="error" role="alert">{{error}}</p>
    <p v-if="receipt" role="status">{{receipt}}</p>
    <div v-if="pendingId"><p>Rückmeldung für Auftrag {{pendingId}} wird abgeglichen.</p><ActionButton :disabled="busy" @click="reconcile">Auftragstatus prüfen</ActionButton></div>
    <form class="mmt-form" @submit.prevent="showPreview">
      <label>Broker-Symbol<select v-model="symbol" required :disabled="busy"><option value="" disabled>Symbol wählen</option><option v-for="q in quotes" :key="q.symbol" :value="q.symbol">{{q.symbol}}</option></select></label>
      <label>Richtung<select v-model="direction" :disabled="busy"><option value="short">Short</option><option value="long">Long</option></select></label>
      <label>Stop-Loss<input v-model="sl" type="number" min="0" step="any" required :disabled="busy"></label>
      <label>Take-Profit<input v-model="tp" type="number" min="0" step="any" required :disabled="busy"></label>
      <label>Suche gültig für (Minuten)<input v-model="durationMinutes" type="number" min="1" max="60" step="1" required :disabled="busy"></label>
      <ActionButton type="submit" :disabled="busy||pendingId||!ready||!account">Suchauftrag vorbereiten</ActionButton>
    </form>
    <div v-if="preview" role="region" aria-label="Suchauftrag zur Bestätigung">
      <p><strong>{{preview.account_name}} · {{preview.intent.symbol}} · {{preview.intent.direction==='short'?'Short':'Long'}}</strong><br>
        {{preview.volume}} Lot · Kurs bei Vorbereitung circa {{preview.reference_price}}<br>
        SL {{preview.intent.stop_loss}} · TP {{preview.intent.take_profit}}<br>
        Verlust bis SL beim aktuellen Kurs circa {{preview.risk.toFixed(2)}} {{preview.currency}} vor Gebühren und Slippage.</p>
      <p>Nach deiner einmaligen Bestätigung wartet der Worker selbstständig auf die passende M1-Kerze und sendet dann zum aktuellen Brokerkurs. Kein weiterer Klick und keine Bindung an den Vorbereitungskurs. Konto, SL/TP und Risikobudget werden beim Entry erneut geprüft.</p>
      <p>Suchende bis {{new Date(preview.intent.expires_sec*1000).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}} (Berlin). Nach einem ausgeführten Trade ist dieser Auftrag beendet.</p>
      <p v-if="expired">Bestätigungsansicht abgelaufen. Bitte den Suchauftrag erneut vorbereiten.</p>
      <ActionButton :disabled="busy||expired||!confirmation||!ready||!liveEnabled||!executionReady" @click="confirm">Entry-Suche verbindlich starten</ActionButton>
    </div>
  </section>
</template>
