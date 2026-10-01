import { describe, it, expect } from 'vitest';
import { simulationStatistics, simulationDateFilter, simulationChartLink } from '../src/tradeSetupSimulationStatistics.js';

const result = (overrides = {}) => ({ status: 'closed', outcome: 't1Be', variant: 'wide', pnlUsd: 240, rMultiple: 0.5, ...overrides });

describe('simulation statistics', () => {
  it('keeps stop alternatives separate and counts T1 + BE as a win', () => {
    const stats = simulationStatistics([
      result(), result({ outcome: 'slBeforeT1', pnlUsd: -480, rMultiple: -1 }),
      result({ variant: 'narrow', pnlUsd: 495 }),
      ...['open', 'ambiguous', 'notExecutable'].map(status => result({ status, outcome: null, pnlUsd: null, rMultiple: null })),
    ], 'wide');
    expect(stats).toMatchObject({ total: 5, closed: 2, wins: 1, losses: 1, winrate: null, pnlUsd: -240, totalR: -0.5 });
    expect(stats.counts).toEqual({ slBeforeT1: 1, t1Be: 1, t2: 0, open: 1, ambiguous: 1, notExecutable: 1 });
  });
  it('uses decided trades as the percentage denominator and respects the 50-case threshold', () => {
    const rows = Array.from({ length: 49 }, () => result());
    rows.push(result({ status: 'open', outcome: null, pnlUsd: null }));
    expect(simulationStatistics(rows, 'wide').winrate).toBeNull();
    rows.push(result({ outcome: 'slBeforeT1', pnlUsd: -480, rMultiple: -1 }));
    expect(simulationStatistics(rows, 'wide')).toMatchObject({ winrate: 98, closed: 50, total: 51 });
  });
  it('does not invent a zero result when there are no completed trades', () => {
    expect(simulationStatistics([], 'wide')).toMatchObject({ closed: 0, pnlUsd: null, totalR: null });
  });
  it.each([['2026-03-29', 23], ['2026-10-25', 25]])('uses both Berlin midnights on %s', (day, hours) => {
    const bounds = simulationDateFilter(day, day);
    expect(bounds.to - bounds.from).toBe(hours * 3600);
  });
  it('rejects reversed dates and links the selected scenario to its original run', () => {
    expect(() => simulationDateFilter('2026-09-10', '2026-09-09')).toThrow(/Enddatum/);
    expect(simulationChartLink({ entryId: 'entry:114', variant: 'narrow', instrument: 'GBPUSD', entryTime: 1772809740 }, 'run:2026')).toEqual({
      path: '/', query: { setup2: 'entry:114', run: 'run:2026', variant: 'narrow', instrument: 'GBPUSD', replay: '1772809740', bar: '5m' },
    });
  });
  it('uses the persisted snapshot identity and preserves the exact recognition time', () => {
    expect(simulationChartLink({ entryId: 'entry', snapshotId: 'snapshot', instrument: 'EURUSD',
      entryTime: 1775028300, variant: 'wide' }, 'run').query).toMatchObject({
      setup2: 'snapshot', instrument: 'EURUSD', replay: '1775028300', variant: 'wide',
    });
  });
});
