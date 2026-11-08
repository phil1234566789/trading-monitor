import { expect, it, vi } from 'vitest';
import { detectTradeSetups } from '../src/tradeSetup.js';
import { detectTradeSetup } from '../supabase/functions/_shared/tradeSetup.ts';
import { tradeSetupFromRow } from '../src/tradeSetupRow.js';
import { persistTradeSetupSweeps } from '../supabase/functions/_shared/tradeSetupSweeps.ts';
import fixture from './fixtures/xauusd-tsc-sweeps-20260921.json';

const sec = (value) => Date.parse(value) / 1000;
const pivots = fixture.evidence.filter((e) => e.kind === 'pivot');
const levels = pivots.map((e) => ({ price: e.price, pivotTime: sec(e.source_time), touchedTime: sec(e.touched_time), touched: true, dir: 1 }));
const zone = fixture.ob[0];
const ob = { dir: -1, top: zone.top, bottom: zone.bottom, startTime: sec(zone.start_time), fvg: 1 };
const params = { graceSec: 300, lsMaxLeadSecH1: 7200, lsMaxLeadSecM5: 2700, maxDistanceM5: null,
  maxSweepDistance: 20, maxLookbackSec: 86400, closeCheckMaxAgeSec: 0, obMaxDelaySec: 3600, nowTime: ob.startTime + 600 };
const expected = [4368.15, 4365.36, 4361.97];

it.each([1, -1])('caps the actual setup in both runtimes without changing the OB (direction %s)', (dir) => {
  const input = levels.map((e) => ({ ...e, dir }));
  const inputOb = { ...ob, dir: -dir };
  const browser = detectTradeSetups(dir, [], [], input, [inputOb], params, [])[0];
  const backend = detectTradeSetup(dir, [], [], input, [inputOb], params, []);
  for (const setup of [browser, backend]) {
    expect(setup.sweeps.map((e) => e.level.price)).toEqual(expected);
    expect(setup.ls).toBe(input[0]);
    expect(setup.fractal).toBe(setup.ls);
    expect(setup).toMatchObject({ obTop: 4374.8, obBottom: 4367.05, obStartTime: ob.startTime });
  }
  expect(input).toHaveLength(5);
});

it('preserves OB extremes from a discarded younger sweep with the earliest touch', () => {
  const start = sec('2026-09-21T12:00:00Z');
  const lows = [
    { price: 100, pivotTime: start - 100, touchedTime: start, touched: true, dir: -1 },
    ...[1000, 900, 800, 700].map((age, i) => ({ price: 100 + i / 10, pivotTime: start + 300 - age, touchedTime: start + 300, touched: true, dir: -1 })),
  ];
  const bullishOb = { dir: 1, top: 101, bottom: 100, startTime: start + 600, fvg: 1 };
  const candles = [{ time: start, open: 100, high: 101, low: 95, close: 100 }, { time: start + 300, open: 100, high: 101, low: 99, close: 100 }];
  const p = { ...params, nowTime: start + 900 };
  for (const setup of [detectTradeSetups(-1, [], [], lows, [bullishOb], p, candles)[0], detectTradeSetup(-1, [], [], lows, [bullishOb], p, candles)]) {
    expect(setup.sweeps).toHaveLength(3);
    expect(setup.sweeps.some((s) => s.level === lows[0])).toBe(false);
    expect(setup.obBottom).toBe(95);
  }
});

it('normalizes historical database setups for chart, replay and runner without mutating rows', () => {
  const primary = pivots[0];
  const row = { id: 99, instrument: 'XAUUSD', direction: 'short', ls_price: primary.price,
    ls_pivot_time: primary.source_time, ls_touched_time: primary.touched_time, ls_timeframe: primary.timeframe,
    fractal_price: primary.price, fractal_pivot_time: primary.source_time,
    ob_top: zone.top, ob_bottom: zone.bottom, ob_start_time: zone.start_time,
    trade_setup_sweeps: pivots.map((e, i) => ({ price: e.price, pivot_time: e.source_time, touched_time: e.touched_time, timeframe: e.timeframe, is_primary: i === 0 })) };
  const original = structuredClone(row);
  const result = tradeSetupFromRow(row);
  expect(result.sweeps.map((e) => e.level.price)).toEqual(expected);
  expect(result.fractal).toBe(result.ls);
  expect(result.obTop).toBe(zone.top);
  expect(row).toEqual(original);
});

it('persists only the strongest three in the shared watcher/backfill writer', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn(() => ({ upsert })) };
  await persistTradeSetupSweeps(client, 99, levels.map((level) => ({ level, timeframe: '5M' })));
  expect(upsert.mock.calls[0][0].map((row) => row.price)).toEqual(expected);
  expect(upsert.mock.calls[0][0].map((row) => row.is_primary)).toEqual([true, false, false]);
});
