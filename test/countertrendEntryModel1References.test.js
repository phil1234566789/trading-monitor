import { describe,it,expect } from 'vitest';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import { buildHistoricalDailyAnchors } from '../src/tradeSetup2Anchors.js';
import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import continuation105 from './fixtures/gbpusd-m5-105-lifecycle.json';
import m1_97 from './fixtures/gbpusd-m1-entry-model1-97.json';
import m1_105 from './fixtures/gbpusd-m1-entry-model1-105.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';

describe('real 97/105 entry model 1 replay',()=>{
 it.each([[fixture.setups[0],m1_97],[fixture.setups[1],m1_105]])('closed reference $0.tradeSetupId',async(setup,m1Candles)=>{
  const at=setup1RecognitionTime(setup);
  const toTime=Math.floor(at/86400)*86400+22*3600;
  const m5Candles=[...new Map([...fixture.m5Candles,...continuation105].map(c=>[c.time,c])).values()];
  const snapshots=await scanTradeSetup2Window({instrument:'GBPUSD',tradeSetups:[setup],m5Candles,h1Candles:fixture.h1Candles,m1Candles,
   dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),sessionConfigs:sessions.sessions,
   tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},fromTime:at,toTime});
  const entries=snapshots.filter(s=>s.entry);
  expect(snapshots[0].dealingRange.status).toBe('validated');
  expect(snapshots[0].checklist.setup.primary.setupType).toBe('countertrend');
  expect(entries.every(s=>s.entry.recognizedAt===s.entry.conditions.fvg.recognizedAt)).toBe(true);
  expect(entries.map(s=>s.knownAt)).toEqual(setup.tradeSetupId===3125 ? [1789545180,1789545300] : []);
  expect(snapshots.at(-1).rangeCourse.lifecycle.entrySearchAllowed).toBe(false);
  if(entries.length){
   expect(entries[0].entry.conditions.retest.orderBlock.inclusionRule).toBe('formedSinceDrConfirmation');
   expect(entries[0].entry.conditions.m1Bos.recognizedAt).toBe(1789545120);
  }
 },180000);
});
