import { describe, expect, it } from 'vitest';
import { evaluateDealingRange, savedDealingRangeStatus, isVersionedDealingRangeRun } from '../src/tradeSetup2DealingRange.js';
import { buildTradeSetup2CandidateSnapshot } from '../src/tradeSetup2Snapshot.js';
import { fixChecklistTargets } from '../src/tradeSetupChecklistLifecycle.js';

const input = (anti = 'unknown', selection = { status:'passed', selectedAt:300, target1:{price:1,knownAt:300} }) => {
 const checks = Object.fromEntries(['liquiditySweep','reaction','outerM5Trend','m5Trend'].map(key=>[key,{status:'passed'}]));
 checks.antiConfluences = {status:anti,details:['H1-Prüfung'],divergences:{candidates:[{type:'bullish',recognizedAt:300,fromTime:100,toTime:200}]}};
 return {model:'countertrend',ruleVersion:'countertrend-abcdef-v1',status:'ready',direction:'short',evaluatedAt:600,checks,
  setup:{primary:{id:'test',setupType:'countertrend',direction:'short',recognizedAt:300,reactionRecognizedAt:300,
   checks,targetSelection:selection}}};
};
describe('Countertrend A–E bestätigt, F validiert',()=>{
 it('nutzt bei Erkennung zwischen M5-Schlüssen nur den letzten vollständigen Schluss',()=>{
  const candidate={direction:'short',reactionRecognizedAt:625,checks:{reaction:{status:'passed'}}};
  const candles=[0,300,600].map(time=>({time,open:2,high:3,low:1,close:2}));
  const args={candidate,instrument:'GBPUSD',candles,sessionConfigs:[],recognitionWithinBar:true};
  expect(fixChecklistTargets(args).selectedAt).toBe(625);
  expect(fixChecklistTargets({...args,candles:candles.slice(0,1)})).toBeNull();
  expect(fixChecklistTargets({...args,recognitionWithinBar:false})).toBeNull();
 });
 it.each(['pending','unmet','unknown'])('E=%s bleibt unbestätigt auch mit Showstopper',status=>{
  expect(evaluateDealingRange(input('pending',{status,selectedAt:300})).status).toBe('unconfirmed');
 });
 it.each([['pending','invalidated'],['passed','validated'],['unknown','confirmed']])('F=%s ergibt %s', (anti,status)=>{
  expect(evaluateDealingRange(input(anti))).toMatchObject({version:'countertrend-abcdef-v1',status});
 });
 it.each([
  {status:'passed',selectedAt:601,target1:{price:1}},
  {status:'passed',selectedAt:300,target1:{price:1,knownAt:601}},
  {status:'passed',selectedAt:300,target1:{price:NaN}},
 ])('künftige oder unvollständige Targets bestätigen nicht (%j)', selection=>{
  expect(evaluateDealingRange(input('passed',selection)).status).toBe('unconfirmed');
 });
 it('liest F eines weiteren Kandidaten statt die Prüfung des Hauptkandidaten',()=>{
  const checklist=input('passed'), candidate={...checklist.setup.primary,direction:'long',checks:{...checklist.checks,
   antiConfluences:{status:'pending',details:['H1-Gegendivergenz']}}};
  expect(evaluateDealingRange(checklist,candidate).status).toBe('invalidated');
 });
 it('künftige Gegendivergenz invalidiert noch nicht',()=>{
  const checklist=input('pending');
  checklist.checks.antiConfluences.divergences.candidates[0].recognizedAt=601;
  expect(evaluateDealingRange(checklist).status).toBe('confirmed');
 });
 it('bekannte Preisinvalidierung bleibt unabhängig von F wirksam',()=>{
  const checklist=input('passed');
  checklist.setup.primary.validity={state:'ended',reason:'invalidation',recognizedAt:600};
  expect(evaluateDealingRange(checklist)).toMatchObject({status:'invalidated',reason:'priceInvalidation'});
  checklist.setup.primary.validity.recognizedAt=601;
  expect(evaluateDealingRange(checklist).status).toBe('validated');
 });
 it('deutet gespeicherte ABCD-Stände nicht um',()=>{
  const checklist=input('pending',null);checklist.ruleVersion='countertrend-abcd-v1';
  expect(evaluateDealingRange(checklist)).toMatchObject({version:'countertrend-abcd-v1',status:'confirmed'});
  for(const version of ['countertrend-abcd-v1','countertrend-abcdef-v1']) {
   expect(savedDealingRangeStatus({dealingRange:{version,status:'confirmed'}})).toBe('confirmed');
   expect(isVersionedDealingRangeRun({configuration:{dealingRangeVersion:version}})).toBe(true);
  }
 });
 it('speichert auch eine unbestätigte DR ohne Targets als Statistik-Beleg',()=>{
  const checklist=input('unknown',null);
  checklist.instrument='GBPUSD';checklist.setup.primary.knownAsOf=600;
  const snapshot=buildTradeSetup2CandidateSnapshot({checklist,candidate:checklist.setup.primary});
  expect(snapshot.dealingRange).toMatchObject({version:'countertrend-abcdef-v1',status:'unconfirmed'});
  expect(snapshot.entry).toBeNull();
 });
});
