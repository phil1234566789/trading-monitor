import {createCloseReactionCache} from '../src/m5CloseReactionHistory.js';
import {evaluateChecklistOuterM5} from '../src/tradeSetupChecklistM5.js';
import {it,expect} from 'vitest';
import fs from 'node:fs';
import candles from './fixtures/gbpusd-dr9312-targets.json';
import source from './fixtures/gbpusd-dr9312-t70-checkpoints.json';
import {ENTRY_PATTERN_1_VERSION} from '../src/entryPattern1Conditions.js';
import {fixChecklistTargets} from '../src/tradeSetupChecklistLifecycle.js';
import {evaluateCountertrendLifecycle} from '../src/countertrendLifecycle.js';
import {evaluateDealingRange} from '../src/tradeSetup2DealingRange.js';
import {activeM1Context,buildM1Structure} from '../src/m1Structure.js';
import {evaluateM1Checklist} from '../src/m1Checklist.js';
import {createSetup2Entry} from '../src/tradeSetup2EntryGate.js';
import {buildTradeSetup2Snapshot} from '../src/tradeSetup2Snapshot.js';
import {sizeSimulation} from '../src/tradeSetupSimulation.js';
import {markIgnoredCandles} from '../src/sessionOccurrences.js';
import {berlinOffsetMinutes,formatDatedTime} from '../src/berlinTime.js';
const closeReactionCache=createCloseReactionCache(),entryProgress={};
function evaluate(at,rows=candles.m1Candles){
 const mark=(data,seconds)=>markIgnoredCandles(data.filter(c=>c.time+seconds<=at),candles.sessionConfigs,t=>berlinOffsetMinutes(t*1000));
 const m5=mark(candles.m5Candles,300),m1=mark(rows,60),primary=structuredClone(source.primary);
 primary.checks.m5Trend.structureState=evaluateChecklistOuterM5({instrument:'GBPUSD',direction:'short',m5Candles:m5.filter(c=>c.time+300<=primary.recognizedAt),evaluatedAt:primary.recognizedAt},candles.settings,candles.structureStart).state;
 primary.targetSelection=fixChecklistTargets({candidate:primary,instrument:'GBPUSD',candles:m5,sessionConfigs:candles.sessionConfigs,recognitionWithinBar:true,entryPattern:ENTRY_PATTERN_1_VERSION});
 primary.lifecycle=evaluateCountertrendLifecycle({selection:primary.targetSelection,invalidation:primary.invalidation,candles:m5,m1Candles:m1,evaluatedAt:at});
 primary.validity=primary.lifecycle.main;
 const checklist={...source.checklist,entryPattern:ENTRY_PATTERN_1_VERSION,direction:'short',evaluatedAt:at,
  checks:primary.checks,setup:{primary},context:{m5Candles:m5,settings:candles.settings,sessionConfigs:candles.sessionConfigs}};
 checklist.dealingRange=evaluateDealingRange(checklist);
 const context=activeM1Context(checklist);
 if(!context)return {checklist,entry:null};
 const structure=buildM1Structure(m1,context.anchor,at);
 const check=evaluateM1Checklist({context,structure,candles:m1,evaluatedAt:at,closeReactionCache,entryProgress:rows===candles.m1Candles?entryProgress:{m5:entryProgress.m5}});
 const snapshot=createSetup2Entry({...source,instrument:'GBPUSD',evaluatedAt:at,sessionConfigs:candles.sessionConfigs},()=>buildTradeSetup2Snapshot({checklist,m1Check:check}));
 return {checklist,check,snapshot,entry:snapshot?.entry ?? null};
}
it('T70 original native DR9312 yields one causal Risky entry at 16:09 with half the identical rounded Full position',()=>{
 const at=1790777340,before=evaluate(at-60),result=evaluate(at);
 expect(result.checklist.dealingRange.status).toBe('validated');
 expect(result.checklist.setup.primary.lifecycle.entrySearchAllowed).toBe(true);
 expect(result.checklist.setup.primary.targetSelection.target1.price).toBeCloseTo(1.32659,5);
 expect(result.checklist.setup.primary.targetSelection.target2.price).toBeCloseTo(1.32548,5);
 expect(before.entry).toBeNull();
 expect(result.entry).toMatchObject({entryCategory:'risky',optionalConditionsMissing:['m5Bos'],recognizedAt:at,conditions:{m5Bos:null,m1PivotBreak:{recognizedAt:1790772480},retest:{candleTime:1790777100},fvg:{recognizedAt:at}}});
 const variants=['wide','narrow'].map(variant=>{
  const risky=sizeSimulation(result.entry,variant);
  // Gleicher Stop/Preis und identische Full-Basis; nur die gespeicherte Größenkategorie variieren.
  const fullEntry={...result.entry,entryCategory:'full',optionalConditionsMissing:[],sizing:{...result.entry.sizing,entryCategory:'full',positionSizeFactor:1,factor:1}};
  const full=sizeSimulation(fullEntry,variant);
  expect(risky.lots).toBe(Math.floor(full.lots*.5));
  expect(risky.fullLots).toBe(full.lots);
  return {variant,fullLots:full.lots,riskyLots:risky.lots,actualRisk:risky.actualRisk,stop:risky.stopPrice,status:risky.status};
 });
 expect(variants.every(v=>v.status==='ready')).toBe(true);
 const missing=evaluate(at,candles.m1Candles.filter(c=>c.time!==1790777100));
 expect(missing.entry).toBeNull();
 const proof={provenance:source.provenance,entryCount:1,entryTimeBerlin:formatDatedTime(at),entryCategory:result.entry.entryCategory,variants,mandatoryGate:'validated original T63 A-F; native lifecycle and T62 trading/news inputs unchanged'};
 console.log('T70_DR9312_PROOF '+JSON.stringify(proof));
 if(fs.existsSync('.debug/t61'))fs.writeFileSync('.debug/t61/t70-proof.json',JSON.stringify(proof,null,2));
},120000);
