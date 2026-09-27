import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ pages: [], boundaries: [] }));
vi.mock('../src/supabaseClient.js', () => ({ supabase: { from() {
  const q = {};
  for (const k of ['select','eq','order','limit']) q[k] = () => q;
  for (const k of ['lt','lte','gt']) q[k] = (column,value) => {mock.boundaries.push([k,value]);return q;};
  q.then = (resolve,reject) => Promise.resolve(mock.pages.shift() ?? {data:[],error:null}).then(resolve,reject);
  return q;
} }}));
import { fetchInitialCandles, fetchOlderCandles, fetchNextCandle } from '../src/forexCandles.js';
import { goldChartSelection } from '../src/goldChartPolicy.js';
const row = day => ({ time:`2026-09-${day}T10:00:00Z`,open:4400,high:4405,low:4390,close:4401,volume:20 });
beforeEach(() => { mock.pages=[];mock.boundaries=[]; vi.stubGlobal('fetch', vi.fn(() => {throw Error('Unexpected fallback');})); });
it('continues short server pages and returns all historical bars chronologically', async () => {
  mock.pages=[{data:[row('18')],error:null},{data:[row('17')],error:null},{data:[],error:null}];
  const result=await fetchInitialCandles('XAUUSD','1h',1500,Date.parse('2026-09-19T00:00:00Z'));
  expect(result.map(c=>c.time)).toEqual(['17','18'].map(d=>Date.parse(row(d).time)/1000));
  expect(mock.boundaries).toContainEqual(['lt',row('18').time]);
  expect(fetch).not.toHaveBeenCalled();
});
it('returns an honest archive boundary without a fallback loop', async () => {
  expect(await fetchOlderCandles('XAUUSD','5m',Date.parse('2026-08-01')/1000,1000)).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
it('does not cache a partial Gold history after a page error', async () => {
  mock.pages=[{data:[row('18')],error:null},{data:null,error:new Error('offline')}];
  await expect(fetchInitialCandles('XAUUSD','1h',1500)).rejects.toThrow('offline');
});
it('skips a placeholder page without mistaking it for the history boundary', async () => {
  mock.pages=[{data:[{...row('26'),time:'2026-09-26T22:00:00Z',open:4400,high:4400,low:4400,close:4400}],error:null},{data:[row('25')],error:null}];
  const candles=await fetchInitialCandles('XAUUSD','5m',1);
  expect(candles).toHaveLength(1);
  expect(candles[0].time).toBe(Date.parse(row('25').time)/1000);
});
it('selects a supported Gold timeframe and brings an old Forex replay into the archive', () => {
  expect(goldChartSelection('1m',1,Date.parse('2026-09-24T21:00:00Z'))).toMatchObject({bar:'5m',replayTime:Date.parse('2026-09-24T20:55:00Z')/1000});
});
it('steps over weekend placeholders to the next real replay candle', async () => {
  const placeholder = { ...row('26'), open:4400, high:4400, low:4400, close:4400 };
  mock.pages = [{data:[placeholder],error:null},{data:[row('28')],error:null}];
  const candle = await fetchNextCandle('XAUUSD','5m',Date.parse(row('25').time)/1000);
  expect(candle.time).toBe(Date.parse(row('28').time)/1000);
  expect(mock.boundaries).toContainEqual(['gt', new Date(placeholder.time).toISOString()]);
});
