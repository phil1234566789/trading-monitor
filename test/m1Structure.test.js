import { describe, expect, it } from 'vitest';
import { buildM1Structure } from '../src/m1Structure.js';
import { computeRangesPivots } from '../src/marketStructureAnalysis';
import { buildStructureWithPhases } from '../src/trendPhases.js';
import dr114 from './fixtures/gbpusd-m1-dr114-p5.json';

const candles = Array.from({ length: 50 }, (_, i) => ({ time: i * 60,
  open: 10, close: 10 + Math.sin(i), high: 11 + Math.sin(i), low: 9 + Math.sin(i) }));
const anchor = { pivotTime: 600, price: 10, recognizedAt: 900 };
describe('M1 structure from a known M5 pivot', () => {
  it('excludes P2-only pivots from the entire DR114 structure and debug input', () => {
    const at = clock => Date.parse(`2026-09-09T${clock}:00+02:00`) / 1000;
    const start = { pivotTime: at('08:45'), price: 1.35554, recognizedAt: at('09:55') };
    const closed = dr114.filter(c => c.time + 60 <= at('10:25'));
    const outer = computeRangesPivots(closed, 5, start.pivotTime);
    const inner = computeRangesPivots(closed, 2, start.pivotTime);
    expect(inner.some(p => !outer.some(o => o.pivotTime === p.pivotTime && o.type === p.type))).toBe(true);
    const expected = buildStructureWithPhases(outer, [], 5, 5, closed, 60);
    const mixed = buildStructureWithPhases(outer, inner, 5, 2, closed, 60);
    expect(expected.state).not.toEqual(mixed.state);
    expect(expected.state).not.toBeNull();
    const result = buildM1Structure(dr114, start, at('10:25'));
    expect(result.state).toEqual(expected.state);
    expect(result.events).toEqual(expected.events);
    expect(result.phases).toEqual(expected.phases);
    expect(result.pivotsOuter).toEqual(outer);
    expect(result.pivotsInner).toEqual([]);
    // Auch ein alter Aufrufer mit gespeicherten P2-Einstellungen kann sie nicht reaktivieren.
    expect(buildM1Structure(dr114, start, at('10:25'), 2, 2)).toEqual(result);
  });
  it('uses the existing structure kernel, preserving fractal lead-in and the anchor cutoff', () => {
    const result = buildM1Structure(candles, anchor, 1800);
    const closed = candles.filter(c => c.time + 60 <= 1800);
    const outer = computeRangesPivots(closed, 5, 600);
    expect(result.state).toEqual(buildStructureWithPhases(outer, [], 5, 5, closed, 60).state);
    expect(result.pivotsOuter).toEqual(outer);
    expect(result.pivotsInner).toEqual([]);
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
