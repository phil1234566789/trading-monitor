<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {createSeriesMarkers,LineStyle} from 'lightweight-charts';
import {createPriceChart} from '../priceChartSetup.js';
import {OrderBlockPrimitive} from '../orderBlocks.js';
import {usePriceChartTradeSetupDrawing} from '../composables/usePriceChartTradeSetupDrawing.js';
import {fetchInitialCandles} from '../forexCandles.js';
import {supabase} from '../supabaseClient.js';
import {fetchPinContext,updatePinNote} from '../pinContext.js';
import {cssColor,cssColorScaled} from '../chartColors.js';
import {formatBerlinTime,formatDatedTime} from '../berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
import {sessions} from '../sessions.js';
import {loadTradeSetup11Context} from '../tradeSetup11ContextLoader.js';
import {isTs11Pin,ts11CaseFromPin,locateTs11Case,diagnoseTs11Case,ts11CaseWindow,TS11_LEADS,TS11_TAILS,ts11LeadOf,ts11TailOf} from '../tradeSetup11Debugger.js';
import PinTypeChips from './PinTypeChips.vue';
import ActionButton from './ui/ActionButton.vue';
import {renderLowerStructure} from '../structureOverlay.js';
import {barSecondsFor} from '../timeframes.js';
import {dobEntryM1Structure} from '../dobEntryM1Structure.js';

// Nur Ansicht/Diagnose: Fälle sind Philips Pins zu TS1.1, neue Pins erscheinen beim nächsten Laden ohne Codeänderung.
const route=useRoute(),router=useRouter();
const cases=shallowRef([]),pinId=ref(Number(route.query.pin)||null),error=ref(''),loading=ref(true);
const structure=ref(route.query.struktur==='1'),tf=ref(route.query.tf==='m1'?'m1':'m5'),lead=ref(ts11LeadOf(route.query.lead)),tail=ref(ts11TailOf(route.query.tail));
const current=computed(()=>cases.value.find(c=>c.id===pinId.value)??null);
const data=shallowRef(null),status=ref('');
const SETUP_COLUMNS='id, instrument, direction, source, detector_version, config_hash, input_set_id, fractal_price, fractal_pivot_time, ls_price, ls_pivot_time, ls_touched_time, ls_timeframe, ob_top, ob_bottom, ob_start_time, ob_fvg, created_at, invalidation, trade_setup_sweeps(price, pivot_time, touched_time, timeframe, is_primary)';

async function loadCases(){
 const pins=(await fetchPinContext()).filter(isTs11Pin).sort((a,b)=>b.id-a.id);
 const ids=[...new Set(pins.map(p=>p.tradeSetupId).filter(id=>id!=null))];
 let rows=[];
 if(ids.length){const {data:list,error:e}=await supabase.from('trade_setups').select(SETUP_COLUMNS).in('id',ids).limit(ids.length);if(e)throw e;rows=list;}
 const byId=new Map(rows.map(r=>[r.id,r]));
 cases.value=pins.map(p=>ts11CaseFromPin(p,byId));
 if(!cases.value.some(c=>c.id===pinId.value))pinId.value=cases.value[0]?.id??null;
}
const optionText=c=>`${c.code} · ${(c.instrument??'?').replace('USD','')} ${c.dir===1?'Short':c.dir===-1?'Long':'?'} · ${c.anchorTime?formatDatedTime(c.anchorTime):'–'} · ${(c.pin.note??'').slice(0,60)}`;

watch([pinId,tf,lead,tail,structure],([p,t,l,n,st])=>{
 const q={...route.query,sektion:'ts11',pin:p!=null?String(p):undefined,tf:t,lead:l,tail:n,struktur:st?'1':undefined};
 if(['pin','tf','lead','tail','struktur'].some(k=>route.query[k]!==q[k]))router.replace({query:q});
},{immediate:true});

// Ein Link auf einen anderen Pin bei offener Sektion montiert nicht neu.
watch(()=>route.query.pin,v=>{const id=Number(v);if(id&&cases.value.some(c=>c.id===id))pinId.value=id;});

let request=0;
watch([current,lead,tail],async([kase,l,n])=>{
 const mine=++request;data.value=null;status.value='';
 if(!kase||kase.error)return;
 try{
  const w=ts11CaseWindow(kase,l,n),symbol=kase.instrument;
  status.value='Lade Kerzen …';
  const [m5,m1]=await Promise.all([fetchInitialCandles(symbol,'5m',w.count['5m'],w.loadTo*1000),fetchInitialCandles(symbol,'1m',w.count['1m'],w.view.to*1000)]);
  if(mine!==request)return;
  const own=sessions.filter(s=>s.instrument===symbol),located=locateTs11Case(kase,m5,own);
  status.value='Lade TS1.1-Trendkontext …';
  const policy=await loadTradeSetup11Context({symbol,evaluatedAt:located.evaluatedAt});
  if(mine!==request)return;
  status.value='Prüfe Detektor …';
  await new Promise(resolve=>setTimeout(resolve));
  const diagnosis=diagnoseTs11Case(kase,m5,own,located,policy);
  if(mine!==request)return;
  data.value={kase,window:w,m5:m5.filter(c=>c.time>=w.view.from&&c.time<=w.view.to),m1:m1.filter(c=>c.time>=w.view.from),located,diagnosis};
  status.value='';
 }catch(e){if(mine===request){status.value='';error.value=e.message;}}
});

// Kommentar wie DOB-Entry M1, aber direkt an Philips Pin dieses Falls.
const note=ref(''),pinType=ref(null),noteEl=ref(null),inserted=ref(''),saving=ref(false),saveError=ref(''),saved=ref(false);
let insertedTimer=null,savedTimer=null;
watch(current,c=>{note.value=c?.pin.note??'';pinType.value=c?.pin.pinType??null;saveError.value='';},{immediate:true});
async function saveNote(){
 if(!current.value||saving.value)return;
 saving.value=true;saveError.value='';
 try{
  if(!await updatePinNote(current.value.id,note.value,pinType.value))throw new Error('Pin-Notiz konnte nicht gespeichert werden.');
  await loadCases();saved.value=true;clearTimeout(savedTimer);savedTimer=setTimeout(()=>{saved.value=false;},1600);
 }catch(e){saveError.value=e.message;}finally{saving.value=false;}
}

const chartEl=ref(null),drawing=usePriceChartTradeSetupDrawing();
let chart=null,series=null,markers=null,symbol=null,primitives=[],priceLines=[],structurePrimitives=[],structureMarkers=[];
function insertChartPoint(param){
 const el=noteEl.value;
 if(!el||!series||param.time==null||!param.point||!current.value)return;
 const price=series.coordinateToPrice(param.point.y);
 if(price==null)return;
 const text=`${formatBerlinTime(param.time)} @ ${fmtPrice(price,pricePrecisionForInstrument(current.value.instrument))}`;
 const a=el.selectionStart??note.value.length,b=el.selectionEnd??a;
 note.value=note.value.slice(0,a)+text+note.value.slice(b);
 nextTick(()=>{el.focus();el.setSelectionRange(a+text.length,a+text.length);});
 inserted.value=text;clearTimeout(insertedTimer);insertedTimer=setTimeout(()=>{inserted.value='';},1600);
}
// Chart einmal beim Mount anlegen: frisch erzeugt hat autoSize noch keine Breite, setVisibleRange liefe ins Leere.
function setInstrument(instrument){
 if(symbol===instrument)return;
 symbol=instrument;
 series.applyOptions({priceFormat:{type:'price',precision:pricePrecisionForInstrument(instrument),minMove:instrument==='XAUUSD'?0.01:0.00001}});
}
function draw(){
 if(!series||!data.value)return;
 const {kase,window:w,diagnosis,located}=data.value,candles=tf.value==='m1'?data.value.m1:data.value.m5;
 if(!candles.length)return;
 setInstrument(kase.instrument);
 series.setData(candles);
 primitives.forEach(p=>series.detachPrimitive(p));primitives=[];
 priceLines.forEach(l=>series.removePriceLine(l));priceLines=[];
 const label=diagnosis.setup?`TS1 ${kase.dir===1?'Short':'Long'} (live)`:kase.setup?`DB #${kase.setupId}`:null;
 const setup=diagnosis.setup??kase.setup;
 drawing.refresh(setup?[{...setup,label,setupNumber:null}]:[],{candles,showTradeSetups:true,showTradeSetupsShort:true,showTradeSetupsLong:true,
  showRScale:false,showPipScale:false,showLiquidityDebug:true,replayUntil:candles.at(-1).time,symbol:kase.instrument});
 // Ohne gefundenes Setup die gepinnte bzw. gesuchte OB zeigen, damit der Kandidatenvergleich einen Bezug hat.
 const ob=!setup?located.ob??kase.ob:null;
 if(ob){const p=new OrderBlockPrimitive({...ob,endTime:ob.startTime+1800,touched:true},{fillColor:cssColorScaled('dobConfirmed',.18),
  borderColor:cssColor('dobConfirmed'),textColor:cssColor('dobConfirmed'),borderWidth:1,label:'Pin-OB',forceLabel:true},candles);
  series.attachPrimitive(p);primitives.push(p);}
 if(kase.lsPrice!=null)priceLines.push(series.createPriceLine({price:kase.lsPrice,color:cssColor('liquiditySweepM5'),lineWidth:1,lineStyle:LineStyle.Dashed,title:'Pin-LS'}));
 for(const c of diagnosis.candidates.filter(c=>!c.inSetup))priceLines.push(series.createPriceLine({price:c.level.price,
  color:c.checks.every(x=>x.ok)?cssColor('tradeWin'):cssColor('tradeLoss'),lineWidth:1,lineStyle:LineStyle.Dotted,title:`LS ${c.level.price}`}));
 const sec=tf.value==='m1'?60:300,at=Math.floor((diagnosis.evaluatedAt-300)/sec)*sec;
 markers.setMarkers(at<=candles.at(-1).time?[{time:at,position:'aboveBar',shape:'arrowDown',color:cssColor('tradeConfirmation'),text:'TS1.1-Prüfung'}]:[]);
 // Achsen nach jedem Wechsel zurücksetzen, sonst bleibt eine verschobene Preisachse stehen.
 series.priceScale().applyOptions({autoScale:true});
 drawStructure();
 const range={from:w.view.from,to:w.view.to};chart.timeScale().setVisibleRange(range);
 // Statuszeile verschwindet im selben Tick: der Resize setzt das Fenster sonst rechtsbündig neu.
 requestAnimationFrame(()=>chart?.timeScale().setVisibleRange(range));
}
// Struktur wie in DOB-Entry M1 (dieselbe Berechnung); Anker = Fensterbeginn, also mindestens 24 h vor dem Fall.
function drawStructure(){
 if(!series)return;
 const bar=tf.value==='m1'?'1m':'5m',candles=data.value?(tf.value==='m1'?data.value.m1:data.value.m5):[],instrument=data.value?.kase.instrument;
 const result=structure.value&&candles.length?dobEntryM1Structure(candles,bar,data.value.window.view.from,instrument):null;
 renderLowerStructure(series,result,structurePrimitives,structureMarkers,candles,{symbol:instrument,replayUntil:candles.at(-1)?.time,
  show:!!result,debug:!!result,barSeconds:barSecondsFor(bar),timeframe:bar});
}
watch([data,tf],()=>nextTick(draw));
watch(structure,drawStructure);

onMounted(async()=>{
 ({chart,candleSeries:series}=createPriceChart(chartEl.value,'XAUUSD'));symbol='XAUUSD';
 chart.applyOptions({autoSize:true});chart.subscribeClick(insertChartPoint);markers=createSeriesMarkers(series,[]);drawing.create(series);
 try{await loadCases();}catch(e){error.value=e.message;}finally{loading.value=false;}});
onBeforeUnmount(()=>{clearTimeout(insertedTimer);clearTimeout(savedTimer);drawing.dispose();chart?.unsubscribeClick(insertChartPoint);chart?.remove();chart=series=null;});
const mark=ok=>ok?'✓':'✗';
</script>

<template>
 <div class="ts11">
  <div class="bar">
   <select v-model="pinId" aria-label="Fall"><option v-for="c in cases" :key="c.id" :value="c.id">{{ optionText(c) }}</option></select>
   <select v-model="lead" title="Vorlauf vor OB/Level"><option v-for="[k,t] in TS11_LEADS" :key="k" :value="k">Vorlauf {{ t }}</option></select>
   <select v-model="tail" title="Nachlauf ab OB/Level"><option v-for="[k,t] in TS11_TAILS" :key="k" :value="k">Nachlauf {{ t }}</option></select>
   <select v-model="tf" title="Chart-Zeitrahmen"><option value="m5">M5</option><option value="m1">M1</option></select>
   <label title="Marktstruktur-Analyse wie in DOB-Entry M1 (M5 P5/P2, M1 P5), Anker = Fensterbeginn"><input v-model="structure" type="checkbox"> Struktur</label>
   <span v-if="data" class="info">Ausgewertet {{ formatDatedTime(data.diagnosis.evaluatedAt) }} · <strong>{{ data.diagnosis.verdict }}</strong></span>
  </div>
  <p v-if="error" class="err" role="alert">{{ error }}</p>
  <p v-else-if="loading" role="status">Lade TS1.1-Pins …</p>
  <p v-else-if="!cases.length" role="status">Noch keine TS1.1-Pins.</p>
  <p v-else-if="current?.error" class="err" role="alert">{{ current.code }}: {{ current.error }}</p>
  <p v-else-if="status" role="status">{{ status }}</p>
  <div class="main">
   <div ref="chartEl" class="chart"></div>
   <aside v-if="current" class="panel">
    <p class="note"><strong>{{ current.code }}</strong> · {{ current.pin.kind }}<span v-if="current.setupId"> · Setup #{{ current.setupId }} ({{ current.detectorVersion ?? 'Version unbekannt' }})</span></p>
    <template v-if="data">
     <h4>Prüfschritte</h4>
     <ul class="checks"><li v-for="(s,i) in data.diagnosis.steps" :key="i" :class="{bad:!s.ok}">{{ mark(s.ok) }} {{ s.label }}<small v-if="s.detail"> · {{ s.detail }}</small></li></ul>
     <h4>LS-Kandidaten am OB</h4>
     <p v-if="!data.diagnosis.candidates.length" class="muted">Keine M5-Level im Sweep-Fenster.</p>
     <div v-for="c in data.diagnosis.candidates" :key="c.level.pivotTime+':'+c.level.price" class="cand">
      <strong>LS {{ c.level.price }}</strong> · Pivot {{ formatDatedTime(c.level.pivotTime) }}<span v-if="c.philip"> · Pin-LS</span><span v-if="c.inSetup"> · im Setup</span>
      <ul class="checks"><li v-for="x in c.checks" :key="x.label" :class="{bad:!x.ok}">{{ mark(x.ok) }} {{ x.label }}<small v-if="x.detail"> · {{ x.detail }}</small></li></ul>
     </div>
     <p class="muted">H1-LS prüft die Lupe nicht; der Chart nimmt H1-Level aus der Marktstruktur dazu.</p>
    </template>
   </aside>
  </div>
  <div v-if="current" class="comment">
   <PinTypeChips v-model="pinType" :disabled="saving" />
   <textarea ref="noteEl" v-model="note" rows="3" :class="{flash:inserted}" :disabled="saving" aria-label="Kommentar zum Pin"
    placeholder="Kommentar · Klick in den Chart fügt „HH:MM @ Preis“ ein · Ctrl+Enter speichert" @keydown.ctrl.enter.prevent="saveNote"></textarea>
   <div class="comment-actions">
    <ActionButton :disabled="saving" @click="saveNote">Pin speichern</ActionButton>
    <span v-if="inserted" class="inserted" role="status">„{{ inserted }}“ eingefügt</span><span v-if="saving" role="status">Speichert …</span>
    <span v-if="saved" class="inserted" role="status">Gespeichert</span><span v-if="saveError" class="err" role="alert">{{ saveError }}</span>
   </div>
  </div>
 </div>
</template>

<style scoped>
.ts11{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.bar select:first-child{max-width:520px}
.info{font-variant-numeric:tabular-nums}
.main{flex:1;display:flex;gap:8px;min-height:300px}
.chart{flex:1;min-width:0;cursor:crosshair}
/* lightweight-charts setzt den Cursor auf seinen eigenen Elementen; der Klick fügt Zeit/Preis ein, daher hier erzwingen. */
.chart :deep(*){cursor:crosshair !important}
.panel{width:420px;flex:none;overflow:auto;font-size:13px}
.panel h4{margin:10px 0 4px}
.note{white-space:pre-wrap}
.checks{list-style:none;margin:0;padding:0}
.checks li{padding:1px 0}
.checks li.bad{color:#ef9a9a}
.checks small{color:#9aa3b2}
.cand{border-top:1px solid #2a2e39;padding:6px 0}
.muted{color:#9aa3b2}
.err{color:#ef5350}
.comment{display:flex;flex-direction:column;gap:6px}
.comment textarea{width:100%;box-sizing:border-box;background:#131722;color:#d1d4dc;border:1px solid #626b7f;padding:8px;font:inherit;resize:vertical}
.comment textarea.flash{border-color:#91b8ff;box-shadow:0 0 0 2px rgba(145,184,255,.45);transition:box-shadow .2s}
.inserted{color:#91b8ff}
.comment-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
@media (max-width:900px){.main{flex-direction:column}.panel{width:auto}}
</style>
