import { expect, it, vi } from 'vitest';
import { fetchAllRows } from '../supabase/functions/_shared/fetchAllRows.ts';

it('advances by the returned count and only stops at an empty page', async () => {
  const pages = [[{id:1}], [{id:2}, {id:3}], []];
  const query = vi.fn(async () => ({data:pages.shift(), error:null}));
  expect(await fetchAllRows(query)).toEqual([{id:1},{id:2},{id:3}]);
  expect(query.mock.calls.map(([from]) => from)).toEqual([0,1,3]);
});
it('does not silently return an incomplete history on a database error', async () => {
  await expect(fetchAllRows(async () => ({data:null,error:{message:'offline'}}))).rejects.toThrow('offline');
});
