<script setup>
import {computed} from 'vue';
import {snapshotAgeSeconds} from '../milkyMetaTraderMonitoring.js';
import {dailyHealth} from '../mmtDailyHealth.js';
import {fmtMoney} from '../format.js';
const props=defineProps({status:Object,now:{type:Number,required:true},staleSeconds:{type:Number,default:15}});
const stop=computed(()=>props.status?.daily_stop);
const age=computed(()=>snapshotAgeSeconds(props.status?.bridge?.heartbeat_at,props.now));
// Im Leerlauf kommen UI-Daten alle acht Sekunden; dieselbe Frist wie die Verbindungsanzeige verwenden.
const ready=computed(()=>props.status?.online&&stop.value?.daily_stop_ready&&age.value!=null&&age.value<=props.staleSeconds);
const hp=computed(()=>ready.value?dailyHealth(props.status?.bridge?.snapshot,stop.value,props.now):null);
const money=value=>fmtMoney(value,'USD');
const activeCommands=computed(()=>(stop.value?.commands??[]).filter(c=>c.status!=='executed'));
const labels={pending:'Notfallauftrag wartet',sending:'Brokerannahme wird abgeglichen',unknown:'Ausgang ungeklärt · kein erneuter Versand',rejected:'Brokerauftrag abgelehnt'};
const reasons={daily_loss:'Tagesverlustgrenze erreicht',broker_drawdown:'Bestätigte Drawdown-Grenze erreicht'};
</script>
<template>
 <section class="mmt-daily-status" aria-label="Tagesstopp" :role="stop?.latched?'alert':'status'">
  <div class="mmt-daily-heading"><strong>Tages-HP <template v-if="hp">{{money(hp.remaining)}} / {{money(hp.limit)}}</template><template v-else>—</template></strong><span>{{stop?.latched?'Tagesstopp / offener Abgleich sperrt Entries':ready?'Tagesprüfung aktuell':'Schutzprüfung fehlt oder ist veraltet'}}</span></div>
  <div class="mmt-daily-hp" :class="{unknown:!hp}" :role="hp?'progressbar':undefined" aria-label="Verbleibende Tages-HP" :aria-valuenow="hp?.remaining" :aria-valuemin="hp?0:undefined" :aria-valuemax="hp?.limit" :aria-valuetext="hp?money(hp.remaining)+' von '+money(hp.limit):undefined"><div v-if="hp" :style="{width:hp.percent+'%'}" :class="{low:hp.percent<=25}" /></div>
  <p v-if="hp">Netto abgeschlossen {{money(hp.realized)}} · Offene Verluste {{money(hp.openLoss)}} · Reset 00:00 Berlin</p>
  <p v-else>Keine aktuellen Tageswerte · Reset 00:00 Berlin</p>
  <p v-if="stop?.reason">{{reasons[stop.reason]??stop.reason}} · Berlin-Tag {{stop.day}}. Erholung hebt die Tages-Sperre nicht auf.</p>
  <p class="mmt-daily-warning" :style="{visibility:ready?'hidden':'visible'}" :aria-hidden="ready">Keine aktuelle Schutzbestätigung. Brokerseitig gesetzte SL/TP bleiben unabhängig bestehen.</p>
  <ul v-if="activeCommands.length"><li v-for="command in activeCommands" :key="command.id">{{command.symbol}} #{{command.ticket}} · {{command.kind==='close'?'Schließen':'Order stornieren'}}: {{labels[command.status]??command.status}}<span v-if="command.result?.reason"> · {{command.result.reason}}</span></li></ul>
 </section>
</template>
<style scoped>
.mmt-daily-status{padding:8px;border:1px solid #303746;border-radius:4px;font-size:11px;margin:8px 0}
.mmt-daily-heading{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}
.mmt-daily-hp{height:12px;background:var(--mmt-border,#303746);border-radius:4px;margin:6px 0;overflow:hidden}
.mmt-daily-hp>div{height:100%;background:var(--mmt-positive,#26a69a)}
.mmt-daily-hp>div.low{background:var(--mmt-negative,#ef5350)}
.mmt-daily-hp.unknown{background:repeating-linear-gradient(135deg,#303746 0 8px,#252c3b 8px 16px)}
p{margin:4px 0}ul{padding-left:16px}
</style>
