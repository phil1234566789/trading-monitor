import {createSharedOrderBlockDetector} from './sharedOrderBlocks.js';
import { setup1RecognitionTime } from './setup1RecognitionTime.js';
import { evaluateCountertrendChecklist } from './countertrendChecklist.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { activeM1Context, buildM1Structure } from './m1Structure.js';
import { evaluateM1Checklist } from './m1Checklist.js';
import { buildTradeSetup2Snapshot, buildTradeSetup2CandidateSnapshot } from './tradeSetup2Snapshot.js';
import { evaluateSimulation } from './tradeSetupSimulation.js';
import { evaluateCountertrendLifecycle } from './countertrendLifecycle.js';
import { createSetup2Entry } from './tradeSetup2EntryGate.js';
import { createCloseReactionCache } from './m5CloseReactionHistory.js';
import { markIgnoredCandles } from './sessionOccurrences.js';
import { berlinOffsetMinutes } from './berlinTime.js';
import { m1ScanPrefixStart } from './m1ScanPrefix.js';
import { m1LoadStart } from './m1StructureStart.js';
import { M1_FRACTAL_SUPPORT } from './m1StructureSettings.js';
import { candleTimeIndex } from './candleTimeIndex.js';
import { createClosedCandlePrefix } from './closedCandlePrefix.js';
import { createSetup2Memo,finalObservation } from './setup2Memo.js';
import { entryModel1FvgAt } from './entryModel1Progress.js';
import { completeDealingRangePriceObservations } from './dealingRangePriceObservation.js';
import { createChecklistHistoryRecorder } from './tradeSetup2ChecklistHistory.js';

export async function scanCountertrendWindow(input) {
  const { instrument,fromTime,toTime,signal,onSnapshot,onProgress,loadM1Candles,
    useMemo=true,yieldEvery=32,yieldControl=()=>Promise.resolve() }=input;
  const setups=(input.tradeSetups ?? []).filter(s=>s.instrument===instrument)
    .map(s=>({source:s,at:setup1RecognitionTime(s)})).filter(s=>s.at<=toTime).sort((a,b)=>a.at-b.at);
  if (!setups.length) {
    await onProgress?.({phase:'scan',completed:0,total:0,m5Evaluations:0,m1Candles:0}); return [];
  }
  const ordered=rows=>(rows ?? []).slice().sort((a,b)=>a.time-b.time);
  const marked=rows=>markIgnoredCandles(ordered(rows),input.sessionConfigs?.filter(s=>s.instrument===instrument) ?? [],
    sec=>berlinOffsetMinutes(sec*1000));
  const m5=marked(input.m5Candles),h1=ordered(input.h1Candles);
  const closedM5At=createClosedCandlePrefix(m5,300);
  let m1=marked(input.m1Candles),loadedFrom=Infinity;
  const snapshots=[],entries=[...(input.existingEntries ?? [])],saved=new Map(),seen=new Set(entries.map(s=>s.entry.id));
  const checklistHistory=createChecklistHistoryRecorder();
  const classificationCache=new Map(),closeReactionCache=createCloseReactionCache(),m1Cache=createCloseReactionCache();
  const recognized=new Map();
  const setupMemo=useMemo ? createSetup2Memo() : null,lifecycles=createSetup2Memo(),executions=createSetup2Memo();
  const searchThrough=createSetup2Memo(),entryProgress=createSetup2Memo();
  const orderBlockDetectors=new Map();
  const detectScanOrderBlocks=(rows,timeframe,isForex=true,minGapOverride=null)=>{
    const key=JSON.stringify([timeframe,isForex,minGapOverride]);
    if(!orderBlockDetectors.has(key))orderBlockDetectors.set(key,createSharedOrderBlockDetector(timeframe,isForex,minGapOverride));
    return orderBlockDetectors.get(key)(rows);
  };
  let evaluations=0;
  const outcomesAt=(at,sources)=>{
    const outcomes=new Map();
    for (const snapshot of entries) {
      if(useMemo && !sources.some(s=>snapshot.setupKey===`${instrument}:setup1:${s.tradeSetupId}`))continue;
      const outcomesForEntry=['wide','narrow'].map(variant=>{
        const progress=useMemo ? executionProgress(`${snapshot.entry.id}:${variant}`) : undefined;
        if(progress?.final && progress.final.evaluatedAt<=at)return {...progress.final,evaluatedAt:at};
        const outcome=evaluateSimulation({entry:snapshot.entry,variant,
        candles:m1,evaluatedAt:at,target1:snapshot.entry.scales[variant].targets[0]?.price,
        target2:snapshot.entry.scales[variant].targets[1]?.price ?? null,
        progress});
        if(progress && outcome.status==='closed')progress.final=outcome;
        return outcome;
      }).filter(e=>e.status!=='notExecutable');
      outcomes.set(snapshot.setupKey,[...(outcomes.get(snapshot.setupKey) ?? []),...outcomesForEntry]);
    }
    return outcomes;
  };
  function executionProgress(key){let state=executions.get(key);if(!state){state={};executions.set(key,state);}return state;}
  function lifecycleProgress(key){let state=lifecycles.get(key);if(!state){state={};lifecycles.set(key,state);}return state;}
  const finalized=base=>base.setup.candidates.every(c=>c.targetSelection?.status==='passed'
    && finalObservation(c.checks.antiConfluences,'antiConfluences') && finalObservation(c.checks.confluences,'confluences'))
    && base.setup.classifications.every(c=>c.outerTrend!=='unknown'
      && (c.currentTrend!=='unknown' || c.reason==='äußerster M5-Trend gegen Setup-Richtung'));
  const evaluateAt=(at,sources)=>{
    for (const source of sources) if (!recognized.get(source.tradeSetupId) || !finalized(recognized.get(source.tradeSetupId))) {
      const recognitionTime=setup1RecognitionTime(source);
      evaluations++;
      recognized.set(source.tradeSetupId,evaluateCountertrendChecklist({...input,evaluatedAt:recognitionTime,tradeSetups:[source],
        m5Candles:m5.filter(c=>c.time+300<=recognitionTime),h1Candles:h1.filter(c=>c.time+3600<=recognitionTime),
        setupClassificationCache:classificationCache,setupMemo,closeReactionCache,detectScanOrderBlocks:useMemo?detectScanOrderBlocks:undefined}));
    }
    const bases=sources.map(source=>recognized.get(source.tradeSetupId)).sort((a,b)=>b.evaluatedAt-a.evaluatedAt);
    const base=bases.find(b=>b.setup.candidates.length) ?? bases[0];
    const outcomes=outcomesAt(at,sources);
    const candidates=bases.flatMap(b=>b.setup.candidates).map(candidate=>{
      const lifecycle=evaluateCountertrendLifecycle({selection:candidate.targetSelection,invalidation:candidate.invalidation,
        candles:m5,m1Candles:m1,evaluatedAt:at,entries:outcomes.get(candidate.id) ?? [],
        progress:useMemo ? lifecycleProgress(candidate.id) : undefined});
      return {...candidate,knownAsOf:at,lifecycle,validity:lifecycle.main};
    });
    const primary=candidates[0] ?? base.setup.primary;
    const result={...base,evaluatedAt:at,checks:primary?.checks ?? base.checks,
      setup:{...base.setup,primary,candidates},context:{...base.context,evaluatedAt:at,m5Candles:closedM5At(at)}};
    result.dealingRange=evaluateDealingRange(result);
    return result;
  };
  const save=async checklist=>{
    for (const candidate of checklist.setup.candidates) {
      if(checklist.evaluatedAt>=fromTime)checklistHistory.record(checklist,candidate);
      const {evaluatedAt: ignoredAt,...lifecycle}=candidate.lifecycle ?? {};
      const key=JSON.stringify([evaluateDealingRange(checklist,candidate).status,lifecycle]);
      if (checklist.evaluatedAt<fromTime || saved.get(candidate.id)===key) continue;
      const snapshot=buildTradeSetup2CandidateSnapshot({checklist,candidate});
      if (snapshot) { saved.set(candidate.id,key); snapshots.push(snapshot); await onSnapshot?.(snapshot); }
    }
  };
  // Exakte Live-Erkennung zwischen zwei M5-Schlüssen bleibt erhalten (Referenz 105).
  const start=Math.max(fromTime,Math.min(...setups.map(s=>s.at)));
  const steps=[...new Set([start,...setups.map(s=>s.at).filter(at=>at>=start),
    ...m5.map(c=>c.time+300).filter(at=>at>=start&&at<=toTime),toTime])].sort((a,b)=>a-b);
  let setupIndex=0;
  const known=new Map();
  for (const [index,at] of steps.entries()) {
    signal?.throwIfAborted();
    while(setupIndex<setups.length && setups[setupIndex].at<=at){const source=setups[setupIndex++].source;known.set(source.tradeSetupId,source);}
    const sources=[...known.values()];
    if(!sources.length){await onProgress?.({phase:'scan',completed:index+1,total:steps.length,evaluatedAt:at,
      entries:entries.length,setups:saved.size,m5Evaluations:evaluations,m1Candles:m1.length});
      if((index+1)%yieldEvery===0)await yieldControl();continue;}
    const checklist=evaluateAt(at,sources);
    await save(checklist);
    if(useMemo)for(const candidate of checklist.setup.candidates)if(candidate.lifecycle?.main.state==='ended'){
      known.delete(candidate.tradeSetupId);recognized.delete(candidate.tradeSetupId);
      lifecycles.delete(candidate.id);entryProgress.delete(candidate.id);searchThrough.delete(candidate.id);
    }
    if(useMemo)for(const source of sources){
      const base=recognized.get(source.tradeSetupId);
      if(base && finalized(base) && !base.setup.candidates.length){known.delete(source.tradeSetupId);recognized.delete(source.tradeSetupId);}
    }
    for (const candidate of checklist.setup.candidates) {
      const single={...checklist,checks:{...checklist.checks,...candidate.checks},direction:candidate.direction,
        setup:{...checklist.setup,primary:candidate},dealingRange:evaluateDealingRange(checklist,candidate)};
      const context=activeM1Context(single);
      if (!context) continue;
      const loadStart=m1LoadStart(context);
      if (loadM1Candles && loadStart<loadedFrom) {
        const rows=await loadM1Candles({fromTime:candidate.recognizedAt,
          structureFromTime:loadStart,toTime,instrument});
        signal?.throwIfAborted();
        m1=marked(rows);
        loadedFrom=loadStart;
      }
      const end=steps[index+1] ?? at;
      for (let minute=candleTimeIndex(m1,at-60);minute<m1.length;minute++) {
        const candle=m1[minute];
        if(!(candle.time+60<end || index===steps.length-1 && candle.time+60===end))break;
        const knownAt=candle.time+60;
        if(useMemo && knownAt<=(searchThrough.get(candidate.id) ?? -Infinity))continue;
        if(useMemo)searchThrough.set(candidate.id,knownAt);
        const current=evaluateAt(knownAt,[sources.find(s=>s.tradeSetupId===candidate.tradeSetupId)]);
        const active=activeM1Context(current);
        if(knownAt>=fromTime)for(const c of current.setup.candidates)checklistHistory.record(current,c,'M1');
        if (!active) break;
        const prefixEnd=candleTimeIndex(m1,candle.time)+1;
        const prefixStart=m1ScanPrefixStart(m1,m1LoadStart(active),M1_FRACTAL_SUPPORT);
        // Ein Entry entsteht ausschließlich beim FVG-Schluss; andere Minuten brauchen keine M1-Struktur.
        if(useMemo && !entryModel1FvgAt(m1,active.direction,prefixEnd,prefixStart))continue;
        const rows=m1.slice(prefixStart,prefixEnd);
        const structure=buildM1Structure(rows,active.anchor,knownAt);
        let follow=entryProgress.get(candidate.id);
        if(!follow){follow={detectM5OrderBlocks:rows=>detectScanOrderBlocks(rows,'5m')};entryProgress.set(candidate.id,follow);}
        const check=evaluateM1Checklist({context:active,structure,candles:rows,evaluatedAt:knownAt,closeReactionCache:m1Cache,
          entryProgress:useMemo ? follow : undefined});
        if(knownAt>=fromTime)checklistHistory.record(current,current.setup.primary,'M1',check);
        if (check.entry?.recognizedAt!==knownAt || seen.has(check.entry.id) || knownAt<fromTime) continue;
        const snapshot=createSetup2Entry({instrument,evaluatedAt:knownAt,tradingWindows:input.tradingWindows,sessionConfigs:input.sessionConfigs,news:input.news,newsLoadStatus:input.newsLoadStatus},
          ()=>buildTradeSetup2Snapshot({checklist:current,m1Check:check,m1Structure:structure,m1Candles:rows}));
        if (!snapshot) continue;
        checklistHistory.record(current,current.setup.primary,'M1',check,snapshot.entry);
        seen.add(snapshot.entry.id);entries.push(snapshot);snapshots.push(snapshot);await onSnapshot?.(snapshot);
      }
    }
    await onProgress?.({phase:'scan',completed:index+1,total:steps.length,evaluatedAt:at,
      entries:entries.length,setups:saved.size,m5Evaluations:evaluations,m1Candles:m1.length});
    if ((index+1)%yieldEvery===0) await yieldControl();
  }
  const latest=new Map(snapshots.filter(s=>s.rangeCourse).map(s=>[s.setupKey,s.rangeCourse]));
  return completeDealingRangePriceObservations(checklistHistory.complete(snapshots.map(s=>s.entry ? {...s,rangeCourse:latest.get(s.setupKey) ?? null} : s)),m5,toTime);
}
