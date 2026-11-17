// Fixture für das Merkmal Gegen-DOB (Merkmal-Labor) aus Philips dob_trade-Pins: je Pin POI-Retest, OB2-Retest und Entry des
// gepinnten Setups (checkDobTradeSetup am Entry) und M5/M1 der 2 Tage vor dem Entry, session-markiert. Schreibt test/fixtures/dob-native/lab-pins.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';
import { dobGridInputAt } from './dobSetupGrid.mjs';

const SYMBOL = 'XAUUSD';
// 526: „bärische DOBs direkt gegen den Long“, 522: ebenfalls markiert; 521: Loss ohne Gegen-DOB (Kontrolle).
const PINS = [[521, 'ohne'], [522, 'gegen'], [526, 'gegen']];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput }, { markIgnoredCandles, htfObCandles },
    { berlinDayRangeUtcMs, berlinOffsetMinutes, formatDatedTime }, { dobPoiContext }, ] = await Promise.all(['/src/forexCandles.js',
    '/src/supabaseClient.js', '/src/dobTradeSetup.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobHtfObPoi.js'].map(load));
  const cacheOf = day => dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: false,
    defaultStartSec: berlinDayRangeUtcMs(day).startUtcMs / 1000, startSec: berlinDayRangeUtcMs(day).startUtcMs / 1000, fetchInitialCandles, supabase });
  const ltf = cacheOf('2026-01-01'), htf = cacheOf('2025-11-15');
  const sessions = await ltf.sessions(), offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  const m5Marked = mark(await ltf.candles('5m', 300, 300)), m1Marked = mark(await ltf.candles('1m', 60, 1500));
  const poiContext = dobPoiContext({ instrument: SYMBOL, m5Candles: m5Marked, htfCandles: {
    '1h': htfObCandles(mark(await htf.candles('1h', 3600, 200)), sessions, offset), '4h': htfObCandles(mark(await htf.candles('4h', 14400, 100)), sessions, offset) } });
  const { data: pins, error } = await supabase.from('pin_context').select('id,note,dob_trade_key,dob_trade_context').eq('kind', 'dob_trade')
    .in('id', PINS.map(([id]) => id)).limit(50);
  if (error) throw error;
  const grid = { symbol: SYMBOL, m5Marked, m1Marked };
  const cases = [];
  for (const [id, expected] of PINS) {
    const pin = pins.find(p => p.id === id), ctx = pin.dob_trade_context, at = ctx.entry_time + 60;
    const result = checkDobTradeSetup({ ...dobLiveWindowInput(dobGridInputAt(grid, at, 2 * 86400)), poiContext });
    const setup = [...result.setups, ...result.rejected].find(s => s.id === ctx.setup_id);
    if (!setup) throw new Error(`Pin ${id}: Setup ${ctx.setup_id} nicht gefunden`);
    const src = setup.poi, from = ctx.entry_time - 2 * 86400, rows = list => list.filter(c => c.time >= from && c.time < ctx.entry_time)
      .map(c => [c.time, c.open, c.high, c.low, c.close, c.ignored ? 1 : 0]);
    cases.push({ pin: id, note: pin.note, expected, direction: setup.direction, entryTime: ctx.entry_time, ob2RetestTime: setup.chart.secondRetestTime,
      poiRetestAt: setup.chart.firstOrderBlockStart - src.retestAgeSeconds, m5: rows(m5Marked), m1: rows(m1Marked) });
    console.log(`Pin ${id} ${expected} ${setup.direction} · POI-Retest ${formatDatedTime(cases.at(-1).poiRetestAt)} · Entry ${formatDatedTime(ctx.entry_time)}`);
  }
  await fs.writeFile(path.join(root, 'test', 'fixtures', 'dob-native', 'lab-pins.json'), JSON.stringify({ schemaVersion: 1, instrument: SYMBOL,
    provenance: { source: 'native FXCM Bid via forex_candles (Cache .debug/dob-setup), Pins aus pin_context kind=dob_trade',
      rowFormat: ['time', 'open', 'high', 'low', 'close', 'ignored'], window: 'M5 und M1 der 2 Tage vor dem Entry (wie das Merkmal im Labor)' }, cases }));
} finally {
  await server.close();
}
