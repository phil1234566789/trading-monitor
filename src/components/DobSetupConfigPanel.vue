<script setup>
import {computed,ref,watch} from 'vue';
import {supabase} from '../supabaseClient.js';
import {dobGuardrailsToRow,dobGuardrailsFromRow,dobRowGuardrailReason,dobRuleActive,dobPartialText,dobEntryWindowOverlaps,dobSortEntryWindows,DOB_COUNTER_DOB_MODES,DOB_COUNTER_DOB_MODE_LABELS,DOB_COUNTER_CANDLES_MODES,DOB_COUNTER_CANDLES_MODE_LABELS,DOB_POI_MATCH_MODE_LABELS,dobRowConfigTpR} from '../dobGuardrails.js';
import {SL_ALGO_DEFAULT,SL_ALGO_V1,slAlgoText} from '../slAlgo.js';
import {dobIntradayWinrate} from '../dobIntraday.js';
import {DOB_LQ_MATCH_LEVELS} from '../dobLqSweepPoi.js';
import {dobFeaturesOf,dobFeature,dobPoiFeature,DOB_BREAKEVEN_AT_R_LEVELS} from '../dobTradeFeatures.js';
import {dobRowConfigScore,dobHasPartialData} from '../dobPartialProfit.js';
import {dobSignedR,dobPct,dobHasSwingStopVariant} from '../dobTradeStatistics.js';
import {dobTotalStats,DOB_ZONE_AGE_BUCKETS,DOB_HALVES,dobTradeHalf,dobTradesPerWeek,dobPerWeekText} from '../dobTradeStatistics.js';
import {DOB_MAX_R_STEPS} from '../dobMaxR.js';
import {minutesToTimeInput,timeInputToMinutes} from '../chartTimeUtils.js';
import DobStatCell from './DobStatCell.vue';
import {dobPoiTypeLabel} from '../dobPoiType.js';

// Setup-Konfiguration je Instrument und POI-Art bearbeiten (Tabelle dob_guardrails, Speichern trifft nur die eigene POI-Art). Der Entwurf wirkt sofort als Vorschau auf die Seite
// (update:draft); nur „Speichern“ schreibt ihn in die DB und damit in den Watcher. „Sperren anwenden“ ist ein reiner Ansichtsschalter.
// Darunter die Halbjahre je Sperrgruppe: Sperren aus denselben Daten schönen die Winrate, ein Effekt, der nur in einem Halbjahr trägt,
// ist eher Zufall.
const props=defineProps({instrument:String,poiType:String,config:Object,rows:Array,targets:Array,open:Boolean,apply:Boolean});
const emit=defineEmits(['saved','toggle','update:draft','update:apply']);
const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const AGE_OPTIONS=DOB_ZONE_AGE_BUCKETS.slice(0,-1).map(([label,max])=>[max,`≥ ${label.split('–').at(-1).replace('< ','')}`]);
const TP_OPTIONS=DOB_MAX_R_STEPS.filter(r=>r>=1);
// Über die DB-Form normalisieren, damit Entwurf und gespeicherter Stand dieselbe Gestalt haben (abgeleitete Sperrliste inklusive).
// Fenster nach Startzeit, solange sich keine überlappen (dobSortEntryWindows); gespeicherter und Entwurfsstand gleich sortiert, sonst wäre er „ungespeichert“.
const clone=c=>{const copy=JSON.parse(JSON.stringify(dobGuardrailsFromRow(dobGuardrailsToRow(props.instrument,c,props.poiType))));
 copy.entryWindows=dobSortEntryWindows(copy.entryWindows);return copy;};
const sortWindows=()=>{draft.value.entryWindows=dobSortEntryWindows(draft.value.entryWindows);};
function addWindow(){draft.value.entryWindows.push({from:600,to:660,action:'block',enabled:false});sortWindows();}
const overlaps=computed(()=>dobEntryWindowOverlaps(draft.value.entryWindows));
const span=w=>`${minutesToTimeInput(w.from)}–${minutesToTimeInput(w.to)}`;
const draft=ref(clone(props.config));
watch(()=>props.config,c=>{draft.value=clone(c);});
const dirty=computed(()=>JSON.stringify(clone(draft.value))!==JSON.stringify(clone(props.config)));
watch(draft,d=>emit('update:draft',clone(d)),{deep:true,immediate:true});
const saving=ref(false),error=ref('');
function setWindow(i,side,value){const minutes=timeInputToMinutes(value);if(Number.isFinite(minutes)){draft.value.entryWindows[i][side]=minutes;sortWindows();}}
function setAction(w,action){w.action=action;if(action==='tp'&&!Number.isFinite(w.tpR))w.tpR=draft.value.defaultTpR;if(action==='block')delete w.tpR;}
function setRuleActive(w,on){if(on)delete w.enabled;else w.enabled=false;}
// Mindestalter an/aus: aus setzt den wirksamen Wert auf null, der gemerkte Wert bleibt fürs Wiedereinschalten.
const zoneAgeOn=computed(()=>draft.value.minZoneAgeSeconds!=null);
function setZoneAgeOn(on){const d=draft.value;d.minZoneAgeSavedSeconds??=AGE_OPTIONS[0][0];d.minZoneAgeSeconds=on?d.minZoneAgeSavedSeconds:null;}
function setZoneAge(value){const d=draft.value;d.minZoneAgeSavedSeconds=value;if(d.minZoneAgeSeconds!=null)d.minZoneAgeSeconds=value;}
function toggleMonth(m){const list=draft.value.blockedMonths;draft.value.blockedMonths=list.includes(m)?list.filter(x=>x!==m):[...list,m].sort((a,b)=>a-b);}
async function save(){
 saving.value=true;error.value='';
 const {error:e}=await supabase.from('dob_guardrails').upsert({...dobGuardrailsToRow(props.instrument,draft.value,props.poiType),updated_at:new Date().toISOString()});
 saving.value=false;
 if(e){error.value=e.message;return;}
 emit('saved',clone(draft.value));
}

const REASONS={blockedMonth:'gesperrt: Monat',blockedZoneAge:'gesperrt: Zonenalter',blockedEntryHour:'gesperrt: Uhrzeit',counterDob:'gesperrt: Gegen-DOB',counterCandles:'gesperrt: Gegenkerzen',poiMatch:'gesperrt: POI-Verbindung'};
const configTp=row=>dobRowConfigScore(draft.value,row);
// Erlaubt und je Sperrgrund getrennt, jeweils Jan–Jun / Jul–Dez, alle Routen, feste Ziele und TP nach Konfig.
const robustness=computed(()=>{
 const groups=new Map([['allowed',[]],...Object.keys(REASONS).map(r=>[r,[]])]);
 for(const row of props.rows)groups.get(dobRowGuardrailReason(draft.value,row)??'allowed').push(row);
 return [...groups].filter(([key,list])=>key==='allowed'||list.length).map(([key,list])=>({key,label:REASONS[key]??'erlaubt',
  halves:DOB_HALVES.map(h=>{const part=list.filter(r=>dobTradeHalf(r)===h);
   return {n:part.length,perWeek:dobTradesPerWeek(part),config:dobTotalStats(part,configTp),targets:props.targets.map(t=>({...t,s:dobTotalStats(part,t.k)}))};})}));
});
// Was eine Regel allein bringt: ΣR nach Konfig (erlaubte Trades, TP je Fenster) mit gegen ohne diese Regel; bei abgeschalteten Regeln
// „mit eingeschaltet“ gegen den aktuellen Stand. Alle Routen, alle Trades des Jahres.
const configSumR=cfg=>dobTotalStats(props.rows.filter(r=>!dobRowGuardrailReason(cfg,r)),r=>dobRowConfigScore(cfg,r)).sumR;
// Gegen-DOB-Status gibt es nur im v3-Lauf; in älteren Läufen bleibt der Schalter ohne Wirkung und wird ausgeblendet.
const hasCounterDob=computed(()=>props.rows.some(r=>r.counter_dob_status!=null));
const modeImpacts=computed(()=>Object.fromEntries(DOB_COUNTER_DOB_MODES.map(m=>[m,configSumR({...draft.value,counterDobMode:m})])));
// Gegenkerzen-Merkmal (features) gibt es erst ab dem v3-Fill mit features; ältere Läufe blenden den Schalter aus.
const hasCounterCandles=computed(()=>props.rows.some(r=>dobFeature(dobFeaturesOf(r),'counterCandles3')!=null));
// POI-Verbindung (nur LQ-Sweep-Läufe, features.poi_match): welche Stufe TS1.1 ↔ DOB noch zählt.
const hasPoiMatch=computed(()=>props.rows.some(r=>dobPoiFeature(dobFeaturesOf(r),'match')!=null));
const matchImpacts=computed(()=>Object.fromEntries(DOB_LQ_MATCH_LEVELS.map(m=>[m,configSumR({...draft.value,poiMatchMode:m})])));
// SL-Algo: Methodenwahl nur in Läufen mit swing_*-Spalten (HTF-OB ab dem Fill mit SL-Algo 1.0). Bewertet wird nach Winrate
// (TPs noch unkoordiniert), daneben die Winrate nur mit Intraday-Wins (src/dobIntraday.js).
const SL_ALGOS=[SL_ALGO_DEFAULT,SL_ALGO_V1];
const hasSwingStop=computed(()=>props.rows.some(dobHasSwingStopVariant));
const slAlgoImpacts=computed(()=>SL_ALGOS.map(slAlgo=>{const cfg={...draft.value,slAlgo},rows=props.rows.filter(r=>!dobRowGuardrailReason(cfg,r));
 return {...dobTotalStats(rows,r=>dobRowConfigScore(cfg,r)),intraday:dobIntradayWinrate(rows,cfg,r=>dobRowConfigTpR(cfg,r)).winrate};}));
const candleImpacts=computed(()=>Object.fromEntries(DOB_COUNTER_CANDLES_MODES.map(m=>[m,configSumR({...draft.value,counterCandlesMode:m})])));
// Teilprofit: nur Stufen, deren Rest-Verlauf (SL auf Entry) der Lauf gespeichert hat; ohne SL-auf-Entry reicht max_r für jede Stufe.
const partialLevels=computed(()=>DOB_BREAKEVEN_AT_R_LEVELS.filter(r=>dobHasPartialData(props.rows,r)));
const partialOptions=computed(()=>[null,...partialLevels.value]);
const partialImpacts=computed(()=>partialOptions.value.map(atR=>configSumR({...draft.value,partialAtR:atR})));
const ruleImpacts=computed(()=>{
 const current=configSumR(draft.value);
 return draft.value.entryWindows.map((w,i)=>{
  const toggled={...draft.value,entryWindows:draft.value.entryWindows.map((x,j)=>j===i?{...x,enabled:!dobRuleActive(x)}:x)};
  const other=configSumR(toggled);
  return dobRuleActive(w)?current-other:other-current;
 });
});
</script>
<template>
  <details class="setup-config" :open="open" @toggle="emit('toggle',$event.target.open)">
    <summary><h2>Setup-Konfiguration ({{ instrument }}) · {{ dobPoiTypeLabel(poiType) }}</h2>
      <label class="apply" @click.stop><input type="checkbox" :checked="apply" @change="emit('update:apply',$event.target.checked)"> Sperren anwenden (nur Ansicht)</label>
      <span v-if="dirty" class="unsaved">nicht gespeichert</span></summary>
    <div class="editor">
      <fieldset class="windows"><legend>Entry-Zeitfenster (Berlin, bis exklusiv, erstes passendes gilt)</legend>
        <div v-for="(w,i) in draft.entryWindows" :key="i" class="window" :class="{off:!dobRuleActive(w)}">
          <input type="checkbox" :checked="dobRuleActive(w)" :aria-label="`Fenster ${w.label??i+1} an`" title="Regel an/aus, Werte bleiben" @change="setRuleActive(w,$event.target.checked)">
          <span v-if="w.label" class="window-label">{{ w.label }}</span>
          <input type="time" :value="minutesToTimeInput(w.from)" :aria-label="`Fenster ${i+1} von`" @change="setWindow(i,'from',$event.target.value)"> –
          <input type="time" :value="minutesToTimeInput(w.to)" :aria-label="`Fenster ${i+1} bis`" @change="setWindow(i,'to',$event.target.value)">
          <select :value="w.action" :aria-label="`Fenster ${i+1} Regel`" @change="setAction(w,$event.target.value)"><option value="block">Sperre</option><option value="tp">TP</option></select>
          <select v-if="w.action==='tp'" v-model.number="w.tpR" :aria-label="`Fenster ${i+1} TP`"><option v-for="r in TP_OPTIONS" :key="r" :value="r">{{ r.toLocaleString('de-DE') }}R</option></select>
          <button type="button" :aria-label="`Fenster ${i+1} entfernen`" @click="draft.entryWindows.splice(i,1)">✕</button>
          <span class="impact" :class="ruleImpacts[i]>0?'positive':ruleImpacts[i]<0?'negative':''" :title="dobRuleActive(w)?'ΣR nach Konfig mit gegen ohne diese Regel':'ΣR, wenn diese Regel eingeschaltet wäre'">{{ dobRuleActive(w)?'bringt':'brächte' }} {{ dobSignedR(ruleImpacts[i]) }} R</span>
          <span v-if="overlaps[i].length" class="overlap" role="note">überlappt mit {{ overlaps[i].map(j=>span(draft.entryWindows[j])).join(', ') }} · das obere Fenster gilt, deshalb nicht nach Zeit sortiert</span>
        </div>
        <button type="button" @click="addWindow">+ Zeitfenster</button>
        <label>sonst TP <select v-model.number="draft.defaultTpR" aria-label="Default-TP"><option v-for="r in TP_OPTIONS" :key="r" :value="r">{{ r.toLocaleString('de-DE') }}R</option></select></label>
      </fieldset>
      <fieldset><legend>Gesperrte Monate (Entry, Berlin)</legend>
        <label v-for="(name,i) in MONTHS" :key="name"><input type="checkbox" :checked="draft.blockedMonths.includes(i+1)" @change="toggleMonth(i+1)"> {{ name }}</label>
      </fieldset>
      <fieldset><legend>POI-Zone bis Retest</legend>
        <label><input type="checkbox" :checked="zoneAgeOn" @change="setZoneAgeOn($event.target.checked)"> Mindestalter</label>
        <select :value="draft.minZoneAgeSavedSeconds??AGE_OPTIONS[0][0]" :disabled="!zoneAgeOn" aria-label="Mindestalter" @change="setZoneAge(Number($event.target.value))"><option v-for="[value,label] in AGE_OPTIONS" :key="label" :value="value">{{ label }}</option></select>
        <p class="note">Trades ohne bekanntes Zonenalter (v0, ohne Retest) sperrt das nicht.</p>
      </fieldset>
      <fieldset v-if="hasCounterDob"><legend>Gegen-DOB seit POI-Retest</legend>
        <label v-for="m in DOB_COUNTER_DOB_MODES" :key="m"><input type="radio" name="counterDobMode" :value="m" v-model="draft.counterDobMode"> {{ DOB_COUNTER_DOB_MODE_LABELS[m] }}
          <span class="impact" title="ΣR nach Konfig mit diesem Modus">{{ dobSignedR(modeImpacts[m]) }} R</span></label>
      </fieldset>
      <fieldset v-if="hasCounterCandles"><legend>Gegenkerzen vor Entry (letzte geschlossene M5)</legend>
        <label v-for="m in DOB_COUNTER_CANDLES_MODES" :key="m"><input type="radio" name="counterCandlesMode" :value="m" v-model="draft.counterCandlesMode"> {{ DOB_COUNTER_CANDLES_MODE_LABELS[m] }}
          <span class="impact" title="ΣR nach Konfig mit dieser Stellung">{{ dobSignedR(candleImpacts[m]) }} R</span></label>
      </fieldset>
      <fieldset v-if="partialLevels.length"><legend>Teilprofit (Rest bis zum Konfig-TP; TP ≤ Stufe: alles beim TP)</legend>
        <label v-for="(atR,i) in partialOptions" :key="String(atR)"><input type="radio" name="partialAtR" :value="atR" v-model="draft.partialAtR">
          {{ atR==null?'aus':dobPartialText({atR,pct:draft.partialPct,be:draft.partialBe}) }}
          <span class="impact" title="ΣR nach Konfig mit dieser Stellung">{{ dobSignedR(partialImpacts[i]) }} R</span></label>
        <label>Anteil <select v-model.number="draft.partialPct" aria-label="Teilprofit-Anteil"><option v-for="p in [25,33,50,70]" :key="p" :value="p">{{ p }} %</option></select></label>
        <label><input type="checkbox" v-model="draft.partialBe"> danach SL auf Entry</label>
      </fieldset>
      <fieldset v-if="hasPoiMatch"><legend>POI-Verbindung TS1.1 ↔ OB1/OB2</legend>
        <label v-for="m in DOB_LQ_MATCH_LEVELS" :key="m"><input type="radio" name="poiMatchMode" :value="m" v-model="draft.poiMatchMode"> {{ DOB_POI_MATCH_MODE_LABELS[m] }}
          <span class="impact" title="ΣR nach Konfig mit dieser Stellung">{{ dobSignedR(matchImpacts[m]) }} R</span></label>
      </fieldset>
      <fieldset v-if="hasSwingStop"><legend>SL-Algo (bei Anti-Confluence „breit“: FVG/OB gegen den Trade)</legend>
        <label v-for="(algo,i) in SL_ALGOS" :key="algo.method"><input type="radio" name="slAlgo" :checked="draft.slAlgo?.method===algo.method" @change="draft.slAlgo={...algo}"> {{ slAlgoText(algo) }}
          <span class="impact" title="Winrate, Winrate nur mit Wins bis NY-Close und ΣR nach Konfig mit dieser Methode">WR {{ dobPct(slAlgoImpacts[i].winrate) }} · intraday {{ dobPct(slAlgoImpacts[i].intraday) }} · {{ dobSignedR(slAlgoImpacts[i].sumR) }} R</span></label>
      </fieldset>
      <fieldset><legend>Telegram-Alarme</legend>
        <label><input type="checkbox" v-model="draft.alarmEnabled"> Alarme dieser POI-Art senden (aus = nur Protokoll)</label>
      </fieldset>
      <div class="actions">
        <button type="button" :disabled="!dirty||saving" @click="save">{{ saving?'Speichert…':'Speichern' }}</button>
        <button type="button" :disabled="!dirty||saving" @click="draft=clone(config)">Verwerfen</button>
        <span v-if="dirty" class="note">Entwurf wirkt nur als Vorschau auf dieser Seite, der Watcher nutzt den gespeicherten Stand.</span><span v-if="error" role="alert" class="error">{{ error }}</span>
      </div>
    </div>
    <h3>Halbjahre zur Konfig{{ dirty?' (Entwurf)':'' }}</h3>
    <p class="note">Sperren aus denselben Daten schönen die Winrate. Trägt eine Sperrgruppe nur in einem Halbjahr, ist sie eher Zufall; kleine n sagen wenig. „Konfig“ = TP aus der Regel des Entry-Fensters, sonst Default-TP.</p>
    <div class="scroll"><table>
      <thead><tr><th scope="col" rowspan="2">Gruppe</th><th v-for="h in ['Jan–Jun','Jul–Dez']" :key="h" scope="colgroup" :colspan="3+targets.length">{{ h }}</th></tr>
        <tr><template v-for="h in 2" :key="h"><th scope="col">n</th><th scope="col" title="Ø Trades je Kalenderwoche (erste bis letzte Woche mit Trades im Halbjahr, Berlin)">Ø/Wo</th><th scope="col">Konfig · Σ R</th><th v-for="t in targets" :key="t.name" scope="col">{{ t.k }}R · Σ R</th></template></tr></thead>
      <tbody><tr v-for="g in robustness" :key="g.key"><th scope="row">{{ g.label }}</th>
        <template v-for="(part,h) in g.halves" :key="h"><td>{{ part.n }}</td><td :title="`${part.perWeek.weeks} Kalenderwochen`">{{ dobPerWeekText(part.perWeek) }}</td><td class="config"><DobStatCell :stats="part.config" /></td><td v-for="t in part.targets" :key="t.name"><DobStatCell :stats="t.s" :k="t.k" /></td></template></tr></tbody>
    </table></div>
  </details>
</template>
<style scoped>
.setup-config{background:#1e222d;border:1px solid #2a2e39;border-radius:4px;padding:12px 16px;margin:16px 0}summary{cursor:pointer}summary h2{display:inline;font-size:15px;font-weight:600}h3{font-size:14px;margin:16px 0 4px}.note{font-size:13px;color:#b1b7c5}.editor{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}fieldset{border:1px solid #2a2e39;border-radius:4px;padding:8px 12px;font-size:13px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}fieldset.windows{flex-direction:column;align-items:flex-start}legend{color:#b1b7c5}.window{display:flex;gap:6px;align-items:center}.window.off>:not(input[type=checkbox]):not(.impact){opacity:.45}.impact{font-size:12px;margin-left:6px}.overlap{font-size:12px;color:#f5a623}.window-label{min-width:120px;color:#b1b7c5}.positive{color:var(--positive)}.negative{color:var(--negative)}input[type=time],select,button{background:#131722;color:#d1d4dc;border:1px solid #434651;padding:4px 8px;border-radius:4px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.apply{margin:0 12px;font-size:13px;color:#d1d4dc;cursor:pointer}.unsaved{margin-left:8px;padding:2px 8px;border-radius:10px;background:#f5a623;color:#131722;font-size:12px;font-weight:600}.actions{display:flex;gap:8px;align-items:center;width:100%}.error{color:#ff8b91}.scroll{overflow-x:auto}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],thead th:first-child{text-align:left}td.config{background:rgba(145,184,255,.08)}:is(button,select,input,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
