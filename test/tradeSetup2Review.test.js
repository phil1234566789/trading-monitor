import { expect, it } from 'vitest';
import { setupEntryConditions, groupSetupSnapshots, filterDealingRanges } from '../src/tradeSetup2Review.js';
import { DEALING_RANGE_VERSION } from '../src/tradeSetup2DealingRange.js';
import { simulationChartLink } from '../src/tradeSetupSimulationStatistics.js';
import { ENTRY_MODEL_1_VERSION } from '../src/entryModel1Conditions.js';

it('reviews M5 BOS and M1 pivot break as required, preserving legacy observations',()=>{
 const saved=snapshot();saved.entry.entryModel=ENTRY_MODEL_1_VERSION;
 saved.entry.conditions={m5Bos:{direction:'short',recognizedAt:300},m1PivotBreak:null};saved.direction='short';
 const review=setupEntryConditions(saved);
 expect(review.rows.find(row=>row.key==='m5Bos').status).toBe('passed');
 expect(review.rows.find(row=>row.key==='m1PivotBreak').status).toBe('unmet');
 expect(review.observations).toEqual([]);
 saved.entry.entryModel='countertrend-entry-model-1-v3';saved.entry.conditions.m1Choch=null;
 expect(setupEntryConditions(saved).rows.find(row=>row.key==='m1Choch').status).toBe('unmet');
 expect(setupEntryConditions(saved).observations.map(row=>row.label)).toEqual(['M1 BOS']);
 expect(setupEntryConditions(snapshot()).observations.map(row=>row.label)).toEqual(['M1 CHoCH','M1 BOS']);
});

it('keeps the original model 1 snapshot labels and requirements',()=>{
 const saved=snapshot();saved.entry.entryModel='countertrend-entry-model-1-v1';saved.direction='short';
 saved.entry.conditions={m5Choch:{direction:'short',recognizedAt:300},m1Bos:null};
 const review=setupEntryConditions(saved);
 expect(review.rows.find(row=>row.key==='m5Choch').status).toBe('passed');
 expect(review.rows.find(row=>row.key==='m1Bos').status).toBe('unmet');
 expect(review.observations.map(row=>row.label)).toEqual(['M1 CHoCH']);
});

it('zeigt alle gespeicherten DR-Stufen und leeren Bestand ohne erfundene Entries',()=>{
 const snapshots=['unconfirmed','confirmed','validated','invalidated'].map((status,i)=>({
  id:`range${i}`,setupKey:`range${i}`,instrument:'GBPUSD',knownAt:600,entry:null,
  dealingRange:{version:'countertrend-abcdef-v1',status}}));
 const entry={...snapshots[2],id:'entry',entry:{recognizedAt:600}};
 const groups=groupSetupSnapshots([...snapshots,entry]);
 expect(filterDealingRanges(groups,'allStages')).toHaveLength(4);
 for(const status of ['unconfirmed','confirmed','validated','invalidated']) expect(filterDealingRanges(groups,status)).toHaveLength(1);
 expect(filterDealingRanges(groups,'validated')[0].entries).toHaveLength(1);
 expect(filterDealingRanges(groupSetupSnapshots([]),'allStages')).toEqual([]);
});

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
it('filters saved DR stages without inferring ABC for old runs and groups a later validation only once', () => {
  const legacy = snapshot();
  const stage = status => ({ version: DEALING_RANGE_VERSION, status, details: ['D geprüft'], evaluatedAt: 600 });
  const first = { ...legacy, id: 'range', entry: null, runId: 'new', knownAt: 300, dealingRange: stage('confirmed') };
  const next = { ...first, id: 'range:validation:600', knownAt: 600, dealingRange: stage('invalidated') };
  const groups = groupSetupSnapshots([legacy, first, next]);
  expect(groups).toHaveLength(2);
  expect(filterDealingRanges(groups)).toHaveLength(1);
  expect(filterDealingRanges(groups, 'invalidated')[0].snapshot).toBe(next);
  expect(filterDealingRanges(groups, 'invalidated')[0].candidate).toBe(first);
  expect(filterDealingRanges(groups, 'legacy')[0].snapshot).toBe(legacy);
  expect(filterDealingRanges(groups, 'validated')).toEqual([]);
  expect(setupEntryConditions(next).rows.find(row => row.key === 'validation').status).toBe('unknown');
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
it('names a blocked candidate condition without declaring the idea permanently invalid', () => {
  const s = snapshot(); s.entry = null; s.m1Check = null;
  s.checklist.checks.time = { status: 'blocked', details: ['00:00 — außerhalb der Handelszeiten.', 'Asia: verboten.'] };
  const review = setupEntryConditions(s);
  expect(review.counts).toEqual([5, 1, 4]);
  expect(review.missing).toEqual([expect.objectContaining({ key: 'time', label: 'Handelszeit / Session / News', details: expect.arrayContaining(['Asia: verboten.']) })]);
  expect(review.assessment).toEqual({ status: 'unmet', label: 'Nicht tradebar am Bewertungsstand' });
  s.checklist.checks.time.status = 'passed';
  expect(setupEntryConditions(s).assessment).toEqual({ status: 'unknown', label: 'Handelbarkeit nicht vollständig belegt' });
});
