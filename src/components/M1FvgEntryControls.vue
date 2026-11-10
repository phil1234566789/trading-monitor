<script setup>
import {cssColor} from '../chartColors.js';
defineProps({rangeId:[String,Number],instrument:String,direction:String,armedAction:String,message:String,disabled:Boolean});
defineEmits(['request']);
</script>
<template>
  <section class="fvg-entry-controls" aria-label="Entry aus M1-FVG vorbelegen">
    <b>M1-FVG → neue Position · DR #{{ rangeId }} · {{ instrument }} {{ direction === 'short' ? 'Short' : 'Long' }}</b>
    <p>Variante wählen, dann eine goldene FVG-Impulskerze (Entstehung) im Chart anklicken. Die Entry-Zeit ist der bestätigende Kerzenschluss.</p>
    <div>
      <button type="button" :disabled="disabled" :aria-pressed="armedAction === 'entryFvgImmediate'" @click="$emit('request','immediate')">a · FVG-Schluss</button>
      <button type="button" :disabled="disabled" :aria-pressed="armedAction === 'entryFvgRetestReaction'" @click="$emit('request','retestReaction')">b) FVG Retest + Bestätigungskerze</button>
    </div>
    <p><span :style="{color:cssColor('fvgCandle')}">Gold: FVG-Impuls</span> · <span :style="{color:cssColor('tradeConnector')}">Positionsfarbe (pink): Bestätigung · pinker Rahmen bei gleichzeitig goldenem Impuls</span></p>
    <p v-if="message" role="status">{{ message }}</p>
    <p>Bei b muss der Docht mindestens die FVG-Mitte erreichen. Bei vollständiger Füllung muss dieselbe Kerze den zugehörigen M1-OB berühren. Erst eine zusätzliche Richtungskerze danach bestätigt den Entry.</p>
    <p>Nur Entry-Preis und -Zeit werden vorgeschlagen. Gespeichert wird erst mit „Position speichern“.</p>
  </section>
</template>
<style scoped>
.fvg-entry-controls{padding:10px;border:1px solid #414857;border-radius:4px;margin:10px 0;font-size:12px}
p{margin:6px 0;color:#aeb9cb;line-height:1.5}div{display:flex;flex-wrap:wrap;gap:6px}button{background:#252b38;color:#d8e1ef;border:1px solid #4b5566;border-radius:4px;padding:7px;cursor:pointer}button[aria-pressed="true"]{border-color:#ffd54f;color:#ffd54f}button:disabled{opacity:.5;cursor:default}
</style>
