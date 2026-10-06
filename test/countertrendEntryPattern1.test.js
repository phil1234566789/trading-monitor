import { describe, it, expect, vi } from 'vitest';
import { entryPattern1ConditionsReady, ENTRY_PATTERN_1_VERSION } from '../src/entryPattern1Conditions.js';
import { eligibleEntryPattern1OrderBlocks, setup1OrderBlockIncluded } from '../src/countertrendEntryPattern1.js';
import { evaluateCountertrendEntryPattern1, entryPattern1RetestFvg } from '../src/countertrendEntryPattern1.js';
import { dealingRangeConfirmedAt } from '../src/dealingRangeConfirmationTime.js';
import { evaluateM1Checklist } from '../src/m1Checklist.js';
import { buildM1Structure } from '../src/m1Structure.js';
import * as m5 from '../src/tradeSetupChecklistM5.js';
import * as obs from '../src/orderBlockDetection.js';
import candles from './fixtures/gbpusd-m1-dr114-p5.json';
const at=clock=>Date.parse(`2026-09-09T${clock}:00+02:00`)/1000;

const conditions = () => ({m5Bos:{type:'BOS',direction:'short',originTime:300,recognizedAt:600},m5Countertrend:{trend:'uptrend',range:{high:{pivotTime:300},low:{pivotTime:100}},recognizedAt:300},
  m1PivotBreak:{type:'pivot-break',direction:'short',recognizedAt:660},
  retest:{candleTime:660,recognizedAt:720,orderBlock:{dir:-1,startTime:300,recognizedAt:600}},
  fvg:{direction:'short',candleTime:660,recognizedAt:780}});
describe('Countertrend entry pattern 1 conditions', () => {
  it('requires every one of the four closed facts', () => {
    const facts=conditions();
    expect(entryPattern1ConditionsReady(facts,'short',780)).toBe(true);
    for(const key of Object.keys(facts))expect(entryPattern1ConditionsReady({...facts,[key]:null},'short',780)).toBe(false);
  });
  it.each([[600,660],[660,600],[780,780]])('does not impose a pivot-break/BOS ordering (%s,%s)', (choch,bos) => {
    const facts=conditions();facts.m5Bos.recognizedAt=choch;facts.m1PivotBreak.recognizedAt=bos;
    expect(entryPattern1ConditionsReady(facts,'short',780)).toBe(true);
  });
  it('rejects future or opposing signals and FVG confirmed before the retest', () => {
    for(const key of ['m5Bos','m1PivotBreak','fvg']) {
      const facts=conditions();facts[key].recognizedAt=781;expect(entryPattern1ConditionsReady(facts,'short',780)).toBe(false);
      facts[key].recognizedAt=780;facts[key].direction='long';expect(entryPattern1ConditionsReady(facts,'short',780)).toBe(false);
    }
    const facts=conditions();facts.fvg.recognizedAt=720;
    expect(entryPattern1ConditionsReady(facts,'short',780)).toBe(false);
  });
  it('mirrors the same four conditions for long', () => {
    const facts=conditions();for(const key of ['m5Bos','m1PivotBreak','fvg'])facts[key].direction='long';facts.m5Countertrend.trend='downtrend';facts.m5Bos.originTime=100;facts.retest.orderBlock.dir=1;
    expect(entryPattern1ConditionsReady(facts,'long',780)).toBe(true);
  });
  it('keeps historical CHoCH conditions and rejects them under the new version',()=>{
    const facts=conditions(),legacy={...facts,m1Choch:{...facts.m1PivotBreak,type:'CHoCH'}};
    delete legacy.m1PivotBreak;
    expect(entryPattern1ConditionsReady(legacy,'short',780,'countertrend-entry-model-1-v3')).toBe(true);
    expect(entryPattern1ConditionsReady(legacy,'short',780)).toBe(false);
    expect(entryPattern1ConditionsReady(facts,'short',780,'countertrend-entry-model-1-v3')).toBe(false);
  });
  it('admits newly confirmed OBs and the explicitly included Setup 1.0 OB only', () => {
    const primary={reactionOB:{dir:-1,startTime:0,top:1.4,bottom:1.3},reactionRecognizedAt:600};
    const zones=[{dir:-1,startTime:300,recognizedAt:900},{dir:-1,startTime:600,recognizedAt:1200},
      {dir:-1,startTime:200,recognizedAt:800},{dir:1,startTime:300,recognizedAt:900}];
    const result=eligibleEntryPattern1OrderBlocks(zones,primary,'short',900,1200);
    expect(result.map(z=>z.startTime)).toEqual([0,300,600]);
    expect(result[0].inclusionRule).toBe('setup1OrderBlockIncluded');
    expect(setup1OrderBlockIncluded(primary,'short',1200)).toMatchObject({startTime:0,recognizedAt:600});
    expect(ENTRY_PATTERN_1_VERSION).toBe('countertrend-entry-model-1-v6');
  });
});

describe('entry pattern 1 detection', () => {
  const primary={id:'dr',reactionRecognizedAt:at('09:30'),reactionOB:{dir:-1,startTime:at('09:20'),top:1.36,bottom:1.359},
    checks:{m5Trend:{evaluatedAt:at('09:30'),structureState:{trend:'uptrend',currRange:{high:{pivotTime:at('09:20'),price:1.36},low:{pivotTime:at('08:00'),price:1.34}},nestedTrend:null}}},
    sweep:{level:{touchedTime:at('09:20')}},invalidation:1.36,targetSelection:{status:'passed',selectedAt:at('09:30'),target1:{price:1.35335},target2:{price:1.353}}};
  const context={entryPattern:ENTRY_PATTERN_1_VERSION,instrument:'GBPUSD',direction:'short',setupKey:'dr',primary,
    confirmedAt:at('09:30'),structureStart:at('08:00'),settings:{},
    anchor:{pivotTime:at('08:45'),price:1.35554,recognizedAt:at('09:30')},
    m5Candles:['09:30','09:35','09:40','09:45'].map(clock=>({time:at(clock),open:1.35,high:1.36,low:1.34,close:1.35}))};
  const second={dir:-1,startTime:at('09:35'),top:1.35675,bottom:1.35641};
  function mocked(run, changes={}) {
    const original=obs.detectOrderBlocks;
    const ob=vi.spyOn(obs,'detectOrderBlocks').mockImplementation((rows,tf,...rest)=>tf==='5m'?[{...second,...changes}]:original(rows,tf,...rest));
    const choch=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:{levels:[{type:'BOS',direction:'short',originTime:at('09:20'),recognizedAt:at('09:49'),candleTime:at('09:44')}]}});
    try{return run();}finally{ob.mockRestore();choch.mockRestore();}
  }
  it('uses the second newly formed M5 OB and saves all facts, without requiring the innermost M1 direction', () => mocked(()=>{
    const result=evaluateCountertrendEntryPattern1({context,rows:candles.filter(c=>c.time+60<=at('09:50')),evaluatedAt:at('09:50'),
      pivotBreak:{type:'pivot-break',direction:'short',recognizedAt:at('09:34')},bos:null,choch:null,trends:[{trend:'uptrend',depth:0}],internalSweeps:[]});
    expect(result.entry).toMatchObject({entryPattern:ENTRY_PATTERN_1_VERSION,recognizedAt:at('09:50'),
      conditions:{m5Bos:{recognizedAt:at('09:49')},m1PivotBreak:{recognizedAt:at('09:34')},
        retest:{candleTime:at('09:46'),orderBlock:{startTime:at('09:35'),recognizedAt:at('09:45')}},fvg:{recognizedAt:at('09:50')}}});
    expect(result.entry.stops.wide.price).toBe(second.top);
  }));
  it('does not substitute a classic CHoCH for the missing pivot break',()=>mocked(()=>{
    const evaluatedAt=at('09:50');
    const result=evaluateM1Checklist({context,candles,evaluatedAt,structure:buildM1Structure(candles,context.anchor,evaluatedAt)});
    expect(result.entry).toBeNull();
    expect(result.conditions.m1PivotBreak).toBeNull();
    expect(result.entryBlockedReason).toContain('M1-Pivotbruch ab Sweep');
  }));
  it('does not backdate an old FVG to a later pivot confirmation or DR validation',()=>mocked(()=>{
    const evaluate=(recognizedAt,validatedAt)=>evaluateCountertrendEntryPattern1({context:{...context,validatedAt},
      rows:candles,evaluatedAt:at('09:51'),trends:[],internalSweeps:[],
      pivotBreak:{type:'pivot-break',direction:'short',recognizedAt}});
    expect(evaluate(at('09:51'),at('09:30')).entry).toBeNull();
    expect(evaluate(at('09:34'),at('09:51')).entry).toBeNull();
    expect(evaluate(at('09:50'),at('09:50')).entry?.recognizedAt).toBe(at('09:50'));
  }));
  it('blocks entries with missing OB history and explains the unknown retest',()=>mocked(()=>{
    const result=evaluateCountertrendEntryPattern1({context,rows:candles.filter(c=>c.time!==at('09:46')),
      evaluatedAt:at('09:50'),trends:[],internalSweeps:[],
      pivotBreak:{type:'pivot-break',direction:'short',recognizedAt:at('09:34')}});
    expect(result.entry).toBeNull();
    expect(result.conditions.retest).toBeNull();
    expect(result.detailStatuses.slice(-2)).toEqual(['unknown','unknown']);
    expect(result.details.at(-2)).toContain('Konnte nicht ermittelt werden');
    expect(result.details.at(-2)).toContain('M1-Historie ab OB-Bestätigung fehlt oder ist lückenhaft');
    expect(result.entryBlockedReason).toContain('Konnte nicht ermittelt werden');
  }));
  it('unknown history cannot prove a retest, and future FVG candles do not count',()=>{
    const zones=[{...second,recognizedAt:at('09:45')}];
    expect(entryPattern1RetestFvg(candles,zones,at('09:30'),'short',at('09:49')).fvg).toBeNull();
    expect(entryPattern1RetestFvg(candles,zones,at('09:30'),'short',at('09:50')).fvg.recognizedAt).toBe(at('09:50'));
    expect(entryPattern1RetestFvg(candles.filter(c=>c.time!==at('09:46')),zones,at('09:30'),'short',at('09:50')).status).toBe('unknown');
  });
  it('derives the OB cutoff from A–E confirmation even when F validates later',()=>{
    const checks=Object.fromEntries(['liquiditySweep','reaction','outerM5Trend','m5Trend'].map(key=>[key,{status:'passed',evaluatedAt:300}]));
    checks.antiConfluences={status:'unknown'};
    const candidate={setupType:'countertrend',direction:'short',reactionRecognizedAt:300,checks,
      targetSelection:{status:'passed',selectedAt:600,target1:{price:1}}};
    const checklist={model:'countertrend',status:'ready',evaluatedAt:900,setup:{primary:candidate}};
    expect(dealingRangeConfirmedAt(checklist)).toBe(600);
    checks.antiConfluences.status='passed';expect(dealingRangeConfirmedAt(checklist)).toBe(600);
    candidate.targetSelection.status='pending';expect(dealingRangeConfirmedAt(checklist)).toBeNull();
  });
});
