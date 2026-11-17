// DOB-LAB-TAGESLIMIT (Philip, Challenge-Konto, nur Messung): (A) Tageslimit nach k Losses bzw. −xR am Berlin-Tag, (B) Serienpause nach
// k Losses in Folge bis zum ersten Papier-Win. Kausal über Ausstiegszeiten: ein Trade zählt fürs Limit erst, wenn er vor dem nächsten
// Entry geschlossen ist. Träger wie lab-drawdown (scripts/dobConfigTrades.mjs). Schreibt analysis/dob-setup/lab-day-limit-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';
import { loadDobConfigTrades } from './dobConfigTrades.mjs';
import { dobCandleCache } from './dobCandleCache.mjs';

// IQCapital-Challenge: 50k Start, höchstens 3.000 $ Gesamtverlust; Risiko so, dass Max-DD × 1,2 darunter bleibt.
const ACCOUNT = 50_000, MAX_LOSS = 3_000, BUFFER = 1.2, RISK_PCT = 0.5;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { supabase, cfg, allowed, g, pp, bt } = await loadDobConfigTrades(server);
  const [{ fetchInitialCandles }, { evaluateDoubleOrderBlockOutcome }, { markIgnoredCandles }, { dobChartLink }, { DOB_SITE_URL }] = await Promise.all(
    ['/src/forexCandles.js', '/src/doubleOrderBlockOutcome.js', '/src/sessionOccurrences.js', '/src/dobTradeStatistics.js', '/src/dobAlarm.js'].map(p => server.ssrLoadModule(p)));
  const startSec = bt.berlinDayRangeUtcMs('2026-01-01').startUtcMs / 1000;
  const cache = dobCandleCache({ outDir: path.join(root, '.debug', 'dob-setup'), symbol: 'XAUUSD', refresh: false, defaultStartSec: startSec, startSec, fetchInitialCandles, supabase });
  const sessionsRaw = await cache.sessions(), offset = s => bt.berlinOffsetMinutes(s * 1000);
  const m1 = markIgnoredCandles(await cache.candles('1m', 60, 1500), sessionsRaw, offset), dataEnd = m1.at(-1).time + 60;
  const lowerBound = t => { let lo = 0, hi = m1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const when = s => bt.formatDatedTime(s), r1 = v => Math.round(v * 10) / 10, day = s => bt.berlinDateStrFor(s);
  const chartUrl = row => { const l = dobChartLink(row); return `${DOB_SITE_URL}#${l.path}?${new URLSearchParams(l.query)}`; };
  // Ausstieg des ganzen Trades nach Konfig (Rest bei Teilprofit, sonst Ziel/SL): dieselbe Ausgangslogik wie max_r.
  const trades = allowed.map(row => {
    const score = pp.dobRowConfigScore(cfg, row);
    if (score.r == null) return null;
    const plan = g.dobPartialPlan(cfg, score.target);
    const o = evaluateDoubleOrderBlockOutcome({ direction: row.direction, entryTime: row.entry_time, entryPrice: row.entry_price, stopPrice: row.stop_price,
      candles: m1.slice(lowerBound(row.entry_time)), evaluatedAt: dataEnd, instrument: 'XAUUSD', rMultiple: score.target, breakevenAtR: plan?.be ? plan.atR : null });
    return { row, r: score.r, exit: o.recognizedAt ?? row.exit_time ?? Infinity, day: day(row.entry_time) };
  }).filter(Boolean);
  if (trades.length !== 234) console.warn(`Achtung: ${trades.length} geschlossene Trades statt 234`);

  // Kennzahlen der behaltenen Trades (Entry-Reihenfolge wie lab-drawdown).
  const summarize = kept => {
    let eq = 0, peak = 0, dd = 0, streak = 0, longest = 0;
    for (const t of kept) { eq += t.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); streak = t.r < 0 ? streak + 1 : 0; longest = Math.max(longest, streak); }
    const days = [...Map.groupBy(kept, t => t.day)].map(([d, l]) => ({ day: d, sumR: r1(l.reduce((a, t) => a + t.r, 0)) })).sort((a, b) => a.sumR - b.sumR);
    const half = h => r1(kept.filter(t => (t.day.slice(5, 7) <= '06') === (h === 1)).reduce((a, t) => a + t.r, 0));
    const riskUsd = dd ? MAX_LOSS / (BUFFER * dd) : null, usd = ACCOUNT * RISK_PCT / 100;
    return { kept: kept.length, sumR: r1(eq), h1: half(1), h2: half(2), maxDdR: r1(dd), longestStreak: longest, worstDay: days[0] ?? null,
      money: { riskPerTradeUsd: riskUsd && Math.floor(riskUsd), riskPerTradePct: riskUsd && +(riskUsd / ACCOUNT * 100).toFixed(2),
        at05pct: { resultUsd: Math.round(eq * usd), maxDdUsd: Math.round(dd * usd), worstDayUsd: Math.round((days[0]?.sumR ?? 0) * usd), floorHit: dd * usd >= MAX_LOSS } } };
  };
  // (A) Tageslimit: Entry entfällt, sobald am selben Tag k Losses bzw. ≤ −xR geschlossen sind (Ausstieg ≤ Entry).
  const dayLimit = blocked => {
    const kept = [], days = [];
    for (const [d, list] of Map.groupBy(trades, t => t.day)) {
      const taken = [], dropped = [];
      for (const t of list) { const closed = taken.filter(x => x.exit <= t.row.entry_time); (blocked(closed) ? dropped : taken).push(t); }
      kept.push(...taken);
      if (dropped.length) days.push({ day: d, before: taken.length, after: dropped.length,
        dropped: dropped.map(t => ({ entry: bt.formatBerlinTime(t.row.entry_time), direction: t.row.direction, r: t.r })),
        cutWinners: dropped.filter(t => t.r > 0).map(t => `${bt.formatBerlinTime(t.row.entry_time)} +${t.r}R`),
        savedLosses: dropped.filter(t => t.r < 0).length, netEffectR: r1(-dropped.reduce((a, t) => a + t.r, 0)), chart: chartUrl(dropped[0].row) });
    }
    return { ...summarize(kept.sort((a, b) => a.row.entry_time - b.row.entry_time)), daysTriggered: days.length, days };
  };
  // (B) Serienpause: nach k geschlossenen Losses in Folge (Ausstiegsreihenfolge) pausieren; der erste Papier-Win nach Pausenbeginn zählt
  // nicht, Entries ab seinem Ausstieg wieder.
  const seriesPause = k => {
    const kept = [], skipped = [];
    let streak = 0, pausedSince = null, resumeAt = null;
    const closedTaken = [];
    for (const t of trades) {
      // Ausstiege bis zu diesem Entry abarbeiten.
      for (const x of closedTaken.filter(x => !x.done && x.exit <= t.row.entry_time).sort((a, b) => a.exit - b.exit)) {
        x.done = true; streak = x.r < 0 ? streak + 1 : 0;
        if (streak >= k && pausedSince == null) { pausedSince = x.exit; resumeAt = null; }
      }
      if (pausedSince != null && resumeAt == null) {
        // Erster Papier-Win = der zuerst geschlossene Win, der nach Pausenbeginn eröffnet wurde.
        const wins = trades.filter(p => p.row.entry_time >= pausedSince && p.r > 0 && p.exit <= t.row.entry_time);
        if (wins.length) resumeAt = Math.min(...wins.map(p => p.exit));
      }
      if (pausedSince != null && (resumeAt == null || t.row.entry_time < resumeAt)) { skipped.push(t); continue; }
      if (pausedSince != null) { pausedSince = null; streak = 0; }
      kept.push(t); closedTaken.push(t);
    }
    return { ...summarize(kept), skipped: skipped.length, skippedWins: skipped.filter(t => t.r > 0).length, skippedR: r1(skipped.reduce((a, t) => a + t.r, 0)) };
  };
  const out = { measurement: 'dob-lab-day-limit-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), config: g.dobGuardrailsSummary(cfg),
    account: { start: ACCOUNT, maxLoss: MAX_LOSS, buffer: BUFFER, riskPct: RISK_PCT },
    methodology: ['Träger wie lab-drawdown: v3 aus der DB, Philips gespeicherte Konfig inkl. Teilprofit, R je Trade aus dobRowConfigScore; offene fehlen.',
      'Ausstieg je Trade = Ende der M1-Kerze, die den Rest (Ziel, BE) bzw. den SL trifft; ein Trade zählt fürs Limit nur, wenn er vor dem nächsten Entry geschlossen ist.',
      'Tag = Berliner Entry-Datum. Serienpause: Serie in Ausstiegsreihenfolge, erster Papier-Win nach Pausenbeginn zählt nicht, Entries ab dessen Ausstieg.',
      `Risiko je Trade = ${MAX_LOSS} $ / (${BUFFER} × Max-DD R); $-Ergebnis bei ${RISK_PCT} % = ${ACCOUNT * RISK_PCT / 100} $ je R.`],
    variants: { base: summarize(trades),
      'A: nach 2 Losses': dayLimit(c => c.filter(x => x.r < 0).length >= 2), 'A: nach 3 Losses': dayLimit(c => c.filter(x => x.r < 0).length >= 3),
      'A: nach −2R': dayLimit(c => c.reduce((a, x) => a + x.r, 0) <= -2), 'A: nach −3R': dayLimit(c => c.reduce((a, x) => a + x.r, 0) <= -3),
      'B: Pause nach 3': seriesPause(3), 'B: Pause nach 4': seriesPause(4), 'B: Pause nach 5': seriesPause(5) } };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-day-limit-xau-2026.json'), JSON.stringify(out, null, 2));
  for (const [n, v] of Object.entries(out.variants)) {
    console.log(`${n.padEnd(20)} ${v.kept} T ${v.sumR}R (${v.h1}/${v.h2}) DD ${v.maxDdR}R Serie ${v.longestStreak} Tag ${v.worstDay?.day} ${v.worstDay?.sumR}R · Risiko ${v.money.riskPerTradeUsd}$ (${v.money.riskPerTradePct}%) · 0,5%: ${v.money.at05pct.resultUsd}$ DD ${v.money.at05pct.maxDdUsd}$${v.daysTriggered != null ? ` · Tage ${v.daysTriggered}, Winner abgeschnitten an ${v.days.filter(d => d.cutWinners.length).length}` : ` · übersprungen ${v.skipped} (Wins ${v.skippedWins}, ${v.skippedR}R)`}`);
  }
  for (const [n, v] of Object.entries(out.variants).filter(([, v]) => v.days)) {
    console.log(`
-- ${n}`);
    for (const d of v.days) console.log(`  ${d.day} vorher ${d.before} nachher ${d.after}: ${d.dropped.map(x => `${x.entry} ${x.r > 0 ? '+' : ''}${x.r}`).join(', ')}${d.cutWinners.length ? '  ⚠ Winner: ' + d.cutWinners.join(', ') : ''} · ${d.chart}`);
  }
} finally {
  await server.close();
}
