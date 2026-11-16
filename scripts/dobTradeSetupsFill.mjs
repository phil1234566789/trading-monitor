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
const RUNS = { 'dob-setup-v0': { label: 'v0 · nur DOB', description: 'DOB + TP 2R, ohne Quelle der Kraft', sort: 0 } };
const RUN_ID = flag('--run') ?? 'dob-setup-v0';
if (!RUNS[RUN_ID]) throw new Error(`Unbekannter Lauf ${RUN_ID}, bekannt: ${Object.keys(RUNS).join(', ')}`);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput, DOB_TRADE_SETUP_VERSION },
    { evaluateDoubleOrderBlockOutcome }, { markIgnoredCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes }]
    = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js',
      '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/berlinTime.js'].map(load));

  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000;
  const cache = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: startSec, startSec, fetchInitialCandles, supabase });
  const [m5All, m1All, sessions] = [await cache.candles('5m', 300, 300), await cache.candles('1m', 60, 1500), await cache.sessions()];
  const mark = rows => markIgnoredCandles(rows, sessions, sec => berlinOffsetMinutes(sec * 1000));
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));

  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  const trades = dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, checkDobTradeSetup, dobLiveWindowInput }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  const carrying = new Map();
  for (const t of trades) carrying.set(dobTradeKey(t), (carrying.get(dobTradeKey(t)) ?? 0) + 1);
  const unique = uniqueDobTrades(trades);

  const rows = unique.map(t => ({ id: `${RUN_ID}:${t.id}`, run_id: RUN_ID, instrument: SYMBOL,
    direction: t.direction, route: t.route, setup_id: t.id, carrying_setups: carrying.get(dobTradeKey(t)), recognized_at: t.recognizedAt,
    entry_time: t.entryTime, entry_price: t.entryPrice, stop_price: t.stopPrice, target_price: t.outcome.targetPrice,
    outcome: t.outcome.status, outcome_reason: t.outcome.reason ?? null, exit_time: t.outcome.recognizedAt ?? null,
    exit_price: t.outcome.exitPrice ?? null, first_ob_start: t.chart.firstOrderBlockStart, second_ob_start: t.chart.secondOrderBlockStart }));

  const total = aggregateDobByMonth(unique.map(t => ({ recognizedAt: t.recognizedAt, entries: { [t.route]: { status: 'ready', outcome: t.outcome } } })),
    p => berlinDateStrFor(p.recognizedAt).slice(0, 7)).total;
  console.log(`${DOB_TRADE_SETUP_VERSION} · ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${trades.length} Trades mit Entry · ${rows.length} einmalig`);
  console.table(Object.entries(total.routes).map(([route, c]) => ({ route, success: c.success, loss: c.loss, ambiguous: c.ambiguous,
    open: c.open, unknown: c.unknown, winrate: c.winrate == null ? '–' : `${(c.winrate * 100).toFixed(1)}%`, sumR: c.sumR })));
  if (DRY) process.exit(0);
  const { data, error } = await supabase.rpc('replace_dob_trade_setups', { p_run: { id: RUN_ID, ...RUNS[RUN_ID], setup_version: DOB_TRADE_SETUP_VERSION, data_end: dataEnd },
    p_instrument: SYMBOL, p_rows: rows });
  if (error) throw error;
  console.log(`dob_trade_setups: ${data} Zeilen für Lauf ${RUN_ID} geschrieben`);
} finally {
  await server.close();
}
