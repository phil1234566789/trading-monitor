import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ pages: [], calls: [] }));
vi.mock('../src/supabaseClient.js', () => ({ supabase: {
  from(table) {
    const calls = [['from', table]];
    mock.calls.push(calls);
    const query = {};
    for (const method of ['select','eq','gte','lt','order']) {
      query[method] = (...args) => { calls.push([method,...args]); return query; };
    }
    query.range = (...args) => { calls.push(['range',...args]); return Promise.resolve(mock.pages.shift()); };
    return query;
  },
} }));
import { fetchGoldPreview, fetchGoldPreviewObs, goldDisplayZone } from '../src/goldPreview.js';
beforeEach(() => { mock.pages = []; mock.calls = []; });

it.each([1, -1])('ends historical boxes at the first near-edge touch, not later invalidation (dir %s)', dir => {
  const zone = { dir, top: 4400, bottom: 4390, startTime: 0, endTime: 10800, touched: true, invalidated: true };
  const candles = dir === 1
    ? [{time:0,low:4390,high:4400},{time:3600,low:4403,high:4410},{time:7200,low:4400,high:4410},{time:10800,low:4389,high:4401}]
    : [{time:0,low:4390,high:4400},{time:3600,low:4380,high:4387},{time:7200,low:4380,high:4390},{time:10800,low:4389,high:4401}];
  expect(goldDisplayZone(zone, candles)).toEqual({...zone, endTime:7200});
  expect(zone.endTime).toBe(10800);
});

it('keeps untouched boxes and gap invalidations without an earlier overlap unchanged', () => {
  const zone = {dir:1,top:4400,bottom:4390,startTime:0,endTime:7200,touched:false,invalidated:true};
  expect(goldDisplayZone(zone,[{time:3600,low:4405,high:4410},{time:7200,low:4380,high:4385},{time:10800,low:4390,high:4400}])).toEqual(zone);
  expect(goldDisplayZone({...zone,invalidated:false},[])).toEqual({...zone,invalidated:false});
});

it('reads only the bounded Gold H1 archive and paginates until an empty page', async () => {
  const row = {time:'2026-09-06T22:00:00Z',open:4430.15,high:4435.29,low:4416.81,close:4429.24};
  mock.pages = [{data:[row],error:null},{data:[],error:null}];
  expect(await fetchGoldPreview()).toEqual([{...row,time:Date.parse(row.time)/1000}]);
  for (const calls of mock.calls) {
    expect(calls).toContainEqual(['eq','instrument','XAUUSD']);
    expect(calls).toContainEqual(['eq','bar','1h']);
    expect(calls).toContainEqual(['gte','time','2026-09-06T22:00:00Z']);
    expect(calls).toContainEqual(['lt','time','2026-09-20T22:00:00Z']);
  }
  expect(mock.calls[1]).toContainEqual(['range',1,1000]);
});

it('reports an archive error instead of returning a partial chart or falling back to live data', async () => {
  const error = new Error('Read failed');
  mock.pages = [{data:null,error}];
  await expect(fetchGoldPreview()).rejects.toBe(error);
  expect(mock.calls).toHaveLength(1);
});

it('keeps H4 native timestamps and its own bounded window separate from H1', async () => {
  const row = {time:'2026-09-24T17:00:00Z',open:4500,high:4510,low:4490,close:4505};
  mock.pages = [{data:[row],error:null},{data:[],error:null}];
  expect(await fetchGoldPreview('4h')).toEqual([{...row,time:Date.parse(row.time)/1000}]);
  expect(mock.calls[0]).toContainEqual(['eq','bar','4h']);
  expect(mock.calls[0]).toContainEqual(['gte','time','2026-08-23T22:00:00Z']);
  expect(mock.calls[0]).toContainEqual(['lt','time','2026-09-24T21:00:00Z']);
});

it('paginates only Gold H4 order blocks when H4 is selected', async () => {
  const row = {direction:'long',top:4400,bottom:4390,start_time:'2026-09-01T01:00:00Z',end_time:'2026-09-01T09:00:00Z',touched:true,invalidated:false};
  mock.pages = [{data:[row],error:null},{data:[],error:null}];
  expect(await fetchGoldPreviewObs('4h')).toHaveLength(1);
  for (const calls of mock.calls) {
    expect(calls).toContainEqual(['eq','instrument','XAUUSD']);
    expect(calls).toContainEqual(['eq','timeframe','4H']);
  }
  expect(mock.calls[1]).toContainEqual(['range',1,1000]);
});

it('rejects unsupported Gold timeframes before requesting data', async () => {
  await expect(fetchGoldPreview('5m')).rejects.toThrow('Unsupported');
  await expect(fetchGoldPreviewObs('5m')).rejects.toThrow('Unsupported');
  expect(mock.calls).toHaveLength(0);
});
