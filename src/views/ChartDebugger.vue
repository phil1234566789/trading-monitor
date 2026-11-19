<script setup>
import {computed,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {createSeriesMarkers,LineStyle} from 'lightweight-charts';
import {createPriceChart,priceFormatFor} from '../priceChartSetup.js';
import {OrderBlockPrimitive,renderPersistedZones} from '../orderBlocks.js';
import {renderDoubleOrderBlocks} from '../doubleOrderBlockRendering.js';
import {tintM1FvgCandidates} from '../fvgCandleTint.js';
import {cssColor,cssColorScaled} from '../chartColors.js';
import {CHART_DEBUGGER_CASES,CASE_GROUPS,expectedText,productMatches,loadCaseFixture,evaluateCase,caseSteps,caseInstrument} from '../chartDebuggerCases.js';
import {DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS,reactionOptionsFor} from '../doubleOrderBlocks.js';
import {obReactionGraph,graphChangeTimes,structuralState} from '../obReactionGraph.js';
import {chartDebuggerFvgZones,chartDebuggerReactionZones,chartDebuggerOpponentZones} from '../chartDebuggerFvgs.js';
import ObReactionGraph from '../components/ObReactionGraph.vue';
import DobPairGraph from '../components/DobPairGraph.vue';
import {dobPairGraph,dobChangeTimes} from '../dobPairGraph.js';
import DobEntryM1Section from '../components/DobEntryM1Section.vue';
import TradeSetup11Section from '../components/TradeSetup11Section.vue';
import DebuggerTimeBar from '../components/DebuggerTimeBar.vue';
import {useDebuggerTime} from '../composables/useDebuggerTime.js';

const route=useRoute(),router=useRouter();
// Sektion DOB-Entry M1 ist eine reine Ansicht ohne Fixture; die Fall-Sektion bleibt per v-show montiert, ihr Chart braucht chartEl.
const section=ref(['dob-entry-m1','ts11'].includes(route.query.sektion)?route.query.sektion:'cases');
watch(section,s=>router.replace({query:s==='cases'?{fall:caseId.value}:{sektion:s}}));
const caseId=ref(CHART_DEBUGGER_CASES.some(c=>c.id===route.query.fall)?route.query.fall:CHART_DEBUGGER_CASES[0].id);
const current=computed(()=>CHART_DEBUGGER_CASES.find(c=>c.id===caseId.value));
// Fall startet am Fensterende (M1-Raster).
const time=useDebuggerTime(60),{at:evaluatedAt,range:steps}=time;
const fixture=shallowRef(null),error=ref('');
// Ablations-Schalter wie scripts/dobAblation.mjs, damit der Effekt von Near-Touch/Marktschluss je Fall sichtbar wird.
const nearTouch=ref(DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS.nearTouch),bridgeClosures=ref(DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS.bridgeClosures);
const options=computed(()=>({nearTouch:nearTouch.value,bridgeClosures:bridgeClosures.value}));
const result=computed(()=>fixture.value&&evaluateCase(current.value,fixture.value,evaluatedAt.value,options.value));
// Knotenplan zeigt standardmäßig den Entry-tragenden OB (OB2 bzw. Einzel-OB); bei DOBs ist OB1 umschaltbar.
const graphRole=ref(current.value.graphRole??'second');
watch(caseId,()=>{graphRole.value=current.value.graphRole??'second';});
// Ebene: OB-Reaktion (ein OB) oder DOB (Paar-Gates); DOB nur bei Zwei-OB-Fällen, per ?ebene=dob verlinkbar.
const isPair=computed(()=>current.value.orderBlocks.length===2);
const levelOf=c=>c.orderBlocks.length===2?(route.query.ebene??c.level??'reaction'):'reaction';
const level=ref(levelOf(current.value));
watch(caseId,()=>{level.value=current.value.orderBlocks.length===2?current.value.level??'reaction':'reaction';});
// fall mitschreiben: beim Fallwechsel ersetzt der Fixture-Watcher die Query im selben Tick, route.query ist dann noch alt.
watch(level,l=>{if(route.query.ebene!==l)router.replace({query:{...route.query,fall:caseId.value,ebene:l}});});
const openReaction=role=>{graphRole.value=role;level.value='reaction';};
const dobGraph=computed(()=>result.value&&isPair.value&&level.value==='dob'&&dobPairGraph({dir:current.value.dir,...result.value,evaluatedAt:evaluatedAt.value,instrument:caseInstrument(current.value)}));
const graphInput=({orderBlocks,context,pair,hold})=>{const entry=orderBlocks.find(o=>o.role===graphRole.value);
 return {entry,context,pair,hold,partner:orderBlocks.find(o=>o!==entry)??null};};
const graph=computed(()=>result.value&&obReactionGraph({...graphInput(result.value),dir:current.value.dir,evaluatedAt:evaluatedAt.value,
 bridgeClosures:bridgeClosures.value,nearTouch:reactionOptionsFor(graphRole.value,{nearTouch:nearTouch.value}).nearTouch}));
// Einmal je Fall/Schalter/Rolle am Fensterende ausgewertet; die Sprünge selbst rechnen nichts mehr.
const endResult=computed(()=>fixture.value&&evaluateCase(current.value,fixture.value,steps.value.through,options.value));
const changeTimes=computed(()=>endResult.value?(level.value==='dob'&&isPair.value?dobChangeTimes(endResult.value):graphChangeTimes(graphInput(endResult.value)))
 .filter(t=>t>=steps.value.from&&t<=steps.value.through):[]);

// ✓/✗ im Dropdown: Produktergebnis unter W1 am Fensterende gegen Philips Soll; im Hintergrund, Fall für Fall.
const productCheck=ref({});
async function checkAllCases(){
 for(const c of CHART_DEBUGGER_CASES){
  const loaded=await loadCaseFixture(c);
  productCheck.value={...productCheck.value,[c.id]:productMatches(c,evaluateCase(c,loaded,caseSteps(c,loaded).through))};
  await new Promise(resolve=>setTimeout(resolve));
 }
}
const checkMark=id=>id in productCheck.value?({true:' ✓',false:' ✗'})[productCheck.value[id]]??'':' …';

// M5 kommt nativ aus derselben Fixture (closedChecklistCandles in evaluateCase); Reaktion und FVG-Füllung bleiben M1.
const tf=ref('m1');
const chartEl=ref(null);
let chart=null,series=null,markers=null,fitPending=false,zonePrimitives=[],overlayPrimitives=[],priceLines=[];

watch(caseId,async id=>{
 if(route.query.fall!==id)router.replace({query:{...route.query,fall:id}});
 fixture.value=null;error.value='';
 try{
  const loaded=await loadCaseFixture(current.value);
  if(id!==caseId.value)return;
  const range=caseSteps(current.value,loaded);time.show(id,range,range.through);fixture.value=loaded;fitPending=true;
 }catch(e){error.value=e.message;}
},{immediate:true});


// Marker sitzen auf der Kerze, deren Schluss das Wissen liefert (knownAt = Kerzenzeit + 60).
const bar=knownAt=>knownAt-60;


function draw(){
 if(!series||!result.value)return;
 const {m1,orderBlocks,pair}=result.value,at=evaluatedAt.value,sec=tf.value==='m1'?60:300;
 const reactionFvgs=orderBlocks.map(o=>o.reaction?.fvg).filter(Boolean),candles=tf.value==='m1'?m1:result.value.m5;
 // M1-Zeitpunkte auf die M5-Kerze legen, sonst fehlen Marker zwischen zwei M5-Balken.
 const snap=t=>Math.floor(t/sec)*sec,last=candles.at(-1)?.time??-Infinity;
 // Fälle mischen XAU und Forex; der Chart entsteht einmal, das Preisformat folgt dem Fall.
 series.applyOptions({priceFormat:priceFormatFor(caseInstrument(current.value))});
 series.setData(tintM1FvgCandidates(candles,reactionFvgs,tf.value==='m1'?'1m':'5m',cssColor('fvgCandle')));
 // Sichtbereich erst nach setData setzen, sonst wirft lightweight-charts 'Value is null'.
 if(fitPending){fitPending=false;chart.timeScale().setVisibleRange({from:steps.value.from-1800,to:steps.value.through});}
 overlayPrimitives.forEach(p=>series.detachPrimitive(p));overlayPrimitives=[];
 // Ein bestätigtes Paar bekommt die Dashboard-DOB-Boxen, vorher die normalen M5-OB-Boxen.
 const known=orderBlocks.filter(o=>o.orderBlock).map(o=>o.orderBlock);
 if(pair){renderPersistedZones(series,[],zonePrimitives,candles);overlayPrimitives=renderDoubleOrderBlocks(series,[pair],candles,at).map(i=>i.primitive);}
 else renderPersistedZones(series,known,zonePrimitives,candles);
 // Boxen folgen derselben OB-Rolle und demselben Inventar wie die Seitenspur, auch nach Rollenwechsel.
 const selected=orderBlocks.find(o=>o.role===graphRole.value);
 const fvgZones=[...chartDebuggerFvgZones(selected,result.value.context,at),...chartDebuggerReactionZones(selected,result.value.context,at),
  ...chartDebuggerOpponentZones(selected,result.value.context,at)];
 for(const {zone,label} of fvgZones){
  // Im M5-Modus fehlt die laufende M5-Kerze; eine FVG danach hätte keinen Balken zum Andocken.
  if(snap(zone.startTime)>last)continue;
  const key='fvgCandle';
  const primitive=new OrderBlockPrimitive({...zone,startTime:snap(zone.startTime)},
   {fillColor:cssColorScaled(key,.25),borderColor:cssColor(key),textColor:cssColor(key),borderWidth:1,label},candles);
  series.attachPrimitive(primitive);overlayPrimitives.push(primitive);
 }
 const list=[];
 for(const {role,reaction} of orderBlocks){
  // OB1-Routen tragen im DOB keinen Entry (pairEntries nimmt nur OB2); Einzel-OBs laufen als OB2.
  const routes=role==='second'?reaction?.routes:null;
  if(!reaction)continue;
  const tag=orderBlocks.length>1?(role==='first'?'OB1 ':'OB2 '):'';
  if(reaction.contact)list.push({time:snap(reaction.contact.candleTime),position:current.value.dir===1?'belowBar':'aboveBar',shape:'circle',color:cssColor('tradeConfirmation'),text:`${tag}${reaction.contact.status}`});
  if(structuralState(reaction)==='true')list.push({time:snap(bar(reaction.knownAt)),position:'inBar',shape:'square',color:cssColor('tradeWin'),text:`${tag}Reaktion ✓`});
  if(structuralState(reaction)==='false')list.push({time:snap(bar(reaction.knownAt)),position:'inBar',shape:'square',color:cssColor('tradeLoss'),text:`${tag}Reaktion ✗`});
  for(const [name,r] of Object.entries(routes??{}))if(r.status==='entry')
   list.push({time:snap(bar(r.entryTime)),position:current.value.dir===1?'belowBar':'aboveBar',shape:current.value.dir===1?'arrowUp':'arrowDown',color:cssColor('dobConfirmed'),text:`Entry ${name}`});
 }
 list.sort((a,b)=>a.time-b.time);
 markers.setMarkers(list.filter(m=>m.time<at&&m.time<=last));
 priceLines.forEach(l=>series.removePriceLine(l));priceLines=[];
 const entries=orderBlocks.filter(o=>o.role==='second').flatMap(o=>Object.entries(o.reaction?.routes??{})).filter(([,r])=>r.status==='entry');
 for(const [name,r] of entries){
  priceLines.push(series.createPriceLine({price:r.entryPrice,color:cssColor('dobConfirmed'),lineWidth:1,lineStyle:LineStyle.Dashed,title:`Entry ${name}`}));
  priceLines.push(series.createPriceLine({price:r.stopLoss,color:cssColor('tradeInvalidation'),lineWidth:1,lineStyle:LineStyle.Dotted,title:`SL ${name}`}));
 }
}

onMounted(()=>{
 ({chart,candleSeries:series}=createPriceChart(chartEl.value,'XAUUSD'));
 chart.applyOptions({autoSize:true});
 markers=createSeriesMarkers(series,[]);
 checkAllCases();
 draw();
});
onBeforeUnmount(()=>{chart?.remove();chart=series=null;});
watch(result,draw);
watch(graphRole,draw);
watch(tf,()=>{fitPending=true;draw();});
</script>

<template>
 <div class="chart-debugger">
  <label class="section">Sektion <select v-model="section"><option value="cases">OB-Reaktion / DOB</option><option value="dob-entry-m1">DOB-Entry M1</option><option value="ts11">TS1.1</option></select></label>
  <DobEntryM1Section v-if="section==='dob-entry-m1'"/>
  <TradeSetup11Section v-if="section==='ts11'"/>
  <div v-show="section==='cases'" class="bar">
   <select v-model="caseId"><optgroup v-for="[group,cases] in CASE_GROUPS" :key="group" :label="group">
    <option v-for="c in cases" :key="c.id" :value="c.id">{{ c.label }} · erwartet: {{ expectedText(c) }}{{ checkMark(c.id) }}</option></optgroup></select>
   <DebuggerTimeBar v-model="evaluatedAt" :from="steps.from" :through="steps.through" :step="time.step" :change-times="changeTimes" :active="section==='cases'">
    <select v-model="tf" title="Chart-Zeitrahmen"><option value="m1">M1</option><option value="m5">M5</option></select>
    <label>Near-Touch <select v-model="nearTouch"><option value="none">aus</option><option value="second">OB2</option><option value="both">OB1+OB2</option></select></label>
    <label><input type="checkbox" v-model="bridgeClosures"> Marktschluss überbrücken</label>
   </DebuggerTimeBar>
  </div>
  <div v-show="section==='cases'" class="main">
   <div ref="chartEl" class="chart"></div>
   <div class="graph">
    <label v-if="isPair">Ebene <select v-model="level"><option value="reaction">OB-Reaktion</option><option value="dob">DOB</option></select></label>
    <label v-if="isPair&&level==='reaction'">Knotenplan für <select v-model="graphRole"><option value="first">OB1</option><option value="second">OB2</option></select></label>
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <p v-else-if="!result" role="status">Lade Fixture …</p>
    <DobPairGraph v-else-if="dobGraph" :graph="dobGraph" :expected="expectedText(current)" :matches="productMatches(current,endResult)" :scope="caseId" @reaction="openReaction"/>
    <ObReactionGraph v-else-if="graph" :graph="graph" :dir="current.dir" :scope="caseId+graphRole"/>
   </div>

  </div>
 </div>
</template>

<style scoped>
.chart-debugger{display:flex;flex-direction:column;height:calc(100vh - 60px);padding:8px;gap:8px}
.bar{display:flex;align-items:center;gap:8px;white-space:nowrap}
.main{flex:1;display:flex;gap:8px;min-height:0}
.chart{flex:1;min-width:0}
.graph{width:460px;flex:none;overflow:auto;padding-right:4px}
.err{color:#ef5350}
</style>
