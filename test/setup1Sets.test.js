import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { replaySetup1, DEFAULT_TRADE_SETUP_PARAMS, obMinimum, strategyDistance } from '../supabase/functions/trading-monitor-mcp/scripts/setup1Replay.ts';
import { compareSet, hash, loadSetupSet, setupKey } from '../scripts/setup1Set.mjs';
import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import { tradeSetupFromRow } from '../src/tradeSetupRow.js';

const start = Date.parse('2026-01-05T00:00:00Z') / 1000;
const candle = (i, changes = {}) => ({ time: start + i * 300, open: 1.101, high: 1.1015, low: 1.1005, close: 1.101, volume: 0, ...changes });
const fixture = () => Array.from({ length: 310 }, (_, i) => candle(i,
  i === 280 ? { low: 1.1 } : i === 297 ? { low: 1.0999 } : i === 298 ? { high: 1.103, close: 1.1025 }
    : i >= 299 ? { open: 1.1025, low: 1.102, high: 1.103, close: 1.1025 } : {}));

it('replays closed windows without future candles, retains first recognition and does not mutate the archive', () => {
  const m5Alle = fixture(), before = hash(m5Alle);
  const replay = bars => replaySetup1({ instrument: 'GBPUSD', m5Alle: bars, h1Alle: [], startSec: start, endeSec: start + 310 * 300 });
  const rows = replay(m5Alle).rows;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows).toEqual(replay(m5Alle).rows);
  expect(rows[0]).toMatchObject({ direction: 'long', ob_start_time: new Date((start + 298 * 300) * 1000).toISOString() });
  expect(rows[0].created_at).toBe(new Date((start + 300 * 300) * 1000).toISOString());
  expect(setup1RecognitionTime(tradeSetupFromRow({ ...rows[0], id: 'fixture' }))).toBe(start + 300 * 300);
  expect(replay(m5Alle.slice(0, 299)).rows).toEqual([]);
  expect(replay(m5Alle.slice(0, 300)).rows[0]).toEqual(rows[0]);
  expect(hash(m5Alle)).toBe(before);
});

it('preserves legacy backfill time and supports current Gold scaling without changing detection rules', () => {
  const args = { instrument: 'GBPUSD', m5Alle: fixture(), h1Alle: [], startSec: start, endeSec: start + 310 * 300 };
  const legacy = replaySetup1({ ...args, recognitionDelaySec: 0 });
  const current = replaySetup1(args);
  expect(Date.parse(current.rows[0].created_at) - Date.parse(legacy.rows[0].created_at)).toBe(300000);
  expect(obMinimum('XAUUSD', '5m')).toBe(0.75);
  expect(strategyDistance(DEFAULT_TRADE_SETUP_PARAMS.maxSweepDistance, 'XAUUSD')).toBe(30);
  expect(replaySetup1({ ...args, minimum: 0.75 }).rows).toEqual([]);
});

it('includes an H1 pivot confirmed exactly at the M5 close, with no H1 lookahead', () => {
  const h1Alle = Array.from({ length: 25 }, (_, i) => ({ ...candle(0, i === 14 ? { low: 1.09995 } : {}), time: start + i * 3600 }));
  const args = { instrument: 'GBPUSD', m5Alle: fixture().slice(0, 300), h1Alle, startSec: start, endeSec: start + 310 * 300 };
  expect(replaySetup1(args).rows[0].ls_timeframe).toBe('1H');
  expect(replaySetup1({ ...args, recognitionDelaySec: 0 }).rows[0].ls_timeframe).toBe('5M');
  expect(replaySetup1({ ...args, h1Alle: h1Alle.slice(0, 24) }).rows[0].ls_timeframe).toBe('5M');
});

it('matches IDs by stable OB key and explicitly reports changed reference fields and missing rows', () => {
  const row = { ...replaySetup1({ instrument: 'GBPUSD', m5Alle: fixture(), h1Alle: [], startSec: start, endeSec: start + 310 * 300 }).rows[0], trade_setup_sweeps: [] };
  const live = { ...row, id: 3125, ob_top: row.ob_top + 0.0001 };
  const missing = { ...row, id: 5491, ob_start_time: new Date(start * 1000).toISOString() };
  const report = compareSet([row], [live, missing]);
  expect(row.id).toBe(3125);
  expect(row.live_id).toBe(3125);
  expect(row.setup_key).toBe(setupKey(live));
  expect(report.references[0].changes).toEqual([{ field: 'ob_top', rebuilt: row.ob_top, live: live.ob_top }]);
  expect(report.references[1].status).toBe('missing');
  expect(Object.values(report.months)[0]).toMatchObject({ sameKey: 1, changed: 1, liveOnly: 1 });
  expect(() => compareSet([row, row], [live])).toThrow('Duplicate');
});

it('rejects tampered sets and wrong windows while preserving stable unmatched IDs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'setup1-test-'));
  try {
    const id = `setup1-${'a'.repeat(24)}`, dir = path.join(root, 'local-data/setup1-sets', id);
    await mkdir(dir, { recursive: true });
    const rows = [{ instrument: 'GBPUSD', direction: 'long', ob_start_time: new Date(start * 1000).toISOString(), created_at: new Date((start + 600) * 1000).toISOString() }];
    compareSet(rows, []);
    expect(rows[0].id).toBe(setupKey(rows[0]));
    await writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ id, status: 'complete', instrument: 'GBPUSD', from: start, to: start + 3600, rowsHash: hash(rows) }));
    await writeFile(path.join(dir, 'sources.json'), JSON.stringify(rows));
    expect((await loadSetupSet(root, id, 'GBPUSD', start, start + 3600)).rows).toEqual(rows);
    await expect(loadSetupSet(root, id, 'GBPUSD', start, start + 3601)).rejects.toThrow('cover');
    await expect(loadSetupSet(root, id, 'XAUUSD', start, start + 3600)).rejects.toThrow('cover');
    await writeFile(path.join(dir, 'sources.json'), '[]');
    await expect(loadSetupSet(root, id, 'GBPUSD', start, start + 3600)).rejects.toThrow('hash');
  } finally { await rm(root, { recursive: true, force: true }); }
});
