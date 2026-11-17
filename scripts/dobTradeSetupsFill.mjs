// Befüllt dob_trade_setups (Statistikseite /dob-statistik) mit den einmaligen v0-Trades ab --from (Berlin), gleiche Zählweise wie
// dobSetupWinrate.mjs: jeder M5-Schluss im Live-Fenster, letzte Sichtung je Setup-ID, Ausgang neu bis Datenende, Dedup Richtung/Entry/SL.
// Flags: --refresh (Kerzen neu holen), --from YYYY-MM-DD, --dry (nichts schreiben, nur Kennzahlen), --run <Lauf-ID aus RUNS>,
// --dump <Datei> (mit --dry: Zeilen als JSON, für bitgenaue Regressionsvergleiche nach Umbauten).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridTrades, dobTradeKey, uniqueDobTrades } from './dobSetupGrid.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = 'XAUUSD', START_DAY = flag('--from') ?? '2026-01-01', DRY = process.argv.includes('--dry');
// Ein Lauf = ein Eintrag im Dropdown der Seite. v1 (POI) kommt als weiterer Eintrag mit eigenem Trade-Filter dazu.
// pick: welche Setups von checkDobTradeSetup() der Lauf zählt. v0 = jedes DOB-Setup, v1 = nur mit POI.
// poiType: POI-Art des Laufs (src/dobPoiType.js), bestimmt die POI-Erkennung; künftige LQ-Sweep-Läufe heißen dob-lq-sweep-v….
const RUNS = {
  'dob-setup-v0': { label: 'v0 · nur DOB', description: 'DOB + TP 2R, ohne POI', sort: 0, version: 'dob-setup-v0', poiType: 'htf_ob', pick: r => [...r.setups, ...r.rejected] },
  'dob-setup-v1': { label: 'v1 · POI (G 1,5 ATR)', description: 'DOB + TP 2R, aktive H1/H4-OB-Zone höchstens 1,5 H1-ATR von OB1',
    sort: 1, version: 'dob-setup-v1', poiType: 'htf_ob', pick: r => r.setups, poiOptions: { requireRetest: false } },
  'dob-setup-v2': { label: 'v2 · POI mit Retest', description: 'wie v1, die H1/H4-Zone muss vor OB1 retestet sein',
    sort: 2, version: 'dob-setup-v2', poiType: 'htf_ob', pick: r => r.setups, poiOptions: { requireRetest: true } },
  // v3: alle v2-Trades mit Gegen-DOB-Status (none/dead/live); was gesperrt oder mit 5R gehandelt wird, entscheidet die Konfig.
  'dob-setup-v3': { label: 'v3 · Gegen-DOB', description: 'wie v2 mit Gegen-DOB-Status seit dem Retest des POI; Sperre bzw. TP über „Sperren und Regeln“',
    sort: 3, version: 'dob-setup-v3', poiType: 'htf_ob', pick: r => r.setups, poiOptions: { requireRetest: true }, counterDob: true },
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
    { dobPoiContext, dobPoiZoneAgeSeconds }, { dobMaxR, dobWideVariant }, { createDobCounterDobGate }, { dobTradeFeatures, dobBreakevenFeatures, DOB_BREAKEVEN_AT_R_LEVELS }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js',
      '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobHtfObPoi.js', '/src/dobMaxR.js', '/src/dobCounterDob.js', '/src/dobTradeFeatures.js'].map(load));

  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000;
  const cache = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: startSec, startSec, fetchInitialCandles, supabase });
  const [m5All, m1All, sessions] = [await cache.candles('5m', 300, 300), await cache.candles('1m', 60, 1500), await cache.sessions()];
  const offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  // POI: HTF-Zonen und H1-ATR einmal über die ganze Historie wie die Messung (Archiv beginnt 02.01.2026).
  const htf = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000, startSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000,
    fetchInitialCandles, supabase });
  const poiContext = dobPoiContext({ instrument: SYMBOL, m5Candles: mark(m5All), htfCandles: {
    '1h': htfObCandles(mark(await htf.candles('1h', 3600, 200)), sessions, offset),
    '4h': htfObCandles(mark(await htf.candles('4h', 4 * 3600, 100)), sessions, offset) } });
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));

  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  // Der Lauf entscheidet, welche Setups zählen; die POI kommt aus dem einmal vorberechneten Kontext.
  const counterDobGate = RUNS[RUN_ID].counterDob ? createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL }) : undefined;
  const runSetups = live => ({ setups: RUNS[RUN_ID].pick(checkDobTradeSetup({ ...live, poiType: RUNS[RUN_ID].poiType, poiContext, poiOptions: RUNS[RUN_ID].poiOptions, counterDobGate })) });
  const trades = dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, checkDobTradeSetup: runSetups, dobLiveWindowInput }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  const carrying = new Map();
  for (const t of trades) carrying.set(dobTradeKey(t), (carrying.get(dobTradeKey(t)) ?? 0) + 1);
  const unique = uniqueDobTrades(trades);
  // Gegen-DOB-Status je Trade über alle tragenden Paare, bester gewinnt (none > dead > live): wie die Dedup „bleibt, sobald ein Paar passiert“.
  const RANK = { none: 0, dead: 1, live: 2 }, counterStatus = new Map();
  for (const t of trades) { const s = t.counterDob?.status, k = dobTradeKey(t); if (s && (!counterStatus.has(k) || RANK[s] < RANK[counterStatus.get(k)])) counterStatus.set(k, s); }

  const rows = unique.map(t => ({ id: `${RUN_ID}:${t.id}`, run_id: RUN_ID, instrument: SYMBOL,
    direction: t.direction, route: t.route, setup_id: t.id, carrying_setups: carrying.get(dobTradeKey(t)), recognized_at: t.recognizedAt,
    entry_time: t.entryTime, entry_price: t.entryPrice, stop_price: t.stopPrice, target_price: t.outcome.targetPrice,
    outcome: t.outcome.status, outcome_reason: t.outcome.reason ?? null, exit_time: t.outcome.recognizedAt ?? null,
    exit_price: t.outcome.exitPrice ?? null,
    ...(({ maxR, slHit, ambiguousR }) => ({ max_r: maxR, sl_hit: slHit, ambiguous_r: ambiguousR }))(dobMaxR(t, { candles: m1Marked, dataEnd, instrument: SYMBOL })),
    // Weite SL-Variante (ferne OB2-Kante) nur, wo der SL am Retest-Extrem liegt; sonst null (eng = weit).
    ...(wide => ({ wide_max_r: wide?.maxR ?? null, wide_sl_hit: wide?.slHit ?? null, wide_ambiguous_r: wide?.ambiguousR ?? null,
      wide_risk_usd: wide?.riskUsd ?? null }))(dobWideVariant(t, { candles: m1Marked, dataEnd, instrument: SYMBOL })),
    counter_dob_status: counterStatus.get(dobTradeKey(t)) ?? null,
    // Konfig-Merkmale als jsonb (Philip): Schlüssel nur in src/dobTradeFeatures.js, gelesen über dobRowGuardrailReason.
    // Teilprofit mit SL auf Entry: Rest-Verlauf je gespeicherter Stufe (DOB_BREAKEVEN_AT_R_LEVELS), gerechnet in src/dobPartialProfit.js.
    features: { ...dobTradeFeatures({ m5Candles: m5Marked, entryTime: t.entryTime, direction: t.direction }),
      ...Object.assign({}, ...DOB_BREAKEVEN_AT_R_LEVELS.map(atR => dobBreakevenFeatures(atR, dobMaxR(t, { candles: m1Marked, dataEnd, instrument: SYMBOL, breakevenAtR: atR })))) },
    first_ob_start: t.chart.firstOrderBlockStart, second_ob_start: t.chart.secondOrderBlockStart,
    ...(RUN_ID === 'dob-setup-v0' ? {} : { poi_kind: `ob_${t.poi.timeframe.toLowerCase()}`, poi_distance_usd: t.poi.distanceUsd,
      poi_atr: t.poi.atr, poi_distance_atr: t.poi.distanceAtr,
      poi_gap_seconds: t.chart.firstOrderBlockStart - t.poi.zoneRecognizedAt,
      poi_zone_top: t.poi.zone.top, poi_zone_bottom: t.poi.zone.bottom,
      poi_zone_start: t.poi.zoneStartTime, poi_retest_kind: t.poi.retestKind, poi_retest_age_seconds: t.poi.retestAgeSeconds,
      poi_zone_age_seconds: dobPoiZoneAgeSeconds(t.poi, t.chart.firstOrderBlockStart) }) }));

  const total = aggregateDobByMonth(unique.map(t => ({ recognizedAt: t.recognizedAt, entries: { [t.route]: { status: 'ready', outcome: t.outcome } } })),
    p => berlinDateStrFor(p.recognizedAt).slice(0, 7)).total;
  console.log(`${RUNS[RUN_ID].version} · ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${trades.length} Trades mit Entry · ${rows.length} einmalig`);
  console.table(Object.entries(total.routes).map(([route, c]) => ({ route, success: c.success, loss: c.loss, ambiguous: c.ambiguous,
    open: c.open, unknown: c.unknown, winrate: c.winrate == null ? '–' : `${(c.winrate * 100).toFixed(1)}%`, sumR: c.sumR })));
  console.log('max_r:', JSON.stringify(Object.fromEntries([...Map.groupBy(rows, r => r.max_r)].sort((x, y) => x[0] - y[0]).map(([k, v]) => [k, v.length]))));
  // Abgleich: Ziel 2R aus max_r/sl_hit muss dem gespeicherten Ausgang entsprechen (gleicher Verfolgungszeitraum).
  console.log('2R aus max_r:', JSON.stringify({ win: rows.filter(r => r.max_r >= 2).length, loss: rows.filter(r => r.max_r < 2 && r.sl_hit && !(r.ambiguous_r >= 2)).length,
    open: rows.filter(r => r.max_r < 2 && !r.sl_hit).length, outcomeWin: rows.filter(r => r.outcome === 'success').length, outcomeLoss: rows.filter(r => r.outcome === 'loss').length }));
  if (DRY) { if (flag('--dump')) (await import('node:fs')).writeFileSync(flag('--dump'), JSON.stringify(rows)); process.exit(0); }
  const { data, error } = await supabase.rpc('replace_dob_trade_setups', { p_run: { id: RUN_ID, label: RUNS[RUN_ID].label, description: RUNS[RUN_ID].description, sort: RUNS[RUN_ID].sort, setup_version: RUNS[RUN_ID].version, poi_type: RUNS[RUN_ID].poiType, data_end: dataEnd },
    p_instrument: SYMBOL, p_rows: rows });
  if (error) throw error;
  console.log(`dob_trade_setups: ${data} Zeilen für Lauf ${RUN_ID} geschrieben`);
} finally {
  await server.close();
}
