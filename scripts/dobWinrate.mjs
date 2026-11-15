// DOB-Winrate XAUUSD ab 01.10.2026 (Berlin) bis zur letzten geschlossenen M1-Kerze.
// Methodik, damit vorher/nachher identisch gemessen wird (läuft unverändert gegen jeden Branch):
// - Kerzen: native forex_candles über fetchInitialCandles, derselbe Weg wie useDoubleOrderBlockChart;
//   gecacht in .debug/dob-winrate, `--refresh` holt neu.
// - Rollierend je Berliner Kalendertag mit M1-Daten: evaluatedAt = Tagesende (zuletzt Datenende),
//   Fenster wie im Dashboard (letzte 2500 M5 / 12505 M1 bis evaluatedAt, Session-Ignore-Markierung).
// - Paare per id dedupliziert, letzte Sichtung gilt; nur recognizedAt ab 01.10.
// - Outcome je ready-Route neu mit evaluatedAt = Datenende über alle M1-Kerzen, sonst würden
//   Entries am Fensterrand des Sichtungstags künstlich `open` bleiben.
// - Monat = Berliner Monat von pair.recognizedAt. Summe R: Win +2, Loss −1.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';

const SYMBOL = 'XAUUSD', START_DAY = '2026-10-01';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const outDir = path.join(root, '.debug', 'dob-winrate');
// Worktrees haben keine eigene .env; sie liegt im Haupt-Checkout darüber.
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

let requests = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (...args) => { requests++; return realFetch(...args); };

const server = await createServer({ root, envDir, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { detectDoubleOrderBlocks }, { evaluateDoubleOrderBlockOutcome },
    { closedChecklistCandles }, { markIgnoredCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes },
    { TRADE_SETUP_M5_CANDLE_COUNT }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js',
    '/src/doubleOrderBlocks.js', '/src/doubleOrderBlockOutcome.js', '/src/tradeSetupChecklistTimeBasis.js',
    '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/priceChartConstants.js'].map(load));

  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000;
  const cached = async (name, fetcher) => {
    const file = path.join(outDir, name);
    if (!process.argv.includes('--refresh') && existsSync(file)) return JSON.parse(await fs.readFile(file, 'utf8'));
    const data = await fetcher();
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data));
    return data;
  };
  // Kalenderbars ab Start plus Fenster: Wochenenden machen das zur sicheren Obergrenze für den Vorlauf.
  const candles = (bar, seconds, window) => cached(`candles-${SYMBOL}-${bar === '1m' ? 'm1' : 'm5'}.json`, () => {
    const nowSec = Math.floor(Date.now() / 1000);
    return fetchInitialCandles(SYMBOL, bar, Math.ceil((nowSec - startSec) / seconds) + window, nowSec * 1000);
  });
  const m5All = await candles('5m', 300, TRADE_SETUP_M5_CANDLE_COUNT);
  const m1All = await candles('1m', 60, TRADE_SETUP_M5_CANDLE_COUNT * 5 + 5);
  // Gleiche Ignore-Fenster wie markIgnored() im Dashboard; Philips Browser läuft in Berlin.
  const sessions = await cached(`sessions-${SYMBOL}.json`, async () => {
    const { data, error } = await supabase.from('sessions').select('from_minutes,to_minutes,days,ignore_liquidity')
      .eq('instrument', SYMBOL).limit(200);
    if (error) throw error;
    return data.map(r => ({ fromMinutes: r.from_minutes, toMinutes: r.to_minutes, days: r.days, ignoreLiquidity: r.ignore_liquidity ?? false }));
  });
  const mark = rows => markIgnoredCandles(rows, sessions, sec => berlinOffsetMinutes(sec * 1000));
  const window = (rows, bar, count, at) => {
    const end = rows.findLastIndex(c => c.time <= at) + 1;
    return mark(closedChecklistCandles(rows.slice(Math.max(0, end - count), end), bar, at));
  };

  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));
  const days = [...new Set(m1All.filter(c => c.time >= startSec).map(c => berlinDateStrFor(c.time)))];
  const seen = new Map();
  let engineMs = 0, version = null;
  for (const day of days) {
    const at = Math.min(berlinDayRangeUtcMs(day).endUtcMs / 1000, dataEnd);
    const input = { m5Candles: window(m5All, '5m', TRADE_SETUP_M5_CANDLE_COUNT, at),
      m1Candles: window(m1All, '1m', TRADE_SETUP_M5_CANDLE_COUNT * 5 + 5, at), instrument: SYMBOL, evaluatedAt: at };
    const t0 = performance.now();
    const result = detectDoubleOrderBlocks(input);
    engineMs += performance.now() - t0;
    version = result.version;
    for (const pair of result.pairs) if (pair.recognizedAt >= startSec) seen.set(pair.id, pair);
  }

  const m1Marked = mark(m1All);
  const pairs = [...seen.values()].map(pair => ({ ...pair, entries: Object.fromEntries(Object.entries(pair.entries).map(([route, entry]) =>
    [route, entry.status !== 'ready' ? entry : { ...entry, outcome: evaluateDoubleOrderBlockOutcome({ direction: pair.direction, ...entry,
      candles: m1Marked, evaluatedAt: dataEnd, instrument: SYMBOL }) }])) }));
  const summary = aggregateDobByMonth(pairs, p => berlinDateStrFor(p.recognizedAt).slice(0, 7));
  const report = { version, symbol: SYMBOL, from: START_DAY, dataEnd, dataEndBerlin: `${berlinDateStrFor(dataEnd)}`,
    evaluations: days.length, engineMs: Math.round(engineMs), requests, candles: { m5: m5All.length, m1: m1All.length },
    ...summary, pairs: pairs.map(p => ({ id: p.id, direction: p.direction, recognizedAt: p.recognizedAt,
      entries: Object.fromEntries(Object.entries(p.entries).map(([r, e]) => [r, { status: e.status, entryTime: e.entryTime,
        entryPrice: e.entryPrice, stopPrice: e.stopPrice, outcome: e.outcome?.status ?? null, outcomeReason: e.outcome?.reason ?? null, reason: e.reason ?? null }])) })) };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `report-${version}.json`), JSON.stringify(report, null, 2));

  console.log(`${version} · ${SYMBOL} ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${days.length} Läufe · Engine ${report.engineMs} ms · ${requests} Requests`);
  console.table(Object.entries({ gesamt: summary.total, ...summary.months }).flatMap(([scope, s]) => Object.entries(s.routes).map(([route, c]) =>
    ({ scope, route, pairs: s.pairs, ...c, winrate: c.winrate == null ? '–' : `${(c.winrate * 100).toFixed(1)}%` }))));
} finally {
  await server.close();
}
