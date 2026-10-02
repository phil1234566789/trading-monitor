import { afterEach, expect, it, vi } from 'vitest';
import { scanTradeSetup2Window } from '../src/tradeSetup2Scan.js';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import * as m5Checks from '../src/tradeSetupChecklistM5.js';
import * as sweeps from '../src/tradeSetupChecklistSweeps.js';
import * as reactions from '../src/tradeSetupChecklistReactions.js';
import * as targets from '../src/tradeSetupChecklistTargets.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import m1 from './fixtures/gbpusd-m1-dr114-p5.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { activeM1Context, m1PrerequisiteReason } from '../src/m1Structure.js';
const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const input = { instrument: 'GBPUSD', h1Candles: h1.candles, m5Candles: m5, m1Candles: m1,
  settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff }, sessionConfigs: config.sessions,
  fromTime: at('09:25'), toTime: at('09:55'), evaluatedAt: at('09:50'), entryGates: true };
afterEach(() => vi.restoreAllMocks());

it('applies the same known time prohibition to chart M1 prerequisites', () => {
  const checklist = evaluateTradeSetupChecklist({ ...input, entryGates: false,
    tradingWindows: { weekday: [], saturday: [], sunday: [] } });
  expect(m1PrerequisiteReason(checklist)).toBe('time');
  expect(activeM1Context(checklist)).toBeNull();
});

it('retains blocked-period candidates and resumes within an M5 interval when the session opens', async () => {
  const baseline = await scanTradeSetup2Window(input);
  const session = { instrument: 'GBPUSD', label: 'Test', fromMinutes: 0, toMinutes: 587, days: [3], danger: 'forbidden' };
  const reopened = await scanTradeSetup2Window({ ...input, sessionConfigs: [...config.sessions, session] });
  expect(reopened.filter(s => s.entry).map(s => s.entry)).toEqual(baseline.filter(s => s.entry).map(s => s.entry));
  expect(reopened.some(s => !s.entry && s.knownAt < at('09:47'))).toBe(true);
  expect((await scanTradeSetup2Window({ ...input, sessionConfigs: [...config.sessions, { ...session, toMinutes: 600 }] })).filter(s => s.entry)).toEqual([]);
}, 30000);

it('blocks known news but keeps caution and unknown news eligible', async () => {
  const caution = { instrument: 'GBPUSD', label: 'Test', fromMinutes: 540, toMinutes: 600, days: [3], danger: 'caution' };
  expect((await scanTradeSetup2Window({ ...input, sessionConfigs: [...config.sessions, caution], newsLoadStatus: 'unknown' })).filter(s => s.entry)).toHaveLength(1);
  expect((await scanTradeSetup2Window({ ...input, news: [{ currency: 'USD', eventTime: at('10:00') }], newsLoadStatus: 'unknown' })).filter(s => s.entry)).toHaveLength(0);
}, 30000);

it('skips B/C if A is unknown and skips costly M5 and targets if B or C are unconfirmed', () => {
  const sweepSpy = vi.spyOn(sweeps, 'evaluateChecklistSweeps');
  evaluateTradeSetupChecklist({ ...input, h1Candles: h1.candles.filter(c => c.time + 3600 <= input.evaluatedAt).slice(-1) });
  expect(sweepSpy).not.toHaveBeenCalled();
  const m5Spy = vi.spyOn(m5Checks, 'evaluateChecklistM5');
  const targetSpy = vi.spyOn(targets, 'evaluateChecklistTargets');
  for (const [b, c] of [['unknown', 'pending'], ['passed', 'unknown'], ['passed', 'pending']]) {
    sweepSpy.mockReturnValue({ candidates: [], primary: null, opposingCandidates: [], checks: { liquiditySweep: { status: b }, reaction: { status: c } } });
    const result = evaluateTradeSetupChecklist(input);
    expect(result.checks.liquiditySweep.status).toBe(b);
    expect(result.checks.reaction.status).toBe(c);
  }
  expect(m5Spy).not.toHaveBeenCalled();
  expect(targetSpy).not.toHaveBeenCalled();
});

it('does not search M5 reactions when no known sweep can confirm B', () => {
  const spy = vi.spyOn(reactions, 'detectChecklistReactions');
  const result = sweeps.evaluateChecklistSweeps({ context: { instrument: 'GBPUSD', evaluatedAt: at('09:50'), direction: 'short', m5Candles: m5 }, h1Levels: [], entryGates: true });
  expect(spy).not.toHaveBeenCalled();
  expect(result.checks.liquiditySweep.status).toBe('unknown');
});
