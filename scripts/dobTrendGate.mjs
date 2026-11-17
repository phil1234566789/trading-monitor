// Messung DOB-Setup v3 (Experiment): v2 mit und ohne M5-Strukturtrend-Anti-Gate (innerster Trend, 24 h, zur OB2-Retest-Zeit).
// Das Gate entscheidet je tragendem DOB-Paar, danach Dedup wie die Statistik (ein Trade bleibt, sobald ein Paar das Gate passiert).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';

// Philips dob_trade-Pins zum Trend (Schlüssel wie dob_trade_key: Richtung:Entry-Zeit:Entry:SL).
const PINS = { 513: ['long:1794560580:3898.43:3892.22', 'negativ'], 516: ['long:1794296280:4115.63:4110.82', 'negativ'],
  517: ['short:1774363080:4405.23:4427.08', 'negativ'], 518: ['short:1794460380:3974.06:3983.27', 'positiv'],
  519: ['long:1787570040:4642.9:4639.05', 'positiv'], 520: ['short:1786359300:4338.16:4340.66', 'positiv'] };
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { createDobM5TrendGate } = await server.ssrLoadModule('/src/dobM5Trend.js');
  const { runs, v2Carriers, uniqueDobTrades, m5Marked, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, summary, gitHash }
    = await loadDobRuns(server, root);
  // Laufzeit wie live: jeder Gate-Aufruf mit leerem Cache (live rechnet je M5-Schluss neu).
  const timings = [];
  const gated = v2Carriers.map(t => {
    const gate = createDobM5TrendGate(m5Marked), t0 = performance.now(), g = gate(t);
    timings.push(performance.now() - t0);
    return { ...t, m5Trend: g };
  });
  const keyOf = t => `${t.direction}:${t.entryTime}:${t.entryPrice}:${t.stopPrice}`;
  const variants = {
    'v2 ohne Gate': runs.v2,
    'v3 Gate, unknown durchlassen': uniqueDobTrades(gated.filter(t => t.m5Trend.verdict !== 'against')),
    'v3 Gate, unknown blocken': uniqueDobTrades(gated.filter(t => t.m5Trend.verdict === 'with')),
    'nur gegen den Trend (verworfen)': uniqueDobTrades(gated.filter(t => t.m5Trend.verdict === 'against')),
    'nur unknown': uniqueDobTrades(gated.filter(t => t.m5Trend.verdict === 'unknown')),
  };
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const r3 = new Map();
  const outcome3 = t => { const k = keyOf(t); if (!r3.has(k)) r3.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction, entryTime: t.entryTime,
    entryPrice: t.entryPrice, stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd, instrument: SYMBOL, rMultiple: 3 })); return r3.get(k); };
  const base = runs.v2;
  const sorted = [...timings].sort((a, b) => a - b), q = f => +sorted[Math.floor(f * (sorted.length - 1))].toFixed(1);
  const result = { measurement: 'dob-m5-trend-gate-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Trades: v2 wie der Statistiklauf (dobRuns.mjs). Gate je tragendem Paar, dann Dedup Richtung/Entry/SL wie die Statistik.',
      'Trend: dobM5Trend = unveränderter Trend-Algo wie der Chart (Perioden 5/2, ignorierte Kerzen raus, Close-Auswertung), innerster Trend, Pivots ab 24 h vor der OB2-Retest-Zeit, nur geschlossene Kerzen.',
      'Gegen den Trend: Short im uptrend, Long im downtrend. unknown: Variante durchlassen bzw. blocken.',
      '2R = Ausgang des Laufs; 3R = evaluateDoubleOrderBlockOutcome mit rMultiple 3, gleicher SL. n = Win + Loss, Halbjahre nach Berliner Entry-Monat.',
      'Laufzeit: ein Gate-Aufruf ohne Cache (so oft rechnet der Watcher höchstens je M5-Schluss und Kandidat).'],
    gateRuntimeMs: { median: q(0.5), p95: q(0.95), max: q(1), calls: timings.length },
    verdictCounts: Object.fromEntries(['with', 'against', 'unknown'].map(v => [v, uniqueDobTrades(gated.filter(t => t.m5Trend.verdict === v)).length])),
    variants: Object.fromEntries(Object.entries(variants).map(([name, list]) => [name, { r2: summary(list, base), r3: summary(list, base, outcome3, 3) }])),
    pins: Object.fromEntries(Object.entries(PINS).map(([pin, [key, expected]]) => {
      const carriers = gated.filter(t => keyOf(t) === key);
      return [pin, { expected, found: carriers.length > 0, trends: [...new Set(carriers.map(t => t.m5Trend.trend))],
        keptWithUnknownPass: carriers.some(t => t.m5Trend.verdict !== 'against'), keptWithUnknownBlock: carriers.some(t => t.m5Trend.verdict === 'with') }];
    })) };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'm5-trend-gate-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s.halves['Jan–Jun'].winrate}/${s.halves['Jul–Nov'].winrate}) ${s.share}%`;
  console.log('Gate-Laufzeit', JSON.stringify(result.gateRuntimeMs), 'Urteile', JSON.stringify(result.verdictCounts));
  for (const [name, v] of Object.entries(result.variants)) console.log(name.padEnd(34), '2R', f(v.r2), '| 3R', f(v.r3));
  console.log('Pins', JSON.stringify(result.pins));
} finally {
  await server.close();
}
