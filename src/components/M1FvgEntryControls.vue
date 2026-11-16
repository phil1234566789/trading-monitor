<script setup>
import {cssColor} from '../chartColors.js';
defineProps({rangeId:[String,Number],executionNumber:Number,positionId:[String,Number],draft:Boolean,instrument:String,direction:String,armedAction:String,message:String,disabled:Boolean,dobChoices:{type:Array,default:()=>[]},dobChosenKey:String});
defineEmits(['request','choose-dob']);
</script>
<template>
  <section class="fvg-entry-controls" aria-label="Entry aus M1-FVG vorbelegen">
    <b>M1-FVG → Entry · Ausführung {{executionNumber}} · {{positionId!=null?'Position #'+positionId:'neue Position'}} · DR #{{ rangeId }} · {{ instrument }} {{ direction === 'short' ? 'Short' : 'Long' }}</b>
    <p>Variante wählen: Gold markiert FVG-Impulse, die Positionsfarbe alle bereits bestätigten Einstiegskerzen. Zum Vorbelegen eine pinke Bestätigungskerze anklicken; die goldene FVG-Impulskerze bleibt ebenfalls auswählbar.</p>
    <div>
      <button type="button" :disabled="disabled" :aria-pressed="armedAction === 'entryFvgImmediate'" @click="$emit('request','immediate')">a · FVG-Schluss</button>
      <button type="button" :disabled="disabled" :aria-pressed="armedAction === 'entryFvgRetestReaction'" @click="$emit('request','retestReaction')">b) FVG Retest + Bestätigungskerze</button>
      <button type="button" :disabled="disabled" @click="$emit('request','dob')">c) DOB-Indikator</button>
    </div>
    <p><span :style="{color:cssColor('fvgCandle')}">Gold: FVG-Impuls</span> · <span :style="{color:cssColor('tradeConnector')}">Positionsfarbe (pink): Bestätigung · pinker Rahmen bei gleichzeitig goldenem Impuls</span></p>
    <p v-if="message" role="status">{{ message }}</p>
    <div v-if="dobChoices.length" role="group" aria-label="DOB-Entry wählen">
      <button v-for="choice in dobChoices" :key="choice.key" type="button" :aria-pressed="choice.key===dobChosenKey" @click="$emit('choose-dob',choice.key)">{{ choice.label }}</button>
    </div>
    <p>Bei b muss der Docht mindestens die FVG-Mitte erreichen. Bei vollständiger Füllung muss dieselbe Kerze den zugehörigen M1-OB berühren. Der zugehörige OB darf bis zur Bestätigung nicht durch einen Docht gebrochen werden. Erst eine zusätzliche Richtungskerze danach bestätigt den Entry.</p>
    <p>c nimmt Entry und SL aus dem DOB-Indikator, Route a oder b. Gelistet werden Paare in Richtung der Dealing Range am Berliner Tag der Entry-Zeit (ohne Entry-Zeit: der jüngsten M5-OB-Evidence); ★ markiert Paare mit M5-OB-Evidence.</p>
    <p>a und b schlagen nur Entry-Preis und -Zeit vor, c zusätzlich den Stop-Loss. Gespeichert wird erst mit „{{draft?'Position speichern':'Speichern'}}“.</p>
  </section>
</template>
<style scoped>
.fvg-entry-controls{padding:10px;border:1px solid #414857;border-radius:4px;margin:10px 0;font-size:12px}
p{margin:6px 0;color:#aeb9cb;line-height:1.5}div{display:flex;flex-wrap:wrap;gap:6px}button{background:#252b38;color:#d8e1ef;border:1px solid #4b5566;border-radius:4px;padding:7px;cursor:pointer}button[aria-pressed="true"]{border-color:#ffd54f;color:#ffd54f}button:disabled{opacity:.5;cursor:default}
</style>
