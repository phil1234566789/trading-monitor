<script setup>
import { fmtPrice, pnlClass, pricePrecisionForInstrument } from '../format.js';
const props=defineProps({position:{type:Object,required:true},currency:String,age:Number,digits:Number});
const price=value=>fmtPrice(value,props.digits??pricePrecisionForInstrument(props.position.symbol.replace(/\.gbe$/i,'')));
</script>
<template>
  <div class="mmt-live-position" :data-stale="age==null||age>5">
    <div class="mmt-live-heading"><strong>Laufendes Broker-PnL</strong><span>{{age==null?'Datenalter unbekannt':age>5?'Daten veraltet · '+age+' s':'Stand vor '+age+' s'}}</span></div>
    <div class="mmt-live-pnl" :class="pnlClass(position.profit)">{{fmtPrice(position.profit,2)}} <small>{{currency}}</small></div>
    <dl class="mmt-levels mmt-live-levels">
      <div><dt>Aktueller Brokerkurs</dt><dd>{{price(position.price_current)}}</dd></div>
      <div><dt>Lotgröße</dt><dd>{{fmtPrice(position.volume,4)}} Lot</dd></div>
      <div><dt>Broker-Entry</dt><dd>{{price(position.price_open)}}</dd></div>
      <div><dt>Broker-SL</dt><dd>{{position.sl?price(position.sl):'Keiner'}}</dd></div>
      <div><dt>Broker-TP</dt><dd>{{position.tp?price(position.tp):'Keiner'}}</dd></div>
    </dl>
    <small class="mmt-muted">Positions-PnL ohne Gebühren und Swap · Ticket {{position.ticket}}</small>
  </div>
</template>
