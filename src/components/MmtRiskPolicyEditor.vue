<script setup>
import {ref,watch} from 'vue';
import {RISK_BASE} from '../../supabase/functions/trading-monitor-mcp/mt5RiskContract.js';
import ActionButton from './ui/ActionButton.vue';
const props=defineProps({api:{type:Function,required:true},policy:Object,account:Object});
const emit=defineEmits(['saved']);
const floor=ref(''),buffer=ref(''),source=ref(''),confirmed=ref(false),busy=ref(false),error=ref('');
watch(()=>[props.account?.id,props.policy?.revision],()=>{
 floor.value=props.policy?.drawdown_floor??'';buffer.value=props.policy?.cost_buffer??'';source.value=props.policy?.source??'';confirmed.value=false;error.value='';
},{immediate:true});
async function save(){
 if(busy.value||!confirmed.value||!props.account)return;
 busy.value=true;error.value='';
 try{await props.api('risk_policy_save',{policy:{risk_base:RISK_BASE,drawdown_floor:Number(floor.value),cost_buffer:Number(buffer.value),currency:'USD',source:source.value}});confirmed.value=false;emit('saved');}
 catch(e){error.value=e.message;}finally{busy.value=false;}
}
</script>
<template>
 <details class="mmt-panel"><summary>Risikobasis und heutige Kontogrenzen bestätigen</summary>
  <p>Für {{account?.name??'das ausgewählte Konto'}} · Risky 0,5 % / Full 0,9 %. Gemeinsames Budget pro Konto und Markt; Tagesstopp 1.000 USD. Engere bestätigte Kontogrenzen haben Vorrang.</p>
  <p>Feste Basis: ursprünglich 50.000 USD. Risky 250 USD, Full und gemeinsames Marktbudget 450 USD. Ohne bestätigte heutige Drawdown-Grenze und Kostenpuffer bleibt die Ausführung gesperrt.</p>
  <p v-if="policy">Quelle: {{policy.source}} · gültig bis {{new Date(policy.valid_until_sec*1000).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})}} (Berlin).</p>
  <form class="mmt-form" @submit.prevent="save">
   <p>Prozentbasis: {{RISK_BASE.toLocaleString('de-DE')}} USD (fest)</p>
   <label>Aktueller Drawdown-Floor (USD)<input v-model="floor" type="number" min="0.01" step="0.01" required :disabled="busy"></label>
   <label>Kosten-/Slippagepuffer je Position (USD)<input v-model="buffer" type="number" min="0.01" step="0.01" required :disabled="busy"></label>
   <label class="mmt-wide">Herkunft der heutigen Grenzen<input v-model="source" required maxlength="500" :disabled="busy" placeholder="Welche bestätigte Kontoregel und welcher Kostenpuffer?"></label>
   <label class="mmt-wide"><span><input v-model="confirmed" type="checkbox" required :disabled="busy"> Diese Werte und ihre Basis habe ich für heute geprüft.</span></label>
   <ActionButton type="submit" class="mmt-wide" :disabled="busy||!confirmed||!account">Heutige Risikogrenzen speichern</ActionButton>
  </form>
  <p>Worker prüft Kurs, offene Risiken, Tagesrest und Broker-Spezifikationen vor dem Versand erneut. Neue Höchststände bei Balance oder Equity verlangen eine erneute Bestätigung des aktuellen Floors. Bestätigte Grenzen ersetzen keine fehlende Brokerverbindung; offene Gewinne heben eine Tagesverlustsperre nicht auf.</p>
  <p v-if="error" role="alert">{{error}}</p>
 </details>
</template>
