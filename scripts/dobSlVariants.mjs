// Messung DOB-SL-VARIANTEN (noch keine Regel): Wo die heutige Regel den SL ans Retest-Extrem legt (keine interne FVG offen),
// gegen den weiten SL an der fernen M5-Kante von OB2. Entry bleibt, Ziel = Entry ± R·Risiko je Variante.
// Ausgang ausschließlich über evaluateDoubleOrderBlockOutcome (rMultiple). Nur Messung, schreibt nicht in die Statistikläufe.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL, DOB_OB_SAMPLES as SAMPLES } from './dobRuns.mjs';

const R_TARGETS = [2, 2.5, 3, 4, 5];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { runs, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, summary, sampleTrade, gitHash } = await loadDobRuns(server, root);
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  // Ab dem Entry reicht für den Ausgang; spart das Kopieren der ganzen M1-Historie je Aufruf.
  const fromEntry = new Map();
  const candlesFrom = t => { if (!fromEntry.has(t.entryTime)) fromEntry.set(t.entryTime, m1Marked.slice(lowerBound(t.entryTime))); return fromEntry.get(t.entryTime); };
  const outcomes = new Map();
  const outcome = (t, variant, r) => {
    const key = `${t.id}:${t.entryTime}:${variant}:${r}`;
    if (!outcomes.has(key)) outcomes.set(key, evaluateDoubleOrderBlockOutcome({ direction: t.direction, entryTime: t.entryTime, entryPrice: t.entryPrice,
      stopPrice: stopOf(t, variant), candles: candlesFrom(t), evaluatedAt: dataEnd, instrument: SYMBOL, rMultiple: r }));
    return outcomes.get(key);
  };
  // Ferne M5-Kante = Kante von OB2 auf der Seite, die der Preis nicht unterschreiten soll (Long unten, Short oben).
  const farEdge = t => t.direction === 'long' ? t.chart.secondOrderBlock.bottom : t.chart.secondOrderBlock.top;
  // 'extreme' und 'heute' nehmen den SL des Indikators, nur 'm5Edge' ersetzt ihn.
  const stopOf = (t, variant) => variant === 'm5Edge' ? farEdge(t) : t.stopPrice;
  const risk = (t, variant) => Math.abs(t.entryPrice - stopOf(t, variant));
  const median = values => { const v = [...values].sort((a, b) => a - b); return v.length ? +v[v.length >> 1].toFixed(2) : null; };

  const result = { measurement: 'dob-sl-varianten-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd), rTargets: R_TARGETS,
    methodology: ['Trades: einmalige Trades der Statistikläufe v1/v2 (dobRuns.mjs = dobSetupGrid, Dedup Richtung/Entry/SL).',
      'Teilmenge: stopAnchor = retestExtreme (heutige Regel, keine interne FVG offen). Vergleich SL Retest-Extrem (heute) gegen SL ferne M5-Kante von OB2 (Long Unterkante, Short Oberkante).',
      'Entry unverändert; Ziel = Entry ± R·Risiko der jeweiligen Variante; Ausgang evaluateDoubleOrderBlockOutcome mit rMultiple bis Datenende.',
      'n = Win + Loss; ΣR = R·Win − Loss; Halbjahre nach Berliner Entry-Monat; Risiko = |Entry − SL| in USD.',
      'Kreuzvergleich je R: weit überlebt, eng gestoppt = enge Variante Loss und weite Variante Win (und umgekehrt), Anteil an der Teilmenge.',
      'Gesamtbild: alle Trades des Laufs, heutige Regel gegen „immer M5-Kante“ (bei Trades mit SL an der M5-Kante ändert sich nichts).'],
    runs: {} };

  for (const run of ['v1', 'v2']) {
    const all = runs[run], subset = all.filter(t => t.stopAnchor === 'retestExtreme');
    const out = { trades: all.length, extremeTrades: subset.length, m5EdgeTrades: all.filter(t => t.stopAnchor === 'm5-edge').length,
      medianRiskUsd: { extreme: median(subset.map(t => risk(t, 'extreme'))), m5Edge: median(subset.map(t => risk(t, 'm5Edge'))) }, byR: {}, overall: {} };
    for (const r of R_TARGETS) {
      const of = variant => t => outcome(t, variant, r);
      const cross = (a, b) => subset.filter(t => of(a)(t).status === 'loss' && of(b)(t).status === 'success').length;
      out.byR[r] = { extreme: summary(subset, subset, of('extreme'), r), m5Edge: summary(subset, subset, of('m5Edge'), r),
        weitUeberlebtEngGestoppt: { n: cross('extreme', 'm5Edge'), share: +(cross('extreme', 'm5Edge') / subset.length * 100).toFixed(1) },
        engUeberlebtWeitGestoppt: { n: cross('m5Edge', 'extreme'), share: +(cross('m5Edge', 'extreme') / subset.length * 100).toFixed(1) } };
      // Heutige Regel = jeder Trade mit seinem Indikator-SL; „immer M5-Kante“ ersetzt nur die Extrem-SLs.
      const today = t => outcome(t, t.stopAnchor === 'retestExtreme' ? 'extreme' : 'heute', r);
      const always = t => outcome(t, t.stopAnchor === 'retestExtreme' ? 'm5Edge' : 'heute', r);
      out.overall[r] = { heutigeRegel: summary(all, all, today, r), immerM5Kante: summary(all, all, always, r) };
    }
    out.samples = Object.fromEntries(SAMPLES.map(s => [s[0], sampleTrade(all, s)]).filter(([, t]) => t).map(([k, t]) => [k, { stopAnchor: t.stopAnchor,
      entry: t.entryPrice, stopToday: t.stopPrice, farEdge: farEdge(t), r2: { heute: outcome(t, t.stopAnchor === 'retestExtreme' ? 'extreme' : 'heute', 2).status,
        immerM5: outcome(t, t.stopAnchor === 'retestExtreme' ? 'm5Edge' : 'heute', 2).status } }]));
    result.runs[run] = out;
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'sl-variants-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s.halves['Jan–Jun'].winrate}/${s.halves['Jul–Nov'].winrate})`;
  for (const [run, out] of Object.entries(result.runs)) {
    console.log(`\n== ${run}: ${out.trades} Trades, Extrem ${out.extremeTrades}, M5-Kante ${out.m5EdgeTrades}, Median-Risiko Extrem ${out.medianRiskUsd.extreme} / M5 ${out.medianRiskUsd.m5Edge} USD`);
    for (const [r, v] of Object.entries(out.byR)) console.log(`R ${r}`.padEnd(6), 'Extrem:', f(v.extreme), '| M5-Kante:', f(v.m5Edge),
      `| weit überlebt ${v.weitUeberlebtEngGestoppt.share}% · eng überlebt ${v.engUeberlebtWeitGestoppt.share}%`);
    for (const [r, v] of Object.entries(out.overall)) console.log(`gesamt R ${r}`.padEnd(12), 'heute:', f(v.heutigeRegel), '| immer M5:', f(v.immerM5Kante));
    console.log('Mustertrades', JSON.stringify(out.samples));
  }
} finally {
  await server.close();
}
