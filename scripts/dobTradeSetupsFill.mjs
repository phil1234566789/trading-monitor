// Befüllt dob_trade_setups (Statistikseite /dob-statistik) mit den einmaligen v0-Trades ab --from (Berlin), gleiche Zählweise wie
// dobSetupWinrate.mjs: jeder M5-Schluss im Live-Fenster, letzte Sichtung je Setup-ID, Ausgang neu bis Datenende, Dedup Richtung/Entry/SL.
// Flags: --refresh (Kerzen neu holen), --from YYYY-MM-DD, --dry (nichts schreiben, nur Kennzahlen), --run <Lauf-ID aus RUNS>.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridTrades, dobTradeKey, uniqueDobTrades } from './dobSetupGrid.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = 'XAUUSD', START_DAY = flag('--from') ?? '2026-01-01', DRY = process.argv.includes('--dry');
// Ein Lauf = ein Eintrag im Dropdown der Seite. v1 (Quelle der Kraft) kommt als weiterer Eintrag mit eigenem Trade-Filter dazu.
// pick: welche Setups von checkDobTradeSetup() der Lauf zählt. v0 = jedes DOB-Setup, v1 = nur mit Quelle der Kraft.
const RUNS = {
  'dob-setup-v0': { label: 'v0 · nur DOB', description: 'DOB + TP 2R, ohne Quelle der Kraft', sort: 0, version: 'dob-setup-v0', pick: r => [...r.setups, ...r.rejected] },
  'dob-setup-v1': { label: 'v1 · Quelle der Kraft (G 1,5 ATR)', description: 'DOB + TP 2R, aktive H1/H4-OB-Zone höchstens 1,5 H1-ATR von OB1',
    sort: 1, version: 'dob-setup-v1', pick: r => r.setups, sourceOptions: { requireRetest: false } },
  'dob-setup-v2': { label: 'v2 · Quelle der Kraft mit Retest', description: 'wie v1, die H1/H4-Zone muss vor OB1 retestet sein',
    sort: 2, version: 'dob-setup-v2', pick: r => r.setups, sourceOptions: { requireRetest: true } },
};
const RUN_ID = flag('--run') ?? 'dob-setup-v0';
if (!RUNS[RUN_ID]) throw new Error(`Unbekannter Lauf ${RUN_ID}, bekannt: ${Object.keys(RUNS).join(', ')}`);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput },
    { evaluateDoubleOrderBlockOutcome }, { markIgnoredCandles, htfObCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes },
    { dobSourceContext }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js',
      '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobSourceOfStrength.js'].map(load));

  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000;
  const cache = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: startSec, startSec, fetchInitialCandles, supabase });
  const [m5All, m1All, sessions] = [await cache.candles('5m', 300, 300), await cache.candles('1m', 60, 1500), await cache.sessions()];
  const offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  // Quelle der Kraft: HTF-Zonen und H1-ATR einmal über die ganze Historie wie die Messung (Archiv beginnt 02.01.2026).
  const htf = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000, startSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000,
    fetchInitialCandles, supabase });
  const sourceContext = dobSourceContext({ instrument: SYMBOL, m5Candles: mark(m5All), htfCandles: {
    '1h': htfObCandles(mark(await htf.candles('1h', 3600, 200)), sessions, offset),
    '4h': htfObCandles(mark(await htf.candles('4h', 4 * 3600, 100)), sessions, offset) } });
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));

  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  // Der Lauf entscheidet, welche Setups zählen; die Quelle der Kraft kommt aus dem einmal vorberechneten Kontext.
  const runSetups = live => ({ setups: RUNS[RUN_ID].pick(checkDobTradeSetup({ ...live, sourceContext, sourceOptions: RUNS[RUN_ID].sourceOptions })) });
  const trades = dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, checkDobTradeSetup: runSetups, dobLiveWindowInput }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  const carrying = new Map();
  for (const t of trades) carrying.set(dobTradeKey(t), (carrying.get(dobTradeKey(t)) ?? 0) + 1);
  const unique = uniqueDobTrades(trades);

  const rows = unique.map(t => ({ id: `${RUN_ID}:${t.id}`, run_id: RUN_ID, instrument: SYMBOL,
    direction: t.direction, route: t.route, setup_id: t.id, carrying_setups: carrying.get(dobTradeKey(t)), recognized_at: t.recognizedAt,
    entry_time: t.entryTime, entry_price: t.entryPrice, stop_price: t.stopPrice, target_price: t.outcome.targetPrice,
    outcome: t.outcome.status, outcome_reason: t.outcome.reason ?? null, exit_time: t.outcome.recognizedAt ?? null,
    exit_price: t.outcome.exitPrice ?? null, first_ob_start: t.chart.firstOrderBlockStart, second_ob_start: t.chart.secondOrderBlockStart,
    ...(RUN_ID === 'dob-setup-v0' ? {} : { source_kind: `ob_${t.sourceOfStrength.timeframe.toLowerCase()}`, source_distance_usd: t.sourceOfStrength.distanceUsd,
      source_atr: t.sourceOfStrength.atr, source_distance_atr: t.sourceOfStrength.distanceAtr,
      source_gap_seconds: t.chart.firstOrderBlockStart - t.sourceOfStrength.zoneRecognizedAt,
      source_retest_kind: t.sourceOfStrength.retestKind, source_retest_age_seconds: t.sourceOfStrength.retestAgeSeconds }) }));

  const total = aggregateDobByMonth(unique.map(t => ({ recognizedAt: t.recognizedAt, entries: { [t.route]: { status: 'ready', outcome: t.outcome } } })),
    p => berlinDateStrFor(p.recognizedAt).slice(0, 7)).total;
  console.log(`${RUNS[RUN_ID].version} · ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${trades.length} Trades mit Entry · ${rows.length} einmalig`);
  console.table(Object.entries(total.routes).map(([route, c]) => ({ route, success: c.success, loss: c.loss, ambiguous: c.ambiguous,
    open: c.open, unknown: c.unknown, winrate: c.winrate == null ? '–' : `${(c.winrate * 100).toFixed(1)}%`, sumR: c.sumR })));
  if (DRY) process.exit(0);
  const { data, error } = await supabase.rpc('replace_dob_trade_setups', { p_run: { id: RUN_ID, label: RUNS[RUN_ID].label, description: RUNS[RUN_ID].description, sort: RUNS[RUN_ID].sort, setup_version: RUNS[RUN_ID].version, data_end: dataEnd },
    p_instrument: SYMBOL, p_rows: rows });
  if (error) throw error;
  console.log(`dob_trade_setups: ${data} Zeilen für Lauf ${RUN_ID} geschrieben`);
} finally {
  await server.close();
}
