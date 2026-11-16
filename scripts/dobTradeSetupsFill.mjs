// Befüllt dob_trade_setups (Statistikseite /dob-statistik) mit den einmaligen v0-Trades ab --from (Berlin), gleiche Zählweise wie
// dobSetupWinrate.mjs: jeder M5-Schluss im Live-Fenster, letzte Sichtung je Setup-ID, Ausgang neu bis Datenende, Dedup Richtung/Entry/SL.
// Flags: --refresh (Kerzen neu holen), --from YYYY-MM-DD, --dry (nichts schreiben, nur Kennzahlen).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = 'XAUUSD', START_DAY = flag('--from') ?? '2026-01-01', DRY = process.argv.includes('--dry');
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

  // ponytail: Rasterschleife bewusst gleich wie dobSetupWinrate.mjs (Skript der Mess-Session, darf hier nicht umgebaut werden);
  // der spätere Live-Watcher ersetzt dieses Skript, bis dahin beide Kopien gemeinsam ändern.
  const lowerBound = (rows, t) => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const slice = (rows, from, to) => rows.slice(lowerBound(rows, from), lowerBound(rows, to));
  const setups = new Map();
  for (const c of m5All) {
    const at = c.time + 300;
    if (at <= startSec || at > dataEnd) continue;
    const live = dobLiveWindowInput({ instrument: SYMBOL, evaluatedAt: at,
      m5Candles: slice(m5Marked, at - 2 * 86400, at), m1Candles: slice(m1Marked, at - 2 * 86400, at) });
    if (!live.m1Candles.length) continue;
    for (const s of checkDobTradeSetup(live).setups) if (s.recognizedAt >= startSec) setups.set(s.id, s);
  }
  const trades = [...setups.values()].filter(s => s.entryTime != null).map(s => ({ ...s,
    outcome: evaluateDoubleOrderBlockOutcome({ direction: s.direction, entryTime: s.entryTime, entryPrice: s.entryPrice,
      stopPrice: s.stopPrice, candles: m1Marked, evaluatedAt: dataEnd, instrument: SYMBOL }) }));
  const keyOf = t => `${t.direction}:${t.entryTime}:${t.entryPrice}:${t.stopPrice}`;
  const carrying = new Map();
  for (const t of trades) carrying.set(keyOf(t), (carrying.get(keyOf(t)) ?? 0) + 1);
  // Gleicher Map-Dedup wie die Messung: der letzte Träger gibt Route und Paar vor.
  const unique = [...new Map(trades.map(t => [keyOf(t), t])).values()];

  const rows = unique.map(t => ({ id: `${DOB_TRADE_SETUP_VERSION}:${t.id}`, version: DOB_TRADE_SETUP_VERSION, instrument: SYMBOL,
    direction: t.direction, route: t.route, setup_id: t.id, carrying_setups: carrying.get(keyOf(t)), recognized_at: t.recognizedAt,
    entry_time: t.entryTime, entry_price: t.entryPrice, stop_price: t.stopPrice, target_price: t.outcome.targetPrice,
    outcome: t.outcome.status, outcome_reason: t.outcome.reason ?? null, exit_time: t.outcome.recognizedAt ?? null,
    exit_price: t.outcome.exitPrice ?? null, first_ob_start: t.chart.firstOrderBlockStart, second_ob_start: t.chart.secondOrderBlockStart }));

  const total = aggregateDobByMonth(unique.map(t => ({ recognizedAt: t.recognizedAt, entries: { [t.route]: { status: 'ready', outcome: t.outcome } } })),
    p => berlinDateStrFor(p.recognizedAt).slice(0, 7)).total;
  console.log(`${DOB_TRADE_SETUP_VERSION} · ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${trades.length} Trades mit Entry · ${rows.length} einmalig`);
  console.table(Object.entries(total.routes).map(([route, c]) => ({ route, success: c.success, loss: c.loss, ambiguous: c.ambiguous,
    open: c.open, unknown: c.unknown, winrate: c.winrate == null ? '–' : `${(c.winrate * 100).toFixed(1)}%`, sumR: c.sumR })));
  if (DRY) process.exit(0);
  const { data, error } = await supabase.rpc('replace_dob_trade_setups', { p_instrument: SYMBOL, p_version: DOB_TRADE_SETUP_VERSION, p_rows: rows });
  if (error) throw error;
  console.log(`dob_trade_setups: ${data} Zeilen geschrieben`);
} finally {
  await server.close();
}
