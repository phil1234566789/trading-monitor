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
import { m1ScanPrefix } from './m1ScanPrefix.js';

export async function scanCountertrendWindow(input) {
  const { instrument,fromTime,toTime,signal,onSnapshot,onProgress,loadM1Candles,
    yieldEvery=32,yieldControl=()=>Promise.resolve() }=input;
  const setups=(input.tradeSetups ?? []).filter(s=>s.instrument===instrument)
    .map(s=>({source:s,at:setup1RecognitionTime(s)})).filter(s=>s.at<=toTime);
  if (!setups.length) {
    await onProgress?.({phase:'scan',completed:0,total:0,m5Evaluations:0,m1Candles:0}); return [];
  }
  const ordered=rows=>(rows ?? []).slice().sort((a,b)=>a.time-b.time);
  const marked=rows=>markIgnoredCandles(ordered(rows),input.sessionConfigs?.filter(s=>s.instrument===instrument) ?? [],
    sec=>berlinOffsetMinutes(sec*1000));
  const m5=marked(input.m5Candles),h1=ordered(input.h1Candles);
  let m1=marked(input.m1Candles),loadedFrom=Infinity;
  const snapshots=[],entries=[...(input.existingEntries ?? [])],saved=new Map(),seen=new Set(entries.map(s=>s.setupKey));
  const classificationCache=new Map(),closeReactionCache=createCloseReactionCache(),m1Cache=createCloseReactionCache();
  const recognized=new Map();
  let evaluations=0;
  const outcomesAt=at=>{
    const outcomes=new Map();
    for (const snapshot of entries) {
      const outcomesForEntry=['wide','narrow'].map(variant=>evaluateSimulation({entry:snapshot.entry,variant,
        candles:m1,evaluatedAt:at,target1:snapshot.entry.scales[variant].targets[0]?.price,
        target2:snapshot.entry.scales[variant].targets[1]?.price ?? null})).filter(e=>e.status!=='notExecutable');
      outcomes.set(snapshot.setupKey,[...(outcomes.get(snapshot.setupKey) ?? []),...outcomesForEntry]);
    }
    return outcomes;
  };
  const evaluateAt=(at,sources)=>{
    for (const source of sources) if (!recognized.has(source.tradeSetupId)) {
      const recognitionTime=setup1RecognitionTime(source);
      evaluations++;
      recognized.set(source.tradeSetupId,evaluateCountertrendChecklist({...input,evaluatedAt:recognitionTime,tradeSetups:[source],
        m5Candles:m5.filter(c=>c.time+300<=recognitionTime),h1Candles:h1.filter(c=>c.time+3600<=recognitionTime),
        setupClassificationCache:classificationCache,closeReactionCache}));
    }
    const bases=sources.map(source=>recognized.get(source.tradeSetupId)).sort((a,b)=>b.evaluatedAt-a.evaluatedAt);
    const base=bases.find(b=>b.setup.candidates.length) ?? bases[0];
    const outcomes=outcomesAt(at);
    const candidates=bases.flatMap(b=>b.setup.candidates).map(candidate=>{
      const lifecycle=evaluateCountertrendLifecycle({selection:candidate.targetSelection,invalidation:candidate.invalidation,
        candles:m5,m1Candles:m1,evaluatedAt:at,entries:outcomes.get(candidate.id) ?? []});
      return {...candidate,knownAsOf:at,lifecycle,validity:lifecycle.main};
    });
    const primary=candidates[0] ?? base.setup.primary;
    const result={...base,evaluatedAt:at,checks:primary?.checks ?? base.checks,
      setup:{...base.setup,primary,candidates},context:{...base.context,evaluatedAt:at}};
    result.dealingRange=evaluateDealingRange(result);
    return result;
  };
  const save=async checklist=>{
    for (const candidate of checklist.setup.candidates) {
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
  for (const [index,at] of steps.entries()) {
    signal?.throwIfAborted();
    const sources=setups.filter(s=>s.at<=at).map(s=>s.source);
    const checklist=evaluateAt(at,sources);
    await save(checklist);
    for (const candidate of checklist.setup.candidates) {
      const single={...checklist,checks:{...checklist.checks,...candidate.checks},direction:candidate.direction,
        setup:{...checklist.setup,primary:candidate},dealingRange:evaluateDealingRange(checklist,candidate)};
      const context=activeM1Context(single);
      if (!context || seen.has(candidate.id)) continue;
      if (loadM1Candles && candidate.recognizedAt<loadedFrom) {
        const rows=await loadM1Candles({fromTime:candidate.recognizedAt,
          structureFromTime:Math.min(context.anchor.pivotTime,candidate.recognizedAt),toTime,instrument});
        signal?.throwIfAborted();
        m1=marked(rows);
        loadedFrom=candidate.recognizedAt;
      }
      const end=steps[index+1] ?? at;
      for (const candle of m1.filter(c=>c.time+60>=at && (c.time+60<end || index===steps.length-1 && c.time+60===end))) {
        const knownAt=candle.time+60;
        const current=evaluateAt(knownAt,[sources.find(s=>s.tradeSetupId===candidate.tradeSetupId)]);
        const active=activeM1Context(current);
        if (!active) break;
        const rows=m1ScanPrefix(m1,Math.min(active.anchor.pivotTime,candidate.recognizedAt),m1.findIndex(c=>c.time===candle.time)+1);
        const structure=buildM1Structure(rows,active.anchor,knownAt);
        const check=evaluateM1Checklist({context:active,structure,candles:rows,evaluatedAt:knownAt,closeReactionCache:m1Cache});
        if (check.entry?.recognizedAt!==knownAt) continue;
        const snapshot=createSetup2Entry({instrument,evaluatedAt:knownAt,tradingWindows:input.tradingWindows,sessionConfigs:input.sessionConfigs,news:input.news,newsLoadStatus:input.newsLoadStatus},
          ()=>buildTradeSetup2Snapshot({checklist:current,m1Check:check,m1Structure:structure,m1Candles:rows}));
        if (!snapshot) continue;
        seen.add(candidate.id);entries.push(snapshot);snapshots.push(snapshot);await onSnapshot?.(snapshot);break;
      }
    }
    await onProgress?.({phase:'scan',completed:index+1,total:steps.length,evaluatedAt:at,
      entries:entries.length,setups:saved.size,m5Evaluations:evaluations,m1Candles:m1.length});
    if ((index+1)%yieldEvery===0) await yieldControl();
  }
  const latest=new Map(snapshots.filter(s=>s.rangeCourse).map(s=>[s.setupKey,s.rangeCourse]));
  return snapshots.map(s=>s.entry ? {...s,rangeCourse:latest.get(s.setupKey) ?? null} : s);
}
