// DOB-LAB-HALTEDAUER (Philip, nur Messung): wie lange laufen Trades bis zum Ausgang beim Konfig-TP, und was bringt ein Zeitstopp
// (Schließen zum Close der letzten M1-Kerze vor der Frist): (a) 22:00 Berlin am Entry-Tag (Entry ≥ 22:00 → Folgetag), (b) 8 h, (c) 24 h.
// Träger: Philips gespeicherte Konfig (scripts/dobV3Carriers.mjs philips). Schreibt analysis/dob-setup/lab-hold-time-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobV3Lab } from './dobV3Carriers.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';
import { DOB_SYMBOL } from './dobRuns.mjs';

const H = 3600;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const [g, bt] = await Promise.all(['/src/dobGuardrails.js', '/src/berlinTime.js'].map(p => server.ssrLoadModule(p)));
  const { philips: c, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, gitHash } = await loadDobV3Lab(server, root);
  const { berlinDateStrFor, formatDatedTime, parseBerlinDatetimeInput, formatBerlinTime } = bt;
  const trades = c.trades;
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const memo = new Map();
  const full = (t, r) => { const k = `${dobTradeKey(t)}:${r}`;
    if (!memo.has(k)) memo.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction, entryTime: t.entryTime, entryPrice: t.entryPrice,
      stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd, instrument: DOB_SYMBOL, rMultiple: r }));
    return memo.get(k); };
  // Ausgang mit Zeitstopp: Fällt der normale Ausgang vor die Frist, bleibt er; sonst Close der letzten M1-Kerze, die bis zur Frist
  // geschlossen ist (Wochenende/Lücke: Close vor dem Marktschluss). ambiguous/offen hinter der Frist werden so zum Zeitstopp.
  const timed = (t, r, deadline) => {
    const o = full(t, r), R = { success: r, loss: -1 }[o.status];
    if (deadline == null || (o.recognizedAt != null && o.recognizedAt <= deadline))
      return R == null ? { st: o.status === 'ambiguous' ? 'ambiguous' : 'open' } : { st: o.status, r: R, exitAt: o.recognizedAt };
    if (deadline > dataEnd) return { st: 'open' };
    const i = lowerBound(deadline - 59) - 1, k = m1Marked[i];
    if (!k || k.time < t.entryTime) return { st: 'open' };
    const risk = Math.abs(o.targetPrice - t.entryPrice) / r;
    return { st: 'timeStop', r: (t.direction === 'long' ? 1 : -1) * (k.close - t.entryPrice) / risk, exitAt: k.time + 60 };
  };
  const deadlines = {
    'ohne Zeitstopp': () => null,
    '(a) 22:00 Berlin': t => { const late = formatBerlinTime(t.entryTime) >= '22:00';
      return parseBerlinDatetimeInput(`${berlinDateStrFor(t.entryTime + (late ? 86400 : 0))}T22:00`); },
    '(b) 8 h': t => t.entryTime + 8 * H,
    '(c) 24 h': t => t.entryTime + 24 * H,
  };
  // Teilprofit-Schema: bestes aus lab-partial-profit (50 % bei 3R, SL bleibt); TP ≤ 3R → alles beim TP.
  const result = (t, dl, partial) => {
    const tp = c.tpR(t), d = dl(t);
    if (!partial || tp <= 3) return timed(t, tp, d);
    const a = timed(t, 3, d), b = timed(t, tp, d);
    if (a.r == null || b.r == null) return { st: a.st === 'ambiguous' || b.st === 'ambiguous' ? 'ambiguous' : 'open' };
    return { st: b.st === 'timeStop' || a.st === 'timeStop' ? 'timeStop' : b.st, r: 0.5 * a.r + 0.5 * b.r };
  };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const stats = (list, dl, partial) => { const res = list.map(t => result(t, dl, partial)), closed = res.filter(x => x.r != null);
    const ts = closed.filter(x => x.st === 'timeStop'), r3 = list.map(t => timed(t, 3, dl(t))).filter(x => x.r != null);
    return { trades: list.length, closed: closed.length, ambiguous: res.filter(x => x.st === 'ambiguous').length, open: res.filter(x => x.st === 'open').length,
      sumR: +closed.reduce((s, x) => s + x.r, 0).toFixed(1), winrate3R: r3.length ? +(r3.filter(x => x.r > 0).length / r3.length * 100).toFixed(1) : null,
      timeStops: ts.length, rPerTimeStop: ts.length ? +(ts.reduce((s, x) => s + x.r, 0) / ts.length).toFixed(2) : null }; };
  const block = (dl, partial) => ({ ...stats(trades, dl, partial), 'Jan–Jun': stats(trades.filter(t => month(t) <= '2026-06'), dl, partial),
    'Jul–Nov': stats(trades.filter(t => month(t) >= '2026-07'), dl, partial) });

  // (1) Haltedauer bis zum Ausgang beim Konfig-TP (geschlossene inkl. ambiguous, Ausgang = Ende der auslösenden M1-Kerze).
  const holds = trades.map(t => ({ t, o: full(t, c.tpR(t)) })).filter(x => x.o.recognizedAt != null)
    .map(({ t, o }) => ({ t, o, h: (o.recognizedAt - t.entryTime) / H }));
  const sorted = holds.map(x => x.h).sort((a, b) => a - b), q = p => +sorted[Math.floor(p * (sorted.length - 1))].toFixed(2);
  const overWeekend = ({ t, o }) => { for (let s = t.entryTime; s < o.recognizedAt; s += H) if (new Date(berlinDateStrFor(s)).getUTCDay() === 6) return true; return false; };
  const share = f => +(holds.filter(f).length / holds.length * 100).toFixed(1);
  const windowOf = t => { if (c.statusOf.get(t) === 'dead') return 'tot 5R'; const w = g.dobEntryRule(c.cfg, t.entryTime).window;
    const clock = m => `${String(m / 60 | 0).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return w ? `${clock(w.from)}–${clock(w.to)} ${w.tpR}R` : 'Standard'; };
  const holding = { trades: holds.length, medianH: q(0.5), p75H: q(0.75), p90H: q(0.9), over8h: share(x => x.h > 8), over24h: share(x => x.h > 24),
    overWeekend: share(overWeekend),
    over24hList: holds.filter(x => x.h > 24).sort((a, b) => a.t.entryTime - b.t.entryTime).map(({ t, o, h }) => ({ entry: formatDatedTime(t.entryTime),
      direction: t.direction, window: windowOf(t), tpR: c.tpR(t), outcome: o.status, exit: formatDatedTime(o.recognizedAt), hours: +h.toFixed(1),
      weekend: overWeekend({ t, o }) })) };
  const out = { measurement: 'dob-lab-hold-time-v1', git: gitHash, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Träger: Philips gespeicherte Konfig (Kombi, Gegenkerzen nach Modus, Fenster, Monate), TP je Trade nach Konfig.',
      'Haltedauer = Entry bis Ende der M1-Kerze, die SL oder TP berührt. Wochenende = ein Berlin-Samstag liegt dazwischen.',
      'Zeitstopp: Close der letzten bis zur Frist geschlossenen M1-Kerze; Ausgang davor bleibt. Winrate 3R = Anteil mit R > 0 bei festem 3R und gleichem Zeitstopp.',
      'Mit Teilprofit: 50 % bei 3R, Rest zum Konfig-TP, beide Teile mit Original-SL und gleichem Zeitstopp (TP ≤ 3R: alles beim TP).'],
    holding, timeStops: {}, timeStopsWithPartial: {} };
  for (const [n, dl] of Object.entries(deadlines)) { out.timeStops[n] = block(dl, false); out.timeStopsWithPartial[n] = block(dl, true); }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-hold-time-xau-2026.json'), JSON.stringify(out, null, 2));
  const { over24hList, ...hs } = holding;
  console.log(hs);
  for (const x of over24hList) console.log(`  ${x.entry} ${x.direction.padEnd(5)} ${x.window.padEnd(12)} ${x.outcome.padEnd(9)} → ${x.exit} ${x.hours}h${x.weekend ? ' WE' : ''}`);
  for (const [label, set] of [['Zeitstopp', out.timeStops], ['Zeitstopp + 50 % bei 3R', out.timeStopsWithPartial]]) {
    console.log(`\n== ${label}`);
    for (const [n, s] of Object.entries(set)) console.log(`  ${n.padEnd(18)} ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR}) WR3R ${s.winrate3R}% Zeitstopps ${s.timeStops} à ${s.rPerTimeStop}R · amb ${s.ambiguous} offen ${s.open}`);
  }
} finally {
  await server.close();
}
