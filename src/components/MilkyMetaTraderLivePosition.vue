<script setup>
import { fmtDateTime, fmtPrice, pnlClass, pricePrecisionForInstrument } from '../format.js';
const props=defineProps({position:{type:Object,required:true},currency:String,age:Number,digits:Number,commission:{type:Number,default:null},commissionAt:String});
const price=value=>fmtPrice(value,props.digits??pricePrecisionForInstrument(props.position.symbol.replace(/\.gbe$/i,'')));
</script>
<template>
  <div class="mmt-live-position" :data-stale="age==null||age>5">
    <div class="mmt-live-heading"><div><strong>Laufendes Broker-PnL</strong> <strong class="mmt-live-pnl" :class="pnlClass(position.profit)">{{fmtPrice(position.profit,2)}} <small>{{currency}}</small></strong></div><span>{{age==null?'Datenalter unbekannt':age>5?'Daten veraltet · '+age+' s':'Stand vor '+age+' s'}}</span></div>
    <dl class="mmt-levels mmt-live-levels">
      <div><dt>Aktueller Brokerkurs</dt><dd>{{price(position.price_current)}}</dd></div>
      <div><dt>Lotgröße</dt><dd>{{fmtPrice(position.volume,4)}} Lot</dd></div>
      <div><dt>Broker-Entry</dt><dd>{{price(position.price_open)}}</dd></div>
      <div><dt>Broker-SL</dt><dd>{{position.sl?price(position.sl):'Keiner'}}</dd></div>
      <div><dt>Broker-TP</dt><dd>{{position.tp?price(position.tp):'Keiner'}}</dd></div>
      <div><dt>Commission bisher</dt><dd :class="pnlClass(commission)">{{fmtPrice(commission,2)}} {{currency}}</dd></div>
    </dl>
    <small class="mmt-muted">Positions-PnL ohne Commission/Gebühren und Swap · Ticket {{position.ticket}}<br>Commission: {{commissionAt?'Historienstand '+fmtDateTime(commissionAt,{timeZone:'Europe/Berlin',second:'2-digit'}):'noch nicht abgeglichen'}}; spätere Ausstiegskosten noch nicht enthalten.</small>
  </div>
</template>
