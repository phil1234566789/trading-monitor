import {describe,it,expect} from 'vitest';
import {ENTRY_PATTERN_1_VERSION,entryPattern1ConditionsReady,entryPattern1StructureCategory} from '../src/entryPattern1Conditions.js';
import {entryCategoryOf,entryCategoryLabel} from '../src/entryCategory.js';
import {entrySizingAt,entryAgainstM5Allowed} from '../src/tradeSetup2EntrySizing.js';
import {sizeSimulation} from '../src/tradeSetupSimulation.js';
import {minuteAlarmEvents} from '../services/setup2/events.js';
import {notificationText} from '../supabase/functions/_shared/setup2Notifications.js';
const at=Date.parse('2026-10-07T10:00:00Z')/1000;
const windows={weekday:[[0,1440]],saturday:[],sunday:[]};
function facts(direction='short',bos=false){return {
 m5Bos:bos?{type:'BOS',direction,originTime:at-1200,recognizedAt:at-120}:null,
 m5Countertrend:{trend:direction==='short'?'uptrend':'downtrend',recognizedAt:at-300,
  range:{[direction==='short'?'high':'low']:{pivotTime:at-1200}}},
 m1PivotBreak:{type:'pivot-break',direction,recognizedAt:at-180},
 retest:{recognizedAt:at-60,orderBlock:{dir:direction==='short'?-1:1,startTime:at-600}},
 fvg:{direction,recognizedAt:at}
};}
function entry(direction='short',bos=false,stopDistance=.00133){
 const conditions=facts(direction,bos),entryCategory=entryPattern1StructureCategory(conditions,direction,at);
 const value={id:'test',instrument:'GBPUSD',direction,entryPattern:ENTRY_PATTERN_1_VERSION,recognizedAt:at,
  entryCategory,optionalConditionsMissing:entryCategory==='full'?[]:['m5Bos'],conditions,
  price:1.3,stops:{narrow:{price:1.3+(direction==='short'?1:-1)*stopDistance}}};
 return {...value,sizing:entrySizingAt({evaluatedAt:at},value)};
}
describe.each(['short','long'])('T70 relative Full/Risky %s',direction=>{
 it('makes only the valid M5-BOS optional, preserving every other mandatory fact and legacy v9',()=>{
  const conditions=facts(direction);
  expect(entryPattern1ConditionsReady(conditions,direction,at)).toBe(true);
  expect(entryPattern1ConditionsReady(conditions,direction,at,'countertrend-entry-model-1-v9')).toBe(false);
  expect(entryPattern1StructureCategory(conditions,direction,at)).toBe('risky');
  for(const key of ['m5Countertrend','m1PivotBreak','retest','fvg']){
   expect(entryPattern1ConditionsReady({...conditions,[key]:null},direction,at)).toBe(false);
   if(key!=='retest' && key!=='fvg')expect(entryPattern1ConditionsReady({...conditions,[key]:{...conditions[key],recognizedAt:at+60}},direction,at)).toBe(false);
  }
  const full=facts(direction,true);
  expect(entryPattern1StructureCategory(full,direction,at)).toBe('full');
  expect(entryAgainstM5Allowed({},entry(direction,true))).toBe(true);
  full.m5Bos.originTime--;
  expect(entryPattern1StructureCategory(full,direction,at)).toBe('risky');
 });
 it('halves the same whole-lot Full position, keeps actual risk, and never rounds up a zero-lot Risky',()=>{
  const full=sizeSimulation(entry(direction,true),'narrow'),risky=sizeSimulation(entry(direction),'narrow');
  expect(full).toMatchObject({status:'ready',entryCategory:'full',lots:3,fullLots:3,positionSizeFactor:1,fullRiskBudget:500});
  expect(risky).toMatchObject({status:'ready',entryCategory:'risky',lots:1,fullLots:3,positionSizeFactor:.5,riskBudget:250,actualRisk:133});
  expect(sizeSimulation(entry(direction,false,.00333),'narrow')).toMatchObject({status:'notExecutable',reason:'belowOneLot',fullLots:1,lots:0});
  const malformed=entry(direction);delete malformed.sizing;
  expect(sizeSimulation(malformed,'narrow')).toMatchObject({status:'notExecutable',reason:'invalidSizing'});
  expect(sizeSimulation({...entry(direction),entryCategory:'full'},'narrow').reason).toBe('invalidSizing');
 });
});
it('keeps unclassified historical sizes unclassified',()=>{
 expect(entryCategoryOf({sizing:{factor:.5},lots:1})).toBeNull();
 expect(entryCategoryLabel({})).toContain('Historischer Stand');
});
it('warns for Risky in all three causal stages with actual rounded Full/Risky lots, never old retests or future knowledge',()=>{
 const context={instrument:'GBPUSD',direction:'short',setupKey:'DR',validatedAt:at-600};
 const emit=(conditions,knownAt,snapshot=null)=>minuteAlarmEvents({context,check:{conditions,entryPattern:ENTRY_PATTERN_1_VERSION},knownAt,snapshot},windows);
 const conditions=facts();
 expect(emit(conditions,at-180).map(e=>e.stage)).toEqual([1]);
 expect(emit(conditions,at-60).map(e=>e.stage)).toEqual([2]);
 expect(emit({...conditions,retest:{...conditions.retest,recognizedAt:at-240}},at)).toEqual([]);
 expect(emit({...conditions,m5Countertrend:null},at-180)).toEqual([]);
 expect(emit({...conditions,m1PivotBreak:{...conditions.m1PivotBreak,recognizedAt:at+60}},at)).toEqual([]);
 const event=emit(conditions,at,{entry:entry()})[0];
 expect(event).toMatchObject({stage:3,payload:{entryCategory:'risky',positionSizeFactor:.5}});
 expect(notificationText(event)).toContain('Risky Entry');
 expect(notificationText(event)).toContain('1 Lots (Full: 3 Lots; 50 %)');
 expect(minuteAlarmEvents({context,check:{conditions,entryPattern:ENTRY_PATTERN_1_VERSION},knownAt:at,snapshot:{entry:entry()}},{weekday:[],saturday:[],sunday:[]})).toEqual([]);
});
