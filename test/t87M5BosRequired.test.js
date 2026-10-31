import {describe,it,expect} from 'vitest';
import {ENTRY_PATTERN_1_VERSION,entryPattern1ConditionsReady,entryPattern1StructureCategory} from '../src/entryPattern1Conditions.js';
import {entryRiskScale} from '../src/entryRisk.js';
import {usesEntryPattern1TargetReplacement} from '../src/entryPattern1Targets.js';
import {entrySizingAt} from '../src/tradeSetup2EntrySizing.js';
import {sizeSimulation} from '../src/tradeSetupSimulation.js';
import {minuteAlarmEvents} from '../services/setup2/events.js';
const at=Date.parse('2026-10-30T12:00:00+01:00')/1000,windows={weekday:[[0,1440]],saturday:[],sunday:[]};
const facts=direction=>({m5Bos:{type:'BOS',direction,originTime:at-600,recognizedAt:at-180},
 m5Countertrend:{trend:direction==='short'?'uptrend':'downtrend',recognizedAt:at-300,range:{[direction==='short'?'high':'low']:{pivotTime:at-600}}},
 m1PivotBreak:{type:'pivot-break',direction,recognizedAt:at-120},retest:{recognizedAt:at-60,orderBlock:{dir:direction==='short'?-1:1,startTime:at-600}},fvg:{direction,recognizedAt:at}});
describe.each(['short','long'])('T87 mandatory M5 BOS %s',direction=>{
 it('rejects otherwise executable current entries without BOS and keeps explicit historical v10 semantics',()=>{
  const conditions={...facts(direction),m5Bos:null};
  expect(entryPattern1ConditionsReady(conditions,direction,at)).toBe(false);
  expect(entryPattern1StructureCategory(conditions,direction,at)).toBeNull();
  expect(entryPattern1ConditionsReady(conditions,direction,at,'countertrend-entry-model-1-v10')).toBe(true);
  expect(entryPattern1StructureCategory(conditions,direction,at,'countertrend-entry-model-1-v10')).toBe('risky');
 });
 it('requires the matching causal BOS and retains all other mandatory facts',()=>{
  const conditions=facts(direction);
  expect(entryPattern1ConditionsReady(conditions,direction,at)).toBe(true);
  for(const m5Bos of [null,{...conditions.m5Bos,recognizedAt:at+60},{...conditions.m5Bos,originTime:at-601},{...conditions.m5Bos,direction:direction==='short'?'long':'short'}])
   expect(entryPattern1ConditionsReady({...conditions,m5Bos},direction,at)).toBe(false);
  for(const key of ['m5Countertrend','m1PivotBreak','retest','fvg'])expect(entryPattern1ConditionsReady({...conditions,[key]:null},direction,at)).toBe(false);
  const entry={direction,recognizedAt:at,conditions,entryPattern:ENTRY_PATTERN_1_VERSION};
  expect(entrySizingAt({evaluatedAt:at},entry)).toMatchObject({entryCategory:'full',factor:1,positionSizeFactor:1});
 });
 it('waits for both known structure signals and gates retest and entry alarms too',()=>{
  const conditions=facts(direction),context={instrument:'GBPUSD',direction,setupKey:'t87',validatedAt:at-600};
  const emit=(value,knownAt,snapshot=null,tradeWindows=windows)=>minuteAlarmEvents({context,check:{conditions:value,entryPattern:ENTRY_PATTERN_1_VERSION},knownAt,snapshot},tradeWindows);
  expect(emit(conditions,at-180)).toEqual([]);
  expect(emit(conditions,at-120).map(e=>e.stage)).toEqual([1]);
  expect(emit(conditions,at-60).map(e=>e.stage)).toEqual([2]);
  const entry={id:'t87',instrument:'GBPUSD',direction,recognizedAt:at,entryPattern:ENTRY_PATTERN_1_VERSION,
   entryCategory:'full',optionalConditionsMissing:[],conditions,price:1.3,stops:{wide:{price:direction==='short'?1.3005:1.2995}},
   sizing:{version:'relative-full-entry-v3',model:'relative-full-entry',evaluatedAt:at,entryCategory:'full',positionSizeFactor:1,fullFactor:1,factor:1}};
  expect(emit(conditions,at,{entry}).map(e=>e.stage)).toEqual([3]);
  const risky={...entry,entryCategory:'risky',optionalConditionsMissing:['m5Bos'],sizing:{...entry.sizing,entryCategory:'risky',positionSizeFactor:.5,factor:.5}};
  expect(sizeSimulation(risky,'wide')).toMatchObject({status:'notExecutable',reason:'invalidSizing'});
  expect(emit({...conditions,m5Bos:null},at,{entry})).toEqual([]);
  expect(emit(conditions,at,{entry:{...entry,conditions:{...conditions,m5Bos:null}}})).toEqual([]);
  expect(emit(conditions,at,{entry},{weekday:[],saturday:[],sunday:[]})).toEqual([]);
 });
});

it('retains target replacement and the six-pip wide stop without changing narrow or other patterns',()=>{
 expect(usesEntryPattern1TargetReplacement(ENTRY_PATTERN_1_VERSION)).toBe(true);
 const risk=(variant,entryPattern=ENTRY_PATTERN_1_VERSION)=>entryRiskScale(1.3,1.301,[],'GBPUSD','short',{variant,entryPattern});
 expect(risk('wide').riskPips).toBeCloseTo(6);expect(risk('narrow').riskPips).toBeCloseTo(10);
 expect(risk('wide','countertrend-entry-model-1-v7').riskPips).toBeCloseTo(10);
});
