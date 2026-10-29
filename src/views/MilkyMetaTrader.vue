<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ActionButton from '../components/ui/ActionButton.vue';
import MilkyMetaTraderOrder from '../components/MilkyMetaTraderOrder.vue';
import { createMilkyMetaTraderClient } from '../milkyMetaTraderClient.js';
import { readMilkyMetaTraderKey, saveMilkyMetaTraderKey, forgetMilkyMetaTraderKey } from '../milkyMetaTraderKey.js';

const token=ref(readMilkyMetaTraderKey()), unlocked=ref(false), accounts=ref([]), activeId=ref(null);
const status=ref(null), busy=ref(false), error=ref(''), message=ref('');
const form=ref({name:'',login:'',server:'BeyondIQCapital-Server',mode:'live',password:''});
let timer=null;
const active=computed(()=>accounts.value.find(a=>a.id===activeId.value));
const api=(action,fields)=>createMilkyMetaTraderClient(import.meta.env.VITE_SUPABASE_URL,token.value)(action,fields);
const time=value=>value ? new Date(value).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}) : '—';
const labels={searching:'Sucht Entry',sending:'Wird gesendet',executed:'Ausgeführt',rejected:'Abgelehnt',
  unknown:'Ausgang ungeklärt',cancelled:'Abgebrochen',expired:'Abgelaufen'};

async function refresh() {
  const data=await api('accounts');
  accounts.value=data.accounts; activeId.value=data.active_account_id;
  status.value=activeId.value ? await api('status') : null;
}
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
    timer=setInterval(()=>{if(!busy.value) run(refresh);},5000);
  });
}
function clearView() {
  clearInterval(timer); timer=null; token.value=''; unlocked.value=false;
  form.value.password=''; accounts.value=[]; status.value=null; activeId.value=null;
}
function lock() {
  if(!forgetMilkyMetaTraderKey()) {error.value='Der gespeicherte Schlüssel konnte nicht entfernt werden. Bitte die Website-Daten im Browser löschen.';return;}
  clearView();
}
onMounted(()=>{if(token.value) unlock();});
onUnmounted(clearView);
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
  <main class="mmt-page">
    <header class="mmt-heading"><div><h1>Milky Meta Trader <small>MMT</small></h1><p>Konten, Verbindung und asynchrone Entry-Aufträge</p></div>
      <ActionButton v-if="unlocked" @click="lock">Sperren &amp; Schlüssel vergessen</ActionButton></header>
    <p class="mmt-notice">Testbetrieb: höchstens 0,01 Lot und 5 Einheiten Risikobudget in Kontowährung pro Auftrag. Strategie- und Challenge-Regeln folgen. Slippage und Gebühren können den tatsächlichen Verlust erhöhen.</p>
    <p v-if="error" role="alert" class="mmt-error">{{error}}</p>
    <p v-if="message" role="status">{{message}}</p>
    <form v-if="!unlocked" class="mmt-panel" @submit.prevent="unlock">
      <h2>Privaten Bereich entsperren</h2>
      <label for="mmt-control-key">MMT-Zugriffsschlüssel</label>
      <input id="mmt-control-key" v-model="token" type="password" autocomplete="off" required>
      <p>Der Zugriffsschlüssel wird nach erfolgreichem Entsperren in diesem Browser gespeichert und beim nächsten Aufruf automatisch verwendet. Mit „Sperren & Schlüssel vergessen“ entfernst du ihn. Skripte dieser Website können auf den gespeicherten Schlüssel zugreifen. Brokerpasswörter werden serverseitig verschlüsselt und nie zurück angezeigt.</p>
      <ActionButton type="submit" :disabled="busy||!token">{{busy?'Verbinde …':'Entsperren'}}</ActionButton>
    </form>
    <template v-else>
      <section class="mmt-panel" aria-labelledby="mmt-accounts-title"><h2 id="mmt-accounts-title">Brokerkonten</h2>
        <p>Genau ein Konto kann als Testkonto ausgewählt sein. Weitere gespeicherte Konten bleiben inaktiv. Keine automatische Vervielfachung von Orders.</p>
        <p v-if="!accounts.length">Noch keine Brokerkonten hinterlegt.</p>
        <ul class="mmt-accounts"><li v-for="account in accounts" :key="account.id">
          <div><strong>{{account.name}}</strong><br><small>{{account.login}} · {{account.server}} · MT5 {{account.mode==='demo'?'Demo':'Real'}}</small></div>
          <span v-if="account.id===activeId" class="mmt-selected">Ausgewähltes Testkonto</span>
          <ActionButton v-else :disabled="busy" @click="select(account.id)">Als Testkonto wählen</ActionButton>
        </li></ul>
        <ActionButton v-if="activeId" :disabled="busy" @click="select(null)">Testkonto abwählen</ActionButton>
      </section>
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
      <section class="mmt-panel" aria-labelledby="mmt-connection-title"><h2 id="mmt-connection-title">Verbindung</h2>
        <p v-if="!active">Zuerst ein Testkonto auswählen.</p>
        <template v-else><p><strong>{{active.name}}</strong> · {{status?.online?'Worker erreichbar':'Worker offline / noch nicht gestartet'}}</p>
          <p v-if="status?.bridge">Letzter Kontakt: {{time(status.bridge.heartbeat_at)}} (Berlin)<br>
            Balance {{status.bridge.snapshot.balance}} · Equity {{status.bridge.snapshot.equity}} {{status.bridge.snapshot.currency}}<br>
            {{status.bridge.snapshot.positions.length}} offene Positionen · Handel {{status.bridge.snapshot.trade_allowed?'freigegeben':'gesperrt'}}</p>
        </template>
        <ActionButton :disabled="busy" @click="run(refresh)">Aktualisieren</ActionButton>
      </section>
      <MilkyMetaTraderOrder :api="api" :status="status" :account="active" @submitted="run(refresh)" />
      <section class="mmt-panel" aria-labelledby="mmt-orders-title"><h2 id="mmt-orders-title">Entry-Aufträge</h2>
        <p>Suchaufträge erteilst du im Chat. Am gültigen M1-Trigger wird ohne erneute Rückfrage ausgeführt.</p>
        <p v-if="!status?.orders?.length">Noch keine Aufträge.</p>
        <ul class="mmt-accounts"><li v-for="order in status?.orders??[]" :key="order.id"><div><strong>{{order.intent.symbol}} · {{order.intent.direction==='long'?'Long':'Short'}}</strong><br>
          {{labels[order.status]??order.status}} · {{time(order.created_at)}}<br>
          <small>{{order.id}} · {{order.result?.reason??''}}</small></div>
          <ActionButton v-if="order.status==='searching'" :disabled="busy" @click="cancel(order.id)">Suche abbrechen</ActionButton>
        </li></ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.mmt-page{flex:1;overflow-y:auto;padding:24px;max-width:1050px;width:100%;margin:auto;color:#d1d4dc}.mmt-heading{display:flex;justify-content:space-between;gap:16px;align-items:center}.mmt-heading h1{margin:0;font-size:24px}.mmt-heading p,.mmt-page small{color:#a5adbe}.mmt-notice{padding:14px;border-left:3px solid #d7ad55;background:#25221c}.mmt-panel{padding:20px;background:#1a1e28;border:1px solid #2a2e39;border-radius:8px;margin:18px 0}.mmt-panel h2{font-size:17px;margin:0 0 12px}.mmt-panel p{font-size:13px;color:#b3bbca}.mmt-page input,.mmt-page select{box-sizing:border-box;width:100%;padding:10px;background:#131722;color:#d1d4dc;border:1px solid #4b5364;border-radius:4px;font:inherit}.mmt-page input:focus-visible,.mmt-page select:focus-visible{outline:2px solid #82b5ff;outline-offset:2px}.mmt-form{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.mmt-form label{display:grid;gap:5px;font-size:13px}.mmt-wide{grid-column:1/-1}.mmt-accounts{list-style:none;padding:0}.mmt-accounts li{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #363d49;padding:14px 0;flex-wrap:wrap;overflow-wrap:anywhere}.mmt-accounts li>div{min-width:0}.mmt-selected{color:#86d9b2}.mmt-error{color:#ffb8b8}.mmt-panel summary{cursor:pointer;font-weight:600}@media(max-width:600px){.mmt-page{padding:16px}.mmt-form{grid-template-columns:1fr}.mmt-wide{grid-column:auto}.mmt-panel{padding:14px}}
</style>
