// Labor DOB-PA (Philip): kurzfristige Price Action vor dem Entry. Letzte 1/3/5 geschlossene M5-Kerzen vor dem Entry, Muster aus
// src/candlePatterns.js. Gegenmuster = Muster gegen die Trade-Richtung (Hammer/Morning Star vor Short, gespiegelt vor Long).
// Nur Messung. Schreibt analysis/dob-setup/lab-price-action-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobV3Lab } from './dobV3Carriers.mjs';

const WINDOWS = [1, 3, 5];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { candlePatternsIn, candleDirection } = await server.ssrLoadModule('/src/candlePatterns.js');
  const { cases, block, fmt, m5Marked, dataEnd, berlinDateStrFor, gitHash } = await loadDobV3Lab(server, root);
  const lowerBound = t => { let lo = 0, hi = m5Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m5Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  // Letzte n M5-Kerzen, die vor dem Entry geschlossen sind (Session-ignorierte zählen mit: echte Preise).
  const lastClosed = (t, n) => { const end = lowerBound(t.entryTime - 300 + 1); return m5Marked.slice(Math.max(0, end - n), end).filter(c => c.time + 300 <= t.entryTime); };
  const featuresOf = (t, n) => {
    const candles = lastClosed(t, n), against = t.direction === 'short' ? 'bull' : 'bear', withSide = against === 'bull' ? 'bear' : 'bull';
    const patterns = candlePatternsIn(candles);
    return { counterPattern: patterns.some(p => p.side === against), withPattern: patterns.some(p => p.side === withSide),
      counterCandles: candles.filter(c => candleDirection(c) === against).length, patterns };
  };
  const result = { measurement: 'dob-lab-price-action-v1', git: gitHash, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Träger: scripts/dobV3Carriers.mjs (v3-Fill-Träger, Kombi; (a) ohne, (b) mit Philips Sperren), Ausgang zu 3R, 5R und TP nach Konfig.',
      'Fenster: letzte 1/3/5 M5-Kerzen, die vor dem Entry geschlossen sind. Hammer je Kerze, Morning/Evening Star nur vollständig im Fenster.',
      'Hammer: Körper ≤ 1/3 der Range, langer Docht ≥ 60 %, Gegendocht ≤ 25 %; Farbe egal (Philips Beispiele 28.08.). bull = unterer, bear = oberer Docht.',
      'Gegenmuster = Musterseite gegen die Trade-Richtung; Gegenkerzen = Kerzen mit Farbe gegen die Trade-Richtung.',
      'Regel „Gegenmuster im Fenster → sperren“: übrige Trades zum TP nach Konfig.'],
    carriers: {} };
  for (const c of cases) {
    const out = { trades: c.trades.length, konfig: block(c.trades, c.tpR), windows: {} };
    for (const n of WINDOWS) {
      const f = t => featuresOf(t, n), rates = l => ({ r3: block(l, () => 3), r5: block(l, () => 5), konfig: block(l, c.tpR) });
      const by = key => Object.fromEntries(Object.entries(Object.groupBy(c.trades, t => String(key(f(t))))).sort().map(([k, l]) => [k, rates(l)]));
      out.windows[n] = { counterPattern: by(x => x.counterPattern), withPattern: by(x => x.withPattern),
        counterCandles: by(x => x.counterCandles >= 3 ? '3+' : x.counterCandles),
        blockCounterPattern: block(c.trades.filter(t => !f(t).counterPattern), c.tpR) };
    }
    result.carriers[c.name] = out;
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-price-action-xau-2026.json'), JSON.stringify(result, null, 2));
  for (const [cName, out] of Object.entries(result.carriers)) {
    console.log(`\n== ${cName}: ${out.trades} · Konfig ${fmt(out.konfig)}`);
    for (const [n, w] of Object.entries(out.windows)) {
      console.log(`-- ${n} Kerze(n): Regel Gegenmuster sperren ${fmt(w.blockCounterPattern)}`);
      for (const feat of ['counterPattern', 'withPattern', 'counterCandles'])
        for (const [k, s] of Object.entries(w[feat])) console.log(`   ${feat}=${k}`.padEnd(24), '3R', fmt(s.r3), '| 5R', fmt(s.r5), '| Kfg', fmt(s.konfig));
    }
  }
} finally {
  await server.close();
}
