import { describe, it, expect } from 'vitest';
import { evaluateDealingRange, DEALING_RANGE_VERSION, savedDealingRangeStatus, isVersionedDealingRangeRun } from '../src/tradeSetup2DealingRange.js';
import { buildTradeSetup2CandidateSnapshot, buildTradeSetup2Snapshot, restoreTradeSetup2Snapshot } from '../src/tradeSetup2Snapshot.js';
import { buildTradeSetup2Configuration, setup2DailyRun } from '../src/tradeSetup2Configuration.js';
import { activeM1Context } from '../src/m1Structure.js';

const input = (direction = 'long') => {
  const candidate = { id: 'range', direction, knownAsOf: 600, reactionRecognizedAt: 300,
    checks: { liquiditySweep: { status: 'passed' }, reaction: { status: 'passed' } },
    targetSelection: { status: 'passed', selectedAt: 300, target1: { price: 1.36 } } };
  return { status: 'ready', instrument: 'GBPUSD', evaluatedAt: 600, direction,
    setup: { primary: candidate }, checks: { h1Trend: { status: 'passed' }, ...candidate.checks,
      time: { status: 'passed' }, m5Trend: { m1Anchor: { pivotTime: 120, recognizedAt: 300 } },
      antiConfluences: { status: 'pending', divergences: { status: 'present', candidates: [{ recognizedAt: 300 }] } },
      confluences: { status: 'unknown' } } };
};
describe.each(['long', 'short'])('versioned DR stages for %s', direction => {
  it('requires complete ABC in the candidate direction and rejects unknown or future confirmation', () => {
    for (const key of ['h1Trend', 'liquiditySweep', 'reaction']) for (const status of ['pending', 'unknown', 'unmet']) {
      const checklist = input(direction);
      (key === 'h1Trend' ? checklist.checks : checklist.setup.primary.checks)[key].status = status;
      expect(buildTradeSetup2CandidateSnapshot({ checklist, candidate: checklist.setup.primary })).toBeNull();
    }
    const checklist = input(direction);
    checklist.setup.primary.direction = direction === 'long' ? 'short' : 'long';
    expect(evaluateDealingRange(checklist).status).toBe('unconfirmed');
    checklist.setup.primary.direction = direction;
    checklist.setup.primary.reactionRecognizedAt = 601;
    expect(evaluateDealingRange(checklist).status).toBe('unconfirmed');
  });
  it('keeps E/G, F and market end separate from validation and saves without an entry', () => {
    const checklist = input(direction);
    checklist.checks.time.status = 'blocked';
    checklist.setup.primary.validity = { state: 'ended', reason: 'target1', recognizedAt: 600 };
    const snapshot = buildTradeSetup2CandidateSnapshot({ checklist, candidate: checklist.setup.primary });
    expect(snapshot.dealingRange).toMatchObject({ version: DEALING_RANGE_VERSION, status: 'validated', eShowstoppers: [] });
    expect(snapshot.entry).toBeNull();
    expect(snapshot.checklist.checks.antiConfluences).toMatchObject({status:'found',divergences:checklist.checks.antiConfluences.divergences,
      rules:[{id:'h1CounterDivergence',status:'found',invalidates:true}]});
    expect(snapshot.checklist.checks.confluences).toMatchObject({...checklist.checks.confluences,
      rules:[{id:'m5SweepDivergence',status:'unknown',invalidates:false}]});
    expect(activeM1Context({ ...checklist, dealingRange: snapshot.dealingRange })).toBeNull();
  });
  it('retains failed targets with their diagnostic reason while unchecked or missing data stay open', () => {
    const checklist = input(direction), candidate = checklist.setup.primary;
    candidate.targetSelection = { status: 'pending', selectedAt: 300, details: ['Kein Session-Pivot auf der Zielseite.'] };
    const snapshot = buildTradeSetup2CandidateSnapshot({ checklist, candidate });
    expect(snapshot.dealingRange).toMatchObject({ status: 'invalidated', reason: 'targetsUnavailable', details: candidate.targetSelection.details });
    checklist.dealingRange = snapshot.dealingRange;
    expect(activeM1Context(checklist)).toBeNull();
    for (const selection of [null, { status: 'unknown', selectedAt: 300 },
      { status: 'passed', selectedAt: 601, target1: { price: 1.36 } },
      { status: 'passed', selectedAt: 300, target1: { price: 1.36, knownAt: 601 } }]) {
      candidate.targetSelection = selection;
      expect(evaluateDealingRange(checklist).status).toBe('confirmed');
    }
  });
  it('allows entries only after validation, even if an entry is supplied directly', () => {
    const checklist = input(direction), m1Check = { evaluatedAt: 600,
      entry: { id: 'entry', setupKey: 'range', direction, recognizedAt: 600 } };
    expect(buildTradeSetup2Snapshot({ checklist, m1Check }).dealingRange.status).toBe('validated');
    m1Check.entry.direction = direction === 'long' ? 'short' : 'long';
    expect(buildTradeSetup2Snapshot({ checklist, m1Check })).toBeNull();
    m1Check.entry.direction = direction;
    checklist.setup.primary.targetSelection = null;
    expect(buildTradeSetup2Snapshot({ checklist, m1Check })).toBeNull();
  });
});
it('versions new run identities without reclassifying or mutating old snapshots', async () => {
  const old = { schemaVersion: 1, instrument: 'GBPUSD', checklist: input() };
  expect(savedDealingRangeStatus(restoreTradeSetup2Snapshot(old))).toBe('legacy');
  expect(old.dealingRange).toBeUndefined();
  const configuration = buildTradeSetup2Configuration({ instrument: 'GBPUSD' });
  expect(configuration.dealingRangeVersion).toBe('countertrend-abcdef-v2');
  expect(isVersionedDealingRangeRun({ configuration })).toBe(true);
  expect(isVersionedDealingRangeRun({ configuration: { instruments: [configuration] } })).toBe(true);
  expect(isVersionedDealingRangeRun({ configuration: { instruments: [{}] } })).toBe(false);
  const { dealingRangeVersion, ...previous } = configuration;
  expect((await setup2DailyRun(configuration, 600)).id).not.toBe((await setup2DailyRun(previous, 600)).id);
  const checklist = input(), candidate = checklist.setup.primary;
  const first = buildTradeSetup2CandidateSnapshot({ checklist, candidate });
  candidate.knownAsOf = checklist.evaluatedAt = 900;
  const next = buildTradeSetup2CandidateSnapshot({ checklist, candidate });
  expect(first.id).not.toBe(next.id);
  expect(first.setupKey).toBe(next.setupKey);
  expect(first.knownAt).toBe(600);
});
