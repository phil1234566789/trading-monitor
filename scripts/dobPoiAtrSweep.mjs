// Messung, keine Regel: POI-Abstand OB1 ↔ nächste aktive H1/H4-OB-Zone in H1-ATR, je Instrument (XAU-Faktor 1,5 wird nicht übertragen).
// Basis = v0 (alle DOB-Setups, TP 2R). Je Schwelle k zählen die Trades, bei denen irgendein tragendes Paar eine Zone ≤ k ATR hat
// (erst filtern, dann deduplizieren, wie der v1-Lauf); einmal ohne und einmal mit Retest-Pflicht (v2). Ziele 2R/3R/5R aus dobMaxR.
// Aufruf: node scripts/dobPoiAtrSweep.mjs --instrument GBPUSD  → analysis/dob-setup/source-g-<instrument>-2026.json
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns } from './dobRuns.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';

const flag = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
const SYMBOL = flag('--instrument') ?? 'GBPUSD';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const TARGETS = [2, 3, 5];
const COARSE = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const FINE = Array.from({ length: 21 }, (_, i) => +(0.5 + i / 10).toFixed(1));

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { pass, uniqueDobTrades, m1Marked, dataEnd, berlinDateStrFor, gitHash } = await loadDobRuns(server, root, '2026-01-01', SYMBOL);
  const [{ dobMaxR }, { dobTargetOutcome }] = await Promise.all(['/src/dobMaxR.js', '/src/dobTradeStatistics.js'].map(p => server.ssrLoadModule(p)));
  const all = r => [...r.setups, ...r.rejected];
  const carriers = { ohneRetest: pass(false, all), mitRetest: pass(true, all) };
  const base = uniqueDobTrades(carriers.ohneRetest);

  // max_r je einmaligem Trade einmal rechnen; dobTargetOutcome liest dieselben Felder wie die Statistikseite.
  const rowOf = new Map(base.map(t => {
    const { maxR, slHit, ambiguousR } = dobMaxR(t, { candles: m1Marked, dataEnd, instrument: SYMBOL });
    return [dobTradeKey(t), { max_r: maxR, sl_hit: slHit, ambiguous_r: ambiguousR, outcome: t.outcome.status }];
  }));
  const weekOf = t => { const [y, m, d] = berlinDateStrFor(t.entryTime).split('-').map(Number); return Math.floor((Date.UTC(y, m - 1, d) / 86400000 + 3) / 7); };
  const stats = (list, k) => {
    const out = list.map(t => dobTargetOutcome(rowOf.get(dobTradeKey(t)), k));
    const w = out.filter(o => o === 'success').length, l = out.filter(o => o === 'loss').length;
    return { n: w + l, win: w, loss: l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: +(k * w - l).toFixed(1) };
  };
  const half = t => berlinDateStrFor(t.entryTime).slice(5, 7) <= '06' ? 'Jan–Jun' : 'Jul–Dez';
  const summary = list => {
    const weeks = list.length ? Math.max(...list.map(weekOf)) - Math.min(...list.map(weekOf)) + 1 : 0;
    return { trades: list.length, perWeek: weeks ? +(list.length / weeks).toFixed(1) : null,
      ...Object.fromEntries(TARGETS.map(k => [`${k}R`, { ...stats(list, k),
        halves: Object.fromEntries(['Jan–Jun', 'Jul–Dez'].map(h => [h, stats(list.filter(t => half(t) === h), k)])) }])) };
  };
  const within = (list, k) => uniqueDobTrades(list.filter(t => t.poi?.distanceAtr != null && t.poi.distanceAtr <= k));
  const sweep = (list, ks) => ks.map(k => ({ k, ...summary(within(list, k)) }));

  const report = { measurement: 'dob-poi-atr-sweep-v1', instrument: SYMBOL, git: gitHash, dataEnd: berlinDateStrFor(dataEnd),
    methodology: ['Basis v0: jedes DOB-Setup im Raster (jeder M5-Schluss, Live-Fenster), einmalig nach Richtung/Entry/SL.',
      'POI: nächste aktive H1/H4-OB-Zone in Trade-Richtung (dobHtfObPoi.js), Abstand in H1-ATR(14) zum OB1-Start.',
      'Schwelle k: Trade zählt, wenn ein tragendes Paar eine Zone ≤ k ATR hat; mitRetest = Zone vor OB1 retestet (v2).',
      'Ziele 2R/3R/5R über dobMaxR/dobTargetOutcome (gleiche Rechnung wie /dob-statistik); Halbjahre nach Berliner Entry-Datum.'],
    base: summary(base),
    ...Object.fromEntries(Object.entries(carriers).map(([name, list]) => [name, { coarse: sweep(list, COARSE), fine: sweep(list, FINE) }])) };
  const file = path.join(root, 'analysis', 'dob-setup', `source-g-${SYMBOL.toLowerCase()}-2026.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  const line = r => `${String(r.k ?? 'Basis').padStart(5)} · n ${String(r.trades).padStart(4)} · ${r.perWeek}/Wo · `
    + TARGETS.map(k => { const s = r[`${k}R`]; return `${k}R ${s.winrate}% ${s.sumR >= 0 ? '+' : ''}${s.sumR} (H1 ${s.halves['Jan–Jun'].sumR} / H2 ${s.halves['Jul–Dez'].sumR})`; }).join(' · ');
  console.log(`${SYMBOL} bis ${report.dataEnd}\nBasis: ${line(report.base)}`);
  for (const name of Object.keys(carriers)) { console.log(`\n${name}`); for (const r of [...report[name].coarse, ...report[name].fine]) console.log(line(r)); }
  console.log(`\n→ ${path.relative(root, file)}`);
} finally {
  await server.close();
}
