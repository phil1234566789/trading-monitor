<script setup>
import {computed,ref,watch,onMounted,onUnmounted} from 'vue';
import {supabase} from '../supabaseClient.js';
import {createLiveWatcherRepository,liveMonthGroups,liveEntryLink} from '../liveWatcherMonth.js';
import {formatDatedTime} from '../berlinTime.js';
import {entryCategorySizeLabel,entryOptionalConditionLabel,entryLotsLabel,entryBudgetLabel} from '../entryPresentation.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
const props=defineProps({month:String,instrument:String,refreshKey:Number});
const repository=createLiveWatcherRepository(supabase),events=ref([]),error=ref(''),loading=ref(false);
let revision=0,timer;
const groups=computed(()=>liveMonthGroups(events.value,props.month,props.instrument));
const count=computed(()=>groups.value.reduce((n,g)=>n+g.entries.length,0));
async function refresh(){const ticket=++revision;loading.value=true;error.value='';try{const rows=await repository.events(props.month);if(ticket===revision)events.value=rows;}catch(e){if(ticket===revision)error.value=e.message || 'Live-Ereignisse konnten nicht geladen werden';}finally{if(ticket===revision)loading.value=false;}}
watch(()=>[props.month,props.refreshKey],()=>{events.value=[];refresh();},{immediate:true});
onMounted(()=>{timer=setInterval(()=>{if(!document.hidden && !loading.value)refresh();},30000);});
onUnmounted(()=>{revision++;clearInterval(timer);});
</script>
<template>
<section class="live-month" :aria-busy="loading">
  <p class="note">Gespeicherte Live-Erkennungen · Aktualisierung alle 30 Sekunden. Kein nachberechneter Monatslauf.</p>
  <p class="note">DRs mit gespeicherten Alarmereignissen; keine vollständige Historie aller beobachteten DRs. Ergebnisse, Winrate und vollständige Statistik-Replays sind nicht gespeichert.</p>
  <p v-if="error" role="alert">{{ error }} <button @click="refresh">Erneut versuchen</button></p>
  <p v-if="loading" role="status">Live-Ereignisse werden geladen…</p>
  <h2 v-if="!loading && !error">{{ groups.length }} ereignisbelegte Dealing Ranges · {{ count }} eindeutige Entries</h2>
  <p v-if="!groups.length && !loading && !error">Keine Live-Erkennungen für diesen Monat und dieses Instrument gespeichert.</p>
  <article v-for="group in groups" :key="group.key">
    <h3>{{ group.instrument }} · {{ group.direction==='long'?'Long':group.direction==='short'?'Short':'Richtung nicht gespeichert' }}</h3>
    <p class="id">DR {{ group.setupKey }}</p><p>{{ group.entries.length }} Entries · {{ group.events.length }} gespeicherte Alarmereignisse</p>
    <details><summary>Gespeicherte Alarmstufen</summary><p v-for="item in group.events" :key="item.id">{{ formatDatedTime(Date.parse(item.signal_at)/1000) }} · {{ item.payload?.message ?? `Stufe ${item.stage}` }}</p></details>
    <p v-if="!group.entries.length">Kein ausführbarer Entry gespeichert.</p>
    <div v-for="event in group.entries" :key="event.payload.entry.id" class="entry">
      <strong>{{ entryCategorySizeLabel(event.payload.entry) }}</strong>
      <p>{{ formatDatedTime(event.payload.entry.recognizedAt) }} · {{ fmtPrice(event.payload.entry.price,pricePrecisionForInstrument(group.instrument)) }} · Europe/Berlin</p>
      <p v-if="entryOptionalConditionLabel(event.payload.entry)">{{ entryOptionalConditionLabel(event.payload.entry) }}</p>
      <p class="id">Entry {{ event.payload.entry.id }}</p>
      <p>Erkannt: {{ formatDatedTime(Date.parse(event.detected_at)/1000) }}</p>
      <p v-for="variant in event.payload.variants ?? []" :key="variant.variant">{{ variant.variant==='wide'?'Weiter SL':'Enger SL' }} · {{ entryLotsLabel(variant) }} · {{ entryBudgetLabel(variant) }}</p>
      <p v-if="event.missed_reason">{{ event.missed_reason }}</p>
      <p>SL-Ergebnisse und Nettoergebnis nicht gespeichert.</p>
      <RouterLink :to="liveEntryLink(event)" target="_blank" rel="noopener noreferrer">Gespeicherten Entry und Archivchart öffnen</RouterLink>
    </div>
  </article>
</section>
</template>
<style scoped>
.note{color:#b1b7c5;font-size:13px;line-height:1.6}h2{font-size:18px}h3{font-size:15px}article{background:#171c28;border:1px solid #434651;padding:16px;margin:12px 0;border-radius:6px}.entry{border-top:1px solid #434651;padding:14px 0;font-size:13px}.id{overflow-wrap:anywhere;color:#b1b7c5;font-size:12px}a{color:#91b8ff}button{background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:8px}a:focus-visible,button:focus-visible{outline:2px solid #91b8ff;outline-offset:3px}
</style>
