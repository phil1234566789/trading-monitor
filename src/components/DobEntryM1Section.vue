<script setup>
import {computed,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue';
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
import SimulationPinMenu from './SimulationPinMenu.vue';
import {DOB_ENTRY_M1_RUN,DOB_ENTRY_M1_CASES,dobEntryM1Window,dobEntryM1Zones,dobEntryM1Display,dobEntryM1CaseOf} from '../dobEntryM1Cases.js';

// Nur Ansicht, keine Erkennung: Trade-Zeile aus dob_trade_setups, Kerzen live aus dem Archiv wie im Dashboard.
const route=useRoute(),router=useRouter();
const GROUPS=[['Losses',DOB_ENTRY_M1_CASES.filter(c=>c.kind==='loss')],['Wins (max R ≥ 5)',DOB_ENTRY_M1_CASES.filter(c=>c.kind==='win')]];
const tradeId=ref((dobEntryM1CaseOf(route.query.trade)??DOB_ENTRY_M1_CASES[0]).id);
const tf=ref(route.query.tf==='m5'?'m5':'m1');
const rows=shallowRef(new Map()),data=shallowRef(null),error=ref('');
const row=computed(()=>rows.value.get(tradeId.value)??null),current=computed(()=>dobEntryM1CaseOf(tradeId.value)),kind=computed(()=>current.value.kind);
// Kommentar/Pin wie auf /dob-statistik, laufübergreifend über denselben Pin-Schlüssel.
const {pinTarget,pinSaving,pinError,pinOf,openPin,savePin,removePin}=useDobTradePins(ref('XAUUSD'),computed(()=>[...rows.value.values()]));
const pinMark=c=>{const r=rows.value.get(c.id);return r&&pinOf(r)?' 📌':'';};
const chartEl=ref(null);
let chart=null,series=null,primitives=[];

async function loadRows(){
 const {data:list,error:e}=await supabase.from('dob_trade_setups').select('*').in('id',DOB_ENTRY_M1_CASES.map(c=>c.id)).limit(DOB_ENTRY_M1_CASES.length);
 if(e)throw e;
 rows.value=new Map(list.map(r=>[r.id,r]));
}
watch([tradeId,tf],([id,t])=>{const code=dobEntryM1CaseOf(id).code;if(route.query.trade!==code||route.query.tf!==t)router.replace({query:{...route.query,trade:code,tf:t}});},{immediate:true});
watch(row,async r=>{
 data.value=null;error.value='';
 if(!r)return;
 try{
  const w=dobEntryM1Window(r,kind.value),toMs=w.loadTo*1000;
  const [m1,m5]=await Promise.all([fetchInitialCandles(r.instrument,'1m',w.count['1m'],toMs),fetchInitialCandles(r.instrument,'5m',w.count['5m'],toMs)]);
  if(r!==row.value)return;
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
 chart.timeScale().setVisibleRange({from:view.from,to:view.to});
}
watch([data,tf],draw);

onMounted(async()=>{
 ({chart,candleSeries:series}=createPriceChart(chartEl.value,'XAUUSD'));
 chart.applyOptions({autoSize:true});
 try{await loadRows();}catch(e){error.value=e.message;}
});
onBeforeUnmount(()=>{chart?.remove();chart=series=null;});
const missingZones=computed(()=>data.value?.zones.filter(z=>!z.zone).map(z=>z.label)??[]);
</script>

<template>
 <div class="dob-entry-m1">
  <div class="bar">
   <select v-model="tradeId" aria-label="Trade"><optgroup v-for="[group,cases] in GROUPS" :key="group" :label="group">
    <option v-for="c in cases" :key="c.id" :value="c.id">{{ c.code }} · {{ c.label }}{{ pinMark(c) }}</option></optgroup></select>
   <select v-model="tf" title="Chart-Zeitrahmen"><option value="m1">M1</option><option value="m5">M5</option></select>
   <RouterLink v-if="row" :to="dobChartLink(row)">Im Chart öffnen</RouterLink>
   <button v-if="row" type="button" @click="openPin(row)">{{ pinOf(row) ? '⚑ Pin bearbeiten' : '⚑ Kommentar / Pin' }}</button>
   <span v-if="row" class="info"><strong>{{ current.code }}</strong> · {{ data?.targetLabel==='TP 5R' ? '5R erreicht '+formatDatedTime(data.row.exit_time)+' · ' : '' }}Entry {{ formatDatedTime(row.entry_time) }} @ {{ row.entry_price }} · SL {{ row.stop_price }} · Ausgang
    {{ row.exit_time ? formatDatedTime(row.exit_time) : 'offen' }} · max R {{ dobMaxRLabel(row.max_r) }} · SL getroffen {{ row.sl_hit ? 'ja' : 'nein' }}</span>
  </div>
  <p v-if="error" class="err" role="alert">{{ error }}</p>
  <p v-else-if="!data" role="status">Lade Trade und Kerzen …</p>
  <p v-else-if="missingZones.length" role="status">{{ missingZones.join(', ') }} im geladenen M5 nicht gefunden.</p>
  <p v-if="row&&pinOf(row)?.note" class="pin-note">📌 {{ pinOf(row).note }}</p>
  <p v-if="pinError&&!pinTarget" class="err" role="alert">{{ pinError }}</p>
  <div ref="chartEl" class="chart"></div>
  <SimulationPinMenu :target="pinTarget" :saving="pinSaving" :error="pinError" @close="pinTarget=null" @save="savePin" @remove="removePin" @show-pins="pinTarget=null;router.push({path:'/dob-statistik',query:{run:DOB_ENTRY_M1_RUN}})"/>
 </div>
</template>

<style scoped>
.dob-entry-m1{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.info{font-variant-numeric:tabular-nums}
.chart{flex:1;min-height:300px}
.err{color:#ef5350}
.pin-note{margin:0;white-space:pre-line}
</style>
