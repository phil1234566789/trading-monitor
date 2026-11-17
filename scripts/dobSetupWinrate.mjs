// Basis-Winrate DOB-Setup v0 (DOB + TP 2R) für XAUUSD ab 01.01.2026 (Berlin), Ergebnis in analysis/dob-setup/.
// Auswertung an jedem M5-Schluss im Live-Fenster (dobLiveWindowInput), wie der spätere Watcher.
// Flags: --refresh (Kerzen neu holen), --from YYYY-MM-DD, --fixture YYYY-MM-DD (Berliner Tag als dob-native-Fixture schreiben).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridInputAt, dobGridTrades, uniqueDobTrades } from './dobSetupGrid.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = 'XAUUSD', START_DAY = flag('--from') ?? '2026-01-01', FIXTURE_DAY = flag('--fixture');
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput },
    { evaluateDoubleOrderBlockOutcome }, { markIgnoredCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes },
    { m1GapCovered }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js',
    '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/goldWeekendGap.js'].map(load));

  // Basismessung = jedes DOB-Setup ohne POI (v0); der POI misst dobPoiMeasurement.mjs auf dieser Datei.
  const BASE_VERSION = 'dob-setup-v0';
  const allDob = input => { const r = checkDobTradeSetup(input); return { setups: [...r.setups, ...r.rejected] }; };
  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000;
  // Ein Tag Vorlauf: das erste Live-Fenster beginnt am Marktschluss davor.
  const cache = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: process.argv.includes('--refresh'),
    defaultStartSec: startSec, startSec, fetchInitialCandles, supabase });
  const [m5All, m1All, sessions] = [await cache.candles('5m', 300, 300), await cache.candles('1m', 60, 1500), await cache.sessions()];

  if (FIXTURE_DAY) {
    const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(FIXTURE_DAY), [from, to] = [startUtcMs / 1000, endUtcMs / 1000];
    const pick = rows => rows.filter(c => c.time >= from && c.time < to).map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }));
    const fixture = { schemaVersion: 1, instrument: SYMBOL,
      provenance: { source: 'native FXCM Bid via forex_candles (fetchInitialCandles, wie Dashboard)', query: { from, to, bounds: 'from inclusive, to exclusive' } },
      timeSemantics: { timezone: 'Europe/Berlin', candleTimestamp: 'bar open in epoch seconds' },
      candles: { m1: pick(m1All), m5: pick(m5All) } };
    const file = path.join(root, 'test', 'fixtures', 'dob-native', `${FIXTURE_DAY}.json`);
    await fs.writeFile(file, JSON.stringify(fixture, null, 1));
    console.log(`Fixture ${file}: ${fixture.candles.m5.length} M5 / ${fixture.candles.m1.length} M1`);
    process.exit(0);
  }

  const mark = rows => markIgnoredCandles(rows, sessions, sec => berlinOffsetMinutes(sec * 1000));
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));
  // Sessionenden = letzte Minute vor einem XAU-Marktschluss (gleiche Lückenregel wie dobLiveWindowStart).
  const sessionEnds = [];
  for (let i = 1; i < m1All.length; i++) {
    const end = m1All[i - 1].time + 60;
    if (end < m1All[i].time && m1GapCovered(SYMBOL, end, m1All[i].time) && end > startSec) sessionEnds.push(end);
  }
  if (dataEnd > (sessionEnds.at(-1) ?? 0)) sessionEnds.push(dataEnd);

  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  const inputAt = (at, lookbackSec) => dobGridInputAt(grid, at, lookbackSec);
  const key = s => JSON.stringify([s.phase, s.entryTime, s.entryPrice, s.stopPrice]);
  // Gegenprobe je Sessionende: mehr Vorlauf (3 Tage) darf kein Setup der Session ändern.
  const mismatches = [];
  for (const at of sessionEnds) {
    const wide = inputAt(at, 3 * 86400), live = dobLiveWindowInput(wide);
    const liveSetups = new Map(allDob(live).setups.map(s => [s.id, key(s)]));
    const reference = allDob(wide).setups.filter(s => s.recognizedAt >= live.liveFrom);
    for (const s of reference) if (liveSetups.get(s.id) !== key(s)) mismatches.push({ at, id: s.id, wide: key(s), live: liveSetups.get(s.id) ?? null });
    for (const id of liveSetups.keys()) if (!reference.some(r => r.id === id)) mismatches.push({ at, id, onlyLive: true });
  }
  const { setups, durations, bars, waitedFirst } = collectDobSetups(grid, { startSec, dataEnd, checkDobTradeSetup: allDob, dobLiveWindowInput });
  const trades = dobGridTrades(setups, grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  // Aggregat erwartet Paare mit Routen; je Setup ein Pseudo-Paar mit genau seiner Route.
  const asPairs = list => list.map(t => ({ recognizedAt: t.recognizedAt, entries: { [t.route]: { status: 'ready', outcome: t.outcome } } }));
  const month = p => berlinDateStrFor(p.recognizedAt).slice(0, 7);
  const unique = uniqueDobTrades(trades);
  const sorted = [...durations].sort((a, b) => a - b), q = f => +sorted[Math.floor(f * (sorted.length - 1))].toFixed(1);
  const gitHash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
    + (execSync('git status --porcelain', { cwd: root }).toString().trim() ? '-dirty' : '');
  const report = { version: BASE_VERSION, git: gitHash, symbol: SYMBOL, from: START_DAY, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: [
      'Kerzen: native forex_candles über fetchInitialCandles wie das Dashboard, gecacht in .debug/dob-setup; Session-Ignore wie markIgnored.',
      'Raster: jeder M5-Schluss ab Start, Eingabe = dobLiveWindowInput (Live-Fenster seit letztem Marktschluss + 1 h Vorlauf) wie der spätere Watcher.',
      'Setups: checkDobTradeSetup mit recognizedAt ab Start, letzte Sichtung je ID; Ausgang je Entry neu bis Datenende über alle M1.',
      'Gegenprobe: je Sessionende Live-Fenster gegen 3 Tage Eingabe (wideWindowMismatches).',
      'Monat = Berliner Monat von recognizedAt; Winrate = success/(success+loss); R: Win +2, Loss −1; ambiguous/open/unknown zählen nicht in die Winrate.',
      'perSetup = je DOB-Paar und Route (Task-Definition); uniqueTrades = gleiche Richtung/Entry/SL nur einmal.'],
    sessions: sessionEnds.length, evaluations: durations.length,
    setupsSeen: { total: setups.size, withEntry: [...setups.values()].filter(s => s.entryTime != null).length,
      firstSeenWaiting: waitedFirst.size, waitingWithoutEntry: [...setups.values()].filter(s => s.entryTime == null).length },
    liveWindow: { runtimeMs: { median: q(0.5), p95: q(0.95), max: q(1) }, bars: { m5Median: bars.map(b => b[0]).sort((a, b) => a - b)[bars.length >> 1],
      m1Median: bars.map(b => b[1]).sort((a, b) => a - b)[bars.length >> 1] }, wideWindowMismatches: mismatches.length, mismatches: mismatches.slice(0, 20) },
    candles: { m5: m5All.length, m1: m1All.length },
    perSetup: aggregateDobByMonth(asPairs(trades), month), uniqueTrades: aggregateDobByMonth(asPairs(unique), month),
    setups: trades.map(t => ({ id: t.id, direction: t.direction, route: t.route, entryTime: t.entryTime, entryPrice: t.entryPrice,
      stopPrice: t.stopPrice, targetPrice: t.outcome.targetPrice, outcome: t.outcome.status, outcomeReason: t.outcome.reason })) };
  const outDir = path.join(root, 'analysis', 'dob-setup');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `winrate-xau-2026-${BASE_VERSION}.json`), JSON.stringify(report, null, 2));

  const pct = v => v == null ? '–' : `${(v * 100).toFixed(1)}%`;
  console.log(`${BASE_VERSION} · ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${sessionEnds.length} Sessions · ${report.evaluations} M5-Läufe · Live-Fenster ${JSON.stringify(report.liveWindow.runtimeMs)} ms · Abweichungen breit/live ${mismatches.length}`);
  console.log(JSON.stringify(report.setupsSeen), JSON.stringify(report.liveWindow.bars));
  for (const [name, agg] of [['perSetup', report.perSetup], ['uniqueTrades', report.uniqueTrades]])
    console.table(Object.entries({ gesamt: agg.total, ...agg.months }).flatMap(([scope, s]) => Object.entries(s.routes).map(([route, c]) =>
      ({ name, scope, route, success: c.success, loss: c.loss, ambiguous: c.ambiguous, open: c.open, unknown: c.unknown, winrate: pct(c.winrate), sumR: c.sumR }))));
} finally {
  await server.close();
}
