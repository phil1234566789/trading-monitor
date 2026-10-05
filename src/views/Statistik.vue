<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabaseClient.js';
import { createSimulationRepository } from '../tradeSetupSimulationRepository.js';
import { useSimulationComparison } from '../composables/useSimulationComparison.js';
import { comparisonFilters } from '../simulationRunComparison.js';
import SimulationRunStatus from '../components/SimulationRunStatus.vue';
import SimulationComparisonFilters from '../components/SimulationComparisonFilters.vue';
import SimulationComparisonMetrics from '../components/SimulationComparisonMetrics.vue';
import SimulationRunQuality from '../components/SimulationRunQuality.vue';
import SimulationDrList from '../components/SimulationDrList.vue';
import SimulationPinMenu from '../components/SimulationPinMenu.vue';
import SimulationPinList from '../components/SimulationPinList.vue';
import { useSimulationPins } from '../composables/useSimulationPins.js';
import { cssColor } from '../chartColors.js';
const route=useRoute(),router=useRouter();
const filters=ref(comparisonFilters(route.query)),pins=ref([]);
const repository=createSimulationRepository(supabase);
const {runs,selectedRun,comparisonRun,current,previous,datasets,loading,error,dateError,refresh}=useSimulationComparison(repository,filters,pins);
const pinState=useSimulationPins(filters,selectedRun,computed(()=>datasets.value.get(filters.value.run)?.results ?? []),{repository,datasets,runs});
const pinListOpen=ref(false);
const listedPins=pinState.listedPins;
function showPins(){pinState.target.value=null;pinListOpen.value=true;}
watch(()=>filters.value.run,()=>{pinListOpen.value=false;});
watch([pinState.pins,pinState.associatedPins],([raw,associated])=>{pins.value=[...raw,...associated];},{immediate:true});
function refreshAll(){refresh();pinState.refresh();}
watch(()=>route.query,query=>{const next=comparisonFilters(query);if(JSON.stringify(next)!==JSON.stringify(filters.value))filters.value=next;});
watch(filters,value=>{const query=Object.fromEntries(Object.entries(value).filter(([,v])=>v));if(JSON.stringify(comparisonFilters(route.query))!==JSON.stringify(value))router.replace({path:'/statistik',query});},{deep:true});
const features=computed(()=>[...new Map([...datasets.value.values()].flatMap(d=>d.groups.flatMap(g=>g.features)).map(f=>[f.key,f])).values()]);
</script>
<template>
  <main class="statistics-page" :style="{'--pin-color':cssColor('pin'),'--positive':cssColor('candleUp'),'--negative':cssColor('candleDown'),'--reference':cssColor('fvgCandle'),'--worse':'#ff7043'}">
    <header><div><h1>Statistik</h1><p>Läufe vergleichen · DR- und Entry-Qualität prüfen</p></div><button type="button" :disabled="loading" @click="refreshAll">{{ loading?'Wird geladen…':'Aktualisieren' }}</button></header>
    <details class="simulation-rules"><summary>Simulationsannahmen</summary>
      <p>50.000 USD Referenzkonto · Basis-Preisrisikobudget 500 USD pro Entry. Die gespeicherte Entry Pattern-Version bestimmt die Größenregel. Ganze Standardlots, 50 % an T1 schließen, Reststop auf Entry, Rest bis T2 oder Break-even. Kein Compounding.</p>
      <p>5 USD Kommission je Standardlot für Entry und Exit zusammen, einmal auf das Eröffnungsvolumen. Kein Spread und keine Slippage. Weiter und enger SL sind alternative Szenarien.</p>
      <p>Netto-Winrate = Netto-Gewinne / eindeutig abgeschlossene, ausführbare Entries. Offen, uneindeutig und nicht ausführbar zählen nicht zum Nenner. Prozent ab 50 Fällen. PnL und R zeigen abgeschlossene Positionen; USD-Kommission wird bereits bei Entry angesetzt.</p>
      <p>Zeitraum filtert Entry-Zeiten in Europe/Berlin. DRs ohne Entry entfallen bei einem gesetzten Entry-Zeitraum. Ohne Datumsfilter bleiben sie in der DR-Auswertung.</p>
    </details>
    <SimulationRunStatus v-if="selectedRun" :run="selectedRun" />
    <SimulationComparisonFilters v-model="filters" :runs="runs" :features="features" />
    <div :aria-busy="loading">
      <p v-if="pinState.error.value" role="alert" class="error">{{ pinState.error.value }} <button @click="pinState.refresh">Pins erneut laden</button></p>
      <p v-else-if="pinState.loading.value" role="status" class="note">Pins werden geladen…</p>
      <p v-if="error || dateError" role="alert" class="error">{{ error || dateError }} <button v-if="error" @click="refresh">Erneut versuchen</button></p>
      <p v-else-if="loading" role="status" class="empty">Gespeicherte Läufe und Review-Belege werden geladen…</p>
      <p v-else-if="!runs.length" role="status" class="empty">Noch keine gespeicherten Simulationsläufe.</p>
      <p v-else-if="!selectedRun" role="alert" class="empty">Kein abgeschlossener Lauf verfügbar oder der verlinkte Lauf fehlt. Bitte einen Lauf wählen.</p>
      <p v-else-if="filters.compare && !comparisonRun" role="alert">Der Vergleichslauf ist nicht verfügbar. Bitte neu wählen.</p>
      <template v-else>
        <p v-if="filters.compare" class="note">Alt: {{ comparisonRun.configuration?.label ?? comparisonRun.id }} · Neu: {{ selectedRun.configuration?.label ?? selectedRun.id }}</p>
        <p v-if="!current.groups.length" role="status" class="empty">Keine DRs für diese Filterauswahl.</p>
        <SimulationComparisonMetrics :current="current.results" :previous="previous.results" :compare="!!filters.compare" />
        <SimulationRunQuality :current="current" :previous="previous" :compare="!!filters.compare" />
        <SimulationDrList :groups="current.groups" :results="current.results" :is-pinned="pinState.isPinned" :pin-note="pinState.pinNote" :pin-count="listedPins.length+pinState.unmatchedPins.value.length" @show-pins="showPins" @pin-menu="pinState.open" />
      </template>
    </div>
    <SimulationPinMenu :target="pinState.target.value" :saving="pinState.saving.value" :error="pinState.error.value" @close="pinState.target.value=null" @save="pinState.save" @remove="pinState.remove" @show-pins="showPins" />
    <SimulationPinList :open="pinListOpen" :pins="listedPins" :unmatched="pinState.unmatchedPins.value" :run-id="filters.run" :loading="pinState.loading.value" :saving="pinState.saving.value" :error="pinState.error.value" @close="pinListOpen=false" @remove="pinState.removeListed" @refresh="pinState.refresh" />
  </main>
</template>
<style scoped>
.statistics-page{padding:24px;color:#d1d4dc;max-width:1600px;width:100%;min-width:0;box-sizing:border-box;margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}h1{margin:0;font-size:20px;font-weight:600}header p,.note{font-size:13px;color:#b1b7c5}button{background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:8px 12px;border-radius:4px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.simulation-rules{background:#1e222d;border:1px solid #2a2e39;border-radius:4px;padding:16px;margin-bottom:20px;font-size:13px;line-height:1.6}.simulation-rules p{color:#b1b7c5}summary{cursor:pointer}.empty{padding:24px 12px;border:1px solid #434651;color:#b1b7c5;font-size:13px}.error{color:#ff8b91}:is(button,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:3px}@media(max-width:600px){.statistics-page{padding:12px}header{align-items:flex-start}}
</style>
