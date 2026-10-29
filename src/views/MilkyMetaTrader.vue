<script setup>
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useStatusBar } from '../composables/useStatusBar.js';
import { mmtPollDelay, mmtStaleSeconds, mmtConnectionStatus } from '../milkyMetaTraderPolling.js';
import { cssColor } from '../chartColors.js';
import { fmtPrice } from '../format.js';
import MilkyMetaTraderLivePosition from '../components/MilkyMetaTraderLivePosition.vue';
import { findOrderPosition, snapshotAgeSeconds } from '../milkyMetaTraderMonitoring.js';
import MilkyMetaTraderOrderCard from '../components/MilkyMetaTraderOrderCard.vue';
import '../milkyMetaTrader.css';
import ActionButton from '../components/ui/ActionButton.vue';
import MilkyMetaTraderEntrySearch from '../components/MilkyMetaTraderEntrySearch.vue';
import { createMilkyMetaTraderClient } from '../milkyMetaTraderClient.js';
import { readMilkyMetaTraderKey, saveMilkyMetaTraderKey, forgetMilkyMetaTraderKey } from '../milkyMetaTraderKey.js';

const token=ref(readMilkyMetaTraderKey()), unlocked=ref(false), accounts=ref([]), activeId=ref(null);
const status=ref(null), busy=ref(false), error=ref(''), message=ref('');
const form=ref({name:'',login:'',server:'BeyondIQCapital-Server',mode:'live',password:''});
let timer=null, nextPoll=0, statusRequest=null, viewEpoch=0;
const pollError=ref('');
const { setPageStatus, clearPageStatus }=useStatusBar();
const pollDelay=computed(()=>mmtPollDelay(status.value));
const staleSeconds=computed(()=>mmtStaleSeconds(pollDelay.value));
const now=ref(Date.now());
const dataAge=computed(()=>snapshot.value&&!snapshot.value.worker_error?snapshotAgeSeconds(status.value?.bridge?.heartbeat_at,now.value):null);
const unmatchedPositions=computed(()=>(snapshot.value?.positions??[]).filter(p=>!(status.value?.orders??[]).some(o=>findOrderPosition(o,snapshot.value)?.ticket===p.ticket)));
const workerProblem=computed(()=>status.value?.bridge?.snapshot?.worker_error??status.value?.health?.incident);
const deliveryLabels={pending:'wartet',claimed:'wird gesendet',accepted:'angenommen',failed:'fehlgeschlagen',uncertain:'Annahme unklar'};
const active=computed(()=>accounts.value.find(a=>a.id===activeId.value));
const api=(action,fields,options)=>createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,token.value)(action,fields,options);
const time=value=>value ? new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}) : '—';
const snapshot=computed(()=>{
  const value=status.value?.bridge?.snapshot;
  return value?.account_login===Number(active.value?.login)&&value?.account_server===active.value?.server?value:null;
});
const ready=computed(()=>status.value?.online&&!workerProblem.value&&snapshot.value?.execution_ready&&snapshot.value?.trade_allowed&&(active.value?.mode==='demo'||status.value?.server_live_allowed));
const workingOrders=computed(()=>(status.value?.orders??[]).filter(order=>['searching','sending','unknown'].includes(order.status)).length);

async function refresh() {
  const data=await api('accounts');
  accounts.value=data.accounts; activeId.value=data.active_account_id;
  // Ein bewusster Refresh muss auch nach einem bereits laufenden Poll einen neuen Stand lesen.
  if(statusRequest)await statusRequest.catch(()=>{});
  await refreshStatus();
}
function refreshStatus(options={}) {
  if(statusRequest)return statusRequest;
  const accountId=activeId.value, epoch=viewEpoch;
  if(!accountId){status.value=null;return Promise.resolve();}
  statusRequest=(async()=>{
    try {
      const value=await api('status',{},options);
      if(epoch===viewEpoch&&accountId===activeId.value){status.value=value;pollError.value='';}
    } finally {statusRequest=null;nextPoll=Date.now()+pollDelay.value;}
  })();
  return statusRequest;
}
async function poll() {
  if(!unlocked.value||busy.value||document.visibilityState!=='visible'||statusRequest)return;
  const epoch=viewEpoch;
  try {await refreshStatus({background:true});}
  catch(e){if(epoch===viewEpoch)pollError.value=e.message;}
}
function visibilityChanged() {
  now.value=Date.now();
  if(document.visibilityState==='visible'){nextPoll=0;void poll();}
}
watchEffect(()=>setPageStatus('/milky-meta-trader',{
  ...mmtConnectionStatus({unlocked:unlocked.value,active:active.value,status:status.value,snapshot:snapshot.value,age:dataAge.value,error:pollError.value,delay:pollDelay.value}),
  updatedAt:snapshot.value?status.value?.bridge?.heartbeat_at:null,
}));
async function run(action) {
  if(busy.value) return;
  busy.value=true; error.value=''; message.value='';
  try {await action();} catch(e) {error.value=e.message;} finally {busy.value=false;}
}
async function unlock() {
  await run(async()=>{
    await refresh(); unlocked.value=true;
    if(!saveMilkyMetaTraderKey(token.value)) message.value='Browser-Speicherung nicht verfügbar. Der Schlüssel gilt nur für diese Ansicht.';
    clearInterval(timer);
    nextPoll=Date.now()+pollDelay.value;
    timer=setInterval(()=>{now.value=Date.now();if(now.value>=nextPoll)void poll();},1000);
  });
}
function clearView() {
  viewEpoch++;clearInterval(timer); timer=null;pollError.value=''; token.value=''; unlocked.value=false;
  form.value.password=''; accounts.value=[]; status.value=null; activeId.value=null;
}
function lock() {
  if(!forgetMilkyMetaTraderKey()) {error.value='Der gespeicherte Schlüssel konnte nicht entfernt werden. Bitte die Website-Daten im Browser löschen.';return;}
  clearView();
}
onMounted(()=>{document.addEventListener('visibilitychange',visibilityChanged);if(token.value) unlock();});
onUnmounted(()=>{clearView();document.removeEventListener('visibilitychange',visibilityChanged);clearPageStatus('/milky-meta-trader');});
async function save() {
  const fields={...form.value,login:Number(form.value.login)};
  // Ein fehlgeschlagener Request darf das Passwort nicht in einer Fehlermeldung oder einem Store hinterlassen.
  form.value.password='';
  await run(async()=>{
    await api('save_account',fields); fields.password='';
    await refresh(); form.value.name='';form.value.login='';
    message.value='Konto verschlüsselt gespeichert. Noch nicht für den Test ausgewählt.';
  });
  fields.password='';
}
async function select(id) {
  await run(async()=>{await api('select_account',{id});await refresh();
    message.value=id ? 'Ein Testkonto ausgewählt. Python-Worker für dieses Konto starten bzw. neu starten.' : 'Kein Testkonto ausgewählt.';});
}
async function cancel(id) {await run(async()=>{await api('cancel',{id});await refresh();});}
</script>

<template>
  <main class="mmt-page" :style="{'--mmt-positive':cssColor('candleUp'),'--mmt-negative':cssColor('candleDown')}">
    <header class="mmt-heading"><div><h1>Milky Meta Trader <small>MMT</small></h1></div>
      <ActionButton v-if="unlocked" @click="lock">Sperren &amp; Schlüssel vergessen</ActionButton></header>
    <details class="mmt-notice"><summary>Testbetrieb · Mindestlot, max. 0,01 Lot · Strategie-/Challenge-Regeln folgen</summary><p>Kein pauschales Geldlimit. Slippage und Gebühren können den tatsächlichen Verlust erhöhen.</p></details>
    <p v-if="error" role="alert" class="mmt-error">{{error}}</p>
    <p v-if="pollError" role="alert" class="mmt-error">Statusabgleich fehlgeschlagen: {{pollError}}. Letzten Brokerstand und Verbindung prüfen.</p>
    <p v-if="message" role="status">{{message}}</p>
    <form v-if="!unlocked" class="mmt-panel" @submit.prevent="unlock">
      <h2>Privaten Bereich entsperren</h2>
      <label for="mmt-control-key">MMT-Zugriffsschlüssel</label>
      <input id="mmt-control-key" v-model="token" type="password" autocomplete="off" required>
      <p>Der Zugriffsschlüssel wird nach erfolgreichem Entsperren in diesem Browser gespeichert und beim nächsten Aufruf automatisch verwendet. Mit „Sperren & Schlüssel vergessen“ entfernst du ihn. Skripte dieser Website können auf den gespeicherten Schlüssel zugreifen. Brokerpasswörter werden serverseitig verschlüsselt und nie zurück angezeigt.</p>
      <ActionButton type="submit" :disabled="busy||!token">{{busy?'Verbinde …':'Entsperren'}}</ActionButton>
    </form>
    <template v-else>
      <section class="mmt-account-bar" aria-label="Aktives Testkonto">
        <div><h2>{{active?.name??'Kein Konto ausgewählt'}}</h2><span class="mmt-muted" v-if="active">{{active.login}} · {{active.server}} · {{active.mode==='demo'?'Demo':'Real / Challenge'}}</span></div>
        <span class="mmt-status" :data-ready="Boolean(ready)">{{ready?'Bereit für Entry-Suche':status?.online?'Ausführung nicht bereit':'Worker offline'}}</span>
      </section>
      <dl class="mmt-metrics" v-if="snapshot">
        <div><dt>Balance <small>{{snapshot.currency}}</small></dt><dd>{{fmtPrice(snapshot.balance,2)}}</dd></div>
        <div><dt>Equity <small>{{snapshot.currency}}</small></dt><dd>{{fmtPrice(snapshot.equity,2)}}</dd></div>
        <div><dt>Offene Positionen</dt><dd>{{snapshot.positions?.length??'—'}}</dd></div>
        <div><dt>Laufende Aufträge</dt><dd>{{workingOrders}}</dd></div>
      </dl>
        <p v-if="workerProblem" role="alert" class="mmt-error">Ausführung gestört: {{workerProblem.code}}<span v-if="workerProblem.stage"> in {{workerProblem.stage}}</span>. Entry-Aufträge und Brokerstatus prüfen; nichts blind erneut senden.</p>
        <p v-if="status?.health?.incident">Fehleralarm: <span v-for="item in status.health.deliveries" :key="item.channel">{{item.channel==='pushover'?'Pushover':'Telegram'}} {{deliveryLabels[item.status]??item.status}}. </span></p>
        <p v-if="status?.health&&!status.health.checked_at" role="alert">Unabhängige Alarmprüfung noch nicht bestätigt.</p>
        <p v-else-if="status?.health?.checked_at&&Date.now()-Date.parse(status.health.checked_at)>150000" role="alert" class="mmt-error">Unabhängige Alarmprüfung ist veraltet. Letzte Prüfung: {{time(status.health.checked_at)}} (Berlin).</p>
      <p v-if="dataAge==null||dataAge>staleSeconds" role="status" class="mmt-error">Brokerdaten {{dataAge==null?'noch nicht verfügbar':'seit '+dataAge+' Sekunden nicht aktualisiert'}}. Angezeigte Werte sind kein aktueller Stand.</p>
      <section v-if="unmatchedPositions.length" class="mmt-panel mmt-broker-positions"><h2>Weitere offene Brokerpositionen</h2>
        <div v-for="position in unmatchedPositions" :key="position.ticket"><h3>{{position.symbol}} · {{position.type===0?'Long':'Short'}}</h3><MilkyMetaTraderLivePosition :position="position" :currency="snapshot?.currency" :age="dataAge" :digits="snapshot?.quotes?.find(q=>q.symbol===position.symbol)?.digits" /></div>
      </section>
      <div class="mmt-workspace">
        <section class="mmt-panel mmt-orders" aria-labelledby="mmt-orders-title">
          <div class="mmt-section-heading"><div><h2 id="mmt-orders-title">Entry-Aufträge</h2></div><ActionButton :disabled="busy" @click="run(refresh)">{{busy?'Lädt …':'Aktualisieren'}}</ActionButton></div>
          <p class="mmt-muted">Abgleich: {{pollDelay===1000?'etwa jede Sekunde':'alle 8 Sekunden im Leerlauf'}}. In versteckten Tabs pausiert.</p>
          <div v-if="!status?.orders?.length" class="mmt-empty"><strong>Noch kein Entry-Auftrag</strong><p>Wähle Symbol, Richtung und SL/TP im Suchformular. Nach deiner Bestätigung wartet MMT auf die passende M1-Kerze.</p></div>
          <ul v-else class="mmt-order-list"><MilkyMetaTraderOrderCard v-for="order in status.orders" :key="order.id" :order="order" :busy="busy" :snapshot="snapshot" :age="dataAge" @cancel="cancel" /></ul>
        </section>
        <MilkyMetaTraderEntrySearch :api="api" :status="status" :account="active" @submitted="run(refresh)" />
      </div>
      <div class="mmt-settings"><h2>Konten &amp; Einstellungen</h2>
      <details class="mmt-panel"><summary>Brokerkonten verwalten <span class="mmt-muted">· {{accounts.length}} gespeichert</span></summary>
        <p>Genau ein Konto kann als Testkonto ausgewählt sein. Weitere gespeicherte Konten bleiben inaktiv. Keine automatische Vervielfachung von Orders.</p>
        <p v-if="!accounts.length">Noch keine Brokerkonten hinterlegt.</p>
        <ul class="mmt-accounts"><li v-for="account in accounts" :key="account.id">
          <div><strong>{{account.name}}</strong><br><small>{{account.login}} · {{account.server}} · MT5 {{account.mode==='demo'?'Demo':'Real'}}</small></div>
          <span v-if="account.id===activeId" class="mmt-selected">Ausgewähltes Testkonto</span>
          <ActionButton v-else :disabled="busy" @click="select(account.id)">Als Testkonto wählen</ActionButton>
        </li></ul>
        <ActionButton v-if="activeId" :disabled="busy" @click="select(null)">Testkonto abwählen</ActionButton>
      </details>
      <details class="mmt-panel" :open="!accounts.length"><summary>Konto mit Zugangsdaten hinzufügen</summary>
        <form class="mmt-form" @submit.prevent="save">
          <label>Name<input v-model="form.name" required maxlength="100" placeholder="Challenge 1"></label>
          <label>Numerische MT5-Login-ID<input v-model="form.login" type="number" min="1" step="1" required></label>
          <label>Server<input v-model="form.server" required maxlength="100" autocomplete="off"></label>
          <label>MT5-Kontotyp<select v-model="form.mode"><option value="live">Real / Challenge</option><option value="demo">Demo</option></select></label>
          <label class="mmt-wide">Trading-Passwort<input v-model="form.password" type="password" required maxlength="200" autocomplete="new-password"></label>
          <p class="mmt-wide">Die Account-Bezeichnung im IQCapital-Dashboard ersetzt die numerische MT5-Login-ID nicht. Benötigt wird das Trading-Passwort, kein Investor-Passwort.</p>
          <ActionButton type="submit" :disabled="busy">Verschlüsselt speichern</ActionButton>
        </form>
      </details>
      <details class="mmt-panel"><summary>Verbindung &amp; Diagnose</summary>
        <p v-if="!active">Zuerst ein Testkonto auswählen.</p>
        <template v-else><p><strong>{{active.name}}</strong> · {{status?.online?(workerProblem?'Worker gestört':'Worker erreichbar'):'Worker offline / noch nicht gestartet'}}</p>
          <p v-if="status?.bridge">Letzter Kontakt: {{time(status.bridge.heartbeat_at)}} (Berlin)<br>
            Balance {{status.bridge.snapshot.balance}} · Equity {{status.bridge.snapshot.equity}} {{status.bridge.snapshot.currency}}<br>
            {{status.bridge.snapshot.positions.length}} offene Positionen · Handel {{status.bridge.snapshot.trade_allowed?'freigegeben':'gesperrt'}}</p>
        </template>
        <ActionButton :disabled="busy" @click="run(refresh)">Aktualisieren</ActionButton>
      </details>
      </div>
    </template>
  </main>
</template>
