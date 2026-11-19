// Befüllt dob_trade_setups (Statistikseite /dob-statistik) mit den einmaligen v0-Trades ab --from (Berlin), gleiche Zählweise wie
// dobSetupWinrate.mjs: jeder M5-Schluss im Live-Fenster, letzte Sichtung je Setup-ID, Ausgang neu bis Datenende, Dedup Richtung/Entry/SL.
// Flags: --instrument (Standard XAUUSD), --refresh (Kerzen neu holen), --from YYYY-MM-DD, --dry (nichts schreiben, nur Kennzahlen), --run <Lauf-ID aus RUNS>,
// --dump <Datei> (mit --dry: Zeilen als JSON, für bitgenaue Regressionsvergleiche nach Umbauten), --allow-missing-model (schreibt trotz fehlender Mustertrades).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridTrades, dobTradeKey, uniqueDobTrades } from './dobSetupGrid.mjs';
import { instrumentConfig } from '../src/instrumentConfig.js';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = flag('--instrument') ?? 'XAUUSD', START_DAY = flag('--from') ?? '2026-01-01', DRY = process.argv.includes('--dry');
// Ein Lauf = ein Eintrag im Dropdown der Seite. v1 (POI) kommt als weiterer Eintrag mit eigenem Trade-Filter dazu.
// pick: welche Setups von checkDobTradeSetup() der Lauf zählt. v0 = jedes DOB-Setup, v1 = nur mit POI.
// poiType: POI-Art des Laufs (src/dobPoiType.js), bestimmt die POI-Erkennung; künftige LQ-Sweep-Läufe heißen dob-lq-sweep-v….
// Lauf-IDs: XAU behält dob-setup-vN, andere Instrumente bekommen das Instrument im Namen (dob-setup-gbpusd-vN), damit ein Füllen
// nie die XAU-Läufe berührt. Der POI-Abstand k kommt je Instrument aus instrumentConfig (dobPoiMaxAtr).
const runId = v => SYMBOL === 'XAUUSD' ? `dob-setup-${v}` : `dob-setup-${SYMBOL.toLowerCase()}-${v}`;
const atrText = (instrumentConfig(SYMBOL).dobPoiMaxAtr ?? 0).toLocaleString('de-DE');
const RUNS = Object.fromEntries([
  ['v0', { label: 'v0 · nur DOB', description: 'DOB + TP 2R, ohne POI', sort: 0, pick: r => [...r.setups, ...r.rejected] }],
  ['v1', { label: `v1 · POI (G ${atrText} ATR)`, description: `DOB + TP 2R, aktive H1/H4-OB-Zone höchstens ${atrText} H1-ATR von OB1`,
    sort: 1, pick: r => r.setups, poiOptions: { requireRetest: false } }],
  ['v2', { label: 'v2 · POI mit Retest', description: 'wie v1, die H1/H4-Zone muss vor OB1 retestet sein',
    sort: 2, pick: r => r.setups, poiOptions: { requireRetest: true } }],
  // v3: alle v2-Trades mit Gegen-DOB-Status (none/dead/live); was gesperrt oder mit 5R gehandelt wird, entscheidet die Konfig.
  ['v3', { label: 'v3 · Gegen-DOB', description: 'wie v2 mit Gegen-DOB-Status seit dem Retest des POI; Sperre bzw. TP über die Setup-Konfiguration',
    sort: 3, pick: r => r.setups, poiOptions: { requireRetest: true }, counterDob: true }],
].map(([v, run]) => [runId(v), { ...run, version: `dob-setup-${v}`, poiType: 'htf_ob' }]));
// LQ-Sweep v0: POI = TS1.1-Setup mit gleicher Kante an OB1/OB2 (Philip). Der Lauf nimmt auch Überlappung und knapp daneben
// auf (features.poi_match), welche Stufe zählt, entscheidet die Konfig (poiMatchMode, Default gleiche Kante). Lauf-ID wie oben:
// XAU dob-lq-sweep-v0, sonst mit Instrument (dob-lq-sweep-gbpusd-v0).
RUNS[SYMBOL === 'XAUUSD' ? 'dob-lq-sweep-v0' : `dob-lq-sweep-${SYMBOL.toLowerCase()}-v0`] = { label: 'v0 · TS1.1 an OB1/OB2',
  description: 'DOB, dessen OB1 oder OB2 eine Kante mit einem TS1.1-OB teilt (TS1.1 wie im Chart, mit Trend-Policy; Überlappung/daneben als Merkmal); Gegen-DOB-Status wie v3',
  sort: 10, version: 'dob-lq-sweep-v0', poiType: 'lq_sweep', pick: r => r.setups, poiOptions: { match: 'adjacent' }, counterDob: true };
// LQ-Sweep v1: Konfiguration wie v0, nur mit dem TS1.1-Stand nach Philips Wurzel-Skizze (Pivot-Alter + Wurzel als Quelle, v7).
// v0 bleibt als Vergleich stehen und kanonisch (dobCanonicalRunId).
const lqV0 = RUNS[SYMBOL === 'XAUUSD' ? 'dob-lq-sweep-v0' : `dob-lq-sweep-${SYMBOL.toLowerCase()}-v0`];
RUNS[SYMBOL === 'XAUUSD' ? 'dob-lq-sweep-v1' : `dob-lq-sweep-${SYMBOL.toLowerCase()}-v1`] = { ...lqV0, label: 'v1 · TS1.1 (Wurzel-Skizze)',
  description: `${lqV0.description}; TS1.1 mit Pivot-Alter-Regel und Wurzel als LS-Quelle nach Philips Skizze`, sort: 11, version: 'dob-lq-sweep-v1' };
const RUN_ID = flag('--run') ?? runId('v0');
if (!RUNS[RUN_ID]) throw new Error(`Unbekannter Lauf ${RUN_ID}, bekannt: ${Object.keys(RUNS).join(', ')}`);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput },
    { evaluateDoubleOrderBlockOutcome }, { markIgnoredCandles, htfObCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes },
    { dobPoiContext, dobPoiZoneAgeSeconds }, { dobMaxR, dobWideVariant }, { createDobCounterDobGate }, { dobTradeFeatures, dobBreakevenFeatures, dobPoiFeatures, DOB_BREAKEVEN_AT_R_LEVELS },
    { dobTs11FromRow, dobLqMatchRank }, { fetchAllRows }, { tradeSetup11RowVerdicts, TRADE_SETUP_11_VERSION }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js',
      '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobHtfObPoi.js', '/src/dobMaxR.js', '/src/dobCounterDob.js', '/src/dobTradeFeatures.js',
      '/src/dobLqSweepPoi.js', '/src/dbReadPaging.js', '/src/tradeSetup11Rows.js'].map(load));
  const [{ fetchDobTradePins }, { missingDobModelTrades }] = await Promise.all(['/src/pinContext.js', '/src/dobTradeStatistics.js'].map(load));
  const LQ = RUNS[RUN_ID].poiType === 'lq_sweep';
  // trade_setups-Zeilen (alle Detektorversionen) nur für LQ-Sweep-Läufe; TS1.1 daraus erst unten mit dem Trendkontext.
  const tradeSetupRows = LQ ? await (async () => { const { data, error } = await fetchAllRows((from, to) => supabase.from('trade_setups')
    .select('*,trade_setup_sweeps(price,pivot_time,touched_time,timeframe,is_primary),ob_zones(top,bottom)')
    .eq('instrument', SYMBOL).order('ob_start_time').order('id').range(from, to)); if (error) throw error; return data; })() : undefined;

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
  const ts11Cache = LQ && dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup', 'ts11'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000, startSec: berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000, fetchInitialCandles, supabase });
  const ts11Candles = LQ && { m5: await ts11Cache.candles('5m', 300, 300), h1: await htf.candles('1h', 3600, 200), d1: await ts11Cache.candles('1D', 86400, 300) };
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));
  // TS1.1 wie im Chart und im Watcher (tradeSetup11RowVerdicts, Trend-Policy). Das Urteil hängt nur an Kerzen bis zur Setup-Erkennung,
  // daher einmal zum Datenende. Eigener Cache-Ordner: M5/D1 ab 15.11.2025 für den D1-Anker, ohne die Lauf-Kerzen oben zu verändern.
  const tradeSetups = LQ ? (() => {
    const verdicts = tradeSetup11RowVerdicts({ rows: tradeSetupRows, instrument: SYMBOL, m5Candles: ts11Candles.m5, h1Candles: ts11Candles.h1,
      d1Candles: ts11Candles.d1, evaluatedAt: dataEnd, sessionConfigs: sessions });
    const counts = Object.groupBy([...verdicts.values()], v => v.status);
    console.log(`TS1.1 ${TRADE_SETUP_11_VERSION}: ${tradeSetupRows.length} Zeilen · ${Object.entries(counts).map(([k, v]) => `${k} ${v.length}`).join(' · ')}`);
    return tradeSetupRows.filter(r => verdicts.get(r.id)?.status === 'passed').map(dobTs11FromRow);
  })() : undefined;

  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  // Der Lauf entscheidet, welche Setups zählen; die POI kommt aus dem einmal vorberechneten Kontext.
  const counterDobGate = RUNS[RUN_ID].counterDob ? createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL }) : undefined;
  const runSetups = live => ({ setups: RUNS[RUN_ID].pick(checkDobTradeSetup({ ...live, poiType: RUNS[RUN_ID].poiType, poiContext, poiOptions: RUNS[RUN_ID].poiOptions, counterDobGate, tradeSetups })) });
  const trades = dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, checkDobTradeSetup: runSetups, dobLiveWindowInput }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  const carrying = new Map();
  for (const t of trades) carrying.set(dobTradeKey(t), (carrying.get(dobTradeKey(t)) ?? 0) + 1);
  const unique = uniqueDobTrades(trades);
  // Gegen-DOB-Status je Trade über alle tragenden Paare, bester gewinnt (none > dead > live): wie die Dedup „bleibt, sobald ein Paar passiert“.
  const RANK = { none: 0, dead: 1, live: 2 }, counterStatus = new Map();
  for (const t of trades) { const s = t.counterDob?.status, k = dobTradeKey(t); if (s && (!counterStatus.has(k) || RANK[s] < RANK[counterStatus.get(k)])) counterStatus.set(k, s); }
  // LQ-Sweep: stärkste Verbindung über alle tragenden Paare (dobLqMatchRank, wie je Paar).
  const bestPoi = new Map(), poiRank = dobLqMatchRank;
  if (LQ) for (const t of trades) { const k = dobTradeKey(t); if (t.poi && (!bestPoi.has(k) || poiRank(t.poi) < poiRank(bestPoi.get(k)))) bestPoi.set(k, t.poi); }

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
      ...Object.assign({}, ...DOB_BREAKEVEN_AT_R_LEVELS.map(atR => dobBreakevenFeatures(atR, dobMaxR(t, { candles: m1Marked, dataEnd, instrument: SYMBOL, breakevenAtR: atR })))),
      ...(LQ ? dobPoiFeatures(bestPoi.get(dobTradeKey(t))) : {}) },
    first_ob_start: t.chart.firstOrderBlockStart, second_ob_start: t.chart.secondOrderBlockStart,
    ...(LQ ? (poi => ({ poi_kind: 'ts11', poi_distance_usd: poi.gapUsd, poi_zone_top: poi.zone.top, poi_zone_bottom: poi.zone.bottom,
      poi_zone_start: poi.zoneStartTime, poi_gap_seconds: t.chart.firstOrderBlockStart - poi.zoneStartTime }))(bestPoi.get(dobTradeKey(t)))
    : RUNS[RUN_ID].version === 'dob-setup-v0' ? {} : { poi_kind: `ob_${t.poi.timeframe.toLowerCase()}`, poi_distance_usd: t.poi.distanceUsd,
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
  if (flag('--dump')) (await import('node:fs')).writeFileSync(flag('--dump'), JSON.stringify(rows));
  // Mustertrades: fällt einer aus dem Lauf, wird nichts geschrieben (Philip: „darf nicht rausfliegen“). --allow-missing-model nur bewusst.
  const missingModels = missingDobModelTrades(await fetchDobTradePins(SYMBOL), rows, { poiType: RUNS[RUN_ID].poiType, fromSec: startSec });
  for (const pin of missingModels) console.error(`Mustertrade fehlt: ${pin.dobTradeContext.direction} ${berlinDateStrFor(pin.dobTradeContext.entry_time)} (Pin ${pin.id}${pin.dealingRangeId ? `, DR #${pin.dealingRangeId}` : ''})`);
  if (missingModels.length && !process.argv.includes('--allow-missing-model')) { console.error('Abbruch: Mustertrade(s) fehlen im Lauf.'); process.exitCode = 1; }
  if (DRY || process.exitCode) process.exit(process.exitCode ?? 0);
  // Nach 8–10 min Rechnen ist die gepoolte Verbindung oft serverseitig zu (fetch failed: ECONNRESET/ECONNABORTED); der Ersatz ist idempotent.
  const write = () => supabase.rpc('replace_dob_trade_setups', { p_run: { id: RUN_ID, label: RUNS[RUN_ID].label, description: RUNS[RUN_ID].description, sort: RUNS[RUN_ID].sort, setup_version: RUNS[RUN_ID].version, poi_type: RUNS[RUN_ID].poiType, data_end: dataEnd },
    p_instrument: SYMBOL, p_rows: rows });
  let { data, error } = await write();
  for (let i = 0; i < 2 && /fetch failed/.test(error?.message ?? ''); i++) ({ data, error } = await write());
  if (error) throw error;
  console.log(`dob_trade_setups: ${data} Zeilen für Lauf ${RUN_ID} geschrieben`);
} finally {
  await server.close();
}
