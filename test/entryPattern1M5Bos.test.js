import { entrySizingAt,entryAgainstM5Allowed } from '../src/tradeSetup2EntrySizing.js';
import { describe, it, expect, vi } from 'vitest';
import { entryPattern1Countertrend, entryPattern1M5Bos } from '../src/entryPattern1M5Bos.js';
import { evaluateCountertrendEntryPattern1 } from '../src/countertrendEntryPattern1.js';
import { entryPattern1ConditionsReady, ENTRY_PATTERN_1_VERSION } from '../src/entryPattern1Conditions.js';
import * as m5 from '../src/tradeSetupChecklistM5.js';
import fixture from './fixtures/gbpusd-dr9016-m5-countertrend.json';

const evaluate = (primary, reaction, direction, at, entryProgress, version=ENTRY_PATTERN_1_VERSION) => {
  const spy=vi.spyOn(m5,'evaluateChecklistM5').mockReturnValue({structureReaction:reaction});
  try { return evaluateCountertrendEntryPattern1({context:{entryPattern:version,
    instrument:'GBPUSD',primary,direction,m5Candles:[],confirmedAt:100,settings:{}},
    rows:[],evaluatedAt:at,trends:[],internalSweeps:[],entryProgress}); }
  finally { spy.mockRestore(); }
};

describe('M5 BOS identity for Entry Pattern 1', () => {
  it.each([ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v5'])('rejects DR 9016 parent BOS through the shared entry evaluator (%s)', version => {
    const result=evaluate(fixture.primary,fixture.reaction,'short',fixture.entryAt,undefined,version);
    expect(evaluate(fixture.primary,fixture.reaction,'short',fixture.entryAt,undefined,'countertrend-entry-model-1-v4').m5Bos).toEqual(fixture.originalBos);
    expect(result.m5Bos).toBeNull();
    expect(result.entry).toBeNull();
    expect(result.conditions.m5Countertrend.range).toMatchObject({
      low:{pivotTime:1790695500,price:1.3201699999999998},high:{pivotTime:1790752800,price:1.32778}});
    expect(result.entryBlockedReason).toContain('M5-BOS');
  });
  it.each(['short','long'])('selects the DR countertrend BOS, never its parent (%s)', direction => {
    const short=direction==='short',trend=short?'uptrend':'downtrend';
    const state={trend,currRange:{high:{pivotTime:100},low:{pivotTime:200}},
      nestedTrend:{trend:short?'downtrend':'uptrend',currRange:{high:{pivotTime:300},low:{pivotTime:400}},
        nestedTrend:{trend,currRange:{high:{pivotTime:500},low:{pivotTime:600}}}}};
    const primary={checks:{m5Trend:{evaluatedAt:700,structureState:state}}};
    const originTime=short?500:600;
    const parent={type:'BOS',direction,originTime:short?100:200,recognizedAt:650};
    const correct={type:'BOS',direction,originTime,recognizedAt:750,depth:2};
    expect(evaluate(primary,{levels:[parent]},direction,800).m5Bos).toBeNull();
    const progress={};
    expect(evaluate(primary,{levels:[parent,correct]},direction,800,progress).m5Bos).toEqual(correct);
    expect(evaluate(primary,{levels:[parent,correct]},direction,749,progress).m5Bos).toBeNull();
    expect(evaluate(primary,{levels:[parent,correct]},direction,750).m5Bos).toEqual(correct);
    expect(evaluate(primary,{levels:[parent,correct]},direction,699).m5Bos).toBeNull();
    // Ein anderer DR-Ursprung muss selbst bei identischen M5-Kerzen den Memo-Schlüssel ändern.
    const other={checks:{m5Trend:{evaluatedAt:700,structureState:{trend,currRange:{high:{pivotTime:900},low:{pivotTime:950}}}}}};
    expect(evaluate(other,{levels:[parent,correct]},direction,800,progress).m5Bos).toBeNull();
    // Keine pauschale Nach-Sweep-Regel: der richtige bekannte BOS darf vor DR-Bestätigung liegen.
    expect(evaluate(primary,{levels:[{...correct,recognizedAt:650}]},direction,800).m5Bos?.recognizedAt).toBe(650);
  });
  it.each(['short','long'])('retains a causal new end extreme of the same DR trend (%s)',direction=>{
    const short=direction==='short',trend=short?'uptrend':'downtrend';
    const original={trend,currRange:{low:{pivotTime:100},high:{pivotTime:200}}};
    const primary={checks:{m5Trend:{evaluatedAt:300,structureState:original}}};
    const updated={trend,currRange:short ? {low:{pivotTime:100},high:{pivotTime:350}}
      : {high:{pivotTime:200},low:{pivotTime:350}}};
    const range=entryPattern1Countertrend(primary,direction,500,updated,400);
    const bos={type:'BOS',direction,originTime:350,recognizedAt:450};
    expect(entryPattern1M5Bos({levels:[bos]},range,direction,500)).toEqual(bos);
    expect(entryPattern1M5Bos({levels:[bos]},range,direction,399)).toBeNull();
    updated.currRange[short?'low':'high'].pivotTime=250;
    expect(entryPattern1Countertrend(primary,direction,500,updated,400)).toBeNull();
  });
  it('requires range provenance for new entries while preserving saved v4 semantics',()=>{
    const direction='short',entryAt=fixture.entryAt;
    const conditions={m5Bos:fixture.originalBos,
      m5Countertrend:entryPattern1Countertrend(fixture.primary,direction,entryAt),
      m1PivotBreak:{type:'pivot-break',direction,recognizedAt:entryAt},
      retest:{recognizedAt:entryAt-60,orderBlock:{dir:-1}},fvg:{direction,recognizedAt:entryAt}};
    expect(entryPattern1ConditionsReady(conditions,direction,entryAt)).toBe(false);
    const entry={entryPattern:ENTRY_PATTERN_1_VERSION,direction,recognizedAt:entryAt,conditions};
    expect(entryAgainstM5Allowed({},entry)).toBe(false);
    expect(entrySizingAt({evaluatedAt:entryAt},entry).reason).toBe('m5BosMissing');
    expect(entryPattern1ConditionsReady(conditions,direction,entryAt,'countertrend-entry-model-1-v4')).toBe(true);
    const correct={...fixture.originalBos,originTime:1790752800};
    expect(entryPattern1ConditionsReady({...conditions,m5Bos:correct},direction,entryAt)).toBe(true);
    expect(entrySizingAt({evaluatedAt:entryAt},{...entry,conditions:{...conditions,m5Bos:correct}}).factor).toBe(1);
    expect(entryPattern1ConditionsReady({...conditions,m5Bos:correct,m5Countertrend:null},direction,entryAt)).toBe(false);
    expect(entryPattern1M5Bos(fixture.reaction,null,direction,entryAt)).toBeNull();
  });
});

it('v5 retains the proven countertrend BOS gate after the mitigation version bump',()=>{
 const conditions={m5Bos:{type:'BOS',direction:'short',originTime:200,recognizedAt:600},
  m5Countertrend:{trend:'uptrend',range:{low:{pivotTime:100},high:{pivotTime:300}},recognizedAt:300},
  m1PivotBreak:{type:'pivot-break',direction:'short',recognizedAt:660},
  retest:{recognizedAt:720,orderBlock:{dir:-1}},fvg:{direction:'short',recognizedAt:780}};
 expect(entryPattern1ConditionsReady(conditions,'short',780,'countertrend-entry-model-1-v5')).toBe(false);
 conditions.m5Bos.originTime=300;
 expect(entryPattern1ConditionsReady(conditions,'short',780,'countertrend-entry-model-1-v5')).toBe(true);
});
