// DOB-Winrate XAUUSD ab 01.10.2026 (Berlin) als Vorher/Nachher-Messung gegen den jeweiligen Checkout-src.
// Methodik steht in report.methodology. Flags: --refresh (Kerzen neu holen), --name <x> (Reportname,
// Default version-gitHash), --from YYYY-MM-DD (Default 2026-10-01), --crosscheck (eine Woche je M5-Schluss).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { aggregateDobByMonth } from './dobWinrateAggregate.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const DEFAULT_START = '2026-10-01', SYMBOL = 'XAUUSD', START_DAY = flag('--from') ?? DEFAULT_START, CHECK_WEEK = ['2026-11-02', '2026-11-07'];
if (!/^\d{4}-\d{2}-\d{2}$/.test(START_DAY)) throw Error(`--from braucht YYYY-MM-DD, nicht ${START_DAY}`);
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const outDir = path.join(root, '.debug', 'dob-winrate');
// Worktrees haben keine eigene .env; sie liegt im Haupt-Checkout darüber.
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

let requests = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (...args) => { requests++; return realFetch(...args); };

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
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
  // Kalenderbars bis Start plus Fenster: Wochenenden machen das zur sicheren Obergrenze für den Vorlauf.
  // coveredFrom = frühester Start, dessen Fenster der Cache trägt; ein früheres --from lädt nur das Ältere nach.
  const candles = async (bar, seconds, window) => {
    const file = path.join(outDir, `candles-${SYMBOL}-${bar === '1m' ? 'm1' : 'm5'}.json`);
    let cache = !process.argv.includes('--refresh') && existsSync(file) ? JSON.parse(await fs.readFile(file, 'utf8')) : null;
    if (Array.isArray(cache)) cache = { coveredFrom: berlinDayRangeUtcMs(DEFAULT_START).startUtcMs / 1000, rows: cache };
    if (cache && cache.coveredFrom <= startSec) return cache.rows;
    const toSec = cache ? cache.rows[0].time : Math.floor(Date.now() / 1000);
    const rows = await fetchInitialCandles(SYMBOL, bar, Math.ceil((toSec - startSec) / seconds) + window, toSec * 1000 - 1);
    cache = { coveredFrom: startSec, rows: [...rows.filter(c => c.time < toSec), ...(cache?.rows ?? [])] };
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify(cache));
    return cache.rows;
  };
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
  // Mitgliedschaft aus der ersten Sichtung (das wurde live gemeldet); Routen aus der letzten Sichtung,
  // deren M5-Fenster OB1 noch enthält, damit kein abgeschnittener Verlauf die Entries verfälscht.
  let engineMs = 0, version = null;
  const scan = points => {
    const first = new Map(), complete = new Map();
    for (const at of points) {
      const m5 = window(m5All, '5m', TRADE_SETUP_M5_CANDLE_COUNT, at);
      const input = { m5Candles: m5, m1Candles: window(m1All, '1m', TRADE_SETUP_M5_CANDLE_COUNT * 5 + 5, at), instrument: SYMBOL, evaluatedAt: at };
      const t0 = performance.now();
      const result = detectDoubleOrderBlocks(input);
      engineMs += performance.now() - t0;
      version = result.version;
      for (const pair of result.pairs) {
        if (!first.has(pair.id)) first.set(pair.id, pair);
        if (pair.firstOrderBlock.startTime >= m5[0].time) complete.set(pair.id, pair);
      }
    }
    return { first, complete };
  };
  const days = [...new Set(m1All.filter(c => c.time >= startSec).map(c => berlinDateStrFor(c.time)))];
  const daily = scan(days.map(day => Math.min(berlinDayRangeUtcMs(day).endUtcMs / 1000, dataEnd)));
  const seen = new Map([...daily.first].filter(([, p]) => p.recognizedAt >= startSec).map(([id, p]) => [id, daily.complete.get(id) ?? p]));
  const dailyEngineMs = engineMs;
  let crosscheck = null;
  if (process.argv.includes('--crosscheck')) {
    const [from, to] = CHECK_WEEK.map(d => berlinDayRangeUtcMs(d).startUtcMs / 1000);
    const points = m5All.map(c => c.time + 300).filter(t => t > from && t <= to);
    const inWeek = map => new Set([...map.values()].filter(p => p.recognizedAt >= from && p.recognizedAt < to).map(p => p.id));
    const fine = inWeek(scan(points).first), coarse = inWeek(daily.first);
    crosscheck = { week: CHECK_WEEK, evaluations: points.length, dailyPairs: coarse.size, m5Pairs: fine.size,
      onlyM5: [...fine].filter(id => !coarse.has(id)), onlyDaily: [...coarse].filter(id => !fine.has(id)) };
    crosscheck.match = !crosscheck.onlyM5.length && !crosscheck.onlyDaily.length;
  }

  const m1Marked = mark(m1All);
  const pairs = [...seen.values()].map(pair => ({ ...pair, entries: Object.fromEntries(Object.entries(pair.entries).map(([route, entry]) =>
    [route, entry.status !== 'ready' ? entry : { ...entry, outcome: evaluateDoubleOrderBlockOutcome({ direction: pair.direction, ...entry,
      candles: m1Marked, evaluatedAt: dataEnd, instrument: SYMBOL }) }])) }));
  const summary = aggregateDobByMonth(pairs, p => berlinDateStrFor(p.recognizedAt).slice(0, 7));
  const gitHash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
    + (execSync('git status --porcelain', { cwd: root }).toString().trim() ? '-dirty' : '');
  const report = { version, git: gitHash, symbol: SYMBOL, from: START_DAY, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: [
      'Kerzen: native forex_candles über fetchInitialCandles wie useDoubleOrderBlockChart, gecacht in .debug/dob-winrate.',
      'Raster: je Berliner Kalendertag mit M1-Daten evaluatedAt = Tagesende (zuletzt Datenende); Fenster wie Dashboard (2500 M5 / 12505 M1, closedChecklistCandles, Session-Ignore-Markierung).',
      'Paare: Mitgliedschaft aus der ersten Sichtung mit recognizedAt ab 01.10.; Routen aus der letzten Sichtung, deren M5-Fenster OB1 noch enthält.',
      'Outcome: je ready-Route neu mit evaluatedAt = Datenende über alle M1-Kerzen.',
      'Monat = Berliner Monat von pair.recognizedAt; Winrate = success/(success+loss); unknownRate = unknown/ready; R: Win +2, Loss −1.'],
    evaluations: days.length, engineMs: Math.round(dailyEngineMs), crosscheck, requests, candles: { m5: m5All.length, m1: m1All.length },
    ...summary, pairs: pairs.map(p => ({ id: p.id, direction: p.direction, recognizedAt: p.recognizedAt,
      entries: Object.fromEntries(Object.entries(p.entries).map(([r, e]) => [r, { status: e.status, entryTime: e.entryTime,
        entryPrice: e.entryPrice, stopPrice: e.stopPrice, outcome: e.outcome?.status ?? null, outcomeReason: e.outcome?.reason ?? null, reason: e.reason ?? null }])) })) };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `report-${flag('--name') ?? `${version}-${gitHash}`}.json`), JSON.stringify(report, null, 2));

  const pct = v => v == null ? '–' : `${(v * 100).toFixed(1)}%`;
  console.log(`${version} · ${SYMBOL} ${START_DAY} → ${berlinDateStrFor(dataEnd)} · ${days.length} Läufe · Engine ${report.engineMs} ms · ${requests} Requests`);
  if (crosscheck) console.log(`Gegenprüfung ${CHECK_WEEK.join('–')}: ${crosscheck.evaluations} M5-Schlüsse, ${crosscheck.m5Pairs} vs ${crosscheck.dailyPairs} Paare, nur M5: ${crosscheck.onlyM5.length}, nur Tag: ${crosscheck.onlyDaily.length}`);
  console.table(Object.entries({ gesamt: summary.total, ...summary.months }).flatMap(([scope, s]) => Object.entries(s.routes).map(([route, c]) =>
    ({ scope, route, pairs: s.pairs, ...c, winrate: pct(c.winrate), unknownRate: pct(c.unknownRate) }))));
} finally {
  await server.close();
}
