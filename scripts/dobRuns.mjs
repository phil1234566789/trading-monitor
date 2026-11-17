// Gemeinsame Grundlage der DOB-Messskripte auf den Statistikläufen (EMA-Gate, SL-Varianten): Kerzen aus dem Cache, Quelle der Kraft,
// zwei Rasterläufe wie die Statistik und dieselben Kennzahlen. So zählen alle Messungen dieselben Trades.
import path from 'node:path';
import { execSync } from 'node:child_process';
import { dobCandleCache } from './dobCandleCache.mjs';
import { collectDobSetups, dobGridTrades, uniqueDobTrades } from './dobSetupGrid.mjs';

export const DOB_SYMBOL = 'XAUUSD';
// OB-Mustertrades (Konto 8, Berlin); #137 hat eine LS-Quelle und fehlt hier bewusst.
export const DOB_OB_SAMPLES = [['#134', '2026-11-12', '14:11', 'short'], ['#135', '2026-11-05', '16:14', 'short'], ['#136', '2026-11-04', '04:13', 'long'],
  ['#136b', '2026-11-04', '06:21', 'long'], ['#138', '2026-10-26', '14:34', 'short'], ['#139', '2026-10-22', '10:52', 'short'],
  ['#139b', '2026-10-22', '11:24', 'short'], ['#140', '2026-10-22', '05:03', 'short'], ['#140b', '2026-10-22', '05:22', 'short'],
  ['#141', '2026-10-12', '15:34', 'short']];

export async function loadDobRuns(server, root, startDay = '2026-01-01') {
  const load = p => server.ssrLoadModule(p);
  const [{ fetchInitialCandles }, { supabase }, { checkDobTradeSetup, dobLiveWindowInput }, { evaluateDoubleOrderBlockOutcome },
    { markIgnoredCandles, htfObCandles }, { berlinDayRangeUtcMs, berlinDateStrFor, berlinOffsetMinutes }, { dobSourceContext, h1AtrAt }]
    = await Promise.all(['/src/forexCandles.js', '/src/supabaseClient.js', '/src/dobTradeSetup.js', '/src/doubleOrderBlockOutcome.js',
      '/src/sessionOccurrences.js', '/src/berlinTime.js', '/src/dobSourceOfStrength.js'].map(load));
  const startSec = berlinDayRangeUtcMs(startDay).startUtcMs / 1000, htfStart = berlinDayRangeUtcMs('2025-11-15').startUtcMs / 1000;
  const cacheOf = from => dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: DOB_SYMBOL, refresh: false,
    defaultStartSec: from, startSec: from, fetchInitialCandles, supabase });
  const ltf = cacheOf(startSec), htf = cacheOf(htfStart);
  const [m5All, m1All, sessions] = [await ltf.candles('5m', 300, 300), await ltf.candles('1m', 60, 1500), await ltf.sessions()];
  const [h1All, h4All] = [await htf.candles('1h', 3600, 200), await htf.candles('4h', 14400, 100)];
  const offset = sec => berlinOffsetMinutes(sec * 1000), mark = rows => markIgnoredCandles(rows, sessions, offset);
  const m1Marked = mark(m1All), m5Marked = mark(m5All);
  const dataEnd = Math.min(m1All.at(-1).time + 60, Math.floor(Date.now() / 1000));
  const sourceContext = dobSourceContext({ instrument: DOB_SYMBOL, m5Candles: m5Marked,
    htfCandles: { '1h': htfObCandles(mark(h1All), sessions, offset), '4h': htfObCandles(mark(h4All), sessions, offset) } });

  // Zwei Rasterläufe wie die Statistik: ohne Retest-Pflicht (v0 = alle, v1 = mit Quelle) und mit (v2).
  const grid = { symbol: DOB_SYMBOL, m5All, m5Marked, m1Marked };
  const pass = (requireRetest, pick) => dobGridTrades(collectDobSetups(grid, { startSec, dataEnd, dobLiveWindowInput,
    checkDobTradeSetup: live => ({ setups: pick(checkDobTradeSetup({ ...live, sourceContext, sourceOptions: { requireRetest } })) }) }).setups,
    grid, dataEnd, evaluateDoubleOrderBlockOutcome);
  // Erst nach Quelle filtern, dann deduplizieren: ein Trade zählt, sobald irgendein tragendes Paar eine Quelle hat (wie der v1-Lauf).
  const passA = pass(false, r => [...r.setups.map(s => ({ ...s, sourced: true })), ...r.rejected.map(s => ({ ...s, sourced: false }))]);
  const runs = { v0: uniqueDobTrades(passA), v1: uniqueDobTrades(passA.filter(t => t.sourced)), v2: uniqueDobTrades(pass(true, r => r.setups)) };

  const berlin = (day, hhmm) => { const utc = Date.parse(`${day}T${hhmm}:00Z`) / 1000; return utc - berlinOffsetMinutes(utc * 1000) * 60; };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  // n = Win + Loss, ΣR = r·Win − Loss; outcomeOf erlaubt eine andere Ausgangsvariante desselben Trades (z. B. anderer SL/R).
  const stats = (list, outcomeOf = t => t.outcome, r = 2) => {
    const w = list.filter(t => outcomeOf(t).status === 'success').length, l = list.filter(t => outcomeOf(t).status === 'loss').length;
    return { n: w + l, win: w, loss: l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: +(r * w - l).toFixed(1), smallN: w + l < 50 };
  };
  const summary = (list, all, outcomeOf, r) => ({ ...stats(list, outcomeOf, r), share: +(list.length / all.length * 100).toFixed(1),
    halves: { 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06'), outcomeOf, r), 'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07'), outcomeOf, r) } });
  const sampleTrade = (list, [, day, at, direction]) => list.filter(t => t.direction === direction)
    .reduce((b, t) => Math.abs(t.entryTime - berlin(day, at)) <= 1800 && (!b || Math.abs(t.entryTime - berlin(day, at)) < Math.abs(b.entryTime - berlin(day, at))) ? t : b, null);
  const gitHash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim()
    + (execSync('git status --porcelain -- . ":!analysis/dob-setup"', { cwd: root }).toString().trim() ? '-dirty' : '');
  return { runs, m1All, m5All, h1All, h4All, m1Marked, dataEnd, sourceContext, evaluateDoubleOrderBlockOutcome, h1AtrAt,
    berlinDateStrFor, stats, summary, sampleTrade, gitHash };
}
