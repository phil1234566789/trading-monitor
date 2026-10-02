import { describe, expect, it } from 'vitest';
import { buildM1Structure } from '../src/m1Structure.js';
import { evaluateM1Checklist, inactiveM1Checklist } from '../src/m1Checklist.js';
import candles from './fixtures/gbpusd-m1-dr114-p5.json';
import { createCloseReactionCache } from '../src/m5CloseReactionHistory.js';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const context = { instrument: 'GBPUSD', direction: 'short',
  primary: { reactionRecognizedAt: at('09:30'), reactionOB: { dir: -1, top: 1.35675, bottom: 1.35641, startTime: at('09:20') } },
  anchor: { pivotTime: at('08:45'), price: 1.35554, recognizedAt: at('09:30') } };
const evaluate = clock => {
  const evaluatedAt = at(clock);
  return evaluateM1Checklist({ context, evaluatedAt, candles,
    structure: buildM1Structure(candles, context.anchor, evaluatedAt) });
};

describe('M1 checklist structure', () => {
  it('keeps every field causal and identical with the bounded archive cache, including backward replay', () => {
    const cache = createCloseReactionCache(100000);
    for (const clock of ['09:31', '09:40', '09:47', '09:50', '09:55', '09:40', '09:50']) {
      const evaluatedAt = at(clock);
      const args = { context, evaluatedAt, candles, structure: buildM1Structure(candles, context.anchor, evaluatedAt) };
      expect(evaluateM1Checklist({ ...args, closeReactionCache: cache })).toEqual(evaluateM1Checklist(args));
    }
    expect(cache.size).toBeGreaterThan(0);
  });
  it('uses the active confirmed nested direction and retains outer as context', () => {
    const early = evaluate('09:31');
    expect(early.trends).toEqual([{ trend: 'uptrend', depth: 0 }]);
    expect(early.detailStatuses.slice(0, 3)).toEqual(['unmet', 'unmet', 'unmet']);
    const later = evaluate('09:40');
    expect(later.trends).toEqual([{ trend: 'uptrend', depth: 0 }, { trend: 'downtrend', depth: 1 }]);
    expect(later.currentTrend).toEqual({ trend: 'downtrend', depth: 1 });
    expect(later.details[0]).toBe('Aktuelle M1-Richtung: Downtrend');
    expect(later.detailStatuses.slice(0, 4)).toEqual(['passed', 'context', 'passed', 'passed']);
  });
  it('keeps current bearish parent signals even when the nested structure reacts bullishly', () => {
    const result = evaluate('09:47');
    expect(result.choch.candleTime).toBe(at('09:33'));
    expect(result.bos.candleTime).toBe(at('09:33'));
    expect(result.choch.direction).toBe('short');
    expect(result.bos.direction).toBe('short');
  });
  it('distinguishes missing prerequisites and data from negative signals', () => {
    expect(inactiveM1Checklist('abc').details).toEqual(['M1-Struktur wartet auf A, B und C.']);
    for (const reason of ['abc', 'anchor', 'loading', 'missing', 'error', 'disabled', 'ended']) {
      const result = inactiveM1Checklist(reason);
      expect(result.detailStatuses).toEqual([]);
      expect(result.status).not.toBe('unmet');
    }
  });
  it('confirms the C-zone touch before the first following FVG, then colors its impulse', () => {
    expect(evaluate('09:46').retest).toBeNull();
    const touch = evaluate('09:47');
    expect(touch.retest.candleTime).toBe(at('09:46'));
    expect(touch.fvg).toBeNull();
    expect(evaluate('09:49').fvg).toBeNull();
    const result = evaluate('09:50');
    expect(result.fvg.candleTime).toBe(at('09:48'));
    expect(result.fvg.recognizedAt).toBe(at('09:50'));
    expect(result.detailStatuses.slice(-2)).toEqual(['passed', 'passed']);
    expect(evaluate('09:55').fvg.candleTime).toBe(at('09:48'));
    expect(evaluate('09:47')).toEqual(touch);
  });
  it('does not treat another zone or a missing minute as proof of the retest', () => {
    const evaluatedAt = at('09:50');
    const structure = buildM1Structure(candles, context.anchor, evaluatedAt);
    const other = { ...context, primary: { ...context.primary,
      reactionOB: { ...context.primary.reactionOB, top: 1.36, bottom: 1.359 } } };
    expect(evaluateM1Checklist({ context: other, structure, candles, evaluatedAt }).retest).toBeNull();
    const incomplete = candles.filter(c => c.time !== at('09:46'));
    const result = evaluateM1Checklist({ context, structure, candles: incomplete, evaluatedAt });
    expect(result.detailStatuses.slice(-2)).toEqual(['unknown', 'unknown']);
    expect(result.fvg).toBeNull();
  });
  it('handles the symmetric bullish sequence with the same detector and signal logic', () => {
    const reflected = candles.map(c => ({ ...c, open: 3 - c.open, close: 3 - c.close, high: 3 - c.low, low: 3 - c.high }));
    const long = { ...context, direction: 'long', anchor: { ...context.anchor, price: 3 - context.anchor.price },
      primary: { ...context.primary, reactionOB: { ...context.primary.reactionOB, dir: 1,
        top: 3 - context.primary.reactionOB.bottom, bottom: 3 - context.primary.reactionOB.top } } };
    const evaluatedAt = at('09:50');
    const result = evaluateM1Checklist({ context: long, candles: reflected, evaluatedAt,
      structure: buildM1Structure(reflected, long.anchor, evaluatedAt) });
    expect(result.trends[0].trend).toBe('downtrend');
    expect(result.choch.direction).toBe('long');
    expect(result.bos.direction).toBe('long');
    expect(result.retest.candleTime).toBe(at('09:46'));
    expect(result.fvg.candleTime).toBe(at('09:48'));
  });
});
