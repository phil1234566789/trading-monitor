import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { groupSetupSnapshots } from '../src/tradeSetup2Review.js';
import { DEALING_RANGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { savedRangeOutcome } from '../src/tradeSetup2SavedRangeOutcome.js';
import DealingRangeOutcome from '../src/components/DealingRangeOutcome.vue';
import { completeSavedRangeCourses } from '../src/tradeSetup2RangeCourse.js';

const snapshot = (at, main, overrides={}) => ({id:`stand:${at}`,setupKey:'range',runId:'run',instrument:'GBPUSD',direction:'long',knownAt:at,entry:null,
  dealingRange:{version:DEALING_RANGE_VERSION,status:'validated'},checklist:{setup:{primary:{direction:'long',invalidation:1.30,
    targetSelection:{status:'passed',selectedAt:600,target1:{price:1.32,knownAt:300}},lifecycle:{evaluatedAt:at,main}}}},...overrides});
const first = () => snapshot(600,{state:'active'});
const group = (main, at=1800) => groupSetupSnapshots([snapshot(at,main),first()])[0];

describe('saved DR course after first causal validation', () => {
  it('tracks overnight T1 and invalidation separately from the last permitted review stand', () => {
    const startAt=Date.parse('2026-09-09T23:55:00+02:00')/1000;
    for(const [high,low,reason] of [[1.32,1.305,'target1'],[1.315,1.30,'invalidation']]) {
      const start=snapshot(startAt,{state:'active'});
      start.checklist.setup.primary.targetSelection.selectedAt=startAt;
      start.checklist.setup.primary.targetSelection.target1.knownAt=startAt;
      const before=JSON.stringify(start);
      const completed=completeSavedRangeCourses([start],[{time:startAt,high:1.315,low:1.305},
        {time:startAt+300,high,low}],startAt+600);
      expect(completed).toHaveLength(1);
      expect(completed[0].knownAt).toBe(startAt);
      expect(completed[0].checklist).toEqual(start.checklist);
      expect(completed[0].rangeCourse.lifecycle.main).toMatchObject({state:'ended',reason,
        endedAt:startAt+300,recognizedAt:startAt+600});
      expect(groupSetupSnapshots(completed)[0].snapshot.knownAt).toBe(startAt);
      expect(JSON.stringify(start)).toBe(before);
    }
  });
  it('evaluates the whole saved window from first validation without rewriting the checklist or using future bars', () => {
    const start = first();
    const before = JSON.stringify(start);
    const rows = [
      { time: 300, high: 1.4, low: 1.29 },
      { time: 600, high: 1.315, low: 1.305 },
      { time: 900, high: 1.32, low: 1.305 },
      { time: 1200, high: 1.4, low: 1.29 },
    ];
    const completed = completeSavedRangeCourses([start], rows, 1200);
    expect(JSON.stringify(start)).toBe(before);
    expect(completed[0].checklist).toEqual(start.checklist);
    const result = savedRangeOutcome(groupSetupSnapshots(completed)[0]);
    expect(result).toMatchObject({ status: 'target1', from: 600, through: 1200, recognizedAt: 1200 });
    expect(result).not.toHaveProperty('pnlUsd');
    completed[0].rangeCourse.target1 = 1.33;
    expect(savedRangeOutcome(groupSetupSnapshots(completed)[0]).status).toBe('unknown');
  });
  it('preserves genuine gaps and skips executions in complete course evaluation', () => {
    const start = first();
    const completed = completeSavedRangeCourses([start], [{ time: 900, high: 1.32, low: 1.305 }], 1200);
    expect(savedRangeOutcome(groupSetupSnapshots(completed)[0])).toMatchObject({ status: 'unknown', reason: expect.stringContaining('unvollständig') });
    expect(completeSavedRangeCourses([start, { ...snapshot(900, {}), id: 'entry', entry: {} }], [], 1200)[0]).not.toHaveProperty('rangeCourse');
  });
  it.each([['target1','target1'],['invalidation','invalidation'],['both','ambiguous']])('reuses stored lifecycle %s without creating a trade outcome', (reason,status) => {
    const result=savedRangeOutcome(group({state:'ended',reason,endedAt:900,recognizedAt:1200}));
    expect(result).toMatchObject({status,from:600,target1:1.32,invalidation:1.30,recognizedAt:1200});
    expect(result).not.toHaveProperty('pnlUsd');
    expect(result).not.toHaveProperty('winrate');
  });
  it('rejects earlier and future events and changed levels, using the earliest validated snapshot', () => {
    const early=group({state:'ended',reason:'target1',endedAt:300,recognizedAt:600});
    expect(early.firstValidated.knownAt).toBe(600);
    expect(savedRangeOutcome(early)).toMatchObject({status:'unknown',reason:expect.stringContaining('vor der Validierung')});
    expect(savedRangeOutcome(group({state:'ended',reason:'target1',endedAt:1800,recognizedAt:2100})).status).toBe('unknown');
    const changed=group({state:'ended',reason:'target1',endedAt:900,recognizedAt:1200});
    changed.snapshot.checklist.setup.primary.targetSelection.target1.price=1.33;
    expect(savedRangeOutcome(changed)).toMatchObject({status:'unknown',reason:expect.stringContaining('andere DR-Grenzen')});
  });
  it('labels covered open state at its saved horizon and distinguishes missing later evidence/history', () => {
    expect(savedRangeOutcome(group({state:'active'}))).toMatchObject({status:'open',through:1800});
    expect(savedRangeOutcome(group({state:'active'},600)).status).toBe('unknown');
    expect(savedRangeOutcome(group({state:'unknown',reason:'missingHistory'}))).toMatchObject({status:'unknown',reason:expect.stringContaining('unvollständig')});
  });
  it('only evaluates validated groups without entry and never substitutes an execution stop', () => {
    const row=group({state:'ended',reason:'invalidation',endedAt:900,recognizedAt:1200});
    row.snapshot.stopLoss=1.31;
    expect(savedRangeOutcome(row).invalidation).toBe(1.30);
    row.entries=[{entry:{stopLoss:1.31}}];
    expect(savedRangeOutcome(row)).toBeNull();
    row.entries=[];
    row.snapshot.dealingRange.status='invalidated';
    expect(savedRangeOutcome(row)).toBeNull();
    row.snapshot.dealingRange.status='confirmed';
    expect(savedRangeOutcome(row)).toBeNull();
  });
  it('does not borrow an earlier validation from an alternate run and renders T1 with causal bounds', async () => {
    const other={...first(),runId:'other'};
    const groups=groupSetupSnapshots([other,snapshot(1800,{state:'ended',reason:'target1',endedAt:900,recognizedAt:1200})]);
    const current=groups.find(g=>g.snapshot.runId==='run');
    expect(current.firstValidated.knownAt).toBe(1800);
    expect(savedRangeOutcome(current).status).toBe('unknown');
    const html=await renderToString(createSSRApp(DealingRangeOutcome,{group:group({state:'ended',reason:'target1',endedAt:900,recognizedAt:1200})}));
    expect(html).toContain('Target T1 zuerst erreicht');
    expect(html).toContain('T1 1,32');
    expect(html).toContain('Invalidierung 1,3');
    expect(html).not.toContain('Netto');
  });
});
