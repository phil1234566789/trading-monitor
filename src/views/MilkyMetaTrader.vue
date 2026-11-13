<script setup>
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useStatusBar } from '../composables/useStatusBar.js';
import { mmtStaleSeconds, mmtConnectionStatus, mmtAccountSnapshot } from '../milkyMetaTraderPolling.js';
import { positionCommissions } from '../milkyMetaTraderStatistics.js';
import { cssColor } from '../chartColors.js';
import MilkyMetaTraderStatistics from '../components/MilkyMetaTraderStatistics.vue';
import MilkyMetaTraderBalances from '../components/MilkyMetaTraderBalances.vue';
import MmtOpenBrokerPositions from '../components/MmtOpenBrokerPositions.vue';
import {collectMmtBrokerPositions} from '../mmtBrokerPositions.js';
import { snapshotAgeSeconds, executionPositionId } from '../milkyMetaTraderMonitoring.js';
import MilkyMetaTraderOrderCard from '../components/MilkyMetaTraderOrderCard.vue';
import '../milkyMetaTrader.css';
import ActionButton from '../components/ui/ActionButton.vue';
import {useMmtUiData} from '../composables/useMmtUiData.js';
import MmtRiskPolicyEditor from '../components/MmtRiskPolicyEditor.vue';
import MilkyMetaTraderEntrySearch from '../components/MilkyMetaTraderEntrySearch.vue';
import { createMilkyMetaTraderClient } from '../milkyMetaTraderClient.js';
import { readMilkyMetaTraderKey, saveMilkyMetaTraderKey, forgetMilkyMetaTraderKey } from '../milkyMetaTraderKey.js';
import {accountAvailability,accountArchiveLabel} from '../milkyMetaTraderAccountSelection.js';

const brokerHistory=ref({rows:[],sync:[]});
const statisticsAccount=ref('');
const commissions=computed(()=>brokerHistory.value.position_commissions
 ?new Map(brokerHistory.value.position_commissions.map(row=>[`${row.account_id}:${row.position_id}`,row.commission]))
 :positionCommissions(brokerHistory.value.rows??[]));
const commissionFor=(accountId,positionId)=>commissions.value.get(`${accountId}:${positionId}`)??null;
const historyTime=accountId=>brokerHistory.value.sync.find(s=>s.account_id===accountId)?.synced_at;
const accountForOrder=order=>accounts.value.find(a=>Number(a.login)===order.intent.account_login&&a.server===order.intent.account_server)?.id;
const orderCommission=order=>commissionFor(accountForOrder(order),executionPositionId(order));
const commissionPositions=computed(()=>[...new Map([
 ...allPositions.value.map(row=>({account_id:row.account.id,position_id:row.position.position_id??row.position.identifier??row.position.ticket})),
 ...(status.value?.orders??[]).map(order=>({account_id:accountForOrder(order),position_id:executionPositionId(order)})),
].filter(row=>row.account_id&&Number.isSafeInteger(row.position_id)&&row.position_id>0).map(row=>[`${row.account_id}:${row.position_id}`,row])).values()].slice(0,100));
const token=ref(readMilkyMetaTraderKey()),unlocked=ref(false);
const api=(action,fields,options)=>createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,token.value)(action,fields,options);
const data=useMmtUiData({api,credential:()=>token.value,enabled:()=>unlocked.value,balances:true,health:true});
const {accounts,activeId,status,accountStatuses,now,error:pollError,refresh}=data;
const accountGroups=computed(()=>{
 const {active,inactive}=accountAvailability(accounts.value);
 return [{inactive:false,label:'Aktive Konten',accounts:active},{inactive:true,label:'Inaktive Konten',accounts:inactive}];
});
const busy=ref(false),error=ref(''),message=ref('');
const form=ref({name:'',login:'',server:'BeyondIQCapital-Server',mode:'live',password:''});
const { setPageStatus, clearPageStatus }=useStatusBar();
const pollDelay=computed(()=>8000);
const staleSeconds=computed(()=>mmtStaleSeconds(pollDelay.value));
const dataAge=computed(()=>snapshot.value&&!snapshot.value.worker_error?snapshotAgeSeconds(status.value?.bridge?.heartbeat_at,now.value):null);
const statusesByAccount=accountStatuses;
const allPositions=computed(()=>collectMmtBrokerPositions(accounts.value,statusesByAccount.value,now.value).map(row=>({...row,commission:commissionFor(row.account.id,row.position.position_id??row.position.identifier??row.position.ticket),commissionAt:historyTime(row.account.id)})));
const positionIssues=computed(()=>accountAvailability(accounts.value).active.flatMap(account=>{
 const state=statusesByAccount.value[account.id];
 const message=state?.status_error||state?.bridge?.snapshot?.worker_error?.code;
 return message?[{account,message}]:[];
}));
const orderStatus=order=>statusesByAccount.value[accountForOrder(order)];
const orderSnapshot=order=>mmtAccountSnapshot(accounts.value.find(account=>account.id===accountForOrder(order)),orderStatus(order)?.bridge);
const orderAge=order=>snapshotAgeSeconds(orderStatus(order)?.bridge?.heartbeat_at,now.value);
const workerProblem=computed(()=>status.value?.bridge?.snapshot?.worker_error??status.value?.health?.incident);
const deliveryLabels={pending:'wartet',claimed:'wird gesendet',accepted:'angenommen',failed:'fehlgeschlagen',uncertain:'Annahme unklar'};
const active=computed(()=>accounts.value.find(a=>a.id===activeId.value));
const time=value=>value ? new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}) : '—';
const snapshot=computed(()=>mmtAccountSnapshot(active.value,status.value?.bridge));
const currentOrders=computed(()=>(status.value?.orders??[]).filter(order=>['searching','sending','unknown'].includes(order.status)||(order.status==='executed'&&order.result?.position_lifecycle?.state!=='closed')));
const previousOrders=computed(()=>(status.value?.orders??[]).filter(order=>!currentOrders.value.includes(order)));

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
  unlocked.value=true;await refresh();
  if(pollError.value){unlocked.value=false;throw new Error(pollError.value);}
  if(!saveMilkyMetaTraderKey(token.value))message.value='Browser-Speicherung nicht verfügbar. Der Schlüssel gilt nur für diese Ansicht.';
 });
}
function clearView() {
  token.value='';unlocked.value=false;data.clear();
  brokerHistory.value={rows:[],sync:[]};statisticsAccount.value='';form.value.password='';
}
function lock() {
  if(!forgetMilkyMetaTraderKey()) {error.value='Der gespeicherte Schlüssel konnte nicht entfernt werden. Bitte die Website-Daten im Browser löschen.';return;}
  clearView();
}
onMounted(()=>{if(token.value)unlock();});
onUnmounted(()=>{clearView();clearPageStatus('/milky-meta-trader');});
async function save() {
  const fields={...form.value,login:Number(form.value.login)};
  // Ein fehlgeschlagener Request darf das Passwort nicht in einer Fehlermeldung oder einem Store hinterlassen.
  form.value.password='';
  await run(async()=>{
    await api('save_account',fields); fields.password='';
    await refresh({sections:['catalog']}); form.value.name='';form.value.login='';
    message.value='Konto verschlüsselt gespeichert. Noch nicht als Handelskonto ausgewählt.';
  });
  fields.password='';
}
async function assignRole(id,role) {await run(async()=>{await api('assign_account_role',{id,role:role||null});await refresh({sections:['catalog']});});}
async function selectTradingAccount(id) {
  await run(async()=>{await api('select_account',{id});activeId.value=id;await refresh({sections:['catalog','snapshots','guards']});
    message.value=id ? 'Handelskonto ausgewählt. Python-Worker für dieses Konto starten bzw. neu starten. Erst nach bestätigter Verbindung können neue Aufträge ausgeführt werden.' : 'Kein aktives Handelskonto.';});
}
async function cancel(id) {await run(async()=>{await api('cancel',{id});await refresh({sections:['orders']});});}
</script>

<template>
  <main class="mmt-page" :style="{'--mmt-positive':cssColor('candleUp'),'--mmt-negative':cssColor('candleDown')}">
    <header class="mmt-heading"><div><h1>Milky Meta Trader <small>MMT</small></h1></div>
      <ActionButton v-if="unlocked" @click="lock">Sperren &amp; Schlüssel vergessen</ActionButton></header>
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
      <MilkyMetaTraderBalances v-model:statistics-account="statisticsAccount" :accounts="accounts" :active-id="activeId" :status="status" :account-statuses="accountStatuses" :history="brokerHistory" :now="now" :stale-seconds="staleSeconds" />
        <p v-if="workerProblem" role="alert" class="mmt-error">Ausführung gestört: {{workerProblem.code}}<span v-if="workerProblem.stage"> in {{workerProblem.stage}}</span>. Entry-Aufträge und Brokerstatus prüfen; nichts blind erneut senden.</p>
        <p v-if="status?.health?.incident">Fehleralarm: <span v-for="item in status.health.deliveries" :key="item.channel">{{item.channel==='pushover'?'Pushover':'Telegram'}} {{deliveryLabels[item.status]??item.status}}. </span></p>
        <p v-if="status?.health&&!status.health.checked_at" role="alert">Unabhängige Alarmprüfung noch nicht bestätigt.</p>
        <p v-else-if="status?.health?.checked_at&&Date.now()-Date.parse(status.health.checked_at)>960000" role="alert" class="mmt-error">Unabhängige Alarmprüfung ist veraltet. Letzte Prüfung: {{time(status.health.checked_at)}} (Berlin).</p>
      <MmtOpenBrokerPositions :positions="allPositions" :issues="positionIssues" />
      <div class="mmt-workspace">
        <div class="mmt-main-column">
          <MilkyMetaTraderStatistics :api="api" :accounts="accounts" :account="statisticsAccount" :commission-positions="commissionPositions" @history="brokerHistory=$event" />
        </div>
        <aside class="mmt-side-column" aria-label="Entry-Suche und Aufträge">
          <section class="mmt-panel mmt-orders" aria-labelledby="mmt-orders-title">
            <div class="mmt-section-heading"><h2 id="mmt-orders-title">Aktuelle Entry-Aufträge</h2><ActionButton v-if="currentOrders.length" :disabled="busy" @click="run(refresh)">Aktualisieren</ActionButton></div>
            <p v-if="currentOrders.length" class="mmt-muted">Abgleich alle 8 Sekunden · kein erneuter Auftrag durch Aktualisieren.</p>
            <ul v-if="currentOrders.length" class="mmt-order-list"><MilkyMetaTraderOrderCard v-for="order in currentOrders" :key="order.id" :order="order" :commission="orderCommission(order)" :commission-at="historyTime(accountForOrder(order))" :busy="busy" :snapshot="orderSnapshot(order)" :age="orderAge(order)" :show-position="false" :account-name="accounts.find(account=>account.id===accountForOrder(order))?.name" @cancel="cancel" /></ul>
            <p v-else class="mmt-muted">Keine laufende Entry-Suche.</p>
            <details v-if="previousOrders.length" class="mmt-technical-history"><summary>Technischer Auftragsverlauf · {{previousOrders.length}} letzte erledigte Aufträge</summary><p>Suchaufträge sind keine vollständige Brokerhistorie und zählen nicht als Statistikdaten.</p><ul class="mmt-order-list"><MilkyMetaTraderOrderCard v-for="order in previousOrders" :key="order.id" :order="order" :commission="orderCommission(order)" :commission-at="historyTime(accountForOrder(order))" :busy="busy" /></ul></details>
          </section>
          <MilkyMetaTraderEntrySearch :api="api" :status="status" :account="active" @submitted="run(refresh)" />
        </aside>
      </div>
      <div class="mmt-settings"><h2>Konten &amp; Einstellungen</h2>
      <MmtRiskPolicyEditor :api="api" :policy="status?.risk_policy" :account="active" @saved="run(()=>refresh({sections:['catalog','guards']}))" />
      <details class="mmt-panel"><summary>Brokerkonten verwalten <span class="mmt-muted">· {{accounts.length}} gespeichert</span></summary>
        <p>Das ausgewählte Handelskonto gilt für neue Einzelaufträge. Mehrere Konten wählst du in der Entry-Suche im Chart. Laufende Suchen bleiben an ihr Konto gebunden; offene Positionen oder unklare Aufträge sperren den Wechsel.</p>
        <p v-if="!accounts.length">Noch keine Brokerkonten hinterlegt.</p>
        <component v-for="group in accountGroups" :key="group.label" :is="group.inactive?'details':'section'">
          <summary v-if="group.inactive">{{group.label}} ({{group.accounts.length}})</summary>
          <h3 v-else>{{group.label}} <span class="mmt-muted">· {{group.accounts.length}}</span></h3>
          <p v-if="!group.accounts.length" class="mmt-muted">Keine {{group.inactive?'inaktiven':'aktiven'}} Konten.</p>
          <ul class="mmt-accounts"><li v-for="account in group.accounts" :key="account.id">
            <div><strong>{{account.name}}</strong><br><small>{{account.login}} · {{account.server}}<template v-if="account.server!=='CSV-Archiv'"> · MT5 {{account.mode==='demo'?'Demo':'Real'}}</template></small>
              <p v-if="group.inactive&&account.archive_details?.reason" class="mmt-muted">{{account.archive_details.reason}}</p>
            </div>
            <span v-if="group.inactive" class="mmt-muted">{{accountArchiveLabel(account)}}</span>
            <template v-else>
              <label>Konto-Tag<select :value="account.trade_role??''" :disabled="busy" @change="assignRole(account.id,$event.target.value)"><option value="">Kein Tag</option><option value="risky">Riskante Trades</option><option value="safe">Sichere Trades</option><option value="normal">Normale Trades</option></select></label>
              <span v-if="account.id===activeId" class="mmt-selected">Aktives Handelskonto</span>
              <ActionButton v-else :disabled="busy" @click="selectTradingAccount(account.id)">Als Handelskonto wählen</ActionButton>
            </template>
          </li></ul>
        </component>
        <ActionButton v-if="activeId" :disabled="busy" @click="selectTradingAccount(null)">Handelskonto abwählen</ActionButton>
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
        <p v-if="!active">Zuerst ein Handelskonto auswählen.</p>
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
