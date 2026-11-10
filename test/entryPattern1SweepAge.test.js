import {it,expect} from 'vitest';
import {entryPattern1SweepAgeRule,entryPattern1SweepAgePassed,ENTRY_PATTERN_1_SWEEP_AGE_POLICY} from '../src/entryPattern1SweepAge.js';
import {entryPattern1ConditionResults,entryPattern1StructureCategory} from '../src/entryPattern1Conditions.js';

const candidate=ageSeconds=>({recognizedAt:100,sweep:{ageSeconds,level:{pivotTime:-20000,touchedTime:0}}});
it.each(['GBPUSD','XAUUSD'])('%s preserves the exact four-hour boundary in H only',instrument=>{
 expect(ENTRY_PATTERN_1_SWEEP_AGE_POLICY.minimumAgeSeconds[instrument]).toBe(14400);
 expect(entryPattern1SweepAgeRule(instrument,candidate(14399),200).status).toBe('blocked');
 expect(entryPattern1SweepAgeRule(instrument,candidate(14400),200).status).toBe('passed');
 expect(entryPattern1SweepAgeRule(instrument,candidate(14401),200).status).toBe('passed');
 expect(entryPattern1SweepAgeRule(instrument,candidate(undefined),200).status).toBe('unknown');
 expect(entryPattern1SweepAgeRule(instrument,candidate(14400),99).status).toBe('unknown');
 expect(entryPattern1SweepAgeRule(instrument,candidate(-1),200).status).toBe('unknown');
});
it('does not introduce a new minimum for EURUSD',()=>{
 expect(entryPattern1SweepAgeRule('EURUSD',candidate(undefined),200)).toMatchObject({status:'passed',minimumAgeSeconds:null});
 expect(entryPattern1SweepAgePassed({sweepAge:entryPattern1SweepAgeRule('EURUSD',candidate(undefined),300)},200)).toBe(true);
});
it.each(['long','short'])('blocks only new %s P1 proof contracts; old archived conditions retain their contract',direction=>{
 const conditions={sweepAge:entryPattern1SweepAgeRule('XAUUSD',candidate(7200),200),
  m1PivotBreak:{type:'pivot-break',direction,recognizedAt:150}};
 expect(entryPattern1ConditionResults(conditions,direction,200).find(r=>r.key==='sweepAge')).toMatchObject({required:true,passed:false});
 expect(entryPattern1StructureCategory(conditions,direction,200)).toBeNull();
 const {sweepAge,...legacy}=conditions;
 expect(entryPattern1ConditionResults(legacy,direction,200).some(r=>r.key==='sweepAge')).toBe(false);
});
