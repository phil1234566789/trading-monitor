import {describe,it,expect} from 'vitest';
import {evaluateSweepRetestInvalidation} from '../src/sweepRetestInvalidation.js';
import {evaluateCountertrendLifecycle} from '../src/countertrendLifecycle.js';
import {evaluateCountertrendDealingRange} from '../src/countertrendDealingRange.js';
import {evaluateM1Checklist} from '../src/m1Checklist.js';
import {setup2EntrySearchEnded} from '../src/setup2EntrySearch.js';
import native from './fixtures/xau-20261110-retest-invalidation.json';

const candidate={sourceKind:'liquidity-sweep-existing-m5-ob-retest-v1',direction:'long',
 sourceRetest:{candleTime:600,recognizedAt:900},reactionOB:{dir:1,top:10,bottom:8}};
const c=(time,low=9,high=11)=>({time,open:10,close:10,low,high});
const run=(rows,at=rows.at(-1).time+60,source=candidate)=>evaluateSweepRetestInvalidation({candidate:source,m1Candles:rows,evaluatedAt:at});
describe('first M1 source retest cannot migrate to a later extreme',()=>{
 it('keeps equal extremes, invalidates a strict wick breach only at candle close',()=>{
  const rows=[c(600),c(660),c(720,8.9)];
  expect(run(rows,779).status).toBe('active');
  expect(run(rows,780)).toMatchObject({status:'invalidated',price:9,retestTime:600,breachTime:720,recognizedAt:780});
  expect(run(rows,720).status).toBe('active');
 });
 it('mirrors short retests without touching TS1 sources',()=>{
  const short={...candidate,direction:'short',reactionOB:{dir:-1,top:12,bottom:10}};
  expect(run([c(600,9,11),c(660,9,11.1)],720,short)).toMatchObject({status:'invalidated',price:11});
  expect(run([c(600),c(660,8)],720,{...candidate,sourceKind:undefined}).status).toBe('notApplicable');
 });
 it('never invents an anchor across missing/ignored history',()=>{
  expect(run([c(660)]).status).toBe('unknown');
  expect(run([{...c(600),ignored:true},c(660)]).status).toBe('unknown');
  expect(run([c(600),c(720)]).status).toBe('unknown');
  expect(run([c(600)],900).status).toBe('unknown');
 });
 it('does not consider a candle outside the original source retest',()=>{
  expect(run([c(600,11,12),c(660,11,12),c(720,11,12),c(780,11,12),c(840,11,12),c(900)])).toMatchObject({status:'unknown'});
 });
 it('matches the native 10:01 / 10:12 case and preserves all earlier prefixes',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4070.53);
  const input={candidate:source,m1Candles:native.m1,evaluatedAt:1794301980};
  expect(evaluateSweepRetestInvalidation(input)).toMatchObject({status:'invalidated',retestTime:1794301260,
   price:4088.68,breachTime:1794301920,recognizedAt:1794301980});
  expect(evaluateSweepRetestInvalidation({...input,evaluatedAt:1794301920}).status).toBe('active');
  expect(evaluateSweepRetestInvalidation({...input,m1Candles:native.m1.filter(c=>c.time+60<=input.evaluatedAt)}))
   .toEqual(evaluateSweepRetestInvalidation(input));
 });
 it('invalidates the second original source at its own retest extreme',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4084.19);
  const result=run(native.m1.filter(c=>c.time>=source.sourceRetest.candleTime),1794303600,source);
  expect(result.status).toBe('invalidated');expect(result.retestTime).toBe(1794301920);
  expect(result.recognizedAt).toBeLessThan(1794303480);
 });
 it('ends the whole DR before the old 10:57 entry and exposes a causal invalidation reason',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4070.53);
  const lifecycle=evaluateCountertrendLifecycle({candidate:source,selection:source.targetSelection,
   invalidation:source.invalidation,m1Candles:native.m1,candles:[],evaluatedAt:1794304620});
  expect(lifecycle.main).toMatchObject({state:'ended',reason:'retestExtremeBroken',recognizedAt:1794301980});
  expect(lifecycle.entrySearchAllowed).toBe(false);
  expect(evaluateCountertrendDealingRange({status:'ready',evaluatedAt:1794304620,ruleVersion:'countertrend-abcdef-v2'},
   {...source,lifecycle})).toMatchObject({status:'invalidated',reason:'retestExtremeBroken'});
 });
 it('never replaces an earlier target ending with a later retest breach',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4070.53);
  const selection={...source.targetSelection,target1:{price:4100},target2:{price:4101}};
  const lifecycle=evaluateCountertrendLifecycle({candidate:source,selection,invalidation:source.invalidation,
   m1Candles:native.m1,candles:[],evaluatedAt:1794304620});
  expect(lifecycle.main.reason).toBe('target1');
  expect(evaluateCountertrendDealingRange({status:'ready',evaluatedAt:1794304620,ruleVersion:'countertrend-abcdef-v2'},
   {...source,targetSelection:selection,lifecycle})).not.toMatchObject({reason:'retestExtremeBroken'});
 });
 it('processes each native minute once and resets for source, revision and replay changes',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4070.53),progress={};
  for(let at=1794301500;at<=1794301980;at+=60){
   const input={candidate:source,m1Candles:native.m1,evaluatedAt:at};
   expect(evaluateSweepRetestInvalidation({...input,progress,dataRevision:0})).toEqual(evaluateSweepRetestInvalidation(input));
  }
  expect(progress.retestProcessed).toBe(13);
  const rewind={candidate:source,m1Candles:native.m1,evaluatedAt:1794301920,progress,dataRevision:0};
  expect(evaluateSweepRetestInvalidation(rewind).status).toBe('active');
  const corrected=native.m1.map(c=>c.time===1794301560?{...c,low:4088}:c);
  expect(evaluateSweepRetestInvalidation({...rewind,m1Candles:corrected,dataRevision:1}))
   .toMatchObject({status:'invalidated',breachTime:1794301560});
  const second=native.candidates.find(x=>x.reactionOB.bottom===4084.19);
  expect(evaluateSweepRetestInvalidation({...rewind,candidate:second,evaluatedAt:1794303600,dataRevision:1}).retestTime).toBe(1794301920);
 });
 it('recovers missing prefixes and internal gaps when M1 is delivered without a correction revision',()=>{
  const rows=[c(600),c(660),c(720)],progress={};
  const input={candidate,m1Candles:rows,evaluatedAt:780,progress,dataRevision:0};
  expect(evaluateSweepRetestInvalidation({...input,m1Candles:rows.slice(1)}).status).toBe('unknown');
  expect(evaluateSweepRetestInvalidation(input).status).toBe('active');
  const more={...input,dataRevision:1};
  expect(evaluateSweepRetestInvalidation({...more,m1Candles:[rows[0],rows[2]]}).status).toBe('unknown');
  expect(evaluateSweepRetestInvalidation(more).status).toBe('active');
 });
 it('uses the same canonical retest for direct M1 checks and still permits loading missing M1',()=>{
  const source=native.candidates.find(x=>x.reactionOB.bottom===4070.53);
  const alias={...source,sourceKind:undefined,sourceRetest:{candleTime:1794303900,recognizedAt:1794304200},
   ideaBinding:{retestSource:source}};
  const result=evaluateM1Checklist({context:{primary:alias},candles:native.m1,evaluatedAt:1794304620});
  expect(result).toMatchObject({status:'pending',reason:'retestExtremeBroken',sweepRetest:{retestTime:1794301260}});
  expect(setup2EntrySearchEnded({setup:{primary:{lifecycle:{entrySearchAllowed:false},validity:{state:'unknown',reason:'missingRetestHistory'}}}})).toBe(false);
  expect(setup2EntrySearchEnded({setup:{primary:{lifecycle:{entrySearchAllowed:false},validity:{state:'ended',reason:'retestExtremeBroken'}}}})).toBe(true);
 });
});
