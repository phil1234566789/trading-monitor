import { describe, it, expect } from 'vitest';
import { evaluateChecklistLifecycle, fixChecklistTargets } from '../src/tradeSetupChecklistLifecycle.js';
import fixture from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { finalizeChecklistCandidates } from '../src/tradeSetupChecklistCandidates.js';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import h1Fixture from './fixtures/gbpusd-h1-dr114-lifecycle.json';

const selection = { status: 'passed', selectedAt: 600, direction: 'short', target1: { price: 8 }, target2: { price: 6 } };
const row = (time, low = 9, high = 10) => ({ time, low, high, open: 9, close: 9 });
const run = (candles, extra = {}) => evaluateChecklistLifecycle({ selection, invalidation: 12, candles, evaluatedAt: 1500, ...extra });

describe('fixed checklist targets and separate T2 observation', () => {
  it('keeps DR114 target selection fixed even when active H1 selects the opposing direction', () => {
    const args = { instrument: 'GBPUSD', h1Candles: h1Fixture.candles, m5Candles: fixture.candles,
      settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1Fixture.cutoff }, sessionConfigs: fixture.sessions };
    const evaluate = time => evaluateTradeSetupChecklist({ ...args, evaluatedAt: Date.parse(`2026-09-09T${time}:00+02:00`) / 1000 });
    const before = evaluate('09:30');
    const known = evaluate('10:00');
    const later = evaluate('10:35');
    const targets = state => state.setup.candidates.find(c => c.direction === 'short' && c.targetSelection?.target1?.price === 1.35335)?.targetSelection;
    expect(before.direction).toBe('long');
    expect(before.setup.primary).toBeNull();
    expect(targets(before)).toEqual(targets(known));
    expect(targets(known).selectedAt).toBe(Date.parse('2026-09-09T09:30:00+02:00') / 1000);
    expect(targets(later)).toEqual(targets(known));
    expect(targets(evaluate('10:00'))).toEqual(targets(known));
  });
  it('ends the setup at T1 and keeps observing T2', () => {
    const candles = [row(600, 8), row(900), row(1200, 6)];
    expect(run(candles)).toMatchObject({ main: { state: 'ended', reason: 'target1', endedAt: 600 }, target2: { status: 'reached', hitAt: 1200, recognizedAt: 1500 } });
    expect(run(candles, { evaluatedAt: 1200 }).target2.status).toBe('open');
  });
  it('stops T2 at invalidation, even if price reaches T2 later', () => {
    expect(run([row(600, 8), row(900, 9, 12), row(1200, 6)]).target2).toMatchObject({ status: 'notReached', endedAt: 900, hitAt: null });
  });
  it('preserves T2 success before later invalidation', () => {
    expect(run([row(600, 6), row(900, 9, 12), row(1200)]).target2.status).toBe('reached');
  });
  it('does not invent intrabar order', () => {
    expect(run([row(600, 6, 12)]).target2).toMatchObject({ status: 'unknown', reason: 'sameCandle', endedAt: 600 });
    expect(run([row(600, 6, 12)]).main.reason).toBe('both');
  });
  it('does not infer success or failure across missing history', () => {
    expect(run([row(900, 6)]).target2).toMatchObject({ status: 'unknown', reason: 'missingHistory' });
    expect(run([row(600, 8), row(1200, 6)]).main.reason).toBe('target1');
    expect(run([row(600, 8), row(1200, 6)]).target2.status).toBe('unknown');
  });
  it('ignores excluded candles and future candles', () => {
    expect(run([{ ...row(600, 6, 12), ignored: true }, row(900), row(1200), row(1500, 6)]).target2.status).toBe('open');
  });
  it('keeps optional T2 out of the sample', () => {
    expect(run([row(600, 8)], { selection: { ...selection, target2: null }, evaluatedAt: 900 }).target2.status).toBe('notApplicable');
  });
  it('is symmetric for long and empty observation at selection time is open', () => {
    expect(run([], { evaluatedAt: 600 }).main.state).toBe('active');
    const long = { ...selection, direction: 'long', target1: { price: 12 }, target2: { price: 14 } };
    expect(run([row(600, 9, 12), row(900, 9, 14)], { selection: long, invalidation: 8, evaluatedAt: 1200 }).target2.status).toBe('reached');
  });
  it('fixes targets from the C prefix and never substitutes newer pivots', () => {
    const selectedAt = Date.parse('2026-09-09T09:30:00+02:00') / 1000;
    const candidate = { direction: 'short', reactionRecognizedAt: selectedAt, checks: { reaction: { status: 'passed' } } };
    const args = { candidate, instrument: 'GBPUSD', candles: fixture.candles, sessionConfigs: fixture.sessions };
    const a = fixChecklistTargets(args);
    expect(a).toMatchObject({ selectedAt, target1: { price: 1.35335 }, target2: { price: 1.353 } });
    expect(fixChecklistTargets({ ...args, candles: fixture.candles.filter(c => c.time + 300 <= selectedAt) })).toEqual(a);
    expect(fixChecklistTargets({ ...args, candidate: { ...candidate, reactionRecognizedAt: null } })).toBeNull();
  });
  it('keeps ended candidates for statistics but removes them from primary selection', () => {
    const selectedAt = Date.parse('2026-09-09T09:30:00+02:00') / 1000;
    const candidate = { id: 'a', direction: 'short', reactionRecognizedAt: selectedAt, invalidation: 1.35675,
      checks: { reaction: { status: 'passed' }, liquiditySweep: { status: 'passed', details: [] } },
      validity: { state: 'unknown' } };
    const context = { instrument: 'GBPUSD', direction: 'short', evaluatedAt: selectedAt + 300,
      m5Candles: [...fixture.candles.filter(c => c.time < selectedAt), { ...row(selectedAt, 1.35335, 1.356), close: 1.354 }], h1Candles: [] };
    const result = finalizeChecklistCandidates({ candidates: [candidate] }, context, fixture.sessions);
    expect(result.primary).toBeNull();
    expect(result.candidates[0].lifecycle).toMatchObject({ main: { state: 'ended', reason: 'target1' }, target2: { status: 'open' } });
    expect(result.candidates[0].targetSelection.selectedAt).toBe(selectedAt);
  });
});
