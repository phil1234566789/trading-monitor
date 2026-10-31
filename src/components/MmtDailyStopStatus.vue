<script setup>
import {computed} from 'vue';
import {snapshotAgeSeconds} from '../milkyMetaTraderMonitoring.js';
const props=defineProps({status:Object,now:{type:Number,required:true}});
const stop=computed(()=>props.status?.daily_stop);
const age=computed(()=>snapshotAgeSeconds(props.status?.bridge?.heartbeat_at,props.now));
const ready=computed(()=>props.status?.online&&stop.value?.daily_stop_ready&&age.value!=null&&age.value<=5);
const activeCommands=computed(()=>(stop.value?.commands??[]).filter(c=>c.status!=='executed'));
const labels={pending:'Notfallauftrag wartet',sending:'Brokerannahme wird abgeglichen',unknown:'Ausgang ungeklärt · kein erneuter Versand',rejected:'Brokerauftrag abgelehnt'};
const reasons={daily_loss:'Tagesverlustgrenze erreicht',broker_drawdown:'Bestätigte Drawdown-Grenze erreicht'};
</script>
<template>
 <section class="mmt-daily-status" aria-label="Tagesstopp" :role="stop?.latched?'alert':'status'">
  <strong>{{stop?.latched?'Tagesstopp / offener Abgleich sperrt Entries':ready?'Tagesprüfung aktuell':'Schutzprüfung fehlt oder ist veraltet'}}</strong>
  <p v-if="stop?.reason">{{reasons[stop.reason]??stop.reason}} · Berlin-Tag {{stop.day}}. Erholung hebt die Tages-Sperre nicht auf.</p>
  <p>Aktives, verbundenes Konto · 1.000 USD Tagesverlustgrenze. Worker-/Broker-/Netzausfälle können eine Schließung verhindern.</p>
  <p v-if="!ready">Keine aktuelle Schutzbestätigung. Brokerseitig gesetzte SL/TP bleiben unabhängig bestehen.</p>
  <ul v-if="activeCommands.length"><li v-for="command in activeCommands" :key="command.id">{{command.symbol}} #{{command.ticket}} · {{command.kind==='close'?'Schließen':'Order stornieren'}}: {{labels[command.status]??command.status}}<span v-if="command.result?.reason"> · {{command.result.reason}}</span></li></ul>
 </section>
</template>
<style scoped>
.mmt-daily-status{padding:8px;border:1px solid #303746;border-radius:4px;font-size:11px;margin:8px 0}
p{margin:4px 0}ul{padding-left:16px}
</style>
