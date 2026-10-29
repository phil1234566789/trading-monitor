<script setup>
import { computed } from 'vue';
import ActionButton from './ui/ActionButton.vue';
import { fmtDateTime, fmtPrice, pnlClass, pricePrecisionForInstrument } from '../format.js';
const props=defineProps({order:{type:Object,required:true},busy:Boolean});
defineEmits(['cancel']);
const lifecycle=computed(()=>props.order.result?.position_lifecycle);
const closed=computed(()=>lifecycle.value?.state==='closed');
const labels={searching:'Entry wird gesucht',sending:'Wird gesendet',executed:'Ausgeführt',rejected:'Abgelehnt',unknown:'Ausgang ungeklärt',cancelled:'Abgebrochen',expired:'Abgelaufen'};
const closeLabels={tp:'TP erreicht',sl:'SL erreicht',mixed:'Geschlossen · mehrere Gründe',other:'Geschlossen'};
const stateLabel=computed(()=>closed.value?(closeLabels[lifecycle.value.close_reason]??'Geschlossen'):props.order.status==='executed'?(lifecycle.value?.state==='open'?'Position offen':'Brokerstatus wird abgeglichen'):labels[props.order.status]??props.order.status);
const precision=computed(()=>pricePrecisionForInstrument(props.order.intent.symbol.replace(/\.gbe$/i,'')));
const price=value=>fmtPrice(value,precision.value);
const time=value=>fmtDateTime(value,{timeZone:'Europe/Berlin'});
</script>

<template>
  <li class="mmt-order-card" :data-state="order.status">
    <div class="mmt-order-heading"><div><strong class="mmt-symbol">{{order.intent.symbol}}</strong> <span class="trade-direction" :class="order.intent.direction">{{order.intent.direction==='long'?'Long':'Short'}}</span></div><span class="mmt-order-state">{{stateLabel}}</span></div>
    <p class="mmt-order-time">Auftrag vom {{time(order.created_at)}} · Berlin</p>
    <dl class="mmt-levels">
      <div><dt>Entry</dt><dd :class="{'mmt-seeking':order.status==='searching'}">{{order.status==='searching'?'wird gesucht':order.status==='executed'?price(order.result?.price):order.result?.reason==='broker_fill_pending'?'Wird abgeglichen':'—'}}</dd></div>
      <div><dt>Stop-Loss <span>SL</span></dt><dd>{{price(order.intent.stop_loss)}}</dd></div>
      <div><dt>Take-Profit <span>TP</span></dt><dd>{{price(order.intent.take_profit)}}</dd></div>
    </dl>
    <div v-if="closed" class="mmt-outcome"><div><span class="mmt-muted">Ergebnis netto</span><strong :class="pnlClass(lifecycle.net_profit)">{{fmtPrice(lifecycle.net_profit,2)}} <small>{{lifecycle.currency}}</small></strong></div><p>Exit {{price(lifecycle.exit_price)}}<br><span class="mmt-muted">{{time(lifecycle.closed_at_sec)}} · Berlin</span></p></div>
    <div class="mmt-order-footer"><details><summary>Auftragsdetails</summary><p>ID: {{order.id}}<br><span v-if="order.result?.reason">{{order.result.reason}}</span></p></details><ActionButton v-if="order.status==='searching'" :disabled="busy" @click="$emit('cancel',order.id)">Suche abbrechen</ActionButton></div>
  </li>
</template>
