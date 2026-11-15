<script setup>
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
defineProps({trade:Object,number:Number,positionId:[String,Number],draft:Boolean,message:String,choices:Array});
defineEmits(['choose','cancel']);
</script>
<template>
 <section class="tp-controls" aria-label="Exit aus M1-Treffer vorbelegen">
  <b>TP suchen · Ausführung {{number}} · {{positionId!=null?'Position #'+positionId:'neue Position'}} · DR #{{trade.dealingRangeId}} · {{trade.instrument}}</b>
  <p>Pink markiert geschlossene M1-Kerzen, die ein vorhandenes Target oder die Invalidierung berühren. Eine Trefferkerze anklicken. Gesucht wird ab dem aktuellen Entry im Formular.</p>
  <p>Die Exit-Zeit bezeichnet die Trefferminute. Innerhalb dieser Minute ist keine Reihenfolge bekannt. Das Ergebnis wird nicht geändert.</p>
  <p v-if="message" role="status">{{message}}</p>
  <div v-if="choices?.length" role="group" aria-label="Getroffene Linie wählen">
   <button v-for="line in choices" :key="line.key" type="button" @click="$emit('choose',line.key)">{{line.label}} · {{fmtPrice(line.price,pricePrecisionForInstrument(trade.instrument))}}</button>
  </div>
  <p>Nur Exit-Preis und -Zeit werden vorgeschlagen. Gespeichert wird erst mit „{{draft?'Position speichern':'Speichern'}}“.</p>
  <button type="button" @click="$emit('cancel')">Suche beenden</button>
 </section>
</template>
<style scoped>
.tp-controls{padding:10px;border:1px solid #414857;border-radius:4px;margin:10px 0;font-size:12px}
p{margin:6px 0;color:#aeb9cb;line-height:1.5}div{display:flex;flex-wrap:wrap;gap:6px}button{background:#252b38;color:#d8e1ef;border:1px solid #4b5566;border-radius:4px;padding:7px;cursor:pointer}button:focus-visible{outline:2px solid #7ea6ff;outline-offset:2px}
</style>
