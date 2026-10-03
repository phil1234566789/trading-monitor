import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import { describe, expect, it, vi } from 'vitest';
import { classifyM5SetupType, evaluateCountertrendChecklist } from '../src/countertrendChecklist.js';
import { buildHistoricalDailyAnchors } from '../src/tradeSetup2Anchors.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';
import sessions from './fixtures/gbpusd-m5-dr114-session-targets.json';
import * as targets from '../src/tradeSetupChecklistTargets.js';
import * as m5 from '../src/tradeSetupChecklistM5.js';
import { hasConfirmedChecklistAbc } from '../src/tradeSetupChecklistGates.js';
import { tradeSetup2Evidence } from '../src/tradeSetup2Evidence.js';
import { buildTradeSetup2CandidateSnapshot } from '../src/tradeSetup2Snapshot.js';

const dailyAnchors = buildHistoricalDailyAnchors(fixture.dailyCandles, fixture.h1Candles);
describe('Countertrend: C/D und Setup-1.0-Quelle', () => {
 it.each([null,{trend:'unknown',appliedPivots:[]}])('ohne bestätigten Nested gilt D = C (%j)',nestedTrend=>{
  const setup=fixture.setups[0];
  const context={instrument:'GBPUSD',direction:'short',evaluatedAt:setup1RecognitionTime(setup),
   m5Candles:fixture.m5Candles.filter(c=>c.time+300<=setup1RecognitionTime(setup))};
  const outer=m5.evaluateChecklistOuterM5(context,{},1788937200);
  const prepared={...outer,state:{...outer.state,nestedTrend}};
  const current=m5.evaluateChecklistM5(context,{},1788937200,prepared);
  expect(current.trend).toBe(prepared.state.trend);
  expect(current.structureReaction.trend).toBe('downtrend');
 });
 it('zeichnet neue M5-Belege mit B-Reaktion ohne fiktive H1-Struktur',()=>{
  const at=1000;
  const evidence=tradeSetup2Evidence({checklist:{model:'countertrend',evaluatedAt:at,
   structure:{trend:'unknown'},checks:{},setup:{primary:{id:'test',recognizedAt:at,reactionRecognizedAt:at,
    sweep:{timeframe:'5M',level:{price:1,pivotTime:100,touchedTime:700}},
    reactionOB:{dir:-1,top:2,bottom:1,startTime:700}}}}});
  expect(evidence.find(e=>e.role==='sweep')).toMatchObject({timeframe:'5m',label:'5M Sweep'});
  expect(evidence.find(e=>e.role==='reactionOB').label).toBe('B · M5 OB');
  expect(evidence.some(e=>e.checkKey==='h1Trend')).toBe(false);
 });
 it.each([
  ['short','downtrend','downtrend','trendContinuation'],
  ['short','downtrend','unknown','unclear'],
  ['short','uptrend','downtrend','countertrend'],
  ['short','uptrend','uptrend','unclear'],
  ['short','unknown','downtrend','unclear'],
  ['long','uptrend','uptrend','trendContinuation'],
  ['long','downtrend','uptrend','countertrend'],
 ])('klassifiziert %s D=%s C=%s als %s', (direction,current,outer,type) => {
  expect(classifyM5SetupType(direction,current,outer).type).toBe(type);
 });
 it.each(fixture.setups)('prüft E/F für den realen Countertrend Setup $tradeSetupId', setup => {
  const spy=vi.spyOn(targets,'evaluateChecklistTargets');
  const input={instrument:'GBPUSD',evaluatedAt:setup1RecognitionTime(setup),tradeSetups:[setup],dailyAnchors,setupClassificationCache:new Map(),
   m5Candles:fixture.m5Candles,h1Candles:fixture.h1Candles,sessionConfigs:sessions.sessions};
  try {
   const result=evaluateCountertrendChecklist(input);
   expect(result.setupType).toBe('countertrend');
   expect(result.checks.liquiditySweep.status).toBe('passed');
   expect(result.checks.reaction.status).toBe('passed');
   expect(result.checks.m5Trend).toMatchObject({trend:'uptrend',status:'passed'});
   expect(result.checks.outerM5Trend).toMatchObject({trend:'downtrend',required:true,status:'passed'});
   expect(result.checks.targets.status).toBe('passed');
   expect(result.checks.antiConfluences.status).toBe('clear');
   expect(result.dealingRange.status).toBe('validated');
   expect(result.confirmed).toBe(true);
   expect(result.abortReason).toBeNull();
   expect(hasConfirmedChecklistAbc(result.checks)).toBe(true);
   const snapshot=buildTradeSetup2CandidateSnapshot({checklist:result,candidate:result.setup.primary});
   expect(snapshot.dealingRange.status).toBe('validated');
   expect(snapshot.checklist.checks.m5Trend.trend).toBe('uptrend');
   expect(snapshot.evidence.some(e=>e.checkKey==='h1Trend')).toBe(false);
   if (setup.tradeSetupId===5491) expect(result.setup.primary.sweep.ageSeconds).toBeLessThan(86400);
   expect(spy).toHaveBeenCalled();
   expect(result.context.h1State).toBeUndefined();
   // Vollarchiv und geschlossenes Präfix liefern denselben eingefrorenen C/D-Stand.
   const prefix={...input,m5Candles:fixture.m5Candles.filter(c=>c.time+300<=setup1RecognitionTime(setup))};
   expect(evaluateCountertrendChecklist(prefix).checks.m5Trend).toEqual(result.checks.m5Trend);
   expect(evaluateCountertrendChecklist({...prefix,h1Candles:fixture.h1Candles.filter(c=>c.time+3600<=setup1RecognitionTime(setup))}).dealingRange)
    .toEqual(result.dealingRange);
   expect(evaluateCountertrendChecklist(prefix).setup.primary.targetSelection).toEqual(result.setup.primary.targetSelection);
   expect(evaluateCountertrendChecklist({...input,evaluatedAt:setup1RecognitionTime(setup)+300}).checks.m5Trend)
    .toEqual(result.checks.m5Trend);
   expect(evaluateCountertrendChecklist({...input,evaluatedAt:setup1RecognitionTime(setup)-1}).setup.candidates).toEqual([]);
  } finally {spy.mockRestore();}
 }, 15000);
 it('fehlender bekannter D1-Anker lässt C unbekannt und gibt keine DR frei',()=>{
  const setup=fixture.setups[0];
  const result=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:setup1RecognitionTime(setup),
   tradeSetups:[setup],dailyAnchors:[],m5Candles:fixture.m5Candles});
  expect(result.checks.outerM5Trend.status).toBe('unknown');
  expect(result.checks.m5Trend.status).toBe('pending');
  expect(result.abortReason).toBe('M5-Trend unbekannt');
  expect(result.confirmed).toBe(false);
 });
 it('bestätigt Countertrend mit Targets auch ohne CHoCH/BOS',()=>{
  const setup=fixture.setups[0];
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  const current=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({status:'pending',
   structureReaction:{trend:'uptrend',choch:null,bos:null},structureState:{trend:'downtrend'}});
  const target=vi.spyOn(targets,'evaluateChecklistTargets').mockReturnValue({status:'passed',selectedAt:setup1RecognitionTime(setup),
   direction:'short',target1:{price:1,knownAt:setup1RecognitionTime(setup)},details:['Testziel']});
  try {
   const result=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:setup1RecognitionTime(setup),
    tradeSetups:[setup],dailyAnchors,m5Candles:fixture.m5Candles});
   expect(result.confirmed).toBe(true);
   expect(result.checks.m5Trend).toMatchObject({status:'passed',detailStatuses:['passed']});
   expect(target).toHaveBeenCalled();
  } finally {outer.mockRestore();current.mockRestore();target.mockRestore();}
 });
 it('erkennt Trendfortführung, bricht ab und verwendet keinen H1-Anker',()=>{
  const setup=fixture.setups[0];
  const outerSpy=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend:'downtrend'}});
  const spy=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({
   status:'passed',details:['M5-Trend bärisch'],structureReaction:{trend:'downtrend'},
   structureState:{trend:'downtrend',currRange:{high:{price:2},low:{price:1}}},
  });
  try {
   const result=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:setup1RecognitionTime(setup),
    tradeSetups:[setup],dailyAnchors,m5Candles:fixture.m5Candles,
    settings:{rangesFixedStartTime:setup1RecognitionTime(setup)-300}});
   expect(spy.mock.calls[0][2]).toBe(1788937200);
   expect(result.setupType).toBe('trendContinuation');
   expect(hasConfirmedChecklistAbc(result.checks)).toBe(true);
   expect(result.checks.outerM5Trend).toMatchObject({trend:'downtrend',required:true,status:'passed'});
   expect(result.dealingRange.status).toBe('unconfirmed');
   expect(result.confirmed).toBe(false);
   expect(result.abortReason).toBe('Typ Trendfortführung, noch nicht umgesetzt');
  } finally {spy.mockRestore();outerSpy.mockRestore();}
 });
 it.each(['uptrend','unknown'])('C=%s bricht ohne D-Auswertung ab',trend=>{
  const setup=fixture.setups[0];
  const outer=vi.spyOn(m5,'evaluateChecklistOuterM5').mockReturnValue({state:{trend}});
  const current=vi.spyOn(m5,'evaluateChecklistM5');
  try {
   const result=evaluateCountertrendChecklist({instrument:'GBPUSD',evaluatedAt:setup1RecognitionTime(setup),
    tradeSetups:[setup],dailyAnchors,m5Candles:fixture.m5Candles});
   expect(current).not.toHaveBeenCalled();
   expect(result.checks.m5Trend.status).toBe('pending');
   expect(result.abortReason).toBe(trend==='unknown'?'M5-Trend unbekannt':'äußerster M5-Trend gegen Setup-Richtung');
   expect(result.confirmed).toBe(false);
   expect(result.setup.candidates).toEqual([]);
  } finally {outer.mockRestore();current.mockRestore();}
 });
});
