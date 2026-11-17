// Merkmal-Labor DOB (Q24, noch keine Regel): vier Merkmale je Trade zum Entscheidungszeitpunkt (src/dobLabFeatures.js) gegen den
// Ausgang bei 2R–5R und TP nach aktiver Konfig. Schreibt analysis/dob-setup/lab-features-xau-2026.json, sonst nichts.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';
import { dobGridInputAt, dobTradeKey } from './dobSetupGrid.mjs';

const R_MAIN = [3, 5], R_SIDE = [2, 4];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [lab, { detectDoubleOrderBlocks }, { supabase }, { dobGuardrailsFromRow, dobConfigTpR }] = await Promise.all(
    ['/src/dobLabFeatures.js', '/src/doubleOrderBlocks.js', '/src/supabaseClient.js', '/src/dobGuardrails.js'].map(load));
  const { runs, m5Marked, m1Marked, h1All, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const { data: cfgRow, error: cfgError } = await supabase.from('dob_guardrails').select('*').eq('instrument', SYMBOL).maybeSingle();
  if (cfgError) throw cfgError;
  const config = dobGuardrailsFromRow(cfgRow);
  const { data: pins, error } = await supabase.from('pin_context').select('id,note,dob_trade_key').eq('kind', 'dob_trade').gte('id', 521).order('id').limit(200);
  if (error) throw error;

  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const outcomes = new Map();
  const status = (t, r) => { const k = `${dobTradeKey(t)}:${r}`; if (!outcomes.has(k)) outcomes.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction,
    entryTime: t.entryTime, entryPrice: t.entryPrice, stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd,
    instrument: SYMBOL, rMultiple: r }).status); return outcomes.get(k); };

  // Merkmale je Trade (gecacht über den Trade-Schlüssel, v1 enthält v2).
  const featureCache = new Map(), t0 = performance.now();
  const featuresOf = t => {
    const key = dobTradeKey(t);
    if (featureCache.has(key)) return featureCache.get(key);
    const retestAt = t.chart.secondRetestTime + 60, src = t.sourceOfStrength;
    const sourceRetestAt = src?.retestAgeSeconds != null ? t.chart.firstOrderBlockStart - src.retestAgeSeconds : null;
    const dob = detectDoubleOrderBlocks({ ...dobGridInputAt({ symbol: SYMBOL, m5Marked, m1Marked }, t.entryTime, 2 * 86400), options: { retests: false } });
    const f = {
      outer: Object.fromEntries([['m5', 300, m5Marked], ['h1', 3600, h1All]].flatMap(([tf, bar, rows]) => [5, 7].map(d =>
        [`${tf}_${d}d`, lab.dobOuterTrend(rows, retestAt, t.direction, { windowDays: d, barSeconds: bar })]))),
      m5Confirm: { sinceOb2Retest: lab.dobM5Confirmation(m5Marked, t.entryTime, t.direction, t.chart.secondRetestTime),
        ...(sourceRetestAt != null ? { sinceSourceRetest: lab.dobM5Confirmation(m5Marked, t.entryTime, t.direction, sourceRetestAt) } : {}) },
      counterDobs: { sinceOb2Retest: lab.dobCounterDobs(dob, t.direction, t.chart.secondRetestTime, t.entryTime),
        ...(sourceRetestAt != null ? { sinceSourceRetest: lab.dobCounterDobs(dob, t.direction, sourceRetestAt, t.entryTime) } : {}) },
      obsInZone: lab.dobObsInSourceZone(t.chart, src),
    };
    featureCache.set(key, f);
    return f;
  };

  // Gruppen: flagged = Merkmal spricht gegen den Trade (Kandidat zum Aussortieren).
  const FLAGS = {
    ...Object.fromEntries(['m5_5d', 'm5_7d', 'h1_5d', 'h1_7d'].map(k => [`äußerer Trend ${k} gegen`, f => f.outer[k].verdict === 'against'])),
    ...Object.fromEntries(['m5_5d', 'm5_7d', 'h1_5d', 'h1_7d'].map(k => [`äußerer Trend ${k} gegen, ≥3 Tg alt`, f => f.outer[k].verdict === 'against' && f.outer[k].durationDays >= 3])),
    'keine M5-Bestätigung seit OB2-Retest': f => !f.m5Confirm.sinceOb2Retest.confirmed,
    'keine M5-Bestätigung seit Quellen-Retest': f => f.m5Confirm.sinceSourceRetest ? !f.m5Confirm.sinceSourceRetest.confirmed : null,
    'innerster M5-Trend am Entry nicht in Richtung': (f, t) => f.m5Confirm.sinceOb2Retest.innerTrendAtEntry !== (t.direction === 'long' ? 'uptrend' : 'downtrend'),
    'Gegen-DOB seit OB2-Retest': f => f.counterDobs.sinceOb2Retest.count > 0,
    'Gegen-DOB seit Quellen-Retest': f => f.counterDobs.sinceSourceRetest ? f.counterDobs.sinceSourceRetest.count > 0 : null,
    'OB1 und OB2 beide in der Kraft-Zone': f => f.obsInZone ? f.obsInZone.both : null,
  };

  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const stats = (list, rOf) => { let w = 0, l = 0, sum = 0;
    for (const t of list) { const r = rOf(t), s = status(t, r); if (s === 'success') { w++; sum += r; } else if (s === 'loss') { l++; sum -= 1; } }
    return { n: w + l, win: w, loss: l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: +sum.toFixed(1) }; };
  const block = (list, rOf) => ({ ...stats(list, rOf), 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06'), rOf), 'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07'), rOf) });
  const rates = list => ({ ...Object.fromEntries([...R_MAIN, ...R_SIDE].map(r => [`r${r}`, block(list, () => r)])), tpKonfig: block(list, t => dobConfigTpR(config, t.entryTime)) });

  const result = { measurement: 'dob-merkmal-labor-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    config: { entryWindows: config.entryWindows, defaultTpR: config.defaultTpR },
    methodology: ['Trades: einmalige Trades der Statistikläufe v2 (Haupt) und v1 (Vergleich), dobRuns.mjs; Merkmale am Repräsentanten je Trade.',
      'Äußerer Trend: oberste Ebene (state.trend) des unveränderten Trend-Algos (Perioden 5/2, Close-Auswertung bei M5) zur OB2-Retest-Zeit, Pivots ab 5 bzw. 7 Tagen davor, M5 und H1, nur geschlossene Kerzen. Dauer = seit appliedPivots[0].',
      'M5-Bestätigung: Phasenwechsel-Ereignis (buildStructureWithPhases.events) in Trade-Richtung, verarbeitet nach OB2-Retest bzw. Quellen-Retest und spätestens am Entry; Struktur aus 2 Tagen M5 bis Entry.',
      'Gegen-DOB: detectDoubleOrderBlocks auf 2 Tagen bis Entry, Paare in Gegenrichtung (je OB2 einmal) mit recognizedAt nach OB2- bzw. Quellen-Retest und spätestens am Entry.',
      'Beide OBs in Zone: Preisabstand OB1 und OB2 zur Kraft-Zone je 0 (Überlappung).',
      'Ausgang: evaluateDoubleOrderBlockOutcome mit rMultiple; tpKonfig = dobConfigTpR(aktive dob_guardrails, Entry). n = Win + Loss, ΣR = R·Win − Loss.',
      'flagged = Merkmal spricht gegen den Trade; kept = Rest (ohne Trades, für die das Merkmal unbekannt ist).'],
    runs: {}, pins: {} };

  for (const run of ['v2', 'v1']) {
    const all = runs[run], out = { trades: all.length, all: rates(all), features: {} };
    for (const t of all) featuresOf(t);
    for (const [name, flag] of Object.entries(FLAGS)) {
      const known = all.filter(t => flag(featuresOf(t), t) != null), flagged = known.filter(t => flag(featuresOf(t), t));
      out.features[name] = { known: known.length, flagged: flagged.length, flaggedRates: rates(flagged), kept: rates(known.filter(t => !flag(featuresOf(t), t))) };
    }
    result.runs[run] = out;
  }
  result.featureRuntimeMsPerTrade = +((performance.now() - t0) / featureCache.size).toFixed(1);
  const byKey = new Map(runs.v1.concat(runs.v2).map(t => [`${SYMBOL}:${dobTradeKey(t)}`, t]));
  for (const pin of pins) {
    const t = byKey.get(pin.dob_trade_key);
    result.pins[pin.id] = { note: pin.note, found: !!t, ...(t ? { r3: status(t, 3), r5: status(t, 5),
      flags: Object.fromEntries(Object.entries(FLAGS).map(([n, flag]) => [n, flag(featuresOf(t), t)])), features: featuresOf(t) } : {}) };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-features-xau-2026.json'), JSON.stringify(result, null, 2));

  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  console.log(`Merkmale je Trade ${result.featureRuntimeMsPerTrade} ms`);
  for (const [run, out] of Object.entries(result.runs)) {
    console.log(`\n== ${run}: ${out.trades} · alle 3R ${f(out.all.r3)} | 5R ${f(out.all.r5)} | Konfig ${f(out.all.tpKonfig)}`);
    for (const [name, v] of Object.entries(out.features)) console.log(`${name}`.padEnd(46), `flag ${v.flagged}/${v.known}`.padEnd(14),
      'flag 3R', f(v.flaggedRates.r3), '5R', f(v.flaggedRates.r5), 'Kfg', f(v.flaggedRates.tpKonfig), '|| kept 3R', f(v.kept.r3), '5R', f(v.kept.r5), 'Kfg', f(v.kept.tpKonfig));
  }
  for (const [id, p] of Object.entries(result.pins)) console.log('Pin', id, p.found ? `${p.r3}/${p.r5}` : 'nicht gefunden', JSON.stringify(p.flags ?? {}));
} finally {
  await server.close();
}
