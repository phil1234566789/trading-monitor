<script setup>
import {computed,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {createSeriesMarkers,LineStyle} from 'lightweight-charts';
import {createPriceChart} from '../priceChartSetup.js';
import {OrderBlockPrimitive,renderPersistedZones} from '../orderBlocks.js';
import {renderDoubleOrderBlocks,doubleOrderBlockDetails} from '../doubleOrderBlockRendering.js';
import {tintM1FvgCandidates} from '../fvgCandleTint.js';
import {cssColor,cssColorScaled} from '../chartColors.js';
import {formatBerlinTime,formatDatedTime} from '../berlinTime.js';
import {fmtPrice} from '../format.js';
import {OB_REACTION_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../obReactionDebuggerCases.js';
import {DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS} from '../doubleOrderBlocks.js';

const route=useRoute(),router=useRouter();
const caseId=ref(OB_REACTION_CASES.some(c=>c.id===route.query.fall)?route.query.fall:OB_REACTION_CASES[0].id);
const current=computed(()=>OB_REACTION_CASES.find(c=>c.id===caseId.value));
const fixture=shallowRef(null),steps=ref({from:0,through:0}),evaluatedAt=ref(0),error=ref('');
// Ablations-Schalter wie scripts/dobAblation.mjs, damit der Effekt von Near-Touch/Marktschluss je Fall sichtbar wird.
const nearTouch=ref(DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS.nearTouch),bridgeClosures=ref(DOUBLE_ORDER_BLOCK_DEFAULT_OPTIONS.bridgeClosures);
const result=computed(()=>fixture.value&&evaluateCase(current.value,fixture.value,evaluatedAt.value,{nearTouch:nearTouch.value,bridgeClosures:bridgeClosures.value}));

const chartEl=ref(null);
let chart=null,series=null,markers=null,fitPending=false,zonePrimitives=[],overlayPrimitives=[],priceLines=[];

watch(caseId,async id=>{
 if(route.query.fall!==id)router.replace({query:{...route.query,fall:id}});
 fixture.value=null;error.value='';
 try{
  const loaded=await loadCaseFixture(current.value);
  if(id!==caseId.value)return;
  steps.value=caseSteps(current.value,loaded);evaluatedAt.value=steps.value.through;fixture.value=loaded;fitPending=true;
 }catch(e){error.value=e.message;}
},{immediate:true});

const step=delta=>{evaluatedAt.value=Math.min(steps.value.through,Math.max(steps.value.from,evaluatedAt.value+delta*60));};
function onKey(e){if(e.target.tagName==='SELECT')return;if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1);}

const sideText=dir=>dir===1?'Long':'Short';
const price=p=>p==null?'–':fmtPrice(p,2);
const time=t=>t==null?'–':formatBerlinTime(t);
// Marker sitzen auf der Kerze, deren Schluss das Wissen liefert (knownAt = Kerzenzeit + 60).
const bar=knownAt=>knownAt-60;

function routeText(r){
 if(!r)return '–';
 if(r.status==='entry')return `entry ${time(r.entryTime)} @ ${price(r.entryPrice)} · SL ${price(r.stopLoss)} (${r.stopAnchor})`;
 const candidate=r.entryCandidate?` · Kandidat ${time(r.entryCandidate.entryTime)} @ ${price(r.entryCandidate.entryPrice)}`:'';
 return `${r.status}${r.reason?' · '+r.reason:''}${r.knownAt!=null?' · ab '+time(r.knownAt):''}${candidate}`;
}
function pairEntryText(e){
 if(e.status!=='ready')return `${e.status}${e.reason?' · '+e.reason:''}`;
 return `ready ${time(e.entryTime)} @ ${price(e.entryPrice)} · SL ${price(e.stopPrice)} · TP ${price(e.targetPrice)} · ${e.outcome?.status??'–'}`;
}

function draw(){
 if(!series||!result.value)return;
 const {m1,orderBlocks,pair}=result.value,at=evaluatedAt.value;
 const reactionFvgs=orderBlocks.map(o=>o.reaction?.fvg).filter(Boolean);
 series.setData(tintM1FvgCandidates(m1,reactionFvgs,'1m',cssColor('fvgCandle')));
 // Sichtbereich erst nach setData setzen, sonst wirft lightweight-charts 'Value is null'.
 if(fitPending){fitPending=false;chart.timeScale().setVisibleRange({from:steps.value.from-1800,to:steps.value.through});}
 overlayPrimitives.forEach(p=>series.detachPrimitive(p));overlayPrimitives=[];
 // Ein bestätigtes Paar bekommt die Dashboard-DOB-Boxen, vorher die normalen M5-OB-Boxen.
 const known=orderBlocks.filter(o=>o.orderBlock).map(o=>o.orderBlock);
 if(pair){renderPersistedZones(series,[],zonePrimitives,m1);overlayPrimitives=renderDoubleOrderBlocks(series,[pair],m1,at).map(i=>i.primitive);}
 else renderPersistedZones(series,known,zonePrimitives,m1);
 // Einziges neues Overlay: FVG-Zonen über dasselbe Box-Primitive, Reaktions-FVG kräftig, interne blass.
 for(const {internalFvgs,reaction} of orderBlocks)for(const fvg of internalFvgs??[]){
  const strong=fvg===reaction?.fvg,key=strong?'fvgCandle':'obInactiveM5';
  const primitive=new OrderBlockPrimitive({top:fvg.top,bottom:fvg.bottom,startTime:fvg.candleTime,endTime:at,touched:true},
   {fillColor:cssColorScaled(key,strong?.25:.12),borderColor:cssColor(key),textColor:cssColor(key),borderWidth:1,label:strong?'Reaktions-FVG':'FVG'},m1);
  series.attachPrimitive(primitive);overlayPrimitives.push(primitive);
 }
 const list=[];
 for(const {role,reaction} of orderBlocks){
  // OB1-Routen tragen im DOB keinen Entry (pairEntries nimmt nur OB2); Einzel-OBs laufen als OB2.
  const routes=role==='second'?reaction?.routes:null;
  if(!reaction)continue;
  const tag=orderBlocks.length>1?(role==='first'?'OB1 ':'OB2 '):'';
  if(reaction.contact)list.push({time:reaction.contact.candleTime,position:current.value.dir===1?'belowBar':'aboveBar',shape:'circle',color:cssColor('tradeConfirmation'),text:`${tag}${reaction.contact.status}`});
  if(reaction.state==='true')list.push({time:bar(reaction.knownAt),position:'inBar',shape:'square',color:cssColor('tradeWin'),text:`${tag}Reaktion ✓`});
  if(reaction.state==='false')list.push({time:bar(reaction.knownAt),position:'inBar',shape:'square',color:cssColor('tradeLoss'),text:`${tag}Reaktion ✗`});
  for(const [name,r] of Object.entries(routes??{}))if(r.status==='entry')
   list.push({time:bar(r.entryTime),position:current.value.dir===1?'belowBar':'aboveBar',shape:current.value.dir===1?'arrowUp':'arrowDown',color:cssColor('dobConfirmed'),text:`Entry ${name}`});
 }
 list.sort((a,b)=>a.time-b.time);
 markers.setMarkers(list.filter(m=>m.time<at));
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
 window.addEventListener('keydown',onKey);
 draw();
});
onBeforeUnmount(()=>{window.removeEventListener('keydown',onKey);chart?.remove();chart=series=null;});
watch(result,draw);
</script>

<template>
 <div class="obr">
  <div class="bar">
   <select v-model="caseId"><option v-for="c in OB_REACTION_CASES" :key="c.id" :value="c.id">{{ c.label }}</option></select>
   <button @click="step(-1)" title="Eine M1-Kerze zurück (←)">◀</button>
   <input type="range" :min="steps.from" :max="steps.through" step="60" :value="evaluatedAt" @input="evaluatedAt=Number($event.target.value)">
   <button @click="step(1)" title="Eine M1-Kerze vor (→)">▶</button>
   <label>Near-Touch <select v-model="nearTouch"><option value="none">aus</option><option value="second">OB2</option><option value="both">OB1+OB2</option></select></label>
   <label><input type="checkbox" v-model="bridgeClosures"> Marktschluss überbrücken</label>
   <span class="at">evaluatedAt {{ evaluatedAt ? formatDatedTime(evaluatedAt) : '–' }}</span>
  </div>
  <div class="main">
   <div ref="chartEl" class="chart"></div>
   <aside class="panel">
    <p v-if="error" class="err">{{ error }}</p>
    <p v-else-if="!result">Lade Fixture …</p>
    <template v-else>
     <section v-if="current.orderBlocks.length===2">
      <h3>DOB {{ sideText(current.dir) }}</h3>
      <template v-if="result.pair">
       <p>{{ doubleOrderBlockDetails(result.pair,evaluatedAt) }}</p>
       <p v-for="(e,name) in result.pair.entries" :key="name"><b>{{ name }}</b> {{ pairEntryText(e) }}</p>
      </template>
      <p v-else class="muted">Noch kein DOB erkannt.</p>
     </section>
     <section v-for="o in result.orderBlocks" :key="o.startTime">
      <h3>{{ current.orderBlocks.length===2?(o.role==='first'?'OB1':'OB2'):'OB' }} · M5 {{ formatDatedTime(o.startTime) }}</h3>
      <p v-if="!o.orderBlock" class="muted">Noch nicht bekannt.</p>
      <template v-else>
       <p>{{ price(o.orderBlock.bottom) }}–{{ price(o.orderBlock.top) }} · bekannt {{ time(o.orderBlock.recognizedAt) }}</p>
       <p><b>Reaktion</b> {{ o.reaction.state }}{{ o.reaction.reason?' · '+o.reaction.reason:'' }}{{ o.reaction.knownAt?' · ab '+time(o.reaction.knownAt):'' }}</p>
       <p v-if="o.reaction.contact"><b>Kontakt</b> {{ o.reaction.contact.status }} · Kerze {{ time(o.reaction.contact.candleTime) }}</p>
       <p v-if="o.reaction.fvg"><b>FVG</b> {{ price(o.reaction.fvg.bottom) }}–{{ price(o.reaction.fvg.top) }} · bekannt {{ time(o.reaction.fvg.recognizedAt) }}</p>
       <p v-for="(r,name) in o.role==='second'?o.reaction.routes ?? {}:{}" :key="name"><b>{{ name }}</b> {{ routeText(r) }}</p>
      </template>
     </section>
    </template>
   </aside>
  </div>
 </div>
</template>

<style scoped>
.obr{display:flex;flex-direction:column;height:calc(100vh - 60px);padding:8px;gap:8px}
.bar{display:flex;align-items:center;gap:8px;white-space:nowrap}
.bar input[type=range]{flex:1}
.at{font-variant-numeric:tabular-nums;white-space:nowrap}
.main{flex:1;display:flex;gap:8px;min-height:0}
.chart{flex:1;min-width:0}
.panel{width:380px;overflow:auto;font-size:13px}
.panel h3{margin:8px 0 4px;font-size:14px}
.panel p{margin:2px 0}
.muted{opacity:.6}
.err{color:#ef5350}
</style>
