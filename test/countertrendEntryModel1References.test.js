import { describe,it,expect } from 'vitest';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import { buildHistoricalDailyAnchors } from '../src/tradeSetup2Anchors.js';
import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import continuation105 from './fixtures/gbpusd-m5-105-lifecycle.json';
import m1_97 from './fixtures/gbpusd-m1-entry-model1-97.json';
import m1_105 from './fixtures/gbpusd-m1-entry-model1-105.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { activeM1Context } from '../src/m1Structure.js';
import { evaluateM1Checklist } from '../src/m1Checklist.js';
import { sizeSimulation } from '../src/tradeSetupSimulation.js';

describe('real 97/105 entry model 1 replay',()=>{
 it.each([[fixture.setups[0],m1_97],[fixture.setups[1],m1_105]])('closed reference $0.tradeSetupId',async(setup,m1Candles)=>{
  const at=setup1RecognitionTime(setup);
  const toTime=Math.floor(at/86400)*86400+22*3600;
  const m5Candles=[...new Map([...fixture.m5Candles,...continuation105].map(c=>[c.time,c])).values()];
  const input={instrument:'GBPUSD',tradeSetups:[setup],m5Candles,h1Candles:fixture.h1Candles,m1Candles,
   dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),sessionConfigs:sessions.sessions,
   tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},fromTime:at,toTime};
  const snapshots=await scanTradeSetup2Window(input);
  expect(snapshots).toEqual(await scanTradeSetup2Window({...input,useMemo:false}));
  const entries=snapshots.filter(s=>s.entry);
  expect(entries).toHaveLength(2);
  expect(new Set(entries.map(s=>s.entry.conditions.retest.orderBlock.startTime)).size).toBe(entries.length);
  expect(entries.every(s=>s.entry.stops.wide.price===s.entry.conditions.retest.orderBlock.top)).toBe(true);
  expect(entries[1].entry.conditions.retest.orderBlock.recognizedAt).toBeGreaterThan(entries[0].knownAt);
  if(setup.tradeSetupId===3125)expect(entries[0].entry.scales.wide.targets[0].rr).toBeCloseTo(3.5208333);
  expect(snapshots[0].dealingRange.status).toBe('validated');
  expect(snapshots[0].checklist.setup.primary.setupType).toBe('countertrend');
  expect(entries.every(s=>s.entry.recognizedAt===s.entry.conditions.fvg.recognizedAt)).toBe(true);
  expect(entries[0].knownAt).toBe(setup.tradeSetupId===3125 ? 1789544040 : 1790238960);
  expect(new Set(entries.map(s=>s.entry.id)).size).toBe(entries.length);
  expect(entries.every(s=>s.entry.conditions.m5Bos.type==='BOS' && s.entry.conditions.m1Choch.type==='CHoCH')).toBe(true);
  expect(snapshots.at(-1).rangeCourse.lifecycle.entrySearchAllowed).toBe(false);
  if(entries.length){
   expect(entries[0].entry.conditions.retest.orderBlock.inclusionRule).toBe('formedSinceDrConfirmation');
   expect(entries[0].entry.conditions.m1Choch.recognizedAt).toBe(setup.tradeSetupId===3125 ? 1789540380 : 1790237820);
   expect(entries[0].m1Check.sweepReaction.active).toBe(true);
   expect(entries[0].entry.sizing.factor).toBe(1);
   expect(sizeSimulation(entries[0].entry,'wide')).toMatchObject({status:'ready',riskBudget:500});
   const context=activeM1Context(entries[0].checklist);
   context.m5Candles=m5Candles;context.settings={};
   const unknown=evaluateM1Checklist({context,candles:m1Candles,evaluatedAt:entries[0].knownAt,
    structure:{status:'ready',state:{trend:'unknown'},pivotsOuter:[]}});
   expect(unknown.entry?.recognizedAt).toBe(entries[0].knownAt);
  }
 },180000);
});
