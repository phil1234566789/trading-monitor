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
import { fetchGoldH1Preview } from '../src/goldH1Preview.js';
beforeEach(() => { mock.pages = []; mock.calls = []; });

it('reads only the bounded Gold H1 archive and paginates until an empty page', async () => {
  const row = {time:'2026-09-06T22:00:00Z',open:4430.15,high:4435.29,low:4416.81,close:4429.24};
  mock.pages = [{data:[row],error:null},{data:[],error:null}];
  expect(await fetchGoldH1Preview()).toEqual([{...row,time:Date.parse(row.time)/1000}]);
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
  await expect(fetchGoldH1Preview()).rejects.toBe(error);
  expect(mock.calls).toHaveLength(1);
});
