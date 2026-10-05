<script setup>
import { computed } from 'vue';
import { comparisonTone } from '../simulationComparisonTone.js';
// Statusfarben bleiben semantisch stabil, auch bei individuell umgefärbten Chart-Linien.
import { DEFAULT_CHART_COLORS } from '../chartColors.js';
import { runFunnel,rangeEntryCrossTable,variantMetrics } from '../simulationRunComparison.js';
import { SIMULATION_OUTCOME_LABELS } from '../tradeSetupSimulationStatistics.js';
const props=defineProps({current:Object,previous:Object,compare:Boolean});
const stages={recognized:'Setups 1.0 erkannt*',confirmed:'Bestätigt',quality:{validated:'Validiert',disqualified:'Disqualifiziert'},target1:'T1 vor Invalidation',withEntry:'DRs mit Entry',entries:'Entries'};
const runs=computed(()=>[...(props.compare?[{label:'Alt',data:props.previous}]:[]),{label:props.compare?'Neu':'Gewählter Lauf',data:props.current}].map(r=>({...r,funnel:runFunnel(r.data.groups,r.data.results)})));
const funnelTone=(run,key)=>!props.compare || !['target1','target2'].includes(key)?'':run.label==='Alt'?'reference':comparisonTone(run.funnel[key],runs.value[0].funnel[key]);
const outcomeCounts=(run,variant)=>variantMetrics(run.data.results,variant).counts;
const outcomeTone=(run,variant,key)=>!props.compare?'':run.label==='Alt'?'reference':comparisonTone(outcomeCounts(run,variant)[key],outcomeCounts(runs.value[0],variant)[key],!['t1Be','t2'].includes(key));
const outcomeHint=(run,variant,key)=>{
  const tone=outcomeTone(run,variant,key);
  return tone==='positive'?'↑ Besser als Alt':tone==='worse'?'↓ Schlechter als Alt':tone==='reference'?'Referenzlauf':'';
};
const entryBranches={win:'Mind. ein Gewinn',loss:'Nur Verluste',pending:'Offen / uneindeutig / unvollständig'};
const crossTables=computed(()=>Object.fromEntries(runs.value.map(run=>[run.label,Object.fromEntries(['wide','narrow'].map(variant=>[variant,rangeEntryCrossTable(run.data.groups,run.data.results,variant)]))])));
const crossTone=(run,variant,row,column)=>{
  if(!props.compare)return '';
  if(run.label==='Alt')return 'reference';
  const old=crossTables.value.Alt[variant].find(item=>item.key===row.key);
  if(column==='total'){
    if(!['t2','t1Only','t1Open','noTarget2','invalidation'].includes(row.key))return '';
    return comparisonTone(row[column],old?.[column],row.key==='invalidation');
  }
  if(column==='without' && !['t2','t1Only','t1Open','noTarget2'].includes(row.key))return '';
  return comparisonTone(row[column],old?.[column],column!=='win');
};
</script>
<template>
  <section class="run-quality"><h2>Entscheidungsbaum</h2>
    <div v-for="run in runs" :key="run.label"><h3>{{ run.label }}</h3><div class="funnel"><dl v-for="(label,key) in stages" :key="key" :class="{'split-node':key==='quality'}"><template v-if="key==='quality'"><div v-for="(halfLabel,halfKey) in label" :key="halfKey"><dt>{{ halfLabel }}</dt><dd>{{ run.funnel[halfKey] }}</dd></div></template><template v-else><dt>{{ label }}</dt><dd :class="funnelTone(run,key)">{{ run.funnel[key] }}<small v-if="funnelTone(run,key)==='positive'"> ↑</small><small v-else-if="funnelTone(run,key)==='worse'"> ↓</small></dd></template></dl></div>
      <p class="note">T2-Quote: {{ run.funnel.target2Eligible ? (100 * run.funnel.target2 / run.funnel.target2Eligible).toFixed(1) + ' %' : 'nicht belegt' }} ({{ run.funnel.target2 }} / {{ run.funnel.target2Eligible }} validierte DRs mit belegtem T2-Ziel). DR-Ausgang nicht belegt: {{ run.funnel.target2Unknown }}.</p>
      <h4>Preisverlauf validierter DRs → Entry-Ergebnis</h4>
      <div class="range-branches">
        <article v-for="row in crossTables[run.label].wide" :key="row.key" class="range-branch" :class="`outcome-${row.key}`" :aria-label="`${run.label} · ${row.label}`">
          <h5><b :class="crossTone(run,'wide',row,'total')">{{ row.total }}</b>{{ row.label }}</h5>
          <p class="without-entry">Ohne Entry <b :class="crossTone(run,'wide',row,'without')">{{ row.without }}</b></p>
          <div class="stop-branches">
            <section v-for="(entryRow,variant) in {wide:row,narrow:crossTables[run.label].narrow.find(r=>r.key===row.key)}" :key="variant" :aria-label="variant==='wide'?'Weiter SL':'Enger SL'">
              <h6>{{ variant==='wide'?'Weiter SL':'Enger SL' }}</h6>
              <dl><div v-for="(label,column) in entryBranches" :key="column"><dt>{{ label }}</dt><dd :class="crossTone(run,variant,entryRow,column)">{{ entryRow[column] }}</dd></div></dl>
            </section>
          </div>
        </article>
      </div>
      <p v-for="variant in ['wide','narrow']" :key="variant" class="outcomes"><strong>Ausgang der Entries · {{ variant==='wide'?'weiter':'enger' }} SL:</strong> <span v-for="(label,key) in SIMULATION_OUTCOME_LABELS" :key="key">{{ label }}: <b :class="outcomeTone(run,variant,key)" :title="outcomeHint(run,variant,key)">{{ outcomeCounts(run,variant)[key] }}<template v-if="outcomeTone(run,variant,key)==='positive'"> ↑</template><template v-else-if="outcomeTone(run,variant,key)==='worse'"> ↓</template></b></span></p>
    </div>
    <p class="note">* Im gespeicherten Review belegte Ursprungs-Setups. Erkennungen ohne gespeicherten Snapshot sind nicht belegt. Alle Zahlen folgen derselben Filterauswahl.</p>
    <p class="note">DR-Verlauf unabhängig vom Entry-Ergebnis, Gewinne und Verluste netto. Jeder SL-Zweig teilt die DRs mit Entry auf; „Ohne Entry“ gilt für beide Varianten. M5-Preisbeobachtung ab Validierung bis T2 oder Rückkehr zur Invalidierung. Alte Läufe ohne Preisbeobachtung bleiben nicht belegt.</p>
  </section>
</template>
<style scoped>
.range-branch.outcome-t2{--range-accent:v-bind('DEFAULT_CHART_COLORS.candleUp.hex')}.range-branch.outcome-t1Only{--range-accent:color-mix(in srgb,v-bind('DEFAULT_CHART_COLORS.liquidityLowM5.hex') 40%,v-bind('DEFAULT_CHART_COLORS.candleUp.hex'))}.range-branch.outcome-invalidation{--range-accent:v-bind('DEFAULT_CHART_COLORS.tradeInvalidation.hex')}
.range-branch:is(.outcome-t2,.outcome-t1Only,.outcome-invalidation){order:0;background:color-mix(in srgb,var(--range-accent) 9%,#1e222d);border-color:color-mix(in srgb,var(--range-accent) 35%,#434651);border-top-color:color-mix(in srgb,var(--range-accent) 55%,#434651)}
.range-branch.outcome-invalidation{order:-3}.range-branch.outcome-t1Only{order:-2}.range-branch.outcome-t2{order:-1}
.range-branch:not(.outcome-t2,.outcome-t1Only,.outcome-invalidation){order:1;border-color:#303640;background:#191e28}.range-branch:not(.outcome-t2,.outcome-t1Only,.outcome-invalidation) h5{color:#a6adbc}.range-branch:not(.outcome-t2,.outcome-t1Only,.outcome-invalidation) h5 b{font-size:18px}
.range-branches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0 20px}.range-branch{border:1px solid #434651;border-top:3px solid #434651;border-radius:4px;background:#1e222d;padding:12px;min-width:0}h4{font-size:13px;font-weight:400;color:#b1b7c5;margin:20px 0 8px}.range-branch h5{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:400;margin:0;min-height:42px}.range-branch h5 b{font-size:24px;font-variant-numeric:tabular-nums}.without-entry{display:flex;justify-content:space-between;font-size:12px;border-bottom:1px solid #434651;padding-bottom:10px}.stop-branches{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stop-branches section+section{border-left:1px solid #434651;padding-left:12px}.stop-branches h6{font-size:12px;margin:0 0 10px}.stop-branches dl{margin:0}.stop-branches dl>div{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:8px 0}.stop-branches dt{font-size:11px;color:#b1b7c5;overflow-wrap:anywhere}.stop-branches dd{margin:0;font-size:14px;font-variant-numeric:tabular-nums}
.run-quality{margin:24px 0}h2{font-size:18px}h3{font-size:14px}.funnel{display:flex;flex-wrap:wrap;gap:8px}.funnel dl{margin:0;display:flex;flex-direction:column;flex:1 1 110px;padding:12px;border:1px solid #434651;background:#1e222d;border-radius:4px}.funnel .split-node{flex:2 1 220px;flex-direction:row;gap:12px}.split-node>div{flex:1;display:flex;flex-direction:column}.split-node>div+div{border-left:1px solid #434651;padding-left:12px}.funnel dd{order:-1;margin:0;font-size:20px;font-variant-numeric:tabular-nums}.funnel dt{font-size:12px;color:#b1b7c5;margin-top:6px}.outcomes{font-size:12px;display:flex;flex-wrap:wrap;gap:8px 16px}.note{color:#b1b7c5;font-size:12px;line-height:1.6}
@media(max-width:1000px){.range-branches{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.range-branches{grid-template-columns:minmax(0,1fr)}}
</style>

<style scoped src="../simulationComparisonColors.css"></style>
