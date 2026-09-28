import { describe, expect, it } from 'vitest';
import fixture from './fixtures/gbpusd-m5-dr114-session-targets.json';
import { evaluateChecklistConfluences } from '../src/tradeSetupChecklistConfluences.js';
import { markIgnoredCandles } from '../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../src/berlinTime.js';

const at = s => Date.parse(s) / 1000;
const candles = markIgnoredCandles(fixture.candles, fixture.sessions, sec => berlinOffsetMinutes(sec * 1000));
const sweep = { timeframe: '1H', ageTier: 'major', level: { dir: 1, price: 1.35649,
  pivotTime: at('2026-08-31T16:00:00+02:00'), touchedTime: at('2026-09-09T09:00:00+02:00') } };
const primary = { id: 'fixture-major', direction: 'short', sweep };
function evaluate(time = '2026-09-09T10:35:00+02:00', changes = {}) {
  const evaluatedAt = at(time);
  return evaluateChecklistConfluences({ evaluatedAt, direction: 'short', m5Candles: candles,
    primary: { ...primary, knownAsOf: evaluatedAt }, ...changes }).confluences;
}

describe('M5 divergence on the selected sweep', () => {
  it('reproduces the pinned DR114 divergence from candles, without consulting pins', () => {
    const result = evaluate();
    expect(result.status).toBe('passed');
    expect(result.divergences.candidates).toHaveLength(1);
    const d = result.divergences.candidates[0];
    // Pin 377 dient nur als Sollbeispiel; Produktcode kennt weder Pin noch Datum/Preis.
    expect(d).toMatchObject({ type: 'bearish', timeframe: '5m', association: 'sweep-touch',
      fromTime: at('2026-09-09T07:25:00+02:00'), toTime: at('2026-09-09T09:10:00+02:00'),
      recognizedAt: at('2026-09-09T09:30:00+02:00') });
    expect(d.fromPrice).toBeCloseTo(1.35531, 5);
    expect(d.toPrice).toBeCloseTo(1.35651, 5);
    expect(d.fromRsi).toBeCloseTo(74.39798458, 6);
    expect(d.toRsi).toBeCloseTo(69.70313457, 6);
    expect(result.details).toHaveLength(2);
    expect(result.details[0]).toBe('M5 bärische Divergenz');
    expect(result.details.join(' ')).not.toMatch(/Kandidat|ungeklärt|unbekannt|Mitigation/);
  });
  it('appears only at the close of all three right confirmation candles', () => {
    expect(evaluate('2026-09-09T09:29:59+02:00').status).toBe('pending');
    expect(evaluate('2026-09-09T09:30:00+02:00').status).toBe('passed');
    expect(evaluate('2026-09-09T10:30:00+02:00').status).toBe('passed');
  });
  it('does not assign historical divergence to a different sweep in the same H1 bar', () => {
    const result = evaluate(undefined, { primary: { ...primary, knownAsOf: at('2026-09-09T10:35:00+02:00'),
      sweep: { ...sweep, level: { ...sweep.level, price: 1.3567 } } } });
    expect(result.status).toBe('pending');
    expect(result.divergences.candidates).toEqual([]);
  });
  it('does not infer G from the H1 RSI or from a missing main sweep', () => {
    expect(evaluate(undefined, { m5Candles: undefined, h1Candles: candles }).status).toBe('unknown');
    expect(evaluate(undefined, { primary: null }).status).toBe('unknown');
    expect(evaluate(undefined, { direction: 'long' }).status).not.toBe('passed');
  });
  it('does not turn an absent optional divergence into No-Go or a false confirmation', () => {
    const result = evaluate(undefined, { m5Candles: candles.map(c => ({ ...c, close: 1.355 })) });
    expect(result.status).toBe('pending');
    expect(result.details).toEqual(['Keine zusätzliche M5-Divergenz am Sweep.']);
  });
  it('is symmetric for a long sweep and a bullish divergence', () => {
    const mirrored = candles.map(c => ({ ...c, open: 3 - c.open, close: 3 - c.close, high: 3 - c.low, low: 3 - c.high }));
    const result = evaluate(undefined, { direction: 'long', m5Candles: mirrored, primary: { ...primary, direction: 'long',
      knownAsOf: at('2026-09-09T10:35:00+02:00'), sweep: { ...sweep, level: { ...sweep.level, dir: -1, price: 3 - sweep.level.price } } } });
    expect(result.status).toBe('passed');
    expect(result.details[0]).toBe('M5 bullische Divergenz');
  });
  it('returns the same result from the closed prefix, even with future rows supplied', () => {
    const time = '2026-09-09T09:30:00+02:00';
    expect(evaluate(time)).toEqual(evaluate(time, { m5Candles: candles.filter(c => c.time + 300 <= at(time)) }));
  });
  it('keeps a proven divergence green while independent OB mitigation remains open', () => {
    const result = evaluate();
    expect(result.status).toBe('passed');
    expect(result.orderBlockData['1H']).toBe('unknown');
  });
});
