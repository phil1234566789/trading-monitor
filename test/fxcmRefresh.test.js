import { expect, it } from 'vitest';
import { unprocessedTimeframes } from '../supabase/functions/poi-watcher/fxcmRefresh.js';

const series = new Map([['M5', [{time: 100}]], ['1H', [{time: 200}]], ['4H', [{time: 300}]]]);
it('processes every timeframe on bootstrap', () => {
  expect([...unprocessedTimeframes(series, {}).keys()]).toEqual(['M5', '1H', '4H']);
});
it('keeps M5 touch checks but skips unchanged closed HTF series', () => {
  expect([...unprocessedTimeframes(series, {'1H':200, '4H':300}).keys()]).toEqual(['M5']);
});
it('processes a newly arrived H4 independently of the current hour', () => {
  expect([...unprocessedTimeframes(series, {'1H':200, '4H':299}).keys()]).toEqual(['M5', '4H']);
  expect(series.size).toBe(3);
});
