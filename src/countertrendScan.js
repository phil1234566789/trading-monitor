import {createSharedOrderBlockDetector} from './sharedOrderBlocks.js';
import { setupSourceRecognitionTime,setupSourceId,setupSourceKey,assembleSetupSources } from './setupSources.js';
import { evaluateCountertrendChecklist } from './countertrendChecklist.js';
import { evaluateDealingRange } from './tradeSetup2DealingRange.js';
import { activeM1Context, buildM1Structure } from './m1Structure.js';
import { evaluateM1Checklist } from './m1Checklist.js';
import { buildTradeSetup2Snapshot, buildTradeSetup2CandidateSnapshot } from './tradeSetup2Snapshot.js';
import { evaluateSimulation } from './tradeSetupSimulation.js';
import { evaluateCountertrendLifecycle } from './countertrendLifecycle.js';
import { createSetup2Entry,gateM1ChecklistEntries } from './tradeSetup2EntryGate.js';
import { createCloseReactionCache } from './m5CloseReactionHistory.js';
import { m1ScanPrefixStart } from './m1ScanPrefix.js';
import { m1LoadStart } from './m1StructureStart.js';
import { M1_FRACTAL_SUPPORT } from './m1StructureSettings.js';
import { candleTimeIndex } from './candleTimeIndex.js';
import { createClosedCandlePrefix } from './closedCandlePrefix.js';
import { createSetup2Memo,finalObservation } from './setup2Memo.js';
import { entryPattern1FvgAt } from './entryPattern1Progress.js';
import {completeCountertrendSnapshots,markCountertrendCandles} from './countertrendSnapshotCompletion.js';
import {validateCountertrendResume,countertrendScanState} from './countertrendScanState.js';
import { createChecklistHistoryRecorder } from './tradeSetup2ChecklistHistory.js';
import {bindKnownSourceIdeas} from './setupSourceIdeaBindings.js';
import {knownSourceIdeaKey} from './setupSourceIdeaIdentity.js';
import {naturalSourceFamilyKey} from './setupSourceFamily.js';
import {evaluateSourceIdeaLifecycles} from './sourceIdeaLifecycle.js';
import {sourceExecutionKey,mergeSourceExecutionFacts} from './sourceExecutionFacts.js';

export async function scanCountertrendWindow(input) {
  const { instrument,fromTime,toTime,signal,onSnapshot,onProgress,onMinuteCheck,loadM1Candles,
    useMemo=true,yieldEvery=32,yieldControl=()=>Promise.resolve() }=input;
  let yieldedAt=Date.now(),minuteWork=0;
  const cooperate=async()=>{
    if(++minuteWork%yieldEvery===0 || Date.now()-yieldedAt>=25){await yieldControl();yieldedAt=Date.now();}
  };
  const setups=assembleSetupSources({...input,evaluatedAt:toTime}).filter(s=>s.instrument===instrument)
    .map(s=>({source:s,at:setupSourceRecognitionTime(s)})).filter(s=>s.at<=toTime).sort((a,b)=>a.at-b.at);
  if (!setups.length) {
    await onProgress?.({phase:'scan',completed:0,total:0,m5Evaluations:0,m1Candles:0}); return [];
  }
  const ordered=rows=>(rows ?? []).slice().sort((a,b)=>a.time-b.time);
  const marked=rows=>markCountertrendCandles(rows,instrument,input.sessionConfigs);
  const m5=marked(input.m5Candles),h1=ordered(input.h1Candles);
  const closedM5At=createClosedCandlePrefix(m5,300);
  // Exakte Live-Erkennung zwischen zwei M5-Schlüssen bleibt erhalten (Referenz 105).
  const start=Math.max(fromTime,Math.min(...setups.map(s=>s.at)));
  const steps=[...new Set([start,...setups.map(s=>s.at).filter(at=>at>=start),
    ...m5.map(c=>c.time+300).filter(at=>at>=start&&at<=toTime),toTime])].sort((a,b)=>a-b);
  validateCountertrendResume(input,steps);
  const resume=input.resumeState,collectSnapshots=input.collectSnapshots!==false;
  if(!collectSnapshots&&!onSnapshot)throw new Error('Streamed scan requires a snapshot sink');
  let m1=marked(input.m1Candles),loadedFrom=resume?.loadedFrom??Infinity;
  const snapshots=[],entries=[...(resume?.entries??input.existingEntries??[])],saved=new Map(resume?.saved),seen=new Set(resume?.seen??entries.map(s=>s.entry.id));
  const sourceIdeaBindings=input.sourceIdeaBindings??new Map(resume?.sourceIdeaBindings);
  const executionsSeen=new Map(entries.map(s=>[sourceExecutionKey(s),s]).filter(([key])=>key));
  let entryCount=resume?.entryCount??entries.length;
  const emit=async snapshot=>{if(collectSnapshots)snapshots.push(snapshot);await onSnapshot?.(snapshot);};
  const checklistHistory=createChecklistHistoryRecorder({resumeState:resume?.history,retainHistory:collectSnapshots,onRecord:input.onHistory});
  const memo=input.scanMemo ?? {};
  const classificationCache=memo.classificationCache ??= new Map(),closeReactionCache=memo.closeReactionCache ??= createCloseReactionCache(),m1Cache=createCloseReactionCache();
  const recognized=new Map();
  const setupMemo=useMemo ? (memo.setupMemo ??= createSetup2Memo()) : null,lifecycles=createSetup2Memo(200,resume?.lifecycles),executions=createSetup2Memo(200,resume?.executions);
  const searchThrough=createSetup2Memo(200,resume?.searchThrough),entryProgress=createSetup2Memo(200,resume?.entryProgress);
  const orderBlockDetectors=new Map();
  const detectScanOrderBlocks=(rows,timeframe,isForex=true,minGapOverride=null)=>{
    const key=JSON.stringify([timeframe,isForex,minGapOverride]);
    if(!orderBlockDetectors.has(key))orderBlockDetectors.set(key,createSharedOrderBlockDetector(timeframe,isForex,minGapOverride));
    return orderBlockDetectors.get(key)(rows);
  };
  let evaluations=resume?.evaluations??0;
  const rebuilding=new Set(resume?.recognizedFinalized);
  const outcomesAt=(at,sources,candidates=[])=>{
    const outcomes=new Map();
    const ideaBySource=new Map(candidates.map(c=>[c.id,c.ideaKey]));
    const ideas=new Set(candidates.map(c=>c.ideaKey).filter(Boolean));
    for (const snapshot of entries) {
      if(input.includeSweepRetestSources&&snapshot.entry.recognizedAt>at)continue;
      const idea=snapshot.entry.ideaKey??ideaBySource.get(snapshot.setupKey);
      if(useMemo && !sources.some(s=>snapshot.setupKey===setupSourceKey(s))&&!(idea&&ideas.has(idea)))continue;
      const outcomesForEntry=['wide','narrow'].map(variant=>{
        const progress=useMemo ? executionProgress(`${snapshot.entry.id}:${variant}`) : undefined;
        if(progress?.final && progress.final.evaluatedAt<=at)return {...progress.final,evaluatedAt:at};
        const outcome=evaluateSimulation({entry:snapshot.entry,variant,
        candles:m1,evaluatedAt:at,target1:snapshot.entry.scales[variant].targets[0]?.price,
        target2:snapshot.entry.scales[variant].targets[1]?.price ?? null,
        progress});
        if(progress && outcome.status==='closed')progress.final=outcome;
        return outcome;
      });
      outcomes.set(snapshot.setupKey,[...(outcomes.get(snapshot.setupKey) ?? []),...outcomesForEntry]);
      if(idea)outcomes.set(idea,[...(outcomes.get(idea)??[]),...outcomesForEntry]);
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
    const requested=sources.length===1?setupSourceKey(sources[0]):null;
    if(input.includeSweepRetestSources){
      const families=new Set(sources.map(naturalSourceFamilyKey).filter(Boolean));
      sources=[...new Map([...sources,...[...known.values()].filter(s=>setupSourceRecognitionTime(s)<=at&&families.has(naturalSourceFamilyKey(s)))]
        .map(s=>[setupSourceKey(s),s])).values()];
    }
    for (const source of sources) if (!recognized.get(setupSourceId(source)) || !finalized(recognized.get(setupSourceId(source)))) {
      const recognitionTime=setupSourceRecognitionTime(source);
      if(!rebuilding.delete(setupSourceId(source)))evaluations++;
      recognized.set(setupSourceId(source),evaluateCountertrendChecklist({...input,sourcesAssembled:true,evaluatedAt:recognitionTime,tradeSetups:[source],
        m5Candles:m5.filter(c=>c.time+300<=recognitionTime),h1Candles:h1.filter(c=>c.time+3600<=recognitionTime),
        setupClassificationCache:classificationCache,setupMemo,closeReactionCache,detectScanOrderBlocks:useMemo?detectScanOrderBlocks:undefined}));
    }
    const bases=sources.map(source=>recognized.get(setupSourceId(source))).sort((a,b)=>b.evaluatedAt-a.evaluatedAt);
    const base=bases.find(b=>b.setup.candidates.length) ?? bases[0];
    const originals=bases.flatMap(b=>b.setup.candidates);
    const bound=input.includeSweepRetestSources?bindKnownSourceIdeas(originals,at,sourceIdeaBindings,knownSourceIdeaKey):originals;
    const outcomes=outcomesAt(at,sources,bound);
    const candidates=input.includeSweepRetestSources?evaluateSourceIdeaLifecycles(bound,{evaluatedAt:at,
      bindings:sourceIdeaBindings,signature:knownSourceIdeaKey,outcomes,evaluateLifecycle:evaluateCountertrendLifecycle,
      candles:m5,m1Candles:m1,allowSpreadHourGaps:input.settings?.allowSpreadHourGaps,
      progressFor:useMemo?lifecycleProgress:undefined}):bound.map(candidate=>{
      const lifecycle=evaluateCountertrendLifecycle({selection:candidate.targetSelection,invalidation:candidate.invalidation,
        candles:m5,m1Candles:m1,evaluatedAt:at,entries:outcomes.get(candidate.id) ?? [],
        allowSpreadHourGaps:input.settings?.allowSpreadHourGaps,
        progress:useMemo ? lifecycleProgress(candidate.id) : undefined});
      return {...candidate,knownAsOf:at,lifecycle,validity:lifecycle.main};
    });
    const primary=(requested?candidates.find(c=>c.id===requested):null)??candidates[0] ?? base.setup.primary;
    const result={...base,evaluatedAt:at,entryPattern:primary?.entryPattern??base.entryPattern,
      entryPatterns:primary?.entryPatterns??base.entryPatterns,checks:primary?.checks ?? base.checks,
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
      if (snapshot) { saved.set(candidate.id,key); await emit(snapshot); }
    }
  };
  let setupIndex=resume?.setupIndex??0;
  const sourcesById=new Map(setups.map(s=>[setupSourceId(s.source),s.source]));
  const known=new Map((resume?.knownIds??[]).map(id=>{if(!sourcesById.has(id))throw new Error('Checkpoint setup source missing');return[id,sourcesById.get(id)];}));
  const checkpoint=async(index,at)=>{await input.onCheckpoint?.({completed:index+1,total:steps.length,evaluatedAt:at},()=>countertrendScanState({input,steps,nextStep:index+1,setupIndex,known,saved,seen,entries,entryCount,evaluations,loadedFrom,lifecycles,executions,searchThrough,entryProgress,checklistHistory,recognized,finalized,sourceIdeaBindings}));};
  for(let index=resume?.nextStep??0;index<steps.length;index++){
    const at=steps[index];
    const pendingEntries=new Map();
    signal?.throwIfAborted();
    while(setupIndex<setups.length && setups[setupIndex].at<=at){const source=setups[setupIndex++].source;known.set(setupSourceId(source),source);}
    const sources=[...known.values()];
    if(!sources.length){await onProgress?.({phase:'scan',completed:index+1,total:steps.length,evaluatedAt:at,
      entries:entryCount,setups:saved.size,m5Evaluations:evaluations,m1Candles:m1.length});
      await checkpoint(index,at);if((index+1)%yieldEvery===0)await yieldControl();continue;}
    const checklist=evaluateAt(at,sources);
    await save(checklist);
    if(useMemo)for(const candidate of checklist.setup.candidates)if(candidate.lifecycle?.main.state==='ended'){
      known.delete(candidate.sourceId);recognized.delete(candidate.sourceId);
      lifecycles.delete(candidate.id);entryProgress.delete(candidate.id);searchThrough.delete(candidate.id);
    }
    if(useMemo)for(const source of sources){
      const base=recognized.get(setupSourceId(source));
      if(base && finalized(base) && !base.setup.candidates.length){known.delete(setupSourceId(source));recognized.delete(setupSourceId(source));}
    }
    for (const candidate of checklist.setup.candidates) {
      const single={...checklist,entryPattern:candidate.entryPattern,checks:{...checklist.checks,...candidate.checks},direction:candidate.direction,
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
        // Historische M1-Schleifen müssen auch Netzwerk und andere Instrumentjobs weiterlaufen lassen.
        await cooperate();signal?.throwIfAborted();
        const candle=m1[minute];
        if(!(candle.time+60<end || index===steps.length-1 && candle.time+60===end))break;
        const knownAt=candle.time+60;
        if(useMemo && knownAt<=(searchThrough.get(candidate.id) ?? -Infinity))continue;
        if(useMemo)searchThrough.set(candidate.id,knownAt);
        const current=evaluateAt(knownAt,[sources.find(s=>setupSourceId(s)===candidate.sourceId)]);
        const active=activeM1Context(current);
        if(knownAt>=fromTime)for(const c of current.setup.candidates)checklistHistory.record(current,c,'M1');
        if (!active) break;
        const prefixEnd=candleTimeIndex(m1,candle.time)+1;
        const prefixStart=m1ScanPrefixStart(m1,m1LoadStart(active),M1_FRACTAL_SUPPORT);
        // Ein Entry entsteht ausschließlich beim FVG-Schluss; andere Minuten brauchen keine M1-Struktur.
        if(useMemo && !onMinuteCheck && !entryPattern1FvgAt(m1,active.direction,prefixEnd,prefixStart))continue;
        const rows=m1.slice(prefixStart,prefixEnd);
        const structure=buildM1Structure(rows,active.anchor,knownAt);
        let follow=entryProgress.get(candidate.id);
        if(!follow){follow={};entryProgress.set(candidate.id,follow);}
        follow.detectM5OrderBlocks??=rows=>detectScanOrderBlocks(rows,'5m');
        const rawCombined=evaluateM1Checklist({context:active,structure,candles:rows,evaluatedAt:knownAt,closeReactionCache:m1Cache,
          entryProgress:useMemo ? follow : undefined});
        const combined=input.includeSweepRetestSources?gateM1ChecklistEntries(rawCombined,{...input,instrument}):rawCombined;
        if(knownAt>=fromTime)checklistHistory.record(current,current.setup.primary,'M1',combined);
        for(const patternCheck of combined.patterns ?? [combined]){
        const grouped=combined.entryChecks?.find(item=>item.entry.id===patternCheck.entry?.id);
        const check=combined.entryChecks?{...patternCheck,entry:grouped?.entry ?? null}:patternCheck;
        const newEntry=check.entry?.recognizedAt===knownAt && !seen.has(check.entry.id) && knownAt>=fromTime;
        let snapshot=newEntry && createSetup2Entry({instrument,evaluatedAt:knownAt,tradingWindows:input.tradingWindows,sessionConfigs:input.sessionConfigs,news:input.news,newsLoadStatus:input.newsLoadStatus},
          ()=>buildTradeSetup2Snapshot({checklist:current,m1Check:check,m1Structure:structure,m1Candles:rows}));
        const executionKey=snapshot&&sourceExecutionKey(snapshot),previous=executionKey&&executionsSeen.get(executionKey);
        if(previous&&mergeSourceExecutionFacts(previous,snapshot)){
          seen.add(snapshot.entry.id);checklistHistory.record(current,current.setup.primary,'M1',check,snapshot.entry);snapshot=null;
        }
        // Live-Vorwarnungen brauchen auch Minuten ohne FVG; Batch bleibt unverändert.
        if(knownAt>=fromTime)await onMinuteCheck?.({checklist:current,context:active,check,combinedCheck:combined,knownAt,snapshot:snapshot || null});
        if (!snapshot) continue;
        checklistHistory.record(current,current.setup.primary,'M1',check,snapshot.entry);
        seen.add(snapshot.entry.id);entryCount++;entries.push(collectSnapshots?snapshot:{setupKey:snapshot.setupKey,entry:snapshot.entry});
        if(executionKey){executionsSeen.set(executionKey,snapshot);pendingEntries.set(snapshot.entry.id,snapshot);}else await emit(snapshot);
        }
      }
    }
    for(const snapshot of pendingEntries.values())await emit(snapshot);
    await onProgress?.({phase:'scan',completed:index+1,total:steps.length,evaluatedAt:at,
      entries:entryCount,setups:saved.size,m5Evaluations:evaluations,m1Candles:m1.length});
    await checkpoint(index,at);
    if ((index+1)%yieldEvery===0) await yieldControl();
  }
  return collectSnapshots?completeCountertrendSnapshots(snapshots,m5,toTime,checklistHistory.entries):[];
}
