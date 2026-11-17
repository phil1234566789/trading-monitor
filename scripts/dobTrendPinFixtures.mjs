// Fixture für das M5-Trend-Gate (DOB-Setup v3) aus Philips dob_trade-Pins: je Pin die OB2-Retest-Zeit des gepinnten Setups
// (checkDobTradeSetup am Entry) und die M5-Kerzen der 26 h davor, session-markiert. Schreibt test/fixtures/dob-native/m5-trend-pins.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';
import { dobGridInputAt } from './dobSetupGrid.mjs';

const SYMBOL = 'XAUUSD';
// Philip 17.11.2026: negativ = gegen den kurzfristigen M5-Trend (muss verworfen werden), positiv = Winner im Trend (bleibt).
const PINS = [[513, 'negativ'], [516, 'negativ'], [517, 'negativ'], [518, 'positiv'], [519, 'positiv'], [520, 'positiv']];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput }, { markIgnoredCandles, htfObCandles },
    { berlinDayRangeUtcMs, berlinOffsetMinutes, formatDatedTime }, { dobSourceContext }, { dobM5Trend }] = await Promise.all(['/src/forexCandles.js',
    '/src/supabaseClient.js', '/src/dobTradeSetup.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobSourceOfStrength.js', '/src/dobM5Trend.js'].map(load));
  const cacheOf = day => dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: false,
    defaultStartSec: berlinDayRangeUtcMs(day).startUtcMs / 1000, startSec: berlinDayRangeUtcMs(day).startUtcMs / 1000, fetchInitialCandles, supabase });
  const ltf = cacheOf('2026-01-01'), htf = cacheOf('2025-11-15');
  const sessions = await ltf.sessions(), offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  const m5Marked = mark(await ltf.candles('5m', 300, 300)), m1Marked = mark(await ltf.candles('1m', 60, 1500));
  const sourceContext = dobSourceContext({ instrument: SYMBOL, m5Candles: m5Marked, htfCandles: {
    '1h': htfObCandles(mark(await htf.candles('1h', 3600, 200)), sessions, offset), '4h': htfObCandles(mark(await htf.candles('4h', 14400, 100)), sessions, offset) } });
  const { data: pins, error } = await supabase.from('pin_context').select('id,note,dob_trade_key,dob_trade_context').eq('kind', 'dob_trade')
    .in('id', PINS.map(([id]) => id)).limit(50);
  if (error) throw error;
  const grid = { symbol: SYMBOL, m5Marked, m1Marked };
  const cases = [];
  for (const [id, expected] of PINS) {
    const pin = pins.find(p => p.id === id), ctx = pin.dob_trade_context, at = ctx.entry_time + 60;
    const result = checkDobTradeSetup({ ...dobLiveWindowInput(dobGridInputAt(grid, at, 2 * 86400)), sourceContext });
    const setup = [...result.setups, ...result.rejected].find(s => s.id === ctx.setup_id);
    if (!setup) throw new Error(`Pin ${id}: Setup ${ctx.setup_id} nicht gefunden`);
    const retestAt = setup.chart.secondRetestTime + 60, from = retestAt - 26 * 3600;
    const m5 = m5Marked.filter(c => c.time >= from && c.time + 300 <= retestAt);
    const trend = dobM5Trend(m5Marked, retestAt);
    cases.push({ pin: id, note: pin.note, expected, direction: setup.direction, setupId: setup.id, entryTime: ctx.entry_time, retestAt,
      m5: m5.map(c => [c.time, c.open, c.high, c.low, c.close, c.ignored ? 1 : 0]) });
    console.log(`Pin ${id} ${expected} ${setup.direction} · Retest ${formatDatedTime(retestAt)} · Trend ${trend.trend} · Reaktion ${trend.reaction ? `${trend.reaction.type} ${formatDatedTime(trend.reaction.time)} @${trend.reaction.price}` : '–'}`);
  }
  await fs.writeFile(path.join(root, 'test', 'fixtures', 'dob-native', 'm5-trend-pins.json'), JSON.stringify({ schemaVersion: 1, instrument: SYMBOL,
    provenance: { source: 'native FXCM Bid via forex_candles (Cache .debug/dob-setup), Pins aus pin_context kind=dob_trade',
      rowFormat: ['time', 'open', 'high', 'low', 'close', 'ignored'], window: '26 h M5 vor der OB2-Retest-Zeit' }, cases }));
} finally {
  await server.close();
}
