<script setup>
import {computed,ref,watch} from 'vue';
import {supabase} from '../supabaseClient.js';
import {dobGuardrailsToRow,dobGuardrailReason} from '../dobGuardrails.js';
import {dobTotalStats,DOB_ZONE_AGE_BUCKETS} from '../dobTradeStatistics.js';
import {minutesToTimeInput,timeInputToMinutes} from '../chartTimeUtils.js';
import {berlinDateStrFor} from '../berlinTime.js';
import DobStatCell from './DobStatCell.vue';

// Sperr-Konfig je Instrument bearbeiten (Tabelle dob_guardrails). Erst „Speichern“ macht den Entwurf aktiv, damit Seite und Watcher
// dieselbe Konfig sehen. Darunter die Halbjahre je Sperrgruppe: Sperren aus denselben Daten schönen die Winrate, ein Effekt, der
// nur in einem Halbjahr trägt, ist eher Zufall.
const props=defineProps({instrument:String,config:Object,rows:Array,targets:Array,open:Boolean});
const emit=defineEmits(['saved','toggle']);
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const AGE_OPTIONS=[[null,'kein Mindestalter'],...DOB_ZONE_AGE_BUCKETS.slice(0,-1).map(([label,max])=>[max,`≥ ${label.split('–').at(-1).replace('< ','')}`])];
const clone=c=>({blockedEntryWindows:c.blockedEntryWindows.map(w=>[...w]),blockedMonths:[...c.blockedMonths],minZoneAgeSeconds:c.minZoneAgeSeconds});
const draft=ref(clone(props.config));
watch(()=>props.config,c=>{draft.value=clone(c);});
const dirty=computed(()=>JSON.stringify(draft.value)!==JSON.stringify(clone(props.config)));
const saving=ref(false),error=ref('');
function setWindow(i,side,value){const minutes=timeInputToMinutes(value);if(Number.isFinite(minutes))draft.value.blockedEntryWindows[i][side]=minutes;}
function toggleMonth(m){const list=draft.value.blockedMonths;draft.value.blockedMonths=list.includes(m)?list.filter(x=>x!==m):[...list,m].sort((a,b)=>a-b);}
async function save(){
 saving.value=true;error.value='';
 const {error:e}=await supabase.from('dob_guardrails').upsert({...dobGuardrailsToRow(props.instrument,draft.value),updated_at:new Date().toISOString()});
 saving.value=false;
 if(e){error.value=e.message;return;}
 emit('saved',clone(draft.value));
}

const REASONS={blockedMonth:'gesperrt: Monat',blockedZoneAge:'gesperrt: Zonenalter',blockedEntryHour:'gesperrt: Uhrzeit'};
const half=row=>Number(berlinDateStrFor(row.entry_time).slice(5,7))<=6?'h1':'h2';
// Erlaubt und je Sperrgrund getrennt, jeweils Jan–Jun / Jul–Dez, alle Routen, beide R-Ziele.
const robustness=computed(()=>{
 const groups=new Map([['allowed',[]],...Object.keys(REASONS).map(r=>[r,[]])]);
 for(const row of props.rows)groups.get(dobGuardrailReason(props.config,{entryTime:row.entry_time,zoneAgeSeconds:row.source_zone_age_seconds})??'allowed').push(row);
 return [...groups].filter(([key,list])=>key==='allowed'||list.length).map(([key,list])=>({key,label:REASONS[key]??'erlaubt',
  halves:['h1','h2'].map(h=>{const part=list.filter(r=>half(r)===h);return {n:part.length,targets:props.targets.map(t=>({...t,s:dobTotalStats(part,t.k)}))};})}));
});
</script>
<template>
  <details class="guardrails" :open="open" @toggle="emit('toggle',$event.target.open)">
    <summary><h2>Sperren ({{ instrument }})</h2> <span class="note">{{ config.blockedEntryWindows.length }} Zeitfenster · {{ config.blockedMonths.length }} Monate · Zonenalter {{ config.minZoneAgeSeconds==null?'egal':AGE_OPTIONS.find(o=>o[0]===config.minZoneAgeSeconds)?.[1] }}</span></summary>
    <div class="editor">
      <fieldset><legend>Gesperrte Entry-Zeit (Berlin, bis exklusiv)</legend>
        <div v-for="(w,i) in draft.blockedEntryWindows" :key="i" class="window">
          <input type="time" :value="minutesToTimeInput(w[0])" :aria-label="`Sperre ${i+1} von`" @change="setWindow(i,0,$event.target.value)"> –
          <input type="time" :value="minutesToTimeInput(w[1])" :aria-label="`Sperre ${i+1} bis`" @change="setWindow(i,1,$event.target.value)">
          <button type="button" :aria-label="`Sperre ${i+1} entfernen`" @click="draft.blockedEntryWindows.splice(i,1)">✕</button>
        </div>
        <button type="button" @click="draft.blockedEntryWindows.push([600,660])">+ Zeitfenster</button>
      </fieldset>
      <fieldset><legend>Gesperrte Monate (Entry, Berlin)</legend>
        <label v-for="(name,i) in MONTHS" :key="name"><input type="checkbox" :checked="draft.blockedMonths.includes(i+1)" @change="toggleMonth(i+1)"> {{ name }}</label>
      </fieldset>
      <fieldset><legend>Kraftquelle-Zone bis Retest</legend>
        <select v-model="draft.minZoneAgeSeconds"><option v-for="[value,label] in AGE_OPTIONS" :key="label" :value="value">{{ label }}</option></select>
        <p class="note">Trades ohne bekanntes Zonenalter (v0, ohne Retest) sperrt das nicht.</p>
      </fieldset>
      <div class="actions">
        <button type="button" :disabled="!dirty||saving" @click="save">{{ saving?'Speichert…':'Speichern' }}</button>
        <button type="button" :disabled="!dirty||saving" @click="draft=clone(config)">Verwerfen</button>
        <span v-if="dirty" class="note">Entwurf, noch nicht aktiv.</span><span v-if="error" role="alert" class="error">{{ error }}</span>
      </div>
    </div>
    <h3>Halbjahre zur aktiven Konfig</h3>
    <p class="note">Sperren aus denselben Daten schönen die Winrate. Trägt eine Sperrgruppe nur in einem Halbjahr, ist sie eher Zufall; kleine n sagen wenig.</p>
    <div class="scroll"><table>
      <thead><tr><th scope="col" rowspan="2">Gruppe</th><th v-for="h in ['Jan–Jun','Jul–Dez']" :key="h" scope="colgroup" :colspan="1+targets.length">{{ h }}</th></tr>
        <tr><template v-for="h in 2" :key="h"><th scope="col">n</th><th v-for="t in targets" :key="t.name" scope="col">{{ t.k }}R · Σ R</th></template></tr></thead>
      <tbody><tr v-for="g in robustness" :key="g.key"><th scope="row">{{ g.label }}</th>
        <template v-for="(part,h) in g.halves" :key="h"><td>{{ part.n }}</td><td v-for="t in part.targets" :key="t.name"><DobStatCell :stats="t.s" :k="t.k" /></td></template></tr></tbody>
    </table></div>
  </details>
</template>
<style scoped>
.guardrails{background:#1e222d;border:1px solid #2a2e39;border-radius:4px;padding:12px 16px;margin:16px 0}summary{cursor:pointer}summary h2{display:inline;font-size:15px;font-weight:600}h3{font-size:14px;margin:16px 0 4px}.note{font-size:13px;color:#b1b7c5}.editor{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}fieldset{border:1px solid #2a2e39;border-radius:4px;padding:8px 12px;font-size:13px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}legend{color:#b1b7c5}.window{display:flex;gap:6px;align-items:center}input[type=time],select,button{background:#131722;color:#d1d4dc;border:1px solid #434651;padding:4px 8px;border-radius:4px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.actions{display:flex;gap:8px;align-items:center;width:100%}.error{color:#ff8b91}.scroll{overflow-x:auto}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],thead th:first-child{text-align:left}:is(button,select,input,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
