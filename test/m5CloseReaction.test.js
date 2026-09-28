import { describe, expect, it } from 'vitest';
import candlesArchive from './fixtures/gbpusd-m5-dr114-close-reaction.json';
import { computeRangesPivots } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';
import { deriveM5CloseReaction } from '../src/m5CloseReaction.js';

const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
const anchor = 1788350400;
function evaluate(clock, rows = candlesArchive) {
  const candles = rows.filter(c => c.time <= at(clock) && !c.ignored);
  return buildStructureWithPhases(computeRangesPivots(candles, 5, anchor),
    computeRangesPivots(candles, 2, anchor), 5, 2, candles, 300, { closeEvaluation: true }).closeReaction;
}

describe('M5 close reactions from the existing DR114 structure', () => {
  it('recognizes CHoCH and BOS on their closing candles before pivot confirmation', () => {
    expect(evaluate('09:45')).toMatchObject({ trend: 'uptrend', choch: null, bos: null });
    expect(evaluate('09:50')).toMatchObject({ trend: 'uptrend', direction: 'short', bos: null,
      choch: { price: expect.closeTo(1.35576, 8), candleTime: at('09:50'), recognizedAt: at('09:55') } });
    expect(evaluate('09:55').choch).toEqual(evaluate('09:50').choch);
    expect(evaluate('10:00')).toMatchObject({ trend: 'uptrend',
      choch: { recognizedAt: at('09:55') },
      bos: { price: expect.closeTo(1.35554, 8), candleTime: at('10:00'), recognizedAt: at('10:05') } });
    expect(evaluate('10:20')).toMatchObject({ trend: 'downtrend',
      choch: { recognizedAt: at('09:55') }, bos: { recognizedAt: at('10:05') } });
  });
  it('ignores a wick and equality at the CHoCH level', () => {
    const rows = candlesArchive.map(c => c.time === at('09:50') ? { ...c, close: 1.35576 } : c);
    expect(evaluate('09:50', rows).choch).toBeNull();
  });
  it('ignores a wick at the protected low and remembers the previous CHoCH', () => {
    const rows = candlesArchive.map(c => c.time === at('10:00') ? { ...c, close: 1.3557 } : c);
    expect(evaluate('10:00', rows)).toMatchObject({ bos: null, choch: { recognizedAt: at('09:55') } });
  });
  it('mirrors both breaks for long', () => {
    const mirrored = candlesArchive.map(c => ({ ...c, open: 3-c.open, close: 3-c.close, high: 3-c.low, low: 3-c.high }));
    expect(evaluate('10:00', mirrored)).toMatchObject({ trend: 'downtrend', direction: 'long',
      choch: { recognizedAt: at('09:55') }, bos: { recognizedAt: at('10:05') } });
  });
  it('ignores spread-hour candles and reproduces earlier results on replay rewind', () => {
    const rows = candlesArchive.map(c => c.time === at('09:50') ? { ...c, ignored: true } : c);
    expect(evaluate('09:50', rows).choch).toBeNull();
    const earlier = evaluate('09:45');
    evaluate('10:20');
    expect(evaluate('09:45')).toEqual(earlier);
  });
  it('clears the current reversal after a close beyond its origin, without reviving old signals', () => {
    const rows = candlesArchive.map(c => c.time === at('09:55') ? { ...c, high: 1.3569, close: 1.35685 } : c);
    expect(evaluate('09:55', rows)).toMatchObject({ choch: null, bos: null });
    expect(evaluate('10:00', rows)).toMatchObject({ choch: null, bos: null });
  });
  it('uses a close after a protected-low wick, retaining the actual CHoCH timestamp', () => {
    const rows = candlesArchive.map(c => c.time === at('09:55') ? { ...c, low: 1.3554 } : c);
    expect(evaluate('09:55', rows).bos).toBeNull();
    expect(evaluate('10:00', rows)).toMatchObject({ choch: { recognizedAt: at('09:55') }, bos: { recognizedAt: at('10:05') } });
  });
  it('can report BOS independently of an unconfirmed CHoCH candidate', () => {
    const cs = candlesArchive.filter(c => c.time <= at('10:00'));
    const outer = computeRangesPivots(cs, 5, anchor);
    const inner = computeRangesPivots(cs, 2, anchor);
    const { state } = buildStructureWithPhases(outer, inner, 5, 2, cs, 300);
    const reaction = deriveM5CloseReaction({ ...state, nestedTrend: null }, outer, inner, 5, 2, cs, 300);
    expect(reaction).toMatchObject({ choch: null, direction: 'short', bos: { recognizedAt: at('10:05') } });
  });
});
