// M5-Strukturkette je Präfix-Zeitpunkt für die Pivot-Schleife des LQ-Algo (findLiquiditySourceOwner), gleich
// prepareM5StructureContext(at).chain (Test m5StructurePrefixChain), ohne je Zeitpunkt neu zu falten (#69401: 250 Faltungen, 10 s CPU).
// Einmal falten und abfragen geht nicht: markLqSweeps klassifiziert in jedem Schritt mit toTime = Präfix-Ende T, die Faltung ist nicht
// kausal. Von T hängt ein Schritt aber nur über Touch- und erste Schlusszeiten seiner Pivots ab; deshalb gelten die Schritte des letzten
// Präfixes weiter bis zum ersten Pivot, der zwischen altem und neuem T eine solche Zeit hat. Pivots aus dem Vollbestand (Touch = erster
// überhaupt) entscheiden isUntouchedAsOf für alle Zeitpunkte ≤ T gleich wie die Präfix-Pivots.
import {buildHistoricalDailyAnchors} from './tradeSetup2Anchors.js';
import {computeRangesPivots,initMarketStructureState,applyMarketStructurePivot,applyInnerMarketStructurePivot,
 collectNestedChain} from './marketStructureAnalysis.ts';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {markIgnoredCandles} from './sessionOccurrences.js';
import {berlinOffsetMinutes} from './berlinTime.js';
import {withCandleCloseWindow} from './candleCloseWindow.ts';

const END=Number.MAX_SAFE_INTEGER;
const countUpTo=(rows,time)=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].time<=time)lo=mid+1;else hi=mid;}return lo;};

export function createM5StructurePrefixChainResolver({instrument,m5Candles=[],h1Candles=[],d1Candles=[],settings={},sessionConfigs=[],structureStartTime}={}) {
 const outerPeriod=settings.m5StructurePeriod??5,innerPeriod=settings.m5Structure2Period??2;
 const raw=closedChecklistCandles(m5Candles,'5m',END),h1=closedChecklistCandles(h1Candles,'1h',END),daily=closedChecklistCandles(d1Candles,'1D',END);
 // Bekannte D1-Anker liegen ≥ 4 Tage zurück: ihre H1-Kerzen sind in jedem Präfix, das sie kennt, schon geschlossen.
 const anchors=buildHistoricalDailyAnchors(daily,h1);
 const marked=markIgnoredCandles(raw,sessionConfigs.filter(s=>s.instrument===instrument),s=>berlinOffsetMinutes(s*1000));
 const clean=marked.filter(c=>!c.ignored),cleanIndex=new Map(clean.map((c,i)=>[c.time,i]));
 const fullPivots=new Map(),folds=new Map();
 const pivotsFor=period=>{
  if(!fullPivots.has(period))fullPivots.set(period,computeRangesPivots(clean,period,-Infinity).map(p=>({p,period,idx:cleanIndex.get(p.pivotTime)})));
  return fullPivots.get(period);
 };
 // Touch und erster Schluss über/unter dem Level nach dem Pivot (closesPastLevel: time > from): die einzigen Fakten, die
 // markLqSweeps vom Präfix-Ende abhängig macht. Kopien im Zustand ({...p,type}) tragen dieselben Zeiten.
 const flipTimes=p=>{
  let above=Infinity,below=Infinity;
  for(let i=countUpTo(clean,p.pivotTime);i<clean.length&&(above===Infinity||below===Infinity);i++){
   if(above===Infinity&&clean[i].close>p.price)above=clean[i].time;
   if(below===Infinity&&clean[i].close<p.price)below=clean[i].time;
  }
  return [p.touched?.touchedTime,above,below].filter(Number.isFinite);
 };
 const foldFor=cutoff=>{
  if(folds.has(cutoff))return folds.get(cutoff);
  const outer=pivotsFor(outerPeriod).filter(e=>e.p.pivotTime>=cutoff),inner=pivotsFor(innerPeriod).filter(e=>e.p.pivotTime>=cutoff);
  const originLow=outer.find(e=>e.p.type==='low'),originHigh=outer.find(e=>e.p.type==='high');
  const fold={originLow,originHigh,steps:[],T:null};
  if(originLow&&originHigh){
   const originCutoff=Math.max(originLow.p.pivotTime,originHigh.p.pivotTime);
   // Gleiche Reihenfolge wie buildMarketStructureState (stabil sortiert, Outer vor Inner); ein Präfix ist eine Teilfolge davon.
   fold.entries=[...outer.filter(e=>e!==originLow&&e!==originHigh).map(e=>({...e,outer:true,at:e.p.pivotTime+outerPeriod*300})),
    ...inner.filter(e=>e.p.pivotTime>originCutoff).map(e=>({...e,outer:false,at:e.p.pivotTime+innerPeriod*300}))]
    .sort((a,b)=>a.at-b.at);
   // Ein Pivot steckt frühestens ab seinem eigenen Schritt im Zustand (Ursprünge ab dem Start).
   fold.flips=[originLow,originHigh,...fold.entries].flatMap(e=>flipTimes(e.p).map(time=>({time,e}))).sort((a,b)=>a.time-b.time);
  }
  folds.set(cutoff,fold);
  return fold;
 };
 const included=(e,n)=>e.idx<=n-1-e.period;

 // Mehrere LS-Quellen laufen dieselben Zeitpunkte erneut ab; ohne Ergebnis-Cache erzwingt jeder Rücksprung eine fast volle Neufaltung.
 const results=new Map();
 return at=>{
  const key=Math.floor(at/300)*300;
  if(!results.has(key)){
   if(results.size>=1024)results.delete(results.keys().next().value);
   results.set(key,chainAt(key));
  }
  return results.get(key);
 };
 function chainAt(key){
  const unknown=reason=>({status:'unknown',reason,chain:[]});
  const nRaw=countUpTo(raw,key-300);
  if(!nRaw||!countUpTo(h1,key-3600)||!countUpTo(daily,key-86400))return unknown('missingNativeContext');
  const d1Anchor=anchors.filter(a=>a.knownAt<=key).sort((a,b)=>b.pivotTime-a.pivotTime)[0];
  const anchor=Number.isFinite(structureStartTime)?{...d1Anchor,structureStartTime}:d1Anchor;
  if(!anchor)return unknown('dailyAnchorUnknown');
  if(raw[0].time>anchor.structureStartTime)return unknown('m5AnchorHistoryMissing');
  const stateKnownAt=raw[nRaw-1].time+300,n=countUpTo(clean,key-300),fold=foldFor(anchor.structureStartTime);
  if(!n||!fold.entries||!included(fold.originLow,n)||!included(fold.originHigh,n))return unknown('m5StructureUnknown');
  const candles=clean.slice(0,n),T=candles[n-1].time,sequence=fold.entries.filter(e=>included(e,n));
  const [first,second]=fold.originLow.p.pivotTime<=fold.originHigh.p.pivotTime?[fold.originLow.p,fold.originHigh.p]:[fold.originHigh.p,fold.originLow.p];
  fold.start??=initMarketStructureState(first,second);
  // Gespeicherte Schritte gelten für fold.T; ab dem ersten Pivot mit Touch/Schluss zwischen fold.T und T neu falten.
  let limit=Math.min(sequence.length,fold.steps.length);
  if(fold.T!==null&&fold.T!==T){
   const lo=Math.min(fold.T,T),hi=Math.max(fold.T,T);
   for(let i=countUpTo(fold.flips,lo);i<fold.flips.length&&fold.flips[i].time<=hi;i++){
    const e=fold.flips[i].e,index=e===fold.originLow||e===fold.originHigh?0:sequence.indexOf(e);
    if(index>=0&&index<limit)limit=index;
   }
  }
  let k=0;
  while(k<limit&&fold.steps[k].entry===sequence[k])k++;
  fold.steps.length=k;
  fold.T=T;
  withCandleCloseWindow(candles,()=>{
   let state=k?fold.steps[k-1].state:fold.start;
   for(;k<sequence.length;k++){
    const entry=sequence[k],direction=state.trend==='downtrend'?'down':'up';
    state=(entry.outer?applyMarketStructurePivot:applyInnerMarketStructurePivot)(state,entry.p,{candles,direction,asOfTime:entry.at});
    fold.steps.push({entry,state});
   }
  },{cacheCloses:true});
  const state=sequence.length?fold.steps[sequence.length-1].state:fold.start;
  return {status:'ready',reason:null,anchor,state,chain:collectNestedChain(state),stateKnownAt};
 }
}
