import {it,expect,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import {scanTradeSetup2Window} from '../src/tradeSetup2Scan.js';
import {buildHistoricalDailyAnchors} from '../src/tradeSetup2Anchors.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import m1 from './fixtures/gbpusd-m1-entry-model1-97.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import * as targets from '../src/tradeSetupChecklistLifecycle.js';
import * as confluences from '../src/tradeSetupChecklistConfluences.js';
import * as lifecycle from '../src/countertrendLifecycle.js';
import * as entry from '../src/m1Checklist.js';
import * as simulation from '../src/tradeSetupSimulation.js';
import * as structure from '../src/m1Structure.js';

// Opt-in: drei volle Orakelläufe gehören zur Messung, nicht zu jeder Testausführung.
it.runIf(process.env.SETUP2_PERFORMANCE==='1')('fixture-only CPU benchmark preserves every snapshot',async()=>{
 const counters={targets:vi.spyOn(targets,'fixChecklistTargets'),confluences:vi.spyOn(confluences,'evaluateChecklistConfluences'),
  lifecycle:vi.spyOn(lifecycle,'evaluateCountertrendLifecycle'),entry:vi.spyOn(entry,'evaluateM1Checklist'),
  simulation:vi.spyOn(simulation,'evaluateSimulation'),structure:vi.spyOn(structure,'buildM1Structure')};
 const input={instrument:'GBPUSD',tradeSetups:Array.from({length:3},(_,i)=>({...fixture.setups[0],tradeSetupId:3125+i})),
  m5Candles:fixture.m5Candles,h1Candles:fixture.h1Candles,m1Candles:m1,
  dailyAnchors:buildHistoricalDailyAnchors(fixture.dailyCandles,fixture.h1Candles),sessionConfigs:sessions.sessions,
  tradingWindows:{weekday:[[0,1440]],saturday:[],sunday:[]},fromTime:1789539000,toTime:1789557600};
 const measurements=[];
 try{
  for(let repeat=0;repeat<3;repeat++){
   let oracle;
   for(const useMemo of [false,true]){
    Object.values(counters).forEach(s=>s.mockClear());
    const start=performance.now(),cpu=process.cpuUsage();
    const snapshots=await scanTradeSetup2Window({...input,useMemo});
    const elapsed=process.cpuUsage(cpu);
    measurements.push({repeat,useMemo,ms:performance.now()-start,cpuMs:(elapsed.user+elapsed.system)/1000,
     counts:Object.fromEntries(Object.entries(counters).map(([k,v])=>[k,v.mock.calls.length]))});
    if(useMemo)expect(snapshots).toEqual(oracle);else oracle=snapshots;
   }
  }
  writeFileSync('.debug/setup2-performance-final.json',JSON.stringify({setup2Performance:measurements}));
 }finally{Object.values(counters).forEach(s=>s.mockRestore());}
},180000);
