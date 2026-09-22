import { describe, it, expect } from 'vitest';
import { validateCandles } from '../supabase/functions/fxcm-ingest/validate.js';

const candle = { instrument: 'GBPUSD', bar: '5m', time: '2026-09-16T06:00:00+00:00',
  open: 1.34909, high: 1.34980, low: 1.34802, close: 1.34827, volume: 1476 };
const closedAt = Date.parse('2026-09-16T06:05:00Z');
describe('FXCM ingest boundary', () => {
  it('rejects an unfinished candle, accepts it at its close', () => {
    expect(() => validateCandles({ candles: [candle] }, closedAt - 1)).toThrow();
    expect(validateCandles({ candles: [candle] }, closedAt)[0].source).toBe('fxcm');
  });
  it.each([{ high: NaN }, { low: 2 }, { bar: 'oops' }, { instrument: 'BAD' }, { time: '2026-09-16' }])('rejects malformed candle %j', (change) => {
    expect(() => validateCandles({ candles: [{ ...candle, ...change }] }, closedAt)).toThrow();
  });
  it('does not trust source or additional columns supplied by the caller', () => {
    const row = validateCandles({ candles: [{ ...candle, source: 'ctrader', extra: true }] }, closedAt)[0];
    expect(row.source).toBe('fxcm');
    expect(row).not.toHaveProperty('extra');
  });
});
