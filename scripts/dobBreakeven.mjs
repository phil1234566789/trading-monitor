// Messung DOB-BREAKEVEN (noch keine Regel): Philip zieht den SL auf Entry, sobald die Position eine R-Weite gelaufen ist.
// Ausgang über evaluateDoubleOrderBlockOutcome mit breakevenAtR (derselbe M1-Pfadlauf), Vergleich je Ziel gegen „kein BE“.
// Nur Messung, schreibt nicht in die Statistikläufe.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';

// Hauptkennzahlen 3R/4R/5R (Philip), 2R nur am Rand; Trigger ≥ Ziel entfällt.
const TARGETS = [3, 4, 5, 2], TRIGGERS = [null, 1, 1.5, 2, 2.5, 3];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { runs, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const fromEntry = new Map();
  const candlesFrom = t => { if (!fromEntry.has(t.entryTime)) fromEntry.set(t.entryTime, m1Marked.slice(lowerBound(t.entryTime))); return fromEntry.get(t.entryTime); };
  const outcomes = new Map();
  const outcome = (t, r, be) => { const key = `${t.direction}:${t.entryTime}:${t.entryPrice}:${t.stopPrice}:${r}:${be}`;
    if (!outcomes.has(key)) outcomes.set(key, evaluateDoubleOrderBlockOutcome({ direction: t.direction, entryTime: t.entryTime, entryPrice: t.entryPrice,
      stopPrice: t.stopPrice, candles: candlesFrom(t), evaluatedAt: dataEnd, instrument: SYMBOL, rMultiple: r, breakevenAtR: be }));
    return outcomes.get(key).status; };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const pct = (a, n) => n ? +(a / n * 100).toFixed(1) : null;
  // n = Win + BE + Loss (ambiguous/offen/unknown außen vor, separat gezählt); ΣR = r·Win − Loss, BE = 0.
  const stats = (list, r, be) => { const c = { success: 0, breakeven: 0, loss: 0, ambiguous: 0, other: 0 };
    for (const t of list) { const s = outcome(t, r, be); c[s in c ? s : 'other']++; }
    const n = c.success + c.breakeven + c.loss;
    return { n, win: c.success, be: c.breakeven, loss: c.loss, winShare: pct(c.success, n), beShare: pct(c.breakeven, n), lossShare: pct(c.loss, n),
      winrate: pct(c.success, n), sumR: +(r * c.success - c.loss).toFixed(1), ambiguous: c.ambiguous, openOrUnknown: c.other };
  };
  const result = { measurement: 'dob-breakeven-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd), targets: TARGETS, triggers: TRIGGERS,
    methodology: ['Trades: einmalige Trades der Statistikläufe v2 (Hauptlauf) und v1 (Vergleich), dobRuns.mjs, Entry/SL unverändert.',
      'Ausgang: evaluateDoubleOrderBlockOutcome mit rMultiple = Ziel und breakevenAtR = Trigger auf M1 ab Entry bis Datenende.',
      'Trigger erreicht (Kerzenhoch/-tief) → SL liegt ab der NÄCHSTEN M1-Kerze auf Entry (Reihenfolge in der Trigger-Kerze unbekannt, dort gilt der alte SL).',
      'Rückkehr auf Entry nach dem Trigger = BE (0R). Kerze, die SL (bzw. Entry nach Trigger) und TP zugleich berührt = ambiguous, nicht in n.',
      'n = Win + BE + Loss; Winrate = Win / n; ΣR = Ziel·Win − Loss. Halbjahre nach Berliner Entry-Monat. Trigger ≥ Ziel entfällt.',
      'gerettet = ohne BE Loss, mit BE BE; gestoppteGewinner = ohne BE Win, mit BE BE (vorzeitig auf 0). Übergänge = alle Wechsel ohne BE → mit BE.'],
    runs: {} };
  for (const run of ['v2', 'v1']) {
    const all = runs[run], out = { trades: all.length, byTarget: {} };
    for (const r of TARGETS) {
      out.byTarget[r] = {};
      for (const be of TRIGGERS.filter(b => b == null || b < r)) {
        const transitions = {};
        if (be != null) for (const t of all) { const a = outcome(t, r, null), b = outcome(t, r, be); if (a !== b) transitions[`${a}→${b}`] = (transitions[`${a}→${b}`] ?? 0) + 1; }
        out.byTarget[r][be == null ? 'keinBE' : `be${be}R`] = { ...stats(all, r, be),
          halves: { 'Jan–Jun': stats(all.filter(t => month(t) <= '2026-06'), r, be), 'Jul–Nov': stats(all.filter(t => month(t) >= '2026-07'), r, be) },
          ...(be == null ? {} : { gerettet: transitions['loss→breakeven'] ?? 0, gestoppteGewinner: transitions['success→breakeven'] ?? 0, transitions }) };
      }
    }
    result.runs[run] = out;
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'breakeven-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} W${s.win}/BE${s.be}/L${s.loss} ${s.winrate}% ${s.sumR}R (H1 ${s.halves['Jan–Jun'].sumR}R / H2 ${s.halves['Jul–Nov'].sumR}R) amb ${s.ambiguous}`;
  for (const [run, out] of Object.entries(result.runs)) {
    console.log(`\n== ${run}: ${out.trades} Trades`);
    for (const [r, v] of Object.entries(out.byTarget)) for (const [k, s] of Object.entries(v))
      console.log(`Ziel ${r}R ${k}`.padEnd(16), f(s), s.gerettet != null ? `| gerettet ${s.gerettet} · Gewinner gestoppt ${s.gestoppteGewinner} · ${JSON.stringify(s.transitions)}` : '');
  }
} finally {
  await server.close();
}
