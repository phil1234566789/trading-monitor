// Messung DOB-EMA-GATE (noch keine Regel, Philips Idee für v3): Short nur unter der EMA200, Long nur darüber.
// Auf den Läufen v0 (alle DOB-Setups), v1 (Quelle ohne Retest) und v2 (Quelle mit Retest), gleiches Raster wie die Statistik.
// EMA200 = computeEma (src/ema.js, wie der Chart) auf M5/M15/H1/H4 zum OB2-Retest (Alarmzeit) und zum Entry, nur geschlossene Kerzen.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridTrades, uniqueDobTrades } from './dobSetupGrid.mjs';

const SYMBOL = 'XAUUSD', START_DAY = '2026-01-01', HOUR = 3600, PERIOD = 200;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
// OB-Mustertrades (Konto 8, Berlin); #137 hat eine LS-Quelle und fehlt hier bewusst.
const SAMPLES = [['#134', '2026-11-12', '14:11', 'short'], ['#135', '2026-11-05', '16:14', 'short'], ['#136', '2026-11-04', '04:13', 'long'],
  ['#136b', '2026-11-04', '06:21', 'long'], ['#138', '2026-10-26', '14:34', 'short'], ['#139', '2026-10-22', '10:52', 'short'],
  ['#139b', '2026-10-22', '11:24', 'short'], ['#140', '2026-10-22', '05:03', 'short'], ['#140b', '2026-10-22', '05:22', 'short'],
  ['#141', '2026-10-12', '15:34', 'short']];

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput }, { evaluateDoubleOrderBlockOutcome },
    { markIgnoredCandles, htfObCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes }, { dobSourceContext, h1AtrAt },
    { computeEma }] = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js', '/src/doubleOrderBlockOutcome.js',
    '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobSourceOfStrength.js', '/src/ema.js'].map(load));
  const startSec = berlinDayRangeUtcMs(START_DAY).startUtcMs / 1000, htfStart = berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000;
  const cacheOf = from => dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: SYMBOL, refresh: false,
    defaultStartSec: from, startSec: from, fetchInitialCandles, supabase });
  const ltf = cacheOf(startSec), htf = cacheOf(htfStart);
  const [m5All, m1All, sessions] = [await ltf.candles('5m', 300, 300), await ltf.candles('1m', 60, 1500), await ltf.sessions()];
  const [h1All, h4All] = [await htf.candles('1h', HOUR, 200), await htf.candles('4h', 4 * HOUR, 100)];
  const offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));
  const sourceContext = dobSourceContext({ instrument: SYMBOL, m5Candles: m5Marked,
    htfCandles: { '1h': htfObCandles(mark(h1All), sessions, offset), '4h': htfObCandles(mark(h4All), sessions, offset) } });

  // Zwei Rasterläufe wie die Statistik: ohne Retest-Pflicht (v0 = alle, v1 = mit Quelle) und mit (v2).
  const grid = { symbol: SYMBOL, m5All, m5Marked, m1Marked };
  const pass = (requireRetest, pick) => uniqueDobTrades(dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, dobLiveWindowInput,
    checkDobTradeSetup: live => ({ setups: pick(checkDobTradeSetup({ ...live, sourceContext, sourceOptions: { requireRetest } })) }) }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome));
  const passA = pass(false, r => [...r.setups.map(s => ({ ...s, sourced: true })), ...r.rejected.map(s => ({ ...s, sourced: false }))]);
  const runs = { v0: passA, v1: passA.filter(t => t.sourced), v2: pass(true, r => r.setups) };

  // EMA-Reihen. M15 gibt es im Archiv nicht; aus je drei nativen M5 (Zeitraster 15 min) zusammengesetzt.
  const m15 = [...Map.groupBy(m5All, c => Math.floor(c.time / 900) * 900)].map(([time, rows]) => ({ time,
    open: rows[0].open, high: Math.max(...rows.map(r => r.high)), low: Math.min(...rows.map(r => r.low)), close: rows.at(-1).close }));
  const TFS = { M5: [m5All, 300], M15: [m15, 900], H1: [h1All, HOUR], H4: [h4All, 4 * HOUR] };
  const series = Object.fromEntries(Object.entries(TFS).map(([tf, [rows, dur]]) =>
    [tf, computeEma(rows, PERIOD).map((e, i) => ({ closedAt: rows[i].time + dur, value: e.value })).slice(PERIOD)]));
  const lastBefore = (rows, t, key) => { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m][key] <= t) lo = m + 1; else hi = m; } return rows[lo - 1]; };
  const m1Index = m1All.map(c => ({ closedAt: c.time + 60, close: c.close }));
  const priceAt = t => lastBefore(m1Index, t, 'closedAt')?.close ?? null;

  const MOMENTS = { retest: t => ({ at: t.chart.secondRetestTime + 60, price: priceAt(t.chart.secondRetestTime + 60) }),
    entry: t => ({ at: t.entryTime, price: t.entryPrice }) };
  const BUCKETS = [[0.5, '0–0,5'], [1, '0,5–1'], [2, '1–2'], [Infinity, '> 2']];
  const feature = (t, tf, moment) => {
    const { at, price } = MOMENTS[moment](t), ema = lastBefore(series[tf], at, 'closedAt')?.value, atr = h1AtrAt(sourceContext, at);
    if (ema == null || price == null) return null;
    const withTrend = t.direction === 'short' ? price < ema : price > ema, dist = atr ? Math.abs(price - ema) / atr : null;
    return { withTrend, bucket: dist == null ? 'ohne ATR' : BUCKETS.find(([max]) => dist <= max)[1] };
  };

  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const stats = list => {
    const w = list.filter(t => t.outcome.status === 'success').length, l = list.filter(t => t.outcome.status === 'loss').length;
    return { n: w + l, win: w, loss: l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: 2 * w - l, smallN: w + l < 50 };
  };
  const berlin = (day, hhmm) => { const utc = Date.parse(`${day}T${hhmm}:00Z`) / 1000; return utc - berlinOffsetMinutes(utc * 1000) * 60; };
  const sampleTrade = (list, [, day, at, direction]) => list.filter(t => t.direction === direction)
    .reduce((b, t) => Math.abs(t.entryTime - berlin(day, at)) <= 1800 && (!b || Math.abs(t.entryTime - berlin(day, at)) < Math.abs(b.entryTime - berlin(day, at))) ? t : b, null);
  const summary = (list, all) => ({ ...stats(list), share: +(list.length / all.length * 100).toFixed(1),
    halves: { 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06')), 'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07')) } });

  const emaGate = { measurement: 'dob-ema-gate-v1', git: execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
    + (execSync('git status --porcelain -- . ":!analysis/dob-setup"', { cwd: root }).toString().trim() ? '-dirty' : ''),
    symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd), breakEvenWinrate: 33.3,
    methodology: ['Trades: einmalige Trades wie die Statistikläufe (dobSetupGrid, jeder M5-Schluss im Live-Fenster, Dedup Richtung/Entry/SL).',
      'v0 = alle DOB-Setups, v1 = Quelle der Kraft ohne Retest-Pflicht, v2 = mit Retest (Produkt).',
      'EMA200 = computeEma (src/ema.js) über die Schlusskurse ab Archivbeginn; Wert der letzten geschlossenen Kerze vor dem Zeitpunkt, erste 200 Kerzen verworfen.',
      'M15 aus je drei nativen M5 zusammengesetzt (kein 15m im Archiv). Preis: Retest = Schluss der letzten geschlossenen M1 bei bekanntem OB2-Kontakt, Entry = Entry-Preis.',
      'Mit dem Trend: Short Preis < EMA, Long Preis > EMA. Abstand in H1-ATR(14) nur zur Info.',
      'n = Win + Loss; ΣR = 2·Win − Loss; Halbjahre nach Berliner Entry-Monat; smallN = n < 50.'],
    runs: {} };
  for (const [run, list] of Object.entries(runs)) {
    const kept = Object.fromEntries(SAMPLES.map(s => [s[0], sampleTrade(list, s)]).filter(([, t]) => t));
    const out = { base: summary(list, list), samplesInRun: Object.keys(kept), variants: {} };
    for (const tf of Object.keys(TFS)) for (const moment of Object.keys(MOMENTS)) {
      const rows = list.map(t => ({ t, f: feature(t, tf, moment) })).filter(r => r.f);
      const side = flag => rows.filter(r => r.f.withTrend === flag).map(r => r.t);
      out.variants[`${tf} · ${moment === 'retest' ? 'OB2-Retest' : 'Entry'}`] = {
        mitTrend: { ...summary(side(true), list), samples: Object.entries(kept).filter(([, t]) => rows.find(r => r.t === t)?.f.withTrend).map(([k]) => k) },
        gegenTrend: summary(side(false), list),
        distance: Object.fromEntries(BUCKETS.map(([, b]) => [b, { mitTrend: stats(rows.filter(r => r.f.withTrend && r.f.bucket === b).map(r => r.t)),
          gegenTrend: stats(rows.filter(r => !r.f.withTrend && r.f.bucket === b).map(r => r.t)) }])),
        // Nur v2 hat die Retest-Art; der erste Touch lag bei 29,7 % (Main), deshalb gekreuzt.
        ...(run === 'v2' ? { byRetestKind: Object.fromEntries(['first', 'followUp'].map(kind => [kind, {
          mitTrend: summary(rows.filter(r => r.f.withTrend && r.t.sourceOfStrength?.retestKind === kind).map(r => r.t), list),
          gegenTrend: summary(rows.filter(r => !r.f.withTrend && r.t.sourceOfStrength?.retestKind === kind).map(r => r.t), list) }])) } : {}) };
    }
    emaGate.runs[run] = out;
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'ema-gate-xau-2026.json'), JSON.stringify({ emaGate }, null, 2));
  for (const [run, out] of Object.entries(emaGate.runs)) {
    console.log(`\n== ${run}: n=${out.base.n} ${out.base.winrate}% ${out.base.sumR}R · Mustertrades ${out.samplesInRun.join(' ')}`);
    for (const [name, v] of Object.entries(out.variants)) {
      const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s.halves['Jan–Jun'].winrate}/${s.halves['Jul–Nov'].winrate})`;
      console.log(name.padEnd(18), 'mit:', f(v.mitTrend), v.mitTrend.samples.length + '/' + out.samplesInRun.length, '| gegen:', f(v.gegenTrend));
      if (v.byRetestKind) for (const [kind, k] of Object.entries(v.byRetestKind)) console.log('   ', kind.padEnd(9), 'mit:', f(k.mitTrend), '| gegen:', f(k.gegenTrend));
    }
  }
} finally {
  await server.close();
}
