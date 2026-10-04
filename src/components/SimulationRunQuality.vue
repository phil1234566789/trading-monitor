<script setup>
import { computed } from 'vue';
import { comparisonTone } from '../simulationComparisonTone.js';
import { runFunnel,rangeEntryCrossTable,variantMetrics } from '../simulationRunComparison.js';
import { SIMULATION_OUTCOME_LABELS } from '../tradeSetupSimulationStatistics.js';
const props=defineProps({current:Object,previous:Object,compare:Boolean});
const stages={recognized:'Setups 1.0 erkannt*',confirmed:'Bestätigt',quality:{validated:'Validiert',disqualified:'Disqualifiziert'},invalidationBeforeT1:'Invalidierung vor T1',target1:'T1 vor Invalidierung',target2:'Davon T2 erreicht',withEntry:'DRs mit Entry',entries:'Entries'};
const runs=computed(()=>[...(props.compare?[{label:'Alt',data:props.previous}]:[]),{label:props.compare?'Neu':'Gewählter Lauf',data:props.current}].map(r=>({...r,funnel:runFunnel(r.data.groups,r.data.results)})));
const funnelTone=(run,key)=>!props.compare || !['target1','target2'].includes(key)?'':run.label==='Alt'?'reference':comparisonTone(run.funnel[key],runs.value[0].funnel[key]);
const outcomeCounts=(run,variant)=>variantMetrics(run.data.results,variant).counts;
const outcomeTone=(run,variant,key)=>!props.compare?'':run.label==='Alt'?'reference':comparisonTone(outcomeCounts(run,variant)[key],outcomeCounts(runs.value[0],variant)[key],!['t1Be','t2'].includes(key));
const outcomeHint=(run,variant,key)=>{
  const tone=outcomeTone(run,variant,key);
  return tone==='positive'?'↑ Besser als Alt':tone==='worse'?'↓ Schlechter als Alt':tone==='reference'?'Referenzlauf':'';
};
const crossColumns=['total','without','win','loss','pending'];
const crossTables=computed(()=>Object.fromEntries(runs.value.map(run=>[run.label,Object.fromEntries(['wide','narrow'].map(variant=>[variant,rangeEntryCrossTable(run.data.groups,run.data.results,variant)]))])));
const crossTone=(run,variant,row,column)=>{
  if(!props.compare)return '';
  if(run.label==='Alt')return 'reference';
  const old=crossTables.value.Alt[variant].find(item=>item.key===row.key);
  if(column==='total'){
    if(!['t2','t1Only','t1Unknown','invalidation'].includes(row.key))return '';
    return comparisonTone(row[column],old?.[column],row.key==='invalidation');
  }
  if(column==='without' && !['t2','t1Only','t1Unknown'].includes(row.key))return '';
  return comparisonTone(row[column],old?.[column],column!=='win');
};
</script>
<template>
  <section class="run-quality"><h2>Entscheidungsbaum</h2>
    <div v-for="run in runs" :key="run.label"><h3>{{ run.label }}</h3><div class="funnel"><dl v-for="(label,key) in stages" :key="key" :class="{'split-node':key==='quality'}"><template v-if="key==='quality'"><div v-for="(halfLabel,halfKey) in label" :key="halfKey"><dt>{{ halfLabel }}</dt><dd>{{ run.funnel[halfKey] }}</dd></div></template><template v-else><dt>{{ label }}</dt><dd :class="funnelTone(run,key)">{{ run.funnel[key] }}<small v-if="funnelTone(run,key)==='positive'"> ↑</small><small v-else-if="funnelTone(run,key)==='worse'"> ↓</small></dd></template></dl></div>
      <p v-for="variant in ['wide','narrow']" :key="variant" class="outcomes"><strong>Ausgang der Entries · {{ variant==='wide'?'weiter':'enger' }} SL:</strong> <span v-for="(label,key) in SIMULATION_OUTCOME_LABELS" :key="key">{{ label }}: <b :class="outcomeTone(run,variant,key)" :title="outcomeHint(run,variant,key)">{{ outcomeCounts(run,variant)[key] }}<template v-if="outcomeTone(run,variant,key)==='positive'"> ↑</template><template v-else-if="outcomeTone(run,variant,key)==='worse'"> ↓</template></b></span></p>
    </div>
    <p class="note">* Im gespeicherten Review belegte Ursprungs-Setups. Erkennungen ohne gespeicherten Snapshot sind nicht belegt. Alle Zahlen folgen derselben Filterauswahl.</p>
    <h2>DR gegen Entry</h2><p class="note">Nur validierte DRs. DR-Verlauf unabhängig vom Entry-Ergebnis, Gewinne und Verluste netto. Der gespeicherte Verlauf endet teils bei T1 oder beim Schließen aller Entries: späteres T2 ist dann nicht belegt.</p>
    <div v-for="run in runs" :key="`${run.label}-cross`"><h3>{{ run.label }}</h3>
      <div v-for="variant in ['wide','narrow']" :key="variant" class="table-scroll" tabindex="0" :aria-label="`DR gegen Entry · ${variant} horizontal scrollen`">
        <table><caption>{{ variant==='wide'?'Weiter SL':'Enger SL' }}</caption><thead><tr><th scope="col">DR-Verlauf</th><th scope="col">DRs gesamt</th><th scope="col">Ohne Entry</th><th scope="col">Mind. ein Gewinn</th><th scope="col">Nur Verluste</th><th scope="col">Offen / uneindeutig / unvollständig</th></tr></thead><tbody><tr v-for="row in crossTables[run.label][variant]" :key="row.key"><th scope="row">{{ row.label }}</th><td v-for="column in crossColumns" :key="column" :class="crossTone(run,variant,row,column)" :title="crossTone(run,variant,row,column)==='positive'?'Besser als Alt':crossTone(run,variant,row,column)==='worse'?'Schlechter als Alt':undefined">{{ row[column] }}<template v-if="crossTone(run,variant,row,column)==='positive'"> ↑</template><template v-else-if="crossTone(run,variant,row,column)==='worse'"> ↓</template></td></tr></tbody></table>
      </div>
    </div>
  </section>
</template>
<style scoped>
.run-quality{margin:24px 0}h2{font-size:18px}h3{font-size:14px}.funnel{display:flex;flex-wrap:wrap;gap:8px}.funnel dl{margin:0;display:flex;flex-direction:column;flex:1 1 110px;padding:12px;border:1px solid #434651;background:#1e222d;border-radius:4px}.funnel .split-node{flex:2 1 220px;flex-direction:row;gap:12px}.split-node>div{flex:1;display:flex;flex-direction:column}.split-node>div+div{border-left:1px solid #434651;padding-left:12px}.funnel dd{order:-1;margin:0;font-size:20px;font-variant-numeric:tabular-nums}.funnel dt{font-size:12px;color:#b1b7c5;margin-top:6px}.outcomes{font-size:12px;display:flex;flex-wrap:wrap;gap:8px 16px}.note{color:#b1b7c5;font-size:12px;line-height:1.6}.table-scroll{overflow-x:auto;max-width:100%;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}caption{text-align:left;margin-bottom:8px}th,td{padding:8px;border-bottom:1px solid #434651}th{text-align:left;font-weight:400}td{text-align:right;font-variant-numeric:tabular-nums}thead{background:#222a3a}.table-scroll:focus-visible{outline:2px solid #91b8ff}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
