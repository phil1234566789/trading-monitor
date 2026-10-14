<script setup>
import {computed,ref,watch,nextTick,onUnmounted} from 'vue';
import {useRoute} from 'vue-router';
import {createChart,CandlestickSeries,createSeriesMarkers} from 'lightweight-charts';
import {supabase} from '../supabaseClient.js';
import {createLiveWatcherRepository,LIVE_MONTH_PREFIX} from '../liveWatcherMonth.js';
import {liveEntryPriceLevels} from '../liveWatcherEntryLevels.js';
import {fetchOlderCandles} from '../forexCandles.js';
import {barSecondsFor} from '../timeframes.js';
import {formatDatedTime,formatBerlinTime,berlinDateStrFor} from '../berlinTime.js';
import {entryCategorySizeLabel,entryOptionalConditionLabel,entryLotsLabel,entryBudgetLabel} from '../entryPresentation.js';
import {cssColor} from '../chartColors.js';
import {pricePrecisionForInstrument} from '../format.js';
import JsonTree from '../components/JsonTree.vue';
const route=useRoute(),repository=createLiveWatcherRepository(supabase),event=ref(null),error=ref(''),chartError=ref(''),loading=ref(false),container=ref(null),bar=ref('5m');
const entry=computed(()=>event.value?.payload?.entry);
let chart,revision=0,chartRevision=0;
async function load(){const ticket=++revision;event.value=null;error.value='';try{const row=await repository.event(route.query.event);if(ticket!==revision)return;if(!row?.payload?.entry)throw new Error('Der gespeicherte Live-Entry fehlt.');event.value=row;}catch(e){if(ticket===revision)error.value=e.message;}}
async function render(){const ticket=++chartRevision;chart?.remove();chart=null;chartError.value='';if(!entry.value)return;loading.value=true;
  try{const original=entry.value,source=event.value,time=original.recognizedAt,period=bar.value;
    // Dieser Beleg liest ausschließlich das Archiv und startet keinen Erkennungs-/Simulationslauf.
    const candles=(await fetchOlderCandles(source.instrument,period,time+7200,Math.ceil(18000/barSecondsFor(period)),{allowLive:false}) ?? []).filter(c=>c.time>=time-10800);
    if(ticket!==chartRevision)return;if(!candles.length)throw new Error('Archivkerzen für dieses Zeitfenster fehlen.');
    await nextTick();if(ticket!==chartRevision || !container.value)return;
    chart=createChart(container.value,{autoSize:true,height:420,layout:{background:{color:'#131722'},textColor:'#d1d4dc'},timeScale:{timeVisible:true,tickMarkFormatter:t=>formatBerlinTime(t)},localization:{timeFormatter:t=>formatDatedTime(t)},
      grid:{vertLines:{color:'#2a2e39'},horzLines:{color:'#2a2e39'}}});
    const savedLevels=liveEntryPriceLevels(original),savedPrices=savedLevels.map(level=>level.price);
    const precision=pricePrecisionForInstrument(source.instrument),series=chart.addSeries(CandlestickSeries,{upColor:cssColor('candleUp'),downColor:cssColor('candleDown'),wickUpColor:cssColor('candleUp'),wickDownColor:cssColor('candleDown'),borderVisible:false,autoscaleInfoProvider:base=>{const info=base();return info?{...info,priceRange:{minValue:Math.min(info.priceRange.minValue,...savedPrices),maxValue:Math.max(info.priceRange.maxValue,...savedPrices)}}:info;},priceFormat:{type:'price',precision,minMove:10**-precision}});
    series.setData(candles);
    for(const level of savedLevels)series.createPriceLine({price:level.price,title:level.title,color:cssColor(level.color),lineWidth:1,lineStyle:2,axisLabelVisible:true});
    const candle=candles.find(c=>c.time<=time && c.time+barSecondsFor(period)>time);
    if(candle)createSeriesMarkers(series,[{time:candle.time,position:source.direction==='long'?'belowBar':'aboveBar',shape:source.direction==='long'?'arrowUp':'arrowDown',color:cssColor('tradeConfirmation'),text:'Gespeicherter Entry'}]);
    chart.timeScale().fitContent();
  }catch(e){if(ticket===chartRevision)chartError.value=e.message || 'Archivchart konnte nicht geladen werden';}finally{if(ticket===chartRevision)loading.value=false;}}
watch(()=>route.query.event,load,{immediate:true});watch([entry,bar],render);
onUnmounted(()=>{revision++;chartRevision++;chart?.remove();});
</script>
<template>
<main class="live-entry">
  <h1>Gespeicherter Live-Entry</h1><p v-if="error" role="alert">{{ error }} <button @click="load">Erneut laden</button></p>
  <template v-if="entry">
    <RouterLink :to="{path:'/statistik',query:{run:LIVE_MONTH_PREFIX+berlinDateStrFor(entry.recognizedAt).slice(0,7)}}">Zur Live-Monatsansicht</RouterLink>
    <h2>{{ event.instrument }} · {{ event.direction==='long'?'Long':'Short' }} · {{ entryCategorySizeLabel(entry) }}</h2>
    <p>{{ formatDatedTime(entry.recognizedAt) }} · Europe/Berlin · {{ entry.label }} · {{ entry.entryPattern ?? 'Modellversion nicht gespeichert' }}</p>
    <p v-if="entryOptionalConditionLabel(entry)">{{ entryOptionalConditionLabel(entry) }}</p>
    <p class="id">DR {{ event.setup_key }}<br>Entry {{ entry.id }}</p>
    <p>Originale Live-Erkennung; kein vollständiger Statistik-Snapshot. SL-Ergebnisse, Nettoergebnis und vollständiger DR-Replay sind nicht gespeichert.</p>
    <p>Archivchart: Kerzen vor und nach dem Entry, gespeicherter Entry, beide Stops und Ziele. Datenlücken können bestehen; daraus wird kein Ergebnis abgeleitet.</p>
    <label>Kerzen <select v-model="bar"><option value="5m">M5</option><option value="1m">M1</option></select></label>
    <p v-if="loading" role="status">Archivkerzen werden geladen…</p><p v-if="chartError" role="alert">{{ chartError }} <button @click="render">Archiv erneut laden</button></p>
    <div ref="container" class="chart" role="img" :aria-label="`Archivchart ${event.instrument} um ${formatDatedTime(entry.recognizedAt)} Europe/Berlin mit gespeicherten Entry-, Stop- und Zielpreisen`"></div>
    <p v-for="variant in event.payload.variants ?? []" :key="variant.variant">{{ variant.variant==='wide'?'Weiter SL':'Enger SL' }} · {{ entryLotsLabel(variant) }} · {{ entryBudgetLabel(variant) }}</p>
    <details><summary>Gespeicherter Originalbeleg</summary><JsonTree :value="event" /></details>
  </template>
  <p v-else-if="!error" role="status">Live-Entry wird geladen…</p>
</main>
</template>
<style scoped>
.live-entry{padding:24px;max-width:1400px;margin:auto;color:#d1d4dc}h1{font-size:20px}h2{font-size:17px}p{font-size:13px;line-height:1.6}.id{overflow-wrap:anywhere;color:#b1b7c5}.chart{height:420px;margin:16px 0}a{color:#91b8ff}select,button{background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:8px}details{overflow:auto}a:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #91b8ff;outline-offset:3px}@media(max-width:600px){.live-entry{padding:12px}}
</style>
