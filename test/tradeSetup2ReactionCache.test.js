import { describe, expect, it } from 'vitest';
import { evaluateTradeSetupChecklist } from '../src/tradeSetupChecklist.js';
import h1 from './fixtures/gbpusd-h1-dr114-lifecycle.json';
import m5 from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import config from './fixtures/gbpusd-m5-dr114-session-targets.json';

describe('immutable archive reaction cache', () => {
  it('preserves uncached prefix results through C recognition and subsequent M5 bars', () => {
    const reactionCache = new Map();
    for (const clock of ['09:25', '09:30', '09:35', '09:50', '10:00']) {
      const input = { instrument: 'GBPUSD', evaluatedAt: Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000,
        h1Candles: h1.candles, m5Candles: m5, sessionConfigs: config.sessions,
        settings: { rangesFixedStartActive: true, rangesFixedStartTime: h1.cutoff } };
      const plain = evaluateTradeSetupChecklist(input);
      const cached = evaluateTradeSetupChecklist({ ...input, reactionCache });
      expect(cached.setup).toEqual(plain.setup);
      expect(cached.checks).toEqual(plain.checks);
    }
    expect(reactionCache.size).toBeGreaterThan(0);
    expect(reactionCache.size).toBeLessThanOrEqual(1024);
  }, 30000);
});
