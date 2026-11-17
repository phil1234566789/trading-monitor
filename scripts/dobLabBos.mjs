// Labor DOB-LAB-BOS (Philip): „gegnerischer BOS-Pivot gebrochen → TP 5R, sonst 3R“ auf den v3-Trades (jeder Gegen-DOB sperrt).
// Gegnerischer BOS-Pivot = BOS-Pivot der innersten M5-Ebene gegen die Trade-Richtung (src/dobLabFeatures.js dobOpposingBosPivot).
// Schreibt analysis/dob-setup/lab-bos-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [lab, { createDobCounterDobGate, dobSourceRetestTime }, { supabase }, { dobGuardrailsFromRow, dobConfigTpR }] = await Promise.all(
    ['/src/dobLabFeatures.js', '/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js'].map(load));
  const { v2Carriers, uniqueDobTrades, m5Marked, m1Marked, h1All, h4All, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const [{ data: cfgRow, error: e1 }, { data: pins, error: e2 }] = await Promise.all([
    supabase.from('dob_guardrails').select('*').eq('instrument', SYMBOL).maybeSingle(),
    supabase.from('pin_context').select('id,note,dob_trade_key').eq('kind', 'dob_trade').gte('id', 521).order('id').limit(200)]);
  if (e1 || e2) throw e1 ?? e2;
  const config = dobGuardrailsFromRow(cfgRow);
  // v3-Träger: jeder Gegen-DOB sperrt; Dedup wie die Statistik (Repräsentant ist ein passierendes Paar).
  const gate = createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL });
  const statusOf = new Map(v2Carriers.map(t => [t, gate(t)?.status ?? null]));
  const v3 = uniqueDobTrades(v2Carriers.filter(t => statusOf.get(t) === 'none'));
  // Für die Pins zusätzlich alle v2-Trades (auch gesperrte), damit jeder Pin einsortiert werden kann.
  const v2 = uniqueDobTrades(v2Carriers);

  // Varianten: Pivot aus der M5-Struktur zum Quellen-Retest (A) bzw. zum OB1-Start (B, „bis zurück zum letzten Pivot vor OB1“);
  // Bruch per Schluss oder Docht zwischen diesem Zeitpunkt und dem Entry.
  const cache = new Map();
  const bosOf = t => {
    const k = dobTradeKey(t);
    if (cache.has(k)) return cache.get(k);
    const sourceAt = dobSourceRetestTime(t), ob1At = t.chart.firstOrderBlockStart, out = {};
    for (const [name, at] of [['quellenRetest', sourceAt], ['ob1Start', ob1At]]) {
      if (at == null) { out[name] = null; continue; }
      const opp = lab.dobOpposingBosPivot(m5Marked, at, t.direction);
      const broken = opp.pivot ? lab.dobPivotBroken(opp.pivot.price, t.direction, m5Marked, Math.max(at, opp.pivot.time), t.entryTime, 300) : null;
      out[name] = { innerTrend: opp.trend, pivot: opp.pivot, close: broken?.close ?? null, wick: broken?.wick ?? null };
    }
    cache.set(k, out);
    return out;
  };
  // gebrochen / nicht gebrochen / keine Gegen-Ebene (Struktur läuft schon mit dem Trade).
  const VARIANTS = { '1a Close ab Quellen-Retest': ['quellenRetest', 'close'], '1b Docht ab Quellen-Retest': ['quellenRetest', 'wick'],
    '1c Close ab OB1-Start': ['ob1Start', 'close'] };
  const classOf = (t, [at, how]) => { const b = bosOf(t)[at]; return !b ? null : !b.pivot ? 'keine Gegen-Ebene' : b[how] ? 'gebrochen' : 'nicht gebrochen'; };

  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const outcomes = new Map();
  const status = (t, r) => { const k = `${dobTradeKey(t)}:${r}`; if (!outcomes.has(k)) outcomes.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction,
    entryTime: t.entryTime, entryPrice: t.entryPrice, stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd,
    instrument: SYMBOL, rMultiple: r }).status); return outcomes.get(k); };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  const stats = (list, rOf) => { let w = 0, l = 0, sum = 0;
    for (const t of list) { const r = rOf(t), s = status(t, r); if (s === 'success') { w++; sum += r; } else if (s === 'loss') { l++; sum -= 1; } }
    return { n: w + l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: +sum.toFixed(1) }; };
  const block = (list, rOf) => ({ ...stats(list, rOf), 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06'), rOf), 'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07'), rOf) });
  const cfgR = t => dobConfigTpR(config, t.entryTime);

  const result = { measurement: 'dob-lab-bos-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd), trades: v3.length,
    methodology: ['Trades: v3 (v2-Träger ohne Gegen-DOB seit Quellen-Retest, createDobCounterDobGate), Dedup wie die Statistik.',
      'Gegnerischer BOS-Pivot: M5-Struktur (unveränderter Trend-Algo, 5 Tage, Perioden 5/2) zum Zeitpunkt X; innerste Ebene GEGEN die Trade-Richtung, deren protected-high (Long) bzw. protected-low (Short); schon gebrochen = jüngster break-of-structure, nur Docht = jüngster LQ-sweep.',
      'X = Quellen-Retest (1a Close, 1b Docht) bzw. OB1-Start (1c Close). Bruch: M5-Kerze nach max(X, Pivotzeit), bis Entry geschlossen.',
      '„keine Gegen-Ebene“ = die M5-Struktur hat zu X keine Ebene gegen den Trade (läuft schon mit). Regel-Varianten zählen sie als gebrochen bzw. nicht.',
      'n = Win + Loss, ΣR = R·Win − Loss; Konfig = dobConfigTpR(aktive dob_guardrails, Entry); Halbjahre nach Berliner Entry-Monat.'],
    variants: {}, pins: {} };
  for (const [name, v] of Object.entries(VARIANTS)) {
    const groups = {};
    for (const t of v3) { const c = classOf(t, v); if (c) (groups[c] ??= []).push(t); }
    const broken = t => classOf(t, v) === 'gebrochen', brokenOrNone = t => ['gebrochen', 'keine Gegen-Ebene'].includes(classOf(t, v));
    result.variants[name] = {
      groups: Object.fromEntries(Object.entries(groups).sort().map(([g, list]) => [g, Object.fromEntries([2, 3, 4, 5].map(r => [`r${r}`, block(list, () => r)]))])),
      rules: { 'fest 3R': block(v3, () => 3), 'fest 5R': block(v3, () => 5), Konfig: block(v3, cfgR),
        'gebrochen 5R, sonst 3R': block(v3, t => broken(t) ? 5 : 3), 'gebrochen oder keine Gegen-Ebene 5R, sonst 3R': block(v3, t => brokenOrNone(t) ? 5 : 3) } };
  }
  const byKey = new Map(v2.map(t => [`${SYMBOL}:${dobTradeKey(t)}`, t]));
  for (const pin of pins) {
    const t = byKey.get(pin.dob_trade_key);
    result.pins[pin.id] = { note: pin.note, found: !!t, ...(t ? { inV3: v3.includes(t) || v3.some(x => dobTradeKey(x) === dobTradeKey(t)), r3: status(t, 3), r5: status(t, 5),
      classes: Object.fromEntries(Object.entries(VARIANTS).map(([n, v]) => [n, classOf(t, v)])), bos: bosOf(t),
      // Pin 523: Fenster/TF mit Aufwärtstrend der obersten Ebene.
      outer: Object.fromEntries([['m5', 300, m5Marked], ['h1', 3600, h1All], ['h4', 14400, h4All]].flatMap(([tf, bar, rows]) => [5, 7, 14, 21, 30].map(d =>
        [`${tf}_${d}d`, lab.dobOuterTrend(rows, t.chart.secondRetestTime + 60, t.direction, { windowDays: d, barSeconds: bar }).trend]))) } : {}) };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-bos-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  console.log(`v3: ${v3.length} Trades`);
  for (const [name, v] of Object.entries(result.variants)) {
    console.log(`\n== ${name}`);
    for (const [g, s] of Object.entries(v.groups)) console.log(g.padEnd(18), '2R', f(s.r2), '| 3R', f(s.r3), '| 4R', f(s.r4), '| 5R', f(s.r5));
    for (const [r, s] of Object.entries(v.rules)) console.log('Regel', r.padEnd(46), f(s));
  }
  for (const [id, p] of Object.entries(result.pins)) console.log('Pin', id, p.found ? `${p.inV3 ? 'v3' : 'gesperrt'} ${p.r3}/${p.r5} ${JSON.stringify(p.classes)} up:${Object.entries(p.outer).filter(([, tr]) => tr === 'uptrend').map(([k]) => k).join(',')}` : 'nicht gefunden', '|', p.note.slice(0, 50));
} finally {
  await server.close();
}
