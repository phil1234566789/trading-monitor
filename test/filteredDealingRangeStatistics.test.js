import { describe, it, expect } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { groupSetupSnapshots, filterDealingRanges } from '../src/tradeSetup2Review.js';
import { DEALING_RANGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { filteredDealingRangeStatistics, simulationDateFilter } from '../src/tradeSetupSimulationStatistics.js';
import { applySimulationCommission } from '../src/tradeSetupSimulationCosts.js';
import FilteredDealingRangeSummary from '../src/components/FilteredDealingRangeSummary.vue';

const snapshot = (id, overrides={}) => ({ id,setupKey:id,runId:'current',instrument:'GBPUSD',knownAt:1788940200,
  entry:{recognizedAt:1788940200},dealingRange:{version:DEALING_RANGE_VERSION,status:'validated'},...overrides });
const result = (id, overrides={}) => applySimulationCommission({snapshotId:id,runId:'current',variant:'wide',
  status:'closed',outcome:'t2',lots:1,actualRisk:100,pnlUsd:105,rMultiple:1.05,...overrides});

describe('filtered DR statistics', () => {
  it('uses all filtered rows before pagination and separates stops, unfinished cases and no entry', () => {
    const snapshots = Array.from({length:27},(_,i)=>snapshot(`e${i}`));
    snapshots.push(snapshot('none',{entry:null}),snapshot('unknown'));
    const rows = [result('e0',{pnlUsd:-100,outcome:'slBeforeT1'}),
      ...Array.from({length:26},(_,i)=>result(`e${i+1}`)),
      result('e0',{variant:'narrow',pnlUsd:-200}),
      result('e1',{variant:'narrow',status:'open',pnlUsd:null,realizedPnlUsd:50}),
      result('e2',{variant:'narrow',status:'ambiguous',pnlUsd:null}),
      result('e3',{variant:'narrow',status:'notExecutable',pnlUsd:null})];
    const groups = groupSetupSnapshots(snapshots);
    const wide = filteredDealingRangeStatistics(groups,rows,'wide')[0];
    expect(wide).toMatchObject({ranges:29,withoutEntry:1,total:27,missingResults:1,closed:27,pnlUsd:2495,wins:26,losses:1});
    expect(wide.winrate).toBeCloseTo(26/27*100);
    expect(filteredDealingRangeStatistics(groups.slice(0,25),rows,'wide')[0].pnlUsd).not.toBe(wide.pnlUsd);
    const narrow = filteredDealingRangeStatistics(groups,rows,'narrow')[0];
    expect(narrow).toMatchObject({closed:1,pnlUsd:-205,winrate:0,openRealizedNetPnlUsd:45,counts:{open:1,ambiguous:1,notExecutable:1}});
    expect(filteredDealingRangeStatistics(groups.filter(g=>!g.entries.length),rows,'wide')[0]).toMatchObject({withoutEntry:1,total:0,pnlUsd:null,winrate:null});
  });
  it('honors filtered DR stage, entry, instrument, date and optional run identities', () => {
    const snapshots=[snapshot('keep'),snapshot('invalid',{dealingRange:{version:DEALING_RANGE_VERSION,status:'invalidated'}}),
      snapshot('eur',{instrument:'EURUSD'}),snapshot('later',{knownAt:1789113000}),snapshot('none',{entry:null}),snapshot('keep',{runId:'other'})];
    const bounds=simulationDateFilter('2026-09-09','2026-09-09');
    const groups=filterDealingRanges(groupSetupSnapshots(snapshots),'validated').filter(g=>g.entries.length && g.instrument==='GBPUSD'
      && g.knownAt>=bounds.from && g.knownAt<bounds.to && g.snapshot.runId==='current');
    expect(filteredDealingRangeStatistics(groups,[result('keep'),result('invalid',{pnlUsd:-900}),result('eur'),result('later'),result('keep',{runId:'other',pnlUsd:900})],'wide')[0])
      .toMatchObject({ranges:1,total:1,closed:1,pnlUsd:100,winrate:100});
  });
  it('renders small winrates with n and keeps alternate runs in separate compact summaries', async () => {
    const groups=groupSetupSnapshots([snapshot('same'),snapshot('same',{runId:'other'})]);
    const html=await renderToString(createSSRApp(FilteredDealingRangeSummary,{groups,variant:'wide',results:[result('same'),result('same',{runId:'other',pnlUsd:-100})]}));
    expect(html).toContain('2 alternative Laufstände');
    expect(html).toContain('100.0 %');
    expect(html).toContain('0.0 %');
    expect(html).toContain('vorläufig · n = 1');
    expect(html).toContain('$100.00');
    expect(html).toContain('-$105.00');
    expect(html).not.toContain('-$5.00');
  });
});
