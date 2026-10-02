import { describe, expect, it } from 'vitest';
import { computeRangesPivots } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';
import candles from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import { createCloseReactionCache } from '../src/m5CloseReactionHistory.js';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
function evaluate(clock, closeReactionCache, start = 1788350400) {
  const rows = candles.filter(c => c.time <= at(clock) && !c.ignored);
  return buildStructureWithPhases(computeRangesPivots(rows, 5, start), computeRangesPivots(rows, 2, start),
    5, 2, rows, 300, { closeEvaluation: true, closeReactionCache }).closeReaction;
}
describe('immutable historical close-reaction cache', () => {
  it('preserves CHoCH/BOS before and after confirmation and when rewinding', () => {
    const cache = createCloseReactionCache();
    for (const clock of ['09:45', '09:50', '09:55', '10:00', '10:20', '09:45']) {
      expect(evaluate(clock, cache)).toEqual(evaluate(clock));
    }
    expect(cache.size).toBeGreaterThan(0);
    expect(evaluate('10:00', cache, at('09:00'))).toEqual(evaluate('10:00', undefined, at('09:00')));
  }, 30000);
});
