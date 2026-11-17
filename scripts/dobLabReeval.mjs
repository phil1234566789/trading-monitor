// DOB-LAB-NEUBEWERTUNG (Philip setzt TPs selbst): ein Filter besteht, wenn die Winrate bei festem 3R in BEIDEN Halbjahren über der
// Basis liegt und ΣR bei TP nach Konfig höchstens 10 % sinkt. Basis = v3 ohne Filter (Kombi), (a) ohne und (b) mit Philips Sperren.
// Alle bisherigen Kandidaten als Filter auf denselben Trägern. Schreibt analysis/dob-setup/lab-reeval-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobV3Lab } from './dobV3Carriers.mjs';

const MAX_SUMR_LOSS = 0.1;
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const [lab, { dobPoiRetestTime }] = await Promise.all(['/src/dobLabFeatures.js', '/src/dobCounterDob.js'].map(p => server.ssrLoadModule(p)));
  const { cases, block, ideaRules, priceAction, m5Marked, h1All, dataEnd, berlinDateStrFor, gitHash } = await loadDobV3Lab(server, root);
  // Merkmale je Trade einmal (gecacht über das Objekt, beide Träger teilen die Repräsentanten).
  const memo = fn => { const cache = new Map(); return t => { if (!cache.has(t)) cache.set(t, fn(t)); return cache.get(t); }; };
  const m5Bos = memo(t => Object.fromEntries([['poiRetest', dobPoiRetestTime(t)], ['ob1Start', t.chart.firstOrderBlockStart]].map(([k, at]) => {
    if (at == null) return [k, null];
    const opp = lab.dobOpposingBosPivot(m5Marked, at, t.direction);
    const b = opp.pivot ? lab.dobPivotBroken(opp.pivot.price, t.direction, m5Marked, Math.max(at, opp.pivot.time), t.entryTime, 300) : null;
    return [k, { none: !opp.pivot, close: b?.close ?? false, wick: b?.wick ?? false }];
  })));
  const h1Class = memo(t => Object.fromEntries(['inner', 'range'].map(level => [level, lab.dobOuterTrendClass(
    lab.dobLevelTrend(h1All, t.chart.secondRetestTime + 60, t.direction, { windowDays: 10, barSeconds: 3600, level, price: t.entryPrice }),
    t.direction, m5Marked, t.entryTime, 300).cls])));
  const outer = memo(t => ({ m5_5d: lab.dobOuterTrend(m5Marked, t.chart.secondRetestTime + 60, t.direction, { windowDays: 5, barSeconds: 300 }).verdict,
    h1_7d: lab.dobOuterTrend(h1All, t.chart.secondRetestTime + 60, t.direction, { windowDays: 7, barSeconds: 3600 }).verdict }));
  const confirm = memo(t => { const at = dobPoiRetestTime(t); return at == null ? null : lab.dobM5Confirmation(m5Marked, t.entryTime, t.direction, at).confirmed; });
  const brokenOrFree = (t, k, how) => { const b = m5Bos(t)[k]; return !b || b.none || b[how]; };

  // keep(t) = Trade bleibt. Gegen-DOB „jeder sperrt“ wirkt nur auf die Kombi-Träger (dort sind nur tote übrig).
  const FILTERS = {
    'Gegen-DOB jeder sperrt (statt Kombi)': (t, c) => c.statusOf.get(t) === 'none',
    ...Object.fromEntries([1, 3, 5].map(n => [`PA Gegenmuster ${n} → sperren`, t => !priceAction(t, n).counterPattern])),
    'PA Gegenkerzen ≥2 von 3 → sperren': t => priceAction(t, 3).counterCandles < 2,
    'PA Gegenkerzen 3 von 3 → sperren': t => priceAction(t, 3).counterCandles < 3,
    'PA Gegenkerzen ≥3 von 5 → sperren': t => priceAction(t, 5).counterCandles < 3,
    'PA Muster in Trade-Richtung Pflicht (3)': t => priceAction(t, 3).withPattern,
    'PA Muster in Trade-Richtung Pflicht (5)': t => priceAction(t, 5).withPattern,
    'BOS M5 1a gebrochen/frei Pflicht (Close ab POI-Retest)': t => brokenOrFree(t, 'poiRetest', 'close'),
    'BOS M5 1b gebrochen/frei Pflicht (Docht ab POI-Retest)': t => brokenOrFree(t, 'poiRetest', 'wick'),
    'BOS M5 1c gebrochen/frei Pflicht (Close ab OB1-Start)': t => brokenOrFree(t, 'ob1Start', 'close'),
    'BOS H1 10 Tg innerste Ebene: 1b sperren': t => h1Class(t).inner !== '1b',
    'BOS H1 10 Tg Range-Ebene: 1b sperren': t => h1Class(t).range !== '1b',
    'erster Touch Pflicht': t => t.poi.retestKind === 'first',
    'äußerer Trend M5 5 Tg gegen → sperren': t => outer(t).m5_5d !== 'against',
    'äußerer Trend H1 7 Tg gegen → sperren': t => outer(t).h1_7d !== 'against',
    'M5-Bestätigung seit POI-Retest Pflicht': t => confirm(t) !== false,
    'OB1 und OB2 beide in der Zone → sperren': t => !lab.dobObsInPoiZone(t.chart, t.poi)?.both,
  };
  const result = { measurement: 'dob-lab-reeval-v1', git: gitHash, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    rule: 'besteht: Winrate fest 3R in Jan–Jun UND Jul–Nov über der Basis; ΣR TP nach Konfig ≥ 90 % der Basis.',
    methodology: ['Träger scripts/dobV3Carriers.mjs (v3-Fill, Kombi), (a) ohne, (b) mit Philips Sperren; Basis = alle Träger.',
      'Definitionen wie in den Einzel-Laboren (lab-features, lab-idea, lab-price-action, lab-bos, lab-bos-plateau). BOS M5 „gebrochen/frei“ = gebrochen oder keine Gegen-Ebene.'],
    carriers: {} };
  for (const c of cases) {
    const base = { r3: block(c.trades, () => 3), konfig: block(c.trades, c.tpR) };
    const judge = kept => { const r3 = block(kept, () => 3), konfig = block(kept, c.tpR);
      const passes = ['Jan–Jun', 'Jul–Nov'].every(h => r3[h].winrate > base.r3[h].winrate) && konfig.sumR >= (1 - MAX_SUMR_LOSS) * base.konfig.sumR;
      return { trades: kept.length, share: +(kept.length / c.trades.length * 100).toFixed(1), r3, konfig, passes }; };
    const rows = { ...Object.fromEntries(Object.entries(FILTERS).map(([n, keep]) => [n, judge(c.trades.filter(t => keep(t, c)))])),
      ...Object.fromEntries(Object.entries(ideaRules(c.trades, c.tpR)).map(([n, kept]) => [`Idee ${n}`, judge(kept)])) };
    result.carriers[c.name] = { base: { trades: c.trades.length, ...base }, rows };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-reeval-xau-2026.json'), JSON.stringify(result, null, 2));
  const w = s => `${s.winrate}% (${s['Jan–Jun'].winrate}/${s['Jul–Nov'].winrate})`;
  for (const [name, v] of Object.entries(result.carriers)) {
    console.log(`\n== ${name}: Basis ${v.base.trades} T · 3R ${w(v.base.r3)} · Konfig ${v.base.konfig.sumR}R`);
    for (const [k, r] of Object.entries(v.rows)) console.log((r.passes ? 'BESTEHT ' : 'fällt   ') + k.padEnd(58), `${r.trades} (${r.share}%)`.padEnd(13), '3R', w(r.r3).padEnd(20), 'Kfg', `${r.konfig.sumR}R`);
  }
} finally {
  await server.close();
}
