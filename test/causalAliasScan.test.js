import {it,expect,vi} from 'vitest';
vi.mock('../src/countertrendChecklist.js',()=>({evaluateCountertrendChecklist:input=>{
 const s=input.tradeSetups[0],id=s.sourceKind?`XAUUSD:sweep-retest:${s.sourceKey}`:`XAUUSD:setup1:${s.tradeSetupId}`;
 const at=s.createdAt,checks={liquiditySweep:{status:'passed'},reaction:{status:'passed'},m5Trend:{status:'passed'},outerM5Trend:{status:'passed'},
  antiConfluences:{status:'clear',rules:[]},confluences:{status:'clear',rules:[]}};
 const primary={id,sourceId:s.sourceKey??s.tradeSetupId,instrument:'XAUUSD',direction:'short',recognizedAt:at,knownAsOf:input.evaluatedAt,
  sourceFamilyKey:s.sourceFamilyKey,exitPolicy:'half-t1-be-rest-t2-exact-half-v1',checks,entryPattern:s.sourceKind?'pattern-r2':'pattern-legacy',
  targetSelection:{instrument:'XAUUSD',status:'passed',direction:'short',selectedAt:at,target1:{id:'target90',price:90,knownAt:1200}},invalidation:110,
  reactionOB:{startTime:0,top:110,bottom:105},sweep:{level:s.ls,timeframe:'5M'}};
 return {instrument:'XAUUSD',status:'ready',evaluatedAt:input.evaluatedAt,entryPattern:primary.entryPattern,checks,context:{},setup:{primary,candidates:[primary],
  classifications:[{outerTrend:'downtrend',currentTrend:'uptrend'}]}};
}}));
vi.mock('../src/tradeSetup2DealingRange.js',()=>({evaluateDealingRange:()=>({status:'validated'})}));
vi.mock('../src/m1Structure.js',()=>({activeM1Context:c=>{
 if(c.setup.primary.lifecycle?.entrySearchAllowed===false)return null;
 if(c.entryPattern!==c.setup.primary.entryPattern)throw new Error('Alias source pattern context crossed');
 return {instrument:'XAUUSD',direction:'short',setupKey:c.setup.primary.id,primary:c.setup.primary,
  anchor:{pivotTime:900,recognizedAt:c.setup.primary.recognizedAt}};},buildM1Structure:()=>({status:'ready',state:{}})}));
vi.mock('../src/m1Checklist.js',()=>({evaluateM1Checklist:({context,evaluatedAt})=>({evaluatedAt,entryPattern:context.primary.entryPattern,
 entry:evaluatedAt===2400?{id:context.setupKey+':entry',setupKey:context.setupKey,instrument:'XAUUSD',direction:'short',recognizedAt:2400,
 price:100,entryPattern:context.primary.entryPattern,conditions:{source:context.setupKey},stops:{wide:{price:110},narrow:{price:105}},
 scales:{wide:{targets:[{price:90}]},narrow:{targets:[{price:90}]}}}:null})}));
vi.mock('../src/tradeSetup2Snapshot.js',()=>({buildTradeSetup2CandidateSnapshot:()=>null,
 buildTradeSetup2Snapshot:({checklist,m1Check})=>({id:m1Check.entry.id,setupKey:m1Check.entry.setupKey,
 entry:{...m1Check.entry,ideaKey:checklist.setup.primary.ideaKey,ideaKnownAt:checklist.setup.primary.ideaBinding?.knownAt,
 sourceRecognizedAt:checklist.setup.primary.recognizedAt,exitPolicy:checklist.setup.primary.exitPolicy},checklist,m1Check})}));
vi.mock('../src/countertrendSnapshotCompletion.js',()=>({markCountertrendCandles:rows=>rows??[],completeCountertrendSnapshots:rows=>rows}));
vi.mock('../src/tradeSetup2ChecklistHistory.js',()=>({createChecklistHistoryRecorder:()=>({record(){},checkpoint:()=>[],entries:()=>[]})}));
vi.mock('../src/tradeSetupSimulation.js',()=>({evaluateSimulation:()=>({status:'notExecutable'})}));
import {scanCountertrendWindow} from '../src/countertrendScan.js';
const family='known-same-geometry',geometry={instrument:'XAUUSD',dir:1,obStartTime:0,obTop:110,obBottom:105,
 ls:{dir:1,price:108,pivotTime:300,touchedTime:900},sourceFamilyKey:family};
const sources=[{...geometry,sourceKind:'liquidity-sweep-existing-m5-ob-retest-v1',sourceKey:'r2',recognizedAt:1800,createdAt:1800,
 orderBlockKnownAt:600,sourceRetest:{recognizedAt:1800}},{...geometry,tradeSetupId:'legacy',createdAt:2160}];
const input={instrument:'XAUUSD',tradeSetups:sources,sourcesAssembled:true,includeSweepRetestSources:true,fromTime:1800,toTime:2460,
 checkpointIdentity:'synthetic-causal-alias-pipeline',m5Candles:[1500,1800,2100,2400].map(time=>({time,high:105,low:95,close:100})),
 m1Candles:Array.from({length:22},(_,i)=>({time:1200+i*60,high:105,low:95,close:100})),
 tradingWindows:{weekday:[[0,1440]],saturday:[[0,1440]],sunday:[[0,1440]]},onMinuteCheck:()=>{}};
it('coalesces one synthetic execution across known aliases while preserving both pattern facts',async()=>{
 const emitted=[],alarms=[];
 await scanCountertrendWindow({...input,onSnapshot:s=>emitted.push(structuredClone(s)),onMinuteCheck:m=>{if(m.snapshot)alarms.push(m.snapshot.entry.id);}});
 expect(emitted).toHaveLength(1);expect(alarms).toHaveLength(1);
 expect(emitted[0].entry.patternMatches.map(m=>m.entryPattern).sort()).toEqual(['pattern-legacy','pattern-r2']);
 expect(emitted[0].entry.patternMatches.map(m=>m.sourceKnownAt).sort()).toEqual([1800,2160]);
});
it('restores first target bindings across a mid-run checkpoint without duplicate executions',async()=>{
 const emitted=[];let state;
 await expect(scanCountertrendWindow({...input,collectSnapshots:false,onSnapshot:s=>emitted.push(structuredClone(s)),
 onCheckpoint:async(p,get)=>{if(p.evaluatedAt===2160){state=structuredClone(get());throw new Error('checkpoint-stop');}}})).rejects.toThrow('checkpoint-stop');
 expect(state.sourceIdeaBindings).toHaveLength(1);
 expect(state.sourceIdeaBindings[0][1].selection.selectedAt).toBe(1800);
 await scanCountertrendWindow({...input,collectSnapshots:false,resumeState:state,onSnapshot:s=>emitted.push(structuredClone(s))});
 expect(emitted).toHaveLength(1);expect(emitted[0].entry.patternMatches).toHaveLength(2);
});
