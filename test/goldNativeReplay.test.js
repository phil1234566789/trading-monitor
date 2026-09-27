import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { goldNativeZones } from '../src/priceChartObZones.js';
const raw = JSON.parse(readFileSync(new URL('../analysis/fxcm-xauusd-chart-20260927/candles.json',import.meta.url)));
it.each([['1h','1H',3600],['4h','4H',14400]])('Gold %s replay ignores later native candles and their touches', (bar,tf,seconds) => {
  const candles=raw[bar].map(c=>({...c,time:Date.parse(c.time)/1000}));
  const until=Date.parse('2026-09-10T12:00:00Z')/1000;
  const prefix=candles.filter(c=>c.time+seconds<=until);
  const expected=goldNativeZones(prefix,tf,until);
  expect(expected.length).toBeGreaterThan(0);
  expect(goldNativeZones(candles,tf,until)).toEqual(expected);
  expect(expected.every(z=>z.endTime<=until)).toBe(true);
});
