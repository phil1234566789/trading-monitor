import { expect, it } from 'vitest';
import { setupEntryConditions, groupSetupSnapshots } from '../src/tradeSetup2Review.js';
import { simulationChartLink } from '../src/tradeSetupSimulationStatistics.js';

const snapshot = () => ({ id: 'entry', setupKey: 'setup', instrument: 'GBPUSD', knownAt: 600,
  entry: { recognizedAt: 600, candleTime: 540, price: 1.3, label: 'Entry 1' },
  checklist: { status: 'ready', evaluatedAt: 600, checks: {
    h1Trend: { status: 'passed' }, liquiditySweep: { status: 'passed' }, reaction: { status: 'passed' },
    time: { status: 'unknown', details: ['News unbekannt'] }, m5Trend: { m1Anchor: { pivotTime: 60, recognizedAt: 300 } },
  }, setup: { primary: { recognizedAt: 120, reactionRecognizedAt: 300, validity: { state: 'active' } } } },
  m1Check: { evaluatedAt: 600, trends: [{ trend: 'downtrend', depth: 0 }], detailStatuses: ['unmet', 'unmet', 'unmet', 'passed', 'passed'],
    retest: { candleTime: 360, recognizedAt: 420 }, fvg: { candleTime: 480, recognizedAt: 600 }, choch: null, bos: null },
});
it('groups by actual setup identity, retaining entries with no candidate and both stop variants only once', () => {
  const entry = snapshot(), candidate = { ...entry, id: 'setup', knownAt: 120, entry: null };
  const orphan = { ...entry, id: 'other-entry', setupKey: 'other' };
  const groups = groupSetupSnapshots([candidate, entry, entry, orphan]);
  expect(groups).toHaveLength(2);
  const group = groups.find(row => row.key.endsWith(':setup'));
  expect(group.entries).toHaveLength(1);
  expect(group.candidate).toBe(candidate);
  expect(group.snapshot).toBe(entry);
});
it('never merges the same setup or entry across different runs or rule versions', () => {
  const entry = snapshot();
  const groups = groupSetupSnapshots([{ ...entry, runId: 'old' }, { ...entry, runId: 'new' }]);
  expect(groups).toHaveLength(2);
  expect(groups.map(group => group.snapshot.runId).sort()).toEqual(['new', 'old']);
});
it('shows saved positive evidence and times without inventing CHoCH/BOS gates or a known time clearance', () => {
  const review = setupEntryConditions(snapshot());
  expect(review.rows.find(row => row.key === 'retest')).toMatchObject({ status: 'passed', time: 420 });
  expect(review.rows.find(row => row.key === 'fvg')).toMatchObject({ status: 'passed', time: 600 });
  expect(review.rows.find(row => row.key === 'time').status).toBe('unknown');
  expect(review.rows.find(row => row.key === 'entry').status).toBe('passed');
  expect(review.rows.some(row => ['choch', 'bos'].includes(row.key))).toBe(false);
  expect(review.prerequisiteNote).toBeNull();
});
it('does not turn missing candidate M1 data or an interrupted evaluation into failed conditions', () => {
  const s = snapshot(); s.entry = null; s.m1Check = null; s.checklist.checks.reaction.status = 'pending';
  let rows = setupEntryConditions(s).rows;
  expect(rows.find(row => row.key === 'reaction').status).toBe('unmet');
  expect(rows.filter(row => ['structure', 'retest', 'fvg', 'entry'].includes(row.key)).every(row => row.status === 'unknown')).toBe(true);
  s.checklist.status = 'error';
  rows = setupEntryConditions(s).rows;
  expect(rows.find(row => row.key === 'reaction').status).toBe('unknown');
});
it('distinguishes evaluated absent signals from unknown data and suppresses future evidence', () => {
  const s = snapshot(); s.entry = null; s.m1Check.retest = null; s.m1Check.fvg = null;
  s.m1Check.detailStatuses = ['unmet', 'unmet', 'unmet', 'unmet', 'unknown'];
  let rows = setupEntryConditions(s).rows;
  expect(rows.find(row => row.key === 'retest').status).toBe('unmet');
  expect(rows.find(row => row.key === 'fvg').status).toBe('unknown');
  s.m1Check.fvg = { recognizedAt: 660, candleTime: 600 };
  s.entry = { recognizedAt: 660, price: 9.99 };
  rows = setupEntryConditions(s).rows;
  expect(rows.find(row => row.key === 'fvg').status).toBe('unknown');
  expect(rows.find(row => row.key === 'entry').status).toBe('unknown');
  expect(JSON.stringify(rows)).not.toContain('9.99');
});
it('links a candidate to its stored time and instrument without fabricating an entry', () => {
  expect(simulationChartLink({ id: 'candidate', instrument: 'GBPUSD', knownAt: 600 }, 'run').query)
    .toMatchObject({ setup2: 'candidate', run: 'run', replay: '600', instrument: 'GBPUSD', bar: '5m' });
});
