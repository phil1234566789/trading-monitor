<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {createPriceChart} from '../priceChartSetup.js';
import {OrderBlockPrimitive} from '../orderBlocks.js';
import {renderDobTrade} from '../dobTradeRendering.js';
import {fetchInitialCandles} from '../forexCandles.js';
import {supabase} from '../supabaseClient.js';
import {cssColor,cssColorScaled} from '../chartColors.js';
import {dobChartLink,dobMaxRLabel} from '../dobTradeStatistics.js';
import {formatDatedTime} from '../berlinTime.js';
import {useDobTradePins} from '../composables/useDobTradePins.js';
import PinTypeChips from './PinTypeChips.vue';
import {formatBerlinTime} from '../berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
import {renderLowerStructure} from '../structureOverlay.js';
import {barSecondsFor} from '../timeframes.js';
import {dobEntryM1Structure} from '../dobEntryM1Structure.js';
import {DOB_ENTRY_M1_RUN,DOB_ENTRY_M1_CASES,DOB_ENTRY_M1_LEADS,DOB_ENTRY_M1_TAILS,dobEntryM1TailOf,dobEntryM1Window,dobEntryM1Zones,dobEntryM1Display,dobEntryM1CaseOf,dobEntryM1LeadOf} from '../dobEntryM1Cases.js';

// Nur Ansicht, keine Erkennung: Trade-Zeile aus dob_trade_setups, Kerzen live aus dem Archiv wie im Dashboard.
const route=useRoute(),router=useRouter();
const GROUPS=[['Losses',DOB_ENTRY_M1_CASES.filter(c=>c.kind==='loss')],['Wins (max R ≥ 5)',DOB_ENTRY_M1_CASES.filter(c=>c.kind==='win')]];
const tradeId=ref((dobEntryM1CaseOf(route.query.trade)??DOB_ENTRY_M1_CASES[0]).id);
const tf=ref(route.query.tf==='m5'?'m5':'m1'),lead=ref(dobEntryM1LeadOf(route.query.lead)),tail=ref(dobEntryM1TailOf(route.query.tail)),structure=ref(route.query.struktur==='1');
const rows=shallowRef(new Map()),data=shallowRef(null),error=ref('');
const row=computed(()=>rows.value.get(tradeId.value)??null),current=computed(()=>dobEntryM1CaseOf(tradeId.value)),kind=computed(()=>current.value.kind);
// Kommentar/Pin wie auf /dob-statistik, laufübergreifend über denselben Pin-Schlüssel.
const {pinTarget,pinSaving,pinError,pinOf,openPin,savePin,removePin}=useDobTradePins(ref('XAUUSD'),computed(()=>[...rows.value.values()]));
// Kommentar ohne Modal (das Modal verdeckte den Chart, Philip liest beim Schreiben Preise/Zeiten ab): openPin hält das Ziel
// des aktuellen Falls offen; nach Speichern/Entfernen setzt useDobTradePins es zurück, die Pins laden neu und es öffnet sich wieder.
const note=ref(''),pinType=ref(null),noteEl=ref(null),inserted=ref('');
let insertedTimer=null;
watch(()=>row.value&&[row.value,pinOf(row.value)],v=>{if(v)openPin(v[0]);});
watch(pinTarget,t=>{if(t){note.value=t.note;pinType.value=t.pinType;}});
const saveNote=()=>{if(pinTarget.value&&!pinSaving.value)savePin(note.value,pinType.value);};
// Klick in den Chart: „HH:MM @ Preis“ (Berlin, Kerzenzeit) an der Cursorposition des Textfelds.
function insertChartPoint(param){
 const el=noteEl.value;
 if(!el||!series||param.time==null||!param.point)return;
 const price=series.coordinateToPrice(param.point.y);
 if(price==null)return;
 const text=`${formatBerlinTime(param.time)} @ ${fmtPrice(price,pricePrecisionForInstrument('XAUUSD'))}`;
 const a=el.selectionStart??note.value.length,b=el.selectionEnd??a;
 note.value=note.value.slice(0,a)+text+note.value.slice(b);
 nextTick(()=>{el.focus();el.setSelectionRange(a+text.length,a+text.length);});
 // Rückmeldung, weil der Klick sonst unbemerkt bleibt: Textfeld kurz hervorheben plus Hinweis mit dem eingefügten Text.
 inserted.value=text;clearTimeout(insertedTimer);insertedTimer=setTimeout(()=>{inserted.value='';},1600);
}
const pinMark=c=>{const r=rows.value.get(c.id);return r&&pinOf(r)?' 📌':'';};
const chartEl=ref(null);
let chart=null,series=null,primitives=[],structurePrimitives=[],structureMarkers=[];

async function loadRows(){
 const {data:list,error:e}=await supabase.from('dob_trade_setups').select('*').in('id',DOB_ENTRY_M1_CASES.map(c=>c.id)).limit(DOB_ENTRY_M1_CASES.length);
 if(e)throw e;
 rows.value=new Map(list.map(r=>[r.id,r]));
}
watch([tradeId,tf,lead,tail,structure],([id,t,l,n,s])=>{
 const q={...route.query,trade:dobEntryM1CaseOf(id).code,tf:t,lead:l,tail:n,struktur:s?'1':undefined};
 if(['trade','tf','lead','tail','struktur'].some(k=>route.query[k]!==q[k]))router.replace({query:q});
},{immediate:true});
watch([row,lead,tail],async([r,l,n])=>{
 data.value=null;error.value='';
 if(!r)return;
 try{
  const w=dobEntryM1Window(r,kind.value,l,n),toMs=w.loadTo*1000;
  const [m1,m5]=await Promise.all([fetchInitialCandles(r.instrument,'1m',w.count['1m'],toMs),fetchInitialCandles(r.instrument,'5m',w.count['5m'],toMs)]);
  if(r!==row.value||l!==lead.value||n!==tail.value)return;
  data.value={...dobEntryM1Display(r,kind.value,m1,w),m1,m5,zones:dobEntryM1Zones(r,m5,m1)};
 }catch(e){error.value=e.message;}
});

function draw(){
 if(!series||!data.value)return;
 const {row:r,m1,m5,view,zones,targetLabel}=data.value,candles=tf.value==='m1'?m1:m5;
 series.setData(candles);
 renderDobTrade(series,r,primitives,candles,tf.value==='m1'?'1m':'5m',targetLabel);
 const end=r.exit_time??candles.at(-1).time;
 for(const {label,zone} of zones){
  if(!zone)continue;
  const p=new OrderBlockPrimitive({...zone,endTime:end},{fillColor:cssColorScaled('dobConfirmed',.18),borderColor:cssColor('dobConfirmed'),
   textColor:cssColor('dobConfirmed'),borderWidth:1,label,forceLabel:true},candles);
  series.attachPrimitive(p);primitives.push(p);
 }
 drawStructure();
 chart.timeScale().setVisibleRange({from:view.from,to:view.to});
}
// Debug wie im Dashboard: Pivots mit Ereignis-Labels, Range und Trend je Ebene, auf die gerade angezeigten Kerzen.
function drawStructure(){
 if(!series)return;
 const bar=tf.value==='m1'?'1m':'5m',candles=data.value?(tf.value==='m1'?data.value.m1:data.value.m5):[];
 const result=structure.value&&candles.length?dobEntryM1Structure(candles,bar,data.value.view.from,'XAUUSD'):null;
 renderLowerStructure(series,result,structurePrimitives,structureMarkers,candles,{symbol:'XAUUSD',replayUntil:candles.at(-1)?.time,
  show:!!result,debug:!!result,barSeconds:barSecondsFor(bar),timeframe:bar});
}
watch([data,tf],draw);
watch(structure,drawStructure);

onMounted(async()=>{
 ({chart,candleSeries:series}=createPriceChart(chartEl.value,'XAUUSD'));
 chart.applyOptions({autoSize:true});
 chart.subscribeClick(insertChartPoint);
 try{await loadRows();}catch(e){error.value=e.message;}
});
onBeforeUnmount(()=>{clearTimeout(insertedTimer);chart?.unsubscribeClick(insertChartPoint);chart?.remove();chart=series=null;});
const missingZones=computed(()=>data.value?.zones.filter(z=>!z.zone).map(z=>z.label)??[]);
</script>

<template>
 <div class="dob-entry-m1">
  <div class="bar">
   <select v-model="tradeId" aria-label="Trade"><optgroup v-for="[group,cases] in GROUPS" :key="group" :label="group">
    <option v-for="c in cases" :key="c.id" :value="c.id">{{ c.code }} · {{ c.label }}{{ pinMark(c) }}</option></optgroup></select>
   <select v-model="lead" title="Vorlauf"><option v-for="[k,t] in DOB_ENTRY_M1_LEADS" :key="k" :value="k">Vorlauf {{ t }}</option></select>
   <select v-model="tail" title="Nachlauf ab Ausgang"><option v-for="[k,t] in DOB_ENTRY_M1_TAILS" :key="k" :value="k">Nachlauf {{ t }}</option></select>
   <select v-model="tf" title="Chart-Zeitrahmen"><option value="m1">M1</option><option value="m5">M5</option></select>
   <label title="Marktstruktur-Analyse (Debug wie im Dashboard) auf die angezeigten Kerzen, Anker = Fensterbeginn"><input v-model="structure" type="checkbox"> Struktur</label>
   <RouterLink v-if="row" :to="dobChartLink(row)">Im Chart öffnen</RouterLink>
   <span v-if="row" class="info"><strong>{{ current.code }}</strong> · {{ data?.targetLabel==='TP 5R' ? '5R erreicht '+formatDatedTime(data.row.exit_time)+' · ' : '' }}Entry {{ formatDatedTime(row.entry_time) }} @ {{ row.entry_price }} · SL {{ row.stop_price }} · Ausgang
    {{ row.exit_time ? formatDatedTime(row.exit_time) : 'offen' }} · max R {{ dobMaxRLabel(row.max_r) }} · SL getroffen {{ row.sl_hit ? 'ja' : 'nein' }}</span>
  </div>
  <p v-if="error" class="err" role="alert">{{ error }}</p>
  <p v-else-if="!data" role="status">Lade Trade und Kerzen …</p>
  <p v-else-if="missingZones.length" role="status">{{ missingZones.join(', ') }} im geladenen M5 nicht gefunden.</p>
  <div ref="chartEl" class="chart"></div>
  <div v-if="row" class="comment">
   <PinTypeChips v-model="pinType" :disabled="pinSaving||!pinTarget" />
   <textarea ref="noteEl" v-model="note" rows="3" :class="{flash:inserted}" :disabled="pinSaving||!pinTarget" aria-label="Kommentar zum Trade"
    placeholder="Kommentar · Klick in den Chart fügt „HH:MM @ Preis“ ein · Ctrl+Enter speichert" @keydown.ctrl.enter.prevent="saveNote"></textarea>
   <div class="comment-actions">
    <button type="button" :disabled="pinSaving||!pinTarget" @click="saveNote">{{ pinOf(row) ? 'Pin aktualisieren' : 'Pin speichern' }}</button>
    <button v-if="pinTarget?.existingId" type="button" :disabled="pinSaving" @click="removePin">Pin entfernen</button>
    <RouterLink :to="{path:'/dob-statistik',query:{run:DOB_ENTRY_M1_RUN}}">Alle Pins</RouterLink>
    <span v-if="inserted" class="inserted" role="status">„{{ inserted }}“ eingefügt</span><span v-if="pinSaving" role="status">Speichert …</span><span v-if="pinError" class="err" role="alert">{{ pinError }}</span>
   </div>
  </div>
 </div>
</template>

<style scoped>
.dob-entry-m1{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.info{font-variant-numeric:tabular-nums}
.chart{flex:1;min-height:300px;cursor:crosshair}
/* lightweight-charts setzt den Cursor auf seinen eigenen Elementen; der Klick fügt Zeit/Preis ein, daher hier erzwingen. */
.chart :deep(*){cursor:crosshair !important}
.err{color:#ef5350}
.comment{display:flex;flex-direction:column;gap:6px}
.comment textarea{width:100%;box-sizing:border-box;background:#131722;color:#d1d4dc;border:1px solid #626b7f;padding:8px;font:inherit;resize:vertical}
.comment textarea.flash{border-color:#91b8ff;box-shadow:0 0 0 2px rgba(145,184,255,.45);transition:box-shadow .2s}
.inserted{color:#91b8ff}
.comment-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
</style>
