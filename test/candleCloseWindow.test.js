import { describe, expect, it } from 'vitest';
import { closesPastLevel, withCandleCloseWindow } from '../src/candleCloseWindow';

const reference = (rows, from, to, price, above) => rows.length === 0 || rows.some(c =>
  c.time > from && c.time <= to && (above ? c.close > price : c.close < price));

describe('bounded candle close queries', () => {
  it('matches the original predicates, including duplicates and invalid bounds', () => {
    const sorted = Array.from({ length: 70 }, (_, i) => ({ time: Math.floor(i / 2), close: i % 11 === 0 ? NaN : Math.sin(i) }));
    for (const rows of [[], sorted, [...sorted].reverse(), [...sorted, { time: NaN, close: 9 }]]) {
      withCandleCloseWindow(rows, () => {
        for (const from of [-Infinity, -1, 0, 12, 35, Infinity, NaN]) {
          for (const to of [-Infinity, 0, 12, 20, Infinity, NaN]) {
            for (const price of [-Infinity, -1, 0, 1, Infinity, NaN]) {
              for (const above of [false, true]) {
                expect(closesPastLevel(rows, from, to, price, above)).toBe(reference(rows, from, to, price, above));
              }
            }
          }
        }
      });
    }
  });

  it('does not read prices outside the selected time window', () => {
    let reads = 0;
    const rows = Array.from({ length: 10000 }, (_, time) => ({ time, get close() { reads++; return 1; } }));
    withCandleCloseWindow(rows, () => expect(closesPastLevel(rows, 9000, 9010, 2, true)).toBe(false));
    expect(reads).toBe(10);
  });

  it('revalidates mutable arrays between calls and cleans up after exceptions', () => {
    const rows = [{ time: 1, close: 1 }, { time: 2, close: 2 }];
    expect(() => withCandleCloseWindow(rows, () => { throw new Error('stop'); })).toThrow('stop');
    rows.reverse();
    withCandleCloseWindow(rows, () => withCandleCloseWindow(rows, () => {
      expect(closesPastLevel(rows, 0, 1, 0, true)).toBe(true);
    }));
    rows[0].time = 0;
    expect(closesPastLevel(rows, -1, 0, 1, true)).toBe(true);
  });
});
