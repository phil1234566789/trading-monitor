// DOB-LAB-DRAWDOWN (Philip, Funded-/Challenge-Konto, nur Messung): Verlustserien, Max Drawdown, Tagesverluste und Muster der Serien.
// Träger: Lauf dob-setup-v3 aus der DB mit Philips gespeicherter Konfig, R je Trade aus dobRowConfigScore (mit und ohne Teilprofit),
// chronologisch nach Entry, offene/unklare Trades zählen nicht. 1 % Risiko linear (feste Kontobasis, wie bei Prop-Firmen üblich).
// Schreibt analysis/dob-setup/lab-drawdown-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'vite';

const RUN = 'dob-setup-v3', MIN_STREAK = 4;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const L = p => server.ssrLoadModule(p);
  const [{ supabase }, g, pp, st, bt, db] = await Promise.all(['/src/supabaseClient.js', '/src/dobGuardrails.js', '/src/dobPartialProfit.js',
    '/src/dobTradeStatistics.js', '/src/berlinTime.js', '/src/dbReadPaging.js'].map(L));
  const { data: cfgRow, error } = await supabase.from('dob_guardrails').select('*').eq('instrument', 'XAUUSD').single();
  if (error) throw error;
  const cfg = g.dobGuardrailsFromRow(cfgRow);
  const { data: rows, error: rowsError } = await db.fetchAllRows((from, to) => supabase.from('dob_trade_setups').select('*').eq('instrument', 'XAUUSD').eq('run_id', RUN).order('id').range(from, to));
  if (rowsError) throw rowsError;
  const { data: sessions } = await supabase.from('sessions').select('label,from_minutes,to_minutes,days').eq('instrument', 'XAUUSD').limit(200);
  const allowed = [...new Map(rows.filter(r => !g.dobRowGuardrailReason(cfg, r)).map(r => [st.dobTradePinKey(r), r])).values()]
    .sort((a, b) => a.entry_time - b.entry_time);
  const when = s => bt.formatDatedTime(s), r1 = v => Math.round(v * 10) / 10;
  const ideaOf = r => `${r.direction}:${r.source_kind}:${r.source_zone_start}:${r.source_zone_bottom}:${r.source_zone_top}`;

  const measure = config => {
    const trades = allowed.map(r => ({ row: r, r: pp.dobRowConfigScore(config, r).r })).filter(t => t.r != null);
    // (1) Serien: aufeinanderfolgende Trades mit R < 0.
    const streaks = []; let cur = [];
    for (const t of [...trades, { r: 0 }]) { if (t.r < 0) cur.push(t); else { if (cur.length) streaks.push(cur); cur = []; } }
    const lengths = Object.fromEntries([...Map.groupBy(streaks, s => s.length)].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v.length]));
    const long = streaks.filter(s => s.length >= MIN_STREAK).map(s => ({ from: when(s[0].row.entry_time), to: when(s.at(-1).row.entry_time), n: s.length,
      sumR: r1(s.reduce((a, t) => a + t.r, 0)), trades: s.map(t => ({ entry: when(t.row.entry_time), direction: t.row.direction, r: t.r,
        sessions: st.dobTradeSessions(t.row, sessions), counterDob: t.row.counter_dob_status, idea: ideaOf(t.row), tpR: g.dobRowConfigTpR(config, t.row) })) }));
    // (2) Drawdown-Phasen: Peak bis Tal, Phase endet mit neuem Hoch (oder Datenende).
    let eq = 0, peak = 0, peakAt = null, phase = null; const phases = [];
    for (const t of trades) {
      eq += t.r;
      if (eq >= peak) { if (phase) phases.push(phase); phase = null; peak = eq; peakAt = t.row.entry_time; continue; }
      const dd = peak - eq;
      if (!phase) phase = { peakAt, dd: 0, troughAt: null, n: 0 };
      phase.n++;
      if (dd > phase.dd) { phase.dd = dd; phase.troughAt = t.row.entry_time; }
    }
    if (phase) phases.push({ ...phase, open: true });
    const top = phases.sort((a, b) => b.dd - a.dd).slice(0, 5).map(p => ({ ddR: r1(p.dd), from: p.peakAt ? when(p.peakAt) : 'Start', trough: when(p.troughAt),
      tradesInPhase: p.n, recovered: !p.open }));
    // (3) Tage nach Berliner Entry-Datum.
    const days = [...Map.groupBy(trades, t => bt.berlinDateStrFor(t.row.entry_time))].map(([day, l]) => ({ day, n: l.length, sumR: r1(l.reduce((a, t) => a + t.r, 0)) }));
    const worstDays = [...days].sort((a, b) => a.sumR - b.sumR).slice(0, 10);
    // (5) Muster: Anteile in Serien ≥ 4 gegen alle Trades.
    const inLong = long.flatMap(s => s.trades), share = (list, f) => +(list.filter(f).length / list.length * 100).toFixed(1);
    const dist = (list, key) => Object.fromEntries([...Map.groupBy(list, key)].map(([k, l]) => [k, l.length]).sort((a, b) => b[1] - a[1]));
    const allT = trades.map(t => ({ entry: when(t.row.entry_time), direction: t.row.direction, sessions: st.dobTradeSessions(t.row, sessions), counterDob: t.row.counter_dob_status, idea: ideaOf(t.row) }));
    const patterns = { tradesInStreaks: inLong.length,
      month: { streaks: dist(inLong, t => t.entry.slice(0, 7)), all: dist(allT, t => t.entry.slice(0, 7)) },
      direction: { streaksShortPct: share(inLong, t => t.direction === 'short'), allShortPct: share(allT, t => t.direction === 'short') },
      deadCounterDob: { streaksPct: share(inLong, t => t.counterDob === 'dead'), allPct: share(allT, t => t.counterDob === 'dead') },
      session: { streaks: dist(inLong.flatMap(t => t.sessions.length ? t.sessions : ['ohne Session']), x => x), all: dist(allT.flatMap(t => t.sessions.length ? t.sessions : ['ohne Session']), x => x) },
      sameIdea: long.map(s => ({ from: s.from, n: s.n, distinctIdeas: new Set(s.trades.map(t => t.idea)).size, sameDirection: new Set(s.trades.map(t => t.direction)).size === 1 })) };
    const sumR = r1(trades.reduce((a, t) => a + t.r, 0));
    return { trades: trades.length, sumR, streakLengths: lengths, longestStreak: Math.max(...streaks.map(s => s.length)), streaksFrom4: long,
      maxDrawdownR: top[0]?.ddR ?? 0, topDrawdowns: top, worstDays, daysLeMinus3R: days.filter(d => d.sumR <= -3).length, daysLeMinus5R: days.filter(d => d.sumR <= -5).length,
      tradingDays: days.length, at1pctRisk: { maxDrawdownPct: top[0]?.ddR ?? 0, worstDayPct: worstDays[0]?.sumR ?? 0, totalPct: sumR }, patterns };
  };
  const out = { measurement: 'dob-lab-drawdown-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), run: RUN, config: g.dobGuardrailsSummary(cfg),
    methodology: ['Lauf dob-setup-v3 (DB), Philips gespeicherte Konfig (Sperren, Fenster-TP, tot → 5R, Gegenkerzen), eindeutige Trades, sortiert nach Entry.',
      'R je Trade aus dobRowConfigScore (src/dobPartialProfit.js); offene/unklare Trades fehlen. Serie = aufeinanderfolgende Trades mit R < 0.',
      'Drawdown = Peak bis Tal der R-Equity nach Entry-Reihenfolge; Tage nach Berliner Entry-Datum. 1 % Risiko linear: 1R = 1 % der Startbasis.'],
    withPartial: measure(cfg), withoutPartial: measure({ ...cfg, partialAtR: null }) };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-drawdown-xau-2026.json'), JSON.stringify(out, null, 2));
  for (const [name, m] of [['MIT Teilprofit', out.withPartial], ['OHNE Teilprofit', out.withoutPartial]]) {
    const { patterns, streaksFrom4, ...rest } = m;
    console.log(`\n== ${name}`, JSON.stringify(rest, null, 1));
    for (const s of streaksFrom4) console.log(`  Serie ${s.n}: ${s.from} → ${s.to} ${s.sumR}R`, s.trades.map(t => `${t.direction[0]}${t.counterDob === 'dead' ? '†' : ''}`).join(''));
    console.log('  Muster', JSON.stringify(patterns));
  }
} finally {
  await server.close();
}
