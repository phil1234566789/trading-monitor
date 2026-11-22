// Gegenprobe zu (c) M15: Bringt der Strukturpunkt etwas oder nur der weitere SL? Vergleicht auf den Treffern (a) wie gelaufen,
// (c) SL hinter M15-P2 und (d) gleiche SL-Weite ohne Struktur (Faktor eines zufälligen anderen Treffers, 20 Wiederholungen aus
// slStattSperre.mjs), je Ziel-Semantik (fest / 2R vom neuen Risiko) und Treffer-Definition (breit / streng). Zielmaß WR und Max-DD.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const { alle } = JSON.parse(await readFile(path.join(here, 'sl-statt-sperre.json'), 'utf8'));
const rows = alle.sort((a, b) => a.entryTime - b.entryTime);
const stats = rs => {
  let cum = 0, peak = 0, dd = 0, n = 0, w = 0;
  for (const r of rs) { if (r == null) continue; n++; if (r > 0) w++; cum += r; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return { n, wr: n ? +(100 * w / n).toFixed(1) : null, maxDD: +dd.toFixed(1), sumR: +cum.toFixed(1) };
};
const mean = v => v.reduce((s, x) => s + x, 0) / v.length, sd = v => Math.sqrt(mean(v.map(x => (x - mean(v)) ** 2)));
const control = (list, key) => {
  const reps = Array.from({ length: list[0]?.[key]?.length ?? 0 }, (_, k) => stats(list.map(r => r[key]?.[k] ?? r.ra)));
  const f = (k, d = 1) => ({ mittel: +mean(reps.map(x => x[k])).toFixed(d), streuung: +sd(reps.map(x => x[k])).toFixed(d) });
  return { n: reps[0]?.n ?? 0, wr: f('wr'), maxDD: f('maxDD'), sumR: f('sumR') };
};
const DEFS = { breit: r => r.hitA || r.hitB, streng: r => r.hitStrict };
const FAMS = { 'LQ-Sweep': r => r.run.includes('lq-sweep'), 'HTF-OB v3': r => r.run.includes('setup') };
const out = { measurement: 'gegenprobe-c-v1', d: 'SL-Faktor (neu/DOB-Risiko) von (c) M15 eines zufällig gezogenen anderen Treffers desselben Laufs, Seed 20261123, 20 Wiederholungen', ergebnisse: {} };
for (const [fam, ff] of Object.entries(FAMS)) for (const [def, df] of Object.entries(DEFS)) for (const half of ['gesamt', 'H1', 'H2']) {
  const list = rows.filter(r => ff(r) && df(r) && r.cM15?.sl != null && (half === 'gesamt' || r.half === half));
  out.ergebnisse[`${fam} · ${def} · ${half}`] = {
    a: stats(list.map(r => r.ra)),
    cFest: stats(list.map(r => r.cM15.ergebnis === 'offen' ? null : r.cM15.R)), cKR: stats(list.map(r => r.cM15.R_kR)),
    dFest: control(list, 'dFest'), dKR: control(list, 'dKR'),
  };
}
await writeFile(path.join(here, 'gegenprobe-c.json'), JSON.stringify(out, null, 1));
for (const [k, e] of Object.entries(out.ergebnisse))
  console.log(k.padEnd(28), `n ${e.a.n} | a ${e.a.wr}% DD ${e.a.maxDD} | c fest ${e.cFest.wr}% DD ${e.cFest.maxDD} · d fest ${e.dFest.wr.mittel}±${e.dFest.wr.streuung}% DD ${e.dFest.maxDD.mittel}±${e.dFest.maxDD.streuung} | c kR ${e.cKR.wr}% DD ${e.cKR.maxDD} · d kR ${e.dKR.wr.mittel}±${e.dKR.wr.streuung}% DD ${e.dKR.maxDD.mittel}±${e.dKR.maxDD.streuung} | ΣR c/d fest ${e.cFest.sumR}/${e.dFest.sumR.mittel} kR ${e.cKR.sumR}/${e.dKR.sumR.mittel}`);
