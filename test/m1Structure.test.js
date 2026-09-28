import { describe, expect, it } from 'vitest';
import { buildM1Structure } from '../src/m1Structure.js';
import { computeRangesPivots } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';

const candles = Array.from({ length: 50 }, (_, i) => ({ time: i * 60,
  open: 10, close: 10 + Math.sin(i), high: 11 + Math.sin(i), low: 9 + Math.sin(i) }));
const anchor = { pivotTime: 600, price: 10, recognizedAt: 900 };
describe('M1 structure from a known M5 pivot', () => {
  it('uses the existing structure kernel, preserving fractal lead-in and the anchor cutoff', () => {
    const result = buildM1Structure(candles, anchor, 1800, 5, 2);
    const closed = candles.filter(c => c.time + 60 <= 1800);
    const outer = computeRangesPivots(closed, 5, 600);
    const inner = computeRangesPivots(closed, 2, 600);
    expect(result.state).toEqual(buildStructureWithPhases(outer, inner, 5, 2, closed, 60).state);
    expect(result.pivotsOuter).toEqual(outer);
    expect(result.pivotsInner.every(p => p.pivotTime >= 600)).toBe(true);
  });
  it('does not use an unknown anchor or open and future candles on replay rewind', () => {
    expect(buildM1Structure(candles, anchor, 899).state).toBeNull();
    expect(buildM1Structure(candles, null, 1800).state).toBeNull();
    const earlier = buildM1Structure(candles, anchor, 1800);
    buildM1Structure(candles, anchor, 2500);
    expect(buildM1Structure(candles, anchor, 1800)).toEqual(earlier);
    expect(buildM1Structure(candles.filter(c => c.time < 1800), anchor, 1800)).toEqual(earlier);
  });
  it('reports insufficient lead-in instead of silently starting later', () => {
    expect(buildM1Structure(candles.filter(c => c.time >= 600), anchor, 1800).status).toBe('missing');
  });
});
