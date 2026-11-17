// DOB-LAB-TEILPROFIT (Philip, nur Messung): Teil bei pR schließen, Rest bis zum Konfig-TP des Trades. Liegt der Konfig-TP bei ≤ pR,
// geht alles beim Konfig-TP raus. (A) SL bleibt, (B) SL auf Entry ab der Kerze nach dem Erreichen von pR (Nachzug wie breakevenAtR).
// Träger: v3-Fill auf Philips gespeicherter Konfig (Kombi, Gegenkerzen 3 von 3, Fenster, Monate). Schreibt
// analysis/dob-setup/lab-partial-profit-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobV3Lab } from './dobV3Carriers.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';
import { DOB_SYMBOL } from './dobRuns.mjs';

const SCHEMES = [['ohne Teilprofit', null], ['50 % bei 3R (A) SL bleibt', { part: 0.5, atR: 3, be: false }],
  ['50 % bei 3R (B) SL auf Entry', { part: 0.5, atR: 3, be: true }], ['Moonbag 70 % bei 3R, Rest SL auf Entry', { part: 0.7, atR: 3, be: true }], ['33 % bei 2R (A) SL bleibt', { part: 1 / 3, atR: 2, be: false }],
  ['33 % bei 2R (B) SL auf Entry', { part: 1 / 3, atR: 2, be: true }]];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const g = await server.ssrLoadModule('/src/dobGuardrails.js');
  const { philips: c, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobV3Lab(server, root);
  const trades = c.trades;
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const memo = new Map();
  const outcome = (t, r, be = null) => { const k = `${dobTradeKey(t)}:${r}:${be}`;
    if (!memo.has(k)) memo.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction, entryTime: t.entryTime, entryPrice: t.entryPrice,
      stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd, instrument: DOB_SYMBOL, rMultiple: r, breakevenAtR: be }));
    return memo.get(k); };
  const legR = (status, r) => status === 'success' ? r : status === 'loss' ? -1 : status === 'breakeven' ? 0 : null;
  // Ergebnis je Trade: r (ΣR des Trades) oder Status ambiguous/open (wie bisher nicht in ΣR, aber gezählt).
  const result = (t, s) => {
    const tp = c.tpR(t);
    if (!s || tp <= s.atR) { const st = outcome(t, tp).status; return legR(st, tp) == null ? { st: st === 'ambiguous' ? st : 'open' } :{ r: legR(st, tp), restBe: false }; }
    const s1 = outcome(t, s.atR).status, o2 = outcome(t, tp, s.be ? s.atR : null), s2 = o2.status;
    if (s1 === 'ambiguous' || s2 === 'ambiguous') return { st: 'ambiguous' };
    if (legR(s1, s.atR) == null || legR(s2, tp) == null) return { st: 'open' };
    return { r: s.part * legR(s1, s.atR) + (1 - s.part) * legR(s2, tp), restBe: s2 === 'breakeven', restHoldH: s1 === 'success' ? (o2.recognizedAt - t.entryTime) / 3600 : null };
  };
  const median = l => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); return +s[(s.length - 1) >> 1].toFixed(2); };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const windowOf = t => { if (c.statusOf.get(t) === 'dead') return 'tote Gegen-DOBs (5R)';
    const w = g.dobEntryRule(c.cfg, t.entryTime).window; return w ? `${clock(w.from)}–${clock(w.to)} (${w.tpR}R)` : `Standard (${c.cfg.defaultTpR}R)`; };
  const stats = (list, s) => { const res = list.map(t => result(t, s)), closed = res.filter(x => x.r != null);
    const sum = closed.reduce((a, x) => a + x.r, 0);
    return { trades: list.length, closed: closed.length, ambiguous: res.filter(x => x.st === 'ambiguous').length, open: res.filter(x => x.st === 'open').length,
      sumR: +sum.toFixed(1), winrate: closed.length ? +(closed.filter(x => x.r > 0).length / closed.length * 100).toFixed(1) : null,
      restBreakeven: closed.length ? +(closed.filter(x => x.restBe).length / closed.length * 100).toFixed(1) : null,
      medianRestHoldH: median(closed.filter(x => x.restHoldH != null).map(x => x.restHoldH)) }; };
  const block = (list, s) => ({ ...stats(list, s), 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06'), s), 'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07'), s),
    windows: Object.fromEntries(Object.entries(Object.groupBy(list, windowOf)).sort().map(([k, l]) => [k, stats(l, s)])) });
  const out = { measurement: 'dob-lab-partial-profit-v1', git: gitHash, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Träger scripts/dobV3Carriers.mjs Fall (b) (Philips gespeicherte Konfig, Kombi) plus Gegenkerzen 3 von 3; TP je Trade nach Konfig.',
      'Teil bei pR, Rest zum Konfig-TP; Konfig-TP ≤ pR: alles beim Konfig-TP. (A) beide Teile mit Original-SL, (B) Rest mit SL auf Entry ab der Kerze nach dem Erreichen von pR.',
      'Winrate = Anteil geschlossener Trades mit ΣR > 0. Rest-BE = Anteil, dessen Rest auf Entry ausgestoppt wurde. Rest-Haltedauer: Entry bis Ausgang des Rests, nur Trades, die pR erreicht haben.',
      'ambiguous (SL und Ziel in derselben M1-Kerze, in einem der Teile) und offene Trades: nicht in ΣR, gezählt.'],
    schemes: Object.fromEntries(SCHEMES.map(([n, s]) => [n, block(trades, s)])) };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-partial-profit-xau-2026.json'), JSON.stringify(out, null, 2));
  const f = s => `${s.sumR}R WR ${s.winrate}% BE ${s.restBreakeven}% Rest-Median ${s.medianRestHoldH}h (${s.closed}/${s.trades}, amb ${s.ambiguous}, offen ${s.open})`;
  for (const [n, b] of Object.entries(out.schemes)) {
    console.log(`\n== ${n}: ${f(b)} · H1 ${b['Jan–Jun'].sumR} / H2 ${b['Jul–Nov'].sumR}`);
    for (const [w, s] of Object.entries(b.windows)) console.log('   ' + w.padEnd(26), f(s));
  }
} finally {
  await server.close();
}
