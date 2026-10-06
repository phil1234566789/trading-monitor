import { beforeAll, expect, it } from 'vitest';
import f from './fixtures/gbpusd-dr9312-targets.json';
import { evaluateChecklistOuterM5 } from '../src/tradeSetupChecklistM5.js';
import { markIgnoredCandles } from '../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';
import { fixChecklistTargets } from '../src/tradeSetupChecklistLifecycle.js';
import { evaluateCountertrendLifecycle } from '../src/countertrendLifecycle.js';
import { ENTRY_PATTERN_1_VERSION } from '../src/entryPattern1Conditions.js';
let primary;
const args = () => ({ candidate: primary, instrument: 'GBPUSD', candles: f.m5Candles,
  sessionConfigs: f.sessionConfigs, recognitionWithinBar: true, entryPattern: ENTRY_PATTERN_1_VERSION });
beforeAll(() => {
  const at = f.primary.recognizedAt;
  const m5 = markIgnoredCandles(f.m5Candles.filter(c => c.time + 300 <= at), f.sessionConfigs,
    t => berlinOffsetMinutes(t * 1000));
  const outer = evaluateChecklistOuterM5({ instrument: 'GBPUSD', direction: 'short', m5Candles: m5,
    evaluatedAt: at }, f.settings, f.structureStart);
  primary = { ...f.primary, checks: { reaction: { status: 'passed' },
    m5Trend: { structureState: outer.state, evaluatedAt: at } } };
});
it('original 9312: replaces NY with MMM and the next native Find Targets pivot', () => {
  const selection = fixChecklistTargets(args());
  expect(selection.target1.price).toBeCloseTo(1.32659, 5);
  expect(selection.target1.pivotTime).toBe(1790759700);
  expect(selection.target2.price).toBeCloseTo(1.32548, 5);
  expect(selection.target2.pivotTime).toBe(1790756100);
  const lifecycle = evaluateCountertrendLifecycle({ selection, invalidation: primary.invalidation,
    candles: f.m5Candles, m1Candles: f.m1Candles, evaluatedAt: 1790777100 });
  expect(lifecycle.main.state).toBe('active');
  expect(lifecycle.entrySearchAllowed).toBe(true);
});
it('preserves historical target rules and their original NY end', () => {
  const selection = fixChecklistTargets({ ...args(), entryPattern: 'countertrend-entry-model-1-v6' });
  expect(selection.target1.price).toBeCloseTo(1.32827, 5);
  expect(selection.target2.price).toBeCloseTo(1.32659, 5);
  expect(evaluateCountertrendLifecycle({ selection, invalidation: primary.invalidation,
    candles: f.m5Candles, m1Candles: f.m1Candles, evaluatedAt: 1790777100 }).entrySearchAllowed).toBe(false);
});
it('freezes selection from the causal recognition prefix, also after rewind', () => {
  const expected = fixChecklistTargets(args());
  expect(fixChecklistTargets({ ...args(), candles: f.m5Candles.filter(c => c.time + 300 <= primary.recognizedAt) })).toEqual(expected);
  expect(fixChecklistTargets({ ...args(), candles: [...f.m5Candles, { time: 1790800000, high: 2, low: 0, close: 1 }] })).toEqual(expected);
});

it('rewinds lifecycle progress without retaining a later target hit', () => {
  const selection = fixChecklistTargets(args()), progress = {};
  const context = { selection, invalidation: primary.invalidation, candles: f.m5Candles, m1Candles: f.m1Candles };
  evaluateCountertrendLifecycle({ ...context, evaluatedAt: 1790778600, progress });
  expect(evaluateCountertrendLifecycle({ ...context, evaluatedAt: 1790773800, progress }))
    .toEqual(evaluateCountertrendLifecycle({ ...context, evaluatedAt: 1790773800 }));
});
