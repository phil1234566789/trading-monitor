import { describe,it,expect,vi } from 'vitest';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import * as m5 from '../src/tradeSetupChecklistM5.js';
import * as targets from '../src/tradeSetupChecklistTargets.js';
import * as confluences from '../src/tradeSetupChecklistConfluences.js';
import { buildHistoricalDailyAnchors } from '../src/tradeSetup2Anchors.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import continuation105 from './fixtures/gbpusd-m5-105-lifecycle.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import * as m1 from '../src/m1Checklist.js';
import { ENTRY_MODEL_1_VERSION } from '../src/entryModel1Conditions.js';
import * as gate from '../src/tradeSetup2EntryGate.js';
import { groupSetupSnapshots } from '../src/tradeSetup2Review.js';
import { evaluateSimulation } from '../src/tradeSetupSimulation.js';

const windows={weekday:[],saturday:[],sunday:[]};
const anchors=buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles);
const input=setup=>({instrument:'GBPUSD',tradeSetups:[setup],dailyAnchors:anchors,
 m5Candles:fixture.m5Candles,h1Candles:fixture.h1Candles,m1Candles:[],sessionConfigs:sessions.sessions,
 fromTime:setup1RecognitionTime(setup)-300,toTime:setup1RecognitionTime(setup)+1800,tradingWindows:windows});
describe('Countertrend-Scanner Start und Last',()=>{
 it('speichert mehrere Entries getrennt über das zentrale Gate und beendet die Suche bei T1',async()=>{
  const setup=fixture.setups[0],at=setup1RecognitionTime(setup),key=`GBPUSD:setup1:${setup.tradeSetupId}`;
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  const current=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:{trend:'uptrend'},
   m1Anchor:{pivotTime:at-300,price:1.35,recognizedAt:at}});
  const target=vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'passed',direction:'short',selectedAt:at,
   target1:{price:1.2,knownAt:at},target2:{price:1.1,knownAt:at}});
  const anti=vi.spyOn(confluences,'evaluateChecklistConfluences').mockReturnValue({antiConfluences:{status:'clear',rules:[]}});
  const entryGate=vi.spyOn(gate,'createSetup2Entry');
  const model=vi.spyOn(m1,'evaluateM1Checklist').mockImplementation(({evaluatedAt})=>{
   const retest={candleTime:at,recognizedAt:at+60,orderBlock:{dir:-1,startTime:setup.obStartTime,top:1.31,bottom:1.305,recognizedAt:at}};
   const conditions={m5Choch:{type:'CHoCH',direction:'short',recognizedAt:at},m1Bos:{type:'BOS',direction:'short',recognizedAt:at},
    retest,fvg:{direction:'short',recognizedAt:evaluatedAt,candleTime:evaluatedAt-120}};
   const entry=[at+120,at+180,at+300].includes(evaluatedAt)?{id:`entry:${evaluatedAt}`,entryModel:ENTRY_MODEL_1_VERSION,conditions,
    instrument:'GBPUSD',setupKey:key,direction:'short',recognizedAt:evaluatedAt,candleTime:evaluatedAt-60,price:1.3,
    stops:{wide:{price:1.31},narrow:{price:1.305}},scales:{wide:{targets:[{price:1.2},{price:1.1}]},narrow:{targets:[{price:1.2},{price:1.1}]}}}:null;
   return {entry,evaluatedAt,entryModel:ENTRY_MODEL_1_VERSION,conditions,retest,fvg:conditions.fvg};
  });
  try {
   const m1Candles=Array.from({length:42},(_,i)=>({time:at+(i-11)*60,open:1.3,high:1.301,low:i===14?1.19:1.299,close:1.3}));
   const snapshots=await scanTradeSetup2Window({...input(setup),m1Candles,tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]}});
   const entries=snapshots.filter(s=>s.entry);
   expect(entries.map(s=>s.entry.recognizedAt)).toEqual([at+120,at+180]);
   expect(entryGate).toHaveBeenCalledTimes(2);
   expect(entries.every(s=>s.entry.sizing.factor===1 && s.checklist.checks.entry.entries[0].id===s.entry.id)).toBe(true);
   expect(groupSetupSnapshots(snapshots)[0].entries).toHaveLength(2);
   expect(snapshots.at(-1).rangeCourse.lifecycle.entrySearchAllowed).toBe(false);
   const outcomes=entries.map(s=>evaluateSimulation({entry:s.entry,variant:'wide',candles:m1Candles,evaluatedAt:at+600,target1:1.2,target2:1.1}));
   expect(new Set(outcomes.map(o=>o.entryId)).size).toBe(2);
   expect(outcomes.every(o=>o.riskBudget===500)).toBe(true);
  }finally {outer.mockRestore();current.mockRestore();target.mockRestore();anti.mockRestore();model.mockRestore();entryGate.mockRestore();}
 });
 it('105 ohne T2 beendet seine entrylose DR am realen T1',async()=>{
  const setup=fixture.setups[1];
  const rows=[...new Map([...fixture.m5Candles,...continuation105].map(c=>[c.time,c])).values()];
  const snapshots=await scanTradeSetup2Window({...input(setup),m5Candles:rows,toTime:continuation105.at(-1).time+300});
  const latest=snapshots.at(-1);
  expect(latest.rangeCourse.target2).toBeNull();
  expect(latest.rangeCourse.lifecycle.main).toMatchObject({state:'ended',reason:'target1'});
  expect(latest.rangeCourse.lifecycle.events[0].type).toBe('target1');
 },15000);
 it.each([[fixture.setups[0],false],[fixture.setups[0],true],[fixture.setups[1],true]])('Entry-Freigabe mit exaktem und sekundengenauem Start (%j, %s)',async (setup,allowed)=>{
  const at=setup1RecognitionTime(setup),key=`GBPUSD:setup1:${setup.tradeSetupId}`;
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  const current=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:{trend:'uptrend',direction:'short',
   choch:{type:'CHoCH',direction:'short',recognizedAt:at}},m1Anchor:{pivotTime:at-300,price:1.35,recognizedAt:at}});
  const target=vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'passed',direction:'short',selectedAt:at,
   target1:{price:1.2,knownAt:at},target2:{price:1.1,knownAt:at}});
  const anti=vi.spyOn(confluences,'evaluateChecklistConfluences').mockReturnValue({antiConfluences:{status:'passed'}});
  const entry={id:'dummy-entry',instrument:'GBPUSD',setupKey:key,direction:'short',recognizedAt:(Math.floor(at/60)+1)*60,price:1.3,
   stops:{wide:{price:1.31},narrow:{price:1.305}},scales:{wide:{targets:[{price:1.2},{price:1.1}]},narrow:{targets:[{price:1.2},{price:1.1}]}}};
  const model=vi.spyOn(m1,'evaluateM1Checklist').mockImplementation(({evaluatedAt})=>({entry,evaluatedAt}));
  try {
   const m1Candles=Array.from({length:17},(_,i)=>({time:Math.floor(at/60)*60+(i-11)*60,open:1.3,high:1.301,low:1.299,close:1.3}));
   const found=await scanTradeSetup2Window({...input(setup),m1Candles,
    tradingWindows:allowed?{weekday:[[0,1440]],saturday:[],sunday:[]}:windows});
   expect(found.filter(s=>s.entry)).toHaveLength(allowed?1:0);
   expect(found[0].dealingRange.status).toBe('validated');
   if(allowed)expect(found.find(s=>s.entry).entryEligibility.hours.status).toBe('passed');
  }finally {outer.mockRestore();current.mockRestore();target.mockRestore();anti.mockRestore();model.mockRestore();}
 });
 it('ohne Setup 1.0 gibt es keine Strukturauswertung und keinen M1-Abruf',async()=>{
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5'),load=vi.fn(),progress=vi.fn();
  try {
   expect(await scanTradeSetup2Window({...input(fixture.setups[0]),tradeSetups:[],loadM1Candles:load,onProgress:progress})).toEqual([]);
   expect(outer).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled();
   expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({m5Evaluations:0,m1Candles:0}));
  } finally {outer.mockRestore();}
 });
 it.each(fixture.setups)('Setup $tradeSetupId startet kausal und läuft auch außerhalb der Handelszeiten',async setup=>{
  const progress=vi.fn();
  const snapshots=await scanTradeSetup2Window({...input(setup),onProgress:progress});
  expect(snapshots[0].knownAt).toBe(setup1RecognitionTime(setup));
  expect(snapshots[0].checklist.setup.primary.setupType).toBe('countertrend');
  expect(snapshots[0].dealingRange.status).toBe('validated');
  expect(snapshots.every(s=>s.entry===null)).toBe(true);
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({m5Evaluations:1}));
  if(setup.tradeSetupId===5491)expect(snapshots[0].checklist.setup.primary.targetSelection.target2).toBeFalsy();
 },15000);
 it.each(['passed','pending','unknown'])('M1 wird erst bei validierter DR angefragt (F=%s)',async status=>{
  const setup=fixture.setups[0],at=setup1RecognitionTime(setup),load=vi.fn(async()=>[]);
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  const current=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:{trend:'uptrend'},
   m1Anchor:{pivotTime:at-300,price:1.35,recognizedAt:at}});
  const target=vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'passed',direction:'short',selectedAt:at,
   target1:{price:1,knownAt:at}});
  const anti=vi.spyOn(confluences,'evaluateChecklistConfluences').mockReturnValue({antiConfluences:{status},confluences:{status:'passed'}});
  try {
   await scanTradeSetup2Window({...input(setup),loadM1Candles:load});
   expect(target).toHaveBeenCalledOnce();expect(anti).toHaveBeenCalledOnce();
   expect(load).toHaveBeenCalledTimes(status==='passed'?1:0);
   if(status==='passed')expect(load).toHaveBeenCalledWith({instrument:'GBPUSD',fromTime:at,structureFromTime:at-300,toTime:at+1800});
  }finally {outer.mockRestore();current.mockRestore();target.mockRestore();anti.mockRestore();}
 });
 it('unbestätigte DR ohne Targets lädt keine M1-Kerzen',async()=>{
  const setup=fixture.setups[0],at=setup1RecognitionTime(setup),load=vi.fn();
  const target=vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'pending',selectedAt:at});
  try {
   const snapshots=await scanTradeSetup2Window({...input(setup),loadM1Candles:load});
   expect(snapshots[0].dealingRange.status).toBe('unconfirmed');expect(load).not.toHaveBeenCalled();
  }finally {target.mockRestore();}
 });
});
