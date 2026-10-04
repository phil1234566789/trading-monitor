import { describe, it, expect } from 'vitest';
import { latestCompletedRun, reviewGroups, filterReviewGroups, independentRangeOutcome, variantMetrics, rangeEntryCrossTable, groupResults } from '../src/simulationRunComparison.js';
import { COUNTERTREND_RANGE_COURSE_VERSION } from '../src/countertrendLifecycle.js';
import { COUNTERTREND_STAGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { applySimulationCommission } from '../src/tradeSetupSimulationCosts.js';
const snapshot = (id, entry=null) => ({id,runId:'new',instrument:'GBPUSD',direction:'long',setupKey:'dr',knownAt:100,
  dealingRange:{version:COUNTERTREND_STAGE_VERSION,status:'validated',details:[]},entry});
const result = (variant,pnlUsd) => applySimulationCommission({runId:'new',snapshotId:'e',variant,entryTime:100,evaluatedAt:200,status:'closed',outcome:'t2',pnlUsd,rMultiple:pnlUsd/100,actualRisk:100,lots:1});
describe('run comparison',()=>{
  it('defaults to the latest completed run, excluding a newer running run',()=>{
    expect(latestCompletedRun([{id:'a',status:'complete',evaluatedAt:1},{id:'b',status:'complete',evaluatedAt:2},{id:'c',status:'running',evaluatedAt:3}])).toBe('b');
  });
  it('keeps legacy groups usable and recognizes the setup type from primary',()=>{
    const s={...snapshot('a'),dealingRange:null,checklist:{setup:{primary:{setupType:'continuation'}}}};
    expect(reviewGroups([s])[0]).toMatchObject({stage:'legacy',setupType:'continuation'});
  });
  it('filters instrument, type, entries, dates, registry values and pins together',()=>{
    const groups=reviewGroups([snapshot('a'),snapshot('e',{recognizedAt:100})]);
    groups[0].setupType='countertrend'; groups[0].features.push({key:'dummy',value:'observed'});
    expect(filterReviewGroups(groups,{instrument:'EURUSD'})).toHaveLength(0);
    expect(filterReviewGroups(groups,{type:'countertrend',entry:'with',feature:'dummy',value:'observed',pinned:'with'},[{simulationRunId:'new',simulationSnapshotId:'e'}])).toHaveLength(1);
    expect(filterReviewGroups(groups,{from:'2026-10-01'})).toHaveLength(0);
  });
  it('does not infer a missing independent T2 from entry closure or an entry result',()=>{
    const g={snapshot:snapshot('e',{}),firstValidated:snapshot('a'),entries:[snapshot('e',{})]};
    const lifecycle={evaluatedAt:200,main:{state:'ended',reason:'entriesClosed'},target1:{status:'reached',recognizedAt:150},target2:{status:'open'}};
    g.snapshot.rangeCourse={version:COUNTERTREND_RANGE_COURSE_VERSION,setupKey:'dr',validatedAt:100,lifecycle};
    expect(independentRangeOutcome(g).status).toBe('t1Unknown');
    lifecycle.target2={status:'reached',recognizedAt:180}; expect(independentRangeOutcome(g).status).toBe('t2');
    lifecycle.main.reason='both'; expect(independentRangeOutcome(g).status).toBe('unknown');
  });
  it('keeps stop variants and runs separate with commission and minimum sample size',()=>{
    const rows=[result('wide',100),result('narrow',-100),{...result('wide',999),runId:'old'}];
    const scoped=groupResults([{entries:[snapshot('e',{})]}],rows);
    expect(variantMetrics(scoped,'wide')).toMatchObject({total:1,closed:1,winrate:null,pnlUsd:95,grossPnlUsd:100,commissionUsd:5});
    expect(variantMetrics(scoped,'wide').commissionR).toBeCloseTo(.05);
    expect(variantMetrics(scoped,'narrow').pnlUsd).toBe(-105);
  });
  it('crosses only validated DRs with their own net entries for each variant',()=>{
    const g={stage:'validated',outcome:{status:'t2'},entries:[snapshot('e',{})]};
    const rows=[result('wide',100),result('narrow',-100)];
    expect(rangeEntryCrossTable([g,{...g,stage:'confirmed'}],rows,'wide')[0]).toMatchObject({total:1,win:1,loss:0});
    expect(rangeEntryCrossTable([g],rows,'narrow')[0]).toMatchObject({total:1,win:0,loss:1});
  });
});
