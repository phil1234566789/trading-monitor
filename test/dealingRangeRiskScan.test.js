
import {it,expect,vi} from 'vitest';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import * as checklistModule from '../src/countertrendChecklist.js';
import * as structureModule from '../src/m1Structure.js';
import * as m1Module from '../src/m1Checklist.js';
import original from './fixtures/eurusd-19982-joint-losses.json';

it('live-resumed DR19982 blocks the original 10:33 entry only after the second joint loss is known',async()=>{
 const start=original.entries[0].entry.recognizedAt,end=original.blockedEntry.recognizedAt+60;
 const source={tradeSetupId:19982,instrument:'EURUSD',createdAt:start-60,obStartTime:start-900};
 const key=original.source.setupKey,selection={status:'passed',direction:'short',selectedAt:start,
  target1:{price:1.11528,knownAt:start},target2:{price:1.11125,knownAt:start}};
 const checks={outerM5Trend:{status:'passed'},liquiditySweep:{status:'passed'},reaction:{status:'passed'},
  m5Trend:{status:'passed'},antiConfluences:{status:'clear',rules:[]},confluences:{status:'clear',rules:[]}};
 const base=vi.spyOn(checklistModule,'evaluateCountertrendChecklist').mockImplementation(({evaluatedAt})=>{
  const candidate={id:key,tradeSetupId:19982,setupType:'countertrend',direction:'short',recognizedAt:start-60,
   reactionRecognizedAt:start-60,knownAsOf:evaluatedAt,checks,targetSelection:selection,invalidation:1.12405,
   sweep:{level:{touchedTime:start-300,price:1.12284}}};
  return {status:'ready',model:'countertrend',ruleVersion:'countertrend-abcdef-v2',
   entryPattern:original.blockedEntry.entryPattern,instrument:'EURUSD',evaluatedAt,
   direction:'short',checks,setup:{primary:candidate,candidates:[candidate],classifications:[]},context:{}};
 });
 const structure=vi.spyOn(structureModule,'buildM1Structure').mockReturnValue({status:'ready'});
 const entryModel=vi.spyOn(m1Module,'evaluateM1Checklist').mockImplementation(({evaluatedAt})=>({
  evaluatedAt,entryPattern:original.blockedEntry.entryPattern,conditions:original.blockedEntry.conditions,
  entry:evaluatedAt===original.blockedEntry.recognizedAt ? original.blockedEntry : null}));
 const m1=[...original.candles,...original.postLossCandles];
 const input={instrument:'EURUSD',tradeSetups:[source],h1Candles:[],dailyAnchors:[],m1Candles:m1,
  m5Candles:m1.filter(c=>c.time%300===0),fromTime:start,toTime:end,
  tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},sessionConfigs:[],news:[],newsLoadStatus:'ready',
  onMinuteCheck:()=>{},yieldControl:()=>Promise.resolve()};
 try{
  // Source/Entry detection is fixed here; native execution candles and the shared risk/scan gates are real.
  const once=await scanTradeSetup2Window({...input,existingEntries:original.entries.slice(0,1).map(row=>({
   setupKey:key,entry:row.entry}))});
  expect(once.filter(s=>s.entry).map(s=>s.entry.id)).toContain(original.blockedEntry.id);
  const live=await scanTradeSetup2Window({...input,existingEntries:original.entries.map(row=>({
   setupKey:key,entry:row.entry}))});
  expect(live.filter(s=>s.entry)).toHaveLength(0);
  expect(live.at(-1).dealingRange).toMatchObject({status:'invalidated',reason:'twoConsecutiveJointLosses',
   riskInvalidation:{recognizedAt:1792052640,entryIds:original.entries.map(row=>row.entry.id)}});
  expect(live.at(-1).rangeCourse.lifecycle.entrySearchAllowed).toBe(false);
  const middleAt=start+1800,middle={...original.entries[0].entry,id:'nonExecutable-between',recognizedAt:middleAt,
   sizing:{...original.entries[0].entry.sizing,evaluatedAt:middleAt,factor:0.3}};
  const interrupted=await scanTradeSetup2Window({...input,existingEntries:[
   {setupKey:key,entry:original.entries[0].entry},{setupKey:key,entry:middle},
   {setupKey:key,entry:original.entries[1].entry}]});
  expect(interrupted.filter(s=>s.entry).map(s=>s.entry.id)).toContain(original.blockedEntry.id);
  const uncached=await scanTradeSetup2Window({...input,useMemo:false,existingEntries:original.entries.map(row=>({
   setupKey:key,entry:row.entry}))});
  expect(uncached.filter(s=>s.entry)).toHaveLength(0);
  expect(uncached.at(-1).dealingRange).toEqual(live.at(-1).dealingRange);
  expect(original.blockedEntry.recognizedAt).toBe(Date.parse('2026-10-15T10:33:00+02:00')/1000);
 }finally{base.mockRestore();structure.mockRestore();entryModel.mockRestore();}
});

