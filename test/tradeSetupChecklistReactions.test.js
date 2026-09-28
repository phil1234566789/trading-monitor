import { describe, it, expect } from 'vitest';
import fixture from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { evaluateChecklistSweeps } from '../src/tradeSetupChecklistSweeps.js';
import { sameChecklistSweep } from '../src/tradeSetupChecklistReactions.js';
import { detectChecklistReactions } from '../src/tradeSetupChecklistReactions.js';
import { detectSetupObs } from '../src/tradeSetup.js';
import { markIgnoredCandles } from '../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';

const at = s => Date.parse(s) / 1000;
const touch = at('2026-09-09T09:00:00+02:00');
// H1-Sweep-Eingabe; die Preisreaktion stammt aus dem archivierten DR114-M5-Präfix.
const sweep = { dir: 1, price: 1.35649, pivotTime: touch - 9 * 86400, touched: true, touchedTime: touch };
const candles = markIgnoredCandles(fixture.candles, fixture.sessions, sec => berlinOffsetMinutes(sec * 1000));
function evaluate(time, levels = [sweep], rows = candles, direction = 'short') {
  return evaluateChecklistSweeps({ h1Levels: levels, context: { instrument: 'GBPUSD', evaluatedAt: at(time), direction, m5Candles: rows } });
}

describe('existing setup reaction for the same checklist sweep', () => {
  it('confirms DR114 at 10:30 and 10:35 Berlin with the widened OB geometry', () => {
    for (const time of ['2026-09-09T10:30:00+02:00', '2026-09-09T10:35:00+02:00']) {
      const result = evaluate(time);
      expect(result.primary?.checks.reaction.status).toBe('passed');
      expect(result.primary.reactionOB.top).toBeCloseTo(1.35675, 5);
      expect(result.primary.reactionOB.bottom).toBeCloseTo(1.35641, 5);
      expect(result.primary.bandRisk).toBeCloseTo(0.00034, 5);
    }
  });
  it('keeps B before C and only confirms a closed FVG', () => {
    expect(evaluate('2026-09-09T09:25:00+02:00').primary.reactionOB).toBeNull();
    expect(evaluate('2026-09-09T09:30:00+02:00').primary.checks.reaction.status).toBe('passed');
  });
  it('does not switch an older B to a younger matching sweep', () => {
    const other = { ...sweep, pivotTime: sweep.pivotTime - 86400, price: 1.36 };
    const result = evaluate('2026-09-09T10:35:00+02:00', [other, sweep]);
    expect(result.primary.sweep.level.price).toBe(1.36);
    expect(result.primary.checks.reaction.status).not.toBe('passed');
    expect(result.candidates.find(c => c.sweep.level.price === sweep.price).checks.reaction.status).toBe('passed');
  });
  it('matches each member of a setup with multiple sweeps', () => {
    const second = { ...sweep, price: 1.3565, pivotTime: sweep.pivotTime + 86400 };
    const result = evaluate('2026-09-09T10:35:00+02:00', [sweep, second]);
    expect(result.candidates.every(c => c.checks.reaction.status === 'passed')).toBe(true);
  });
  it('requires source, direction, pivot and touch identity, not price alone', () => {
    const a = { timeframe: '1H', level: sweep };
    for (const key of ['dir', 'pivotTime', 'price', 'touchedTime']) {
      expect(sameChecklistSweep(a, { ...a, level: { ...sweep, [key]: sweep[key] + 1 } })).toBe(false);
    }
    expect(sameChecklistSweep(a, { ...a, timeframe: '5M' })).toBe(false);
  });
  it('retains the detected relationship beyond the legacy six-hour search window', () => {
    const args = { candles, levels: [sweep], obs: detectSetupObs(candles), instrument: 'GBPUSD' };
    const earlier = detectChecklistReactions({ ...args, evaluatedAt: at('2026-09-09T10:35:00+02:00') });
    const later = detectChecklistReactions({ ...args, evaluatedAt: at('2026-09-10T10:35:00+02:00') });
    expect(earlier[0].ob).toEqual(later[0].ob);
  });
  it('is symmetric for long and identical with a sliced prefix', () => {
    const time = '2026-09-09T10:35:00+02:00';
    const mirror = candles.map(c => ({ ...c, open: 3 - c.open, close: 3 - c.close, high: 3 - c.low, low: 3 - c.high }));
    const levels = [{ ...sweep, dir: -1, price: 3 - sweep.price }];
    expect(evaluate(time, levels, mirror, 'long').primary.checks.reaction.status).toBe('passed');
    expect(evaluate(time, [sweep], candles.filter(c => c.time + 300 <= at(time)))).toEqual(evaluate(time));
  });
});
