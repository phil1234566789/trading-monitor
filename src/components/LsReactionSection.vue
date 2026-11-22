<script setup>
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef,toRaw,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {createSeriesMarkers,LineStyle} from 'lightweight-charts';
import {createPriceChart,priceFormatFor} from '../priceChartSetup.js';
import {OrderBlockPrimitive} from '../orderBlocks.js';
import {drawLsReactionLevels} from '../composables/usePriceChartLsReactionLevels.js';
import {usePriceChartTradeSetupDrawing} from '../composables/usePriceChartTradeSetupDrawing.js';
import {fetchInitialCandles} from '../forexCandles.js';
import {supabase} from '../supabaseClient.js';
import {fetchPinContext,updatePinNote} from '../pinContext.js';
import {cssColor,cssColorScaled} from '../chartColors.js';
import {formatBerlinTime,formatDatedTime} from '../berlinTime.js';
import {fmtPrice,pricePrecisionForInstrument} from '../format.js';
import {sessions} from '../sessions.js';
import {loadLsReactionContext} from '../lsReactionContextLoader.js';
import {isLsReactionPin,lsReactionCaseFromPin,locateLsReactionCase,lsReactionCaseWindow,LS_REACTION_LEADS,LS_REACTION_TAILS,lsReactionLeadOf,lsReactionTailOf,lsReactionChainAt,lsReactionChangeTimes} from '../lsReactionDebugger.js';
import {createM5StructureContextResolver} from '../m5StructureContext.js';
import {createCloseReactionCache} from '../m5CloseReactionHistory.js';
import {mergeCandles} from '../candleCache.js';
import PinTypeChips from './PinTypeChips.vue';
import DebuggerTimeBar from './DebuggerTimeBar.vue';
import {useDebuggerTime} from '../composables/useDebuggerTime.js';
import {lsReactionPoint,lsReactionPrice,lsReactionTrendText,lsReactionWhen} from '../lsReactionExplain.js';
import ActionButton from './ui/ActionButton.vue';
import ToggleButton from './ui/ToggleButton.vue';
import DateTimeInput from './ui/DateTimeInput.vue';
import {renderLowerStructure} from '../structureOverlay.js';
import {lsReactionStructureOverlay} from '../lsReactionStructureOverlay.js';
import {closedChecklistCandles} from '../tradeSetupChecklistTimeBasis.js';

// Nur Ansicht/Diagnose: Fälle sind Philips Pins zu LS-Reaktion, neue Pins erscheinen beim nächsten Laden ohne Codeänderung.
const route=useRoute(),router=useRouter();
const cases=shallowRef([]),pinId=ref(Number(route.query.pin)||null),error=ref(''),loading=ref(true);
const structure=ref(route.query.struktur==='1'),levels=ref(route.query.ebenen==='1'),tf=ref(route.query.tf==='m1'?'m1':'m5'),lead=ref(lsReactionLeadOf(route.query.lead)),tail=ref(lsReactionTailOf(route.query.tail));
// Manueller Strukturstart = Simulation nur für diese Ansicht; Live-LS-Reaktion bleibt beim D1-Anker.
const manualStart=ref(Number(route.query.start)||null);
const current=computed(()=>cases.value.find(c=>c.id===pinId.value)??null);
const data=shallowRef(null),status=ref('');
const SETUP_COLUMNS='id, instrument, direction, source, detector_version, config_hash, input_set_id, fractal_price, fractal_pivot_time, ls_price, ls_pivot_time, ls_touched_time, ls_timeframe, ob_top, ob_bottom, ob_start_time, ob_fvg, created_at, invalidation, trade_setup_sweeps(price, pivot_time, touched_time, timeframe, is_primary)';

async function loadCases(){
 const pins=(await fetchPinContext()).filter(isLsReactionPin).sort((a,b)=>b.id-a.id);
 const ids=[...new Set(pins.map(p=>p.tradeSetupId).filter(id=>id!=null))];
 let rows=[];
 if(ids.length){const {data:list,error:e}=await supabase.from('trade_setups').select(SETUP_COLUMNS).in('id',ids).limit(ids.length);if(e)throw e;rows=list;}
 const byId=new Map(rows.map(r=>[r.id,r]));
 cases.value=pins.map(p=>lsReactionCaseFromPin(p,byId));
 if(!cases.value.some(c=>c.id===pinId.value))pinId.value=cases.value[0]?.id??null;
}
const optionText=c=>`${c.code} · ${(c.instrument??'?').replace('USD','')} ${c.dir===1?'Short':c.dir===-1?'Long':'?'} · ${c.anchorTime?formatDatedTime(c.anchorTime):'–'} · ${(c.pin.note??'').slice(0,60)}`;

watch([pinId,tf,lead,tail,structure,manualStart,levels],([p,t,l,n,st,ms,lv])=>{
 const q={...route.query,sektion:'ts11',pin:p!=null?String(p):undefined,tf:t,lead:l,tail:n,struktur:st?'1':undefined,ebenen:lv?'1':undefined,start:ms!=null?String(ms):undefined};
 if(['pin','tf','lead','tail','struktur','ebenen','start'].some(k=>route.query[k]!==q[k]))router.replace({query:q});
},{immediate:true});

// Ein Link auf einen anderen Pin bei offener Sektion montiert nicht neu.
watch(()=>route.query.pin,v=>{const id=Number(v);if(id&&cases.value.some(c=>c.id===id))pinId.value=id;});

let request=0;
// Ein anderer Pin beginnt wieder mit dem echten D1-Anker.
watch(pinId,(p,old)=>{if(old!=null&&p!==old)manualStart.value=null;});
watch([current,lead,tail,manualStart],async([kase,l,n,structureStartTime])=>{
 const mine=++request;scanWorker?.terminate();scanWorker=null;data.value=null;status.value='';
 if(!kase||kase.error)return;
 try{
  const w=lsReactionCaseWindow(kase,l,n),symbol=kase.instrument;
  status.value='Lade Kerzen …';
  const [m5,m1]=await Promise.all([fetchInitialCandles(symbol,'5m',w.count['5m'],w.loadTo*1000),fetchInitialCandles(symbol,'1m',w.count['1m'],w.view.to*1000)]);
  if(mine!==request)return;
  const own=sessions.filter(s=>s.instrument===symbol),located=locateLsReactionCase(kase,m5,own);
  status.value='Lade LS-Reaktion-Trendkontext …';
  // Einmal bis Fensterende laden; diagnoseLsReactionCase schneidet je Zeitpunkt auf das damals Geschlossene.
  const policy=await loadLsReactionContext({symbol,evaluatedAt:w.view.to});
  if(mine!==request)return;
  const resolve=createM5StructureContextResolver({m5Candles:mergeCandles(policy.m5??[],m5),h1Candles:policy.h1,d1Candles:policy.d1,
   settings:{},sessionConfigs:own,instrument:symbol,structureStartTime:structureStartTime??undefined});
  const range={from:Math.ceil(w.view.from/300)*300,through:Math.floor(w.view.to/300)*300};
  // Neuer Pin startet bei OB+10 min.
  time.show(kase.id,range,located.evaluatedAt);
  data.value={kase,window:w,range,own,policy,resolve,structureStartTime:structureStartTime??undefined,closeCache:createCloseReactionCache(),m5All:m5,
   m5:m5.filter(c=>c.time>=w.view.from&&c.time<=w.view.to),m1:m1.filter(c=>c.time>=w.view.from),located};
  status.value='';fitPending=true;
  scanChanges(data.value,mine);
 }catch(e){if(mine===request){status.value='';error.value=e.message;}}
});

// Zeitbalken: Kette im Hauptthread (~6 ms), erklärte Diagnose im Worker; ein neuer Zeitpunkt bricht die laufende ab.
const time=useDebuggerTime(300),{at}=time;
const diagnosis=shallowRef(null),chain=shallowRef(null),overlay=shallowRef(null),changeTimes=ref(null),scanned=ref(0),diagnosing=ref(false);
const startDiagnosisWorker=(d,job)=>{
 const w=new Worker(new URL('../lsReactionDiagnosisWorker.js',import.meta.url),{type:'module'});
 w.postMessage({...job,structureStartTime:d.structureStartTime,kase:d.kase,m5:d.m5All,own:d.own.map(x=>toRaw(x)),located:d.located,policy:d.policy});
 return w;
};
let diagnoseTimer=null,explainWorker=null;
watch([data,at],([d,t])=>{
 clearTimeout(diagnoseTimer);explainWorker?.terminate();explainWorker=null;
 if(!d){diagnosis.value=chain.value=overlay.value=null;diagnosing.value=false;return;}
 diagnosing.value=true;
 diagnoseTimer=setTimeout(()=>{
  if(d!==data.value)return;
  chain.value=lsReactionChainAt(d.resolve,d.closeCache,t);overlay.value=lsReactionStructureOverlay(d.resolve(t),d.closeCache);
  const w=explainWorker=startDiagnosisWorker(d,{from:t,through:t,explain:true});
  w.onmessage=({data:m})=>{if(w!==explainWorker)return;if(m.error){error.value=`Diagnose: ${m.error}`;diagnosing.value=false;}else if(m.done){w.terminate();explainWorker=null;diagnosing.value=false;}else diagnosis.value=m.diagnosis;};
  w.onerror=e=>{if(w===explainWorker){error.value=`Diagnose: ${e.message}`;diagnosing.value=false;}};
 },30);
});
// Änderung = LS-Reaktion-Urteil oder Range-Kette. Die Kette (~6 ms je Schritt) läuft hier, das Urteil (~1 s je Schritt)
// im Worker; die Sprungliste wächst mit, soweit beides vorliegt.
let scanWorker=null;
async function scanChanges(d,mine){
 scanWorker?.terminate();scanWorker=null;changeTimes.value=null;scanned.value=0;
 const {from,through}=d.range,obKnownAt=d.located.obKnownAt??Infinity,chainKeys=new Map(),verdicts=new Map();
 for(let t=from;t<=through;t+=300){
  chainKeys.set(t,lsReactionChainAt(d.resolve,d.closeCache,t).key);
  if(chainKeys.size%24===0){await new Promise(r=>setTimeout(r));if(mine!==request)return;}
 }
 const publish=()=>{
  const samples=[];
  for(const [t,key] of chainKeys){const v=t<obKnownAt?'vor OB':verdicts.get(t);if(v==null)break;samples.push({at:t,key:v+key});}
  changeTimes.value=lsReactionChangeTimes(samples);scanned.value=Math.round(samples.length/chainKeys.size*100);
 };
 publish();
 const start=from+Math.ceil(Math.max(0,obKnownAt-from)/300)*300;
 if(start>through)return;
 scanWorker=startDiagnosisWorker(d,{from:start,through,explain:false});
 scanWorker.onmessage=({data:m})=>{
  if(mine!==request)return;
  if(m.error){error.value=`Änderungssuche: ${m.error}`;return;}
  if(m.done){scanWorker.terminate();scanWorker=null;}else verdicts.set(m.at,m.verdict);
  publish();
 };
 scanWorker.onerror=e=>{if(mine===request)error.value=`Änderungssuche: ${e.message}`;};
}

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
let chart=null,series=null,markers=null,symbol=null,primitives=[],priceLines=[],structurePrimitives=[],structureMarkers=[],fitPending=false;
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
 series.applyOptions({priceFormat:priceFormatFor(instrument)});
}
// Wie die DOB-Sektion: nur bis zur am Zeitbalken geschlossenen Kerze, damit die Historie mitläuft.
function shownCandles(){
 const d=data.value;if(!d)return [];
 const all=tf.value==='m1'?d.m1:d.m5;
 return closedChecklistCandles(all,tf.value==='m1'?'1m':'5m',at.value);
}
function draw(){
 if(!series||!data.value||!diagnosis.value)return;
 const {kase,window:w,located}=data.value,candles=shownCandles(),d=diagnosis.value;
 if(!candles.length)return;
 setInstrument(kase.instrument);
 // Kürzere Daten verschieben sonst den Ausschnitt mit der letzten Kerze; Indizes beginnen fest bei view.from.
 const view=fitPending?null:chart.timeScale().getVisibleLogicalRange();
 series.setData(candles);
 if(view)chart.timeScale().setVisibleLogicalRange(view);
 primitives.forEach(p=>series.detachPrimitive(p));primitives=[];
 priceLines.forEach(l=>series.removePriceLine(l));priceLines=[];
 // Vor dem OB-Schluss nichts zeichnen, was erst danach bekannt ist (auch nicht die DB-Zeile).
 const early=d.verdict==='OB noch nicht bekannt';
 const label=d.setup?`TS1 ${kase.dir===1?'Short':'Long'} (live)`:kase.setup&&!early?`DB #${kase.setupId}`:null;
 const setup=d.setup??(early?null:kase.setup);
 drawing.refresh(setup?[{...setup,label,setupNumber:null}]:[],{candles,showTradeSetups:true,showTradeSetupsShort:true,showTradeSetupsLong:true,
  showRScale:false,showPipScale:false,showLiquidityDebug:true,replayUntil:candles.at(-1).time,symbol:kase.instrument});
 // Ohne gefundenes Setup die gepinnte bzw. gesuchte OB zeigen, damit der Kandidatenvergleich einen Bezug hat.
 const ob=!setup&&!early?located.ob??kase.ob:null;
 if(ob){const p=new OrderBlockPrimitive({...ob,endTime:ob.startTime+1800,touched:true},{fillColor:cssColorScaled('dobConfirmed',.18),
  borderColor:cssColor('dobConfirmed'),textColor:cssColor('dobConfirmed'),borderWidth:1,label:'Pin-OB',forceLabel:true},candles);
  series.attachPrimitive(p);primitives.push(p);}
 // Aktuelle Range der LS-Reaktion-Kette zum Zeitpunkt des Zeitbalkens, von ihrem ältesten Grenzpivot bis evaluatedAt.
 const cur=chain.value?.current,sec5=tf.value==='m1'?60:300;
 if(cur?.low&&cur?.high){const p=new OrderBlockPrimitive({top:cur.high.price,bottom:cur.low.price,
   startTime:Math.floor(Math.min(cur.low.pivotTime,cur.high.pivotTime)/sec5)*sec5,endTime:Math.floor((d.evaluatedAt-300)/sec5)*sec5,touched:true},
  {fillColor:cssColorScaled('tradeConfirmation',.08),borderColor:cssColor('tradeConfirmation'),textColor:cssColor('tradeConfirmation'),borderWidth:1,
   label:`Aktuelle Range · Tiefe ${cur.depth} · ${lsReactionTrendText(cur.trend)}`,forceLabel:true},candles);
  series.attachPrimitive(p);primitives.push(p);}
 if(levels.value)primitives.push(...drawLsReactionLevels(series,chain.value,candles));
 if(kase.lsPrice!=null)priceLines.push(series.createPriceLine({price:kase.lsPrice,color:cssColor('liquiditySweepM5'),lineWidth:1,lineStyle:LineStyle.Dashed,title:'Pin-LS'}));
 // Durchgefallene Kandidaten nur in der Liste rechts; im Chart lenken sie ab (Philip: „kann weg“).
 for(const c of d.candidates.filter(c=>!c.inSetup&&c.checks.every(x=>x.ok)))priceLines.push(series.createPriceLine({price:c.level.price,
  color:cssColor('tradeWin'),lineWidth:1,lineStyle:LineStyle.Dotted,title:`LS ${px(c.level.price)}`}));
 const sec=tf.value==='m1'?60:300,mark=Math.floor((at.value-300)/sec)*sec;
 const inChart=t=>t!=null&&t<=candles.at(-1).time&&t>=candles[0].time,start=overlay.value?.anchorTime;
 markers.setMarkers([inChart(mark)&&{time:mark,position:'aboveBar',shape:'arrowDown',color:cssColor('tradeConfirmation'),text:'LS-Reaktion-Prüfung'},
  structure.value&&inChart(start)&&{time:Math.floor(start/sec)*sec,position:'belowBar',shape:'arrowUp',color:cssColor('tradeConfirmation'),text:`Strukturstart ${formatDatedTime(start)}`}].filter(Boolean));
 drawStructure();
 // Sicht nur bei neuem Fall/Zeitrahmen setzen; beim Drehen am Zeitbalken bleibt Philips Zoom stehen.
 if(!fitPending)return;
 fitPending=false;
 // Achsen nach jedem Wechsel zurücksetzen, sonst bleibt eine verschobene Preisachse stehen.
 series.priceScale().applyOptions({autoScale:true});
 const range={from:w.view.from,to:w.view.to};chart.timeScale().setVisibleRange(range);
 // Statuszeile verschwindet im selben Tick: der Resize setzt das Fenster sonst rechtsbündig neu.
 requestAnimationFrame(()=>chart?.timeScale().setVisibleRange(range));
}
// Struktur = LS-Reaktion-Kontext zu evaluatedAt (D1-Anker, M5-Pivots, Zustand); auf M1 dieselbe M5-Struktur.
function drawStructure(){
 if(!series)return;
 const candles=shownCandles(),instrument=data.value?.kase.instrument,result=structure.value&&candles.length?overlay.value:null;
 renderLowerStructure(series,result,structurePrimitives,structureMarkers,candles,{symbol:instrument,replayUntil:candles.at(-1)?.time,
  show:!!result,debug:!!result,barSeconds:300,timeframe:'5m'});
}
watch(tf,()=>{fitPending=true;});
// Kerzen folgen dem Regler sofort; die Prüf-Overlays ziehen nach, sobald die Diagnose da ist („Prüfe …“).
watch([diagnosis,tf,at,overlay],()=>nextTick(draw));
watch([structure,levels],()=>nextTick(draw));

onMounted(async()=>{
 ({chart,candleSeries:series}=createPriceChart(chartEl.value,'XAUUSD'));symbol='XAUUSD';
 chart.applyOptions({autoSize:true});chart.subscribeClick(insertChartPoint);markers=createSeriesMarkers(series,[]);drawing.create(series);
 try{await loadCases();}catch(e){error.value=e.message;}finally{loading.value=false;}});
onBeforeUnmount(()=>{request++;scanWorker?.terminate();explainWorker?.terminate();clearTimeout(diagnoseTimer);clearTimeout(insertedTimer);clearTimeout(savedTimer);drawing.dispose();chart?.unsubscribeClick(insertChartPoint);chart?.remove();chart=series=null;});
const mark=ok=>ok?'✓':'✗';
const pt=p=>lsReactionPoint(p,at.value,current.value?.instrument);
const px=p=>lsReactionPrice(p,current.value?.instrument);
const basisText=c=>c.basis==='existingCloseReactionChoch'?`Close-CHoCH · Ursprung ${lsReactionWhen(c.originTime,at.value)} · erkannt ${lsReactionWhen(c.recognizedAt,at.value)}`
 :'innerste bestätigte Range der Kette';
</script>

<template>
 <div class="lsReaction">
  <div class="bar">
   <select v-model="pinId" aria-label="Fall"><option v-for="c in cases" :key="c.id" :value="c.id">{{ optionText(c) }}</option></select>
   <select v-model="lead" title="Vorlauf vor OB/Level"><option v-for="[k,t] in LS_REACTION_LEADS" :key="k" :value="k">Vorlauf {{ t }}</option></select>
   <select v-model="tail" title="Nachlauf ab OB/Level"><option v-for="[k,t] in LS_REACTION_TAILS" :key="k" :value="k">Nachlauf {{ t }}</option></select>
   <select v-model="tf" title="Chart-Zeitrahmen"><option value="m5">M5</option><option value="m1">M1</option></select>
   <label title="LS-Reaktion-Marktstruktur (M5 P5/P2) ab dem Strukturstart, nach der LS-Reaktion entscheidet"><input v-model="structure" type="checkbox"> Struktur</label>
   <label title="Struktur-Ebenen als Zeitbänder: Wurzel, T1, T2, … bis zur aktuellen Ebene"><input v-model="levels" type="checkbox"> Ebenen</label>
   <ToggleButton variant="bordered" :class="{active:manualStart==null}" title="Wie Live-LS-Reaktion: Struktur zählt ab dem D1-Anker" @click="manualStart=null">Start ab D1-Anker</ToggleButton>
   <ToggleButton variant="bordered" :class="{active:manualStart!=null}" title="Simulation: LS-Reaktion für diese Ansicht mit eigenem Strukturstart neu rechnen"
    @click="manualStart??=overlay?.anchorTime??data?.window.view.from??null">Start ab Datum</ToggleButton>
   <DateTimeInput v-if="manualStart!=null" v-model="manualStart" title="Ab diesem Zeitpunkt zählt die simulierte LS-Reaktion-Struktur (beide Perioden)"/>
  </div>
  <p v-if="manualStart!=null" class="sim" role="status">Start manuell: {{ formatDatedTime(manualStart) }} · Live-LS-Reaktion nutzt D1
   <ActionButton @click="manualStart=null">Zurück auf D1-Anker</ActionButton></p>
  <div v-if="data" class="bar">
   <DebuggerTimeBar v-model="at" :from="time.range.value.from" :through="time.range.value.through" :step="time.step" step-label="M5-Kerze"
    change-hint="von LS-Reaktion-Urteil oder Range-Kette" :change-times="changeTimes">
    <strong v-if="diagnosis" class="info">{{ diagnosis.verdict }}</strong>
    <span v-if="diagnosing" class="muted" role="status">Prüfe …</span>
    <span v-if="scanned<100" class="muted" role="status">Suche Änderungen … {{ scanned }} %</span>
   </DebuggerTimeBar>
  </div>
  <p v-if="error" class="err" role="alert">{{ error }}</p>
  <p v-else-if="loading" role="status">Lade LS-Reaktion-Pins …</p>
  <p v-else-if="!cases.length" role="status">Noch keine LS-Reaktion-Pins.</p>
  <p v-else-if="current?.error" class="err" role="alert">{{ current.code }}: {{ current.error }}</p>
  <p v-else-if="status" role="status">{{ status }}</p>
  <div class="main">
   <div ref="chartEl" class="chart"></div>
   <aside v-if="current" class="panel">
    <p class="note"><strong>{{ current.code }}</strong> · {{ current.pin.kind }}<span v-if="current.setupId"> · Setup #{{ current.setupId }} ({{ current.detectorVersion ?? 'Version unbekannt' }})</span></p>
    <template v-if="diagnosis">
     <h4>Prüfschritte</h4>
     <ul class="checks"><li v-for="(s,i) in diagnosis.steps" :key="i" :class="{bad:!s.ok}">{{ mark(s.ok) }} {{ s.label }}<span v-if="s.detail" class="detail"> · {{ s.detail }}</span><small v-if="s.code"> · {{ s.code }}</small></li></ul>
     <template v-if="chain">
      <h4>Prüfschritt Range-Kette (Stand evaluatedAt)</h4>
      <p v-if="overlay" class="muted">Strukturstart {{ formatDatedTime(overlay.anchorTime) }} ({{ overlay.manual?'manuell, Simulation':'D1-Anker, ab hier zählt LS-Reaktion' }})</p>
      <p v-if="chain.status!=='ready'" class="muted">{{ chain.status }} · {{ chain.reason }}</p>
      <ul v-else class="checks">
       <li v-for="l in chain.links" :key="l.depth">Tiefe {{ l.depth }}{{ l.depth===0?' (Wurzel)':'' }} · {{ lsReactionTrendText(l.trend) }} · H {{ pt(l.high) }} · L {{ pt(l.low) }} · bestätigt</li>
       <li v-if="chain.current"><strong>Aktuelle Range</strong> · Tiefe {{ chain.current.depth }} · {{ lsReactionTrendText(chain.current.trend) }} · H {{ pt(chain.current.high) }} · L {{ pt(chain.current.low) }} · {{ basisText(chain.current) }}</li>
       <li v-else class="muted">Keine aktuelle Range (Wurzel ist kein Richtungsbeleg)</li>
      </ul>
     </template>
     <h4>LS-Kandidaten am OB</h4>
     <p v-if="!diagnosis.candidates.length" class="muted">Keine M5-Level im Sweep-Fenster.</p>
     <div v-for="c in diagnosis.candidates" :key="c.level.pivotTime+':'+c.level.price" class="cand">
      <strong>LS {{ px(c.level.price) }}</strong> · Pivot {{ formatDatedTime(c.level.pivotTime) }}<span v-if="c.philip"> · Pin-LS</span><span v-if="c.inSetup"> · im Setup</span>
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
.lsReaction{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}
.bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
/* Simulation fällt auf wie der scharfe Chart-Modus: Urteil und Kette gelten nicht für Live-LS-Reaktion. */
.sim{display:flex;align-items:center;gap:8px;margin:0;color:rgba(255,179,0,.9)}
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
.checks small{color:#9aa3b2;font-size:11px}
.checks .detail{color:inherit}
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
