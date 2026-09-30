import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { archiveClient, candleCoverage } from '../scripts/tradeSetup2Archive.mjs';

describe('FXCM archive reads', () => {
  it('continues after a short server page and caches only the complete result', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'setup2-'));
    try {
      const rows = [0, 60, 120].map(time => ({ time: new Date(time * 1000).toISOString(), open: 1, high: 2, low: 1, close: 2 }));
      const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(rows.slice(0, 2))))
        .mockResolvedValueOnce(new Response(JSON.stringify(rows.slice(2))))
        .mockResolvedValueOnce(new Response('[]'));
      const client = archiveClient({ url: 'https://example.invalid', key: 'test', fetcher });
      const args = { instrument: 'GBPUSD', bar: '1m', from: 0, to: 180, cacheDirectory: directory };
      expect((await client.candles(args)).map(c => c.time)).toEqual([0, 60, 120]);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(decodeURIComponent(fetcher.mock.calls[1][0])).toContain('time.gte.1970-01-01T00:01:01.000Z');
      expect(await client.candles(args)).toHaveLength(3);
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally { await rm(directory, { recursive: true }); }
  });
  it('reports gaps without assuming every missing minute is a market closure', () => {
    expect(candleCoverage([{ time: 0 }, { time: 60 }, { time: 240 }], 60)).toMatchObject({
      count: 3, from: 0, to: 300, gapCount: 1, missingBars: 2, gaps: [{ from: 120, to: 240, missingBars: 2 }] });
  });
});
