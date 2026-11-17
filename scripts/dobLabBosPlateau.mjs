// Labor DOB-LAB-BOS-PLATEAU: BOS-Pivot-Klassen 1a/1b/1c auf H1-Struktur über 5/7/10/14 Tage, je Ebene (oberste, innerste,
// Range enthält den Entry), auf v3 („keiner“ bzw. „keiner + nur tote“). Regel „1c → 5R, sonst Konfig“ gegen Konfig.
// Schreibt analysis/dob-setup/lab-bos-plateau-xau-2026.json.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadDobRuns, DOB_SYMBOL as SYMBOL } from './dobRuns.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';

const WINDOWS = [5, 7, 10, 14], LEVELS = ['outer', 'inner', 'range'];
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
let envDir = root;
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);

const server = await createServer({ root, envDir, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const load = p => server.ssrLoadModule(p);
  const [lab, { createDobCounterDobGate }, { supabase }, { dobGuardrailsFromRow, dobConfigTpR, dobGuardrailsQuery }] = await Promise.all(
    ['/src/dobLabFeatures.js', '/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js'].map(load));
  const { v2Carriers, m5Marked, m1Marked, h1All, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const [{ data: cfgRow, error: e1 }, { data: pins, error: e2 }] = await Promise.all([
    dobGuardrailsQuery(supabase, SYMBOL, 'htf_ob'),
    supabase.from('pin_context').select('id,note,dob_trade_key').eq('kind', 'dob_trade').gte('id', 521).order('id').limit(200)]);
  if (e1 || e2) throw e1 ?? e2;
  const config = dobGuardrailsFromRow(cfgRow);
  // Status je Trade wie der v3-Fill: bester über die tragenden Paare (none > dead > live), Repräsentant = Paar mit diesem Status.
  const gate = createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL });
  const RANK = { none: 0, dead: 1, live: 2 }, best = new Map();
  for (const t of v2Carriers) { const s = gate(t)?.status ?? 'none', k = dobTradeKey(t); if (!best.has(k) || RANK[s] < RANK[best.get(k).s]) best.set(k, { t, s }); }
  const statusOf = t => best.get(dobTradeKey(t)).s;
  const all = [...best.values()].map(x => x.t);
  const carriers = { 'keiner': all.filter(t => statusOf(t) === 'none'), 'keiner + nur tote': all.filter(t => statusOf(t) !== 'live') };

  const cache = new Map();
  const classOf = (t, w, level) => { const k = `${dobTradeKey(t)}:${w}:${level}`;
    if (!cache.has(k)) { const o = lab.dobLevelTrend(h1All, t.chart.secondRetestTime + 60, t.direction, { windowDays: w, barSeconds: 3600, level, price: t.entryPrice });
      cache.set(k, { ...lab.dobOuterTrendClass(o, t.direction, m5Marked, t.entryTime, 300), trend: o.trend, depth: o.depth }); }
    return cache.get(k); };

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
  // Konfig wie die Statistikseite: TP-Fenster/Default, nur tote Gegen-DOBs im Kombi-Modus 5R.
  const cfgR = t => dobConfigTpR(config, t.entryTime, statusOf(t));

  const result = { measurement: 'dob-lab-bos-plateau-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    counterDobMode: config.counterDobMode,
    methodology: ['Trades: v2 mit Gegen-DOB-Status wie der v3-Fill (bester über die tragenden Paare); Träger „keiner“ bzw. „keiner + nur tote“.',
      'Struktur: unveränderter Trend-Algo auf H1 (Perioden 5/2), Pivots ab 5/7/10/14 Tagen vor der OB2-Retest-Zeit, nur geschlossene Kerzen.',
      'Ebene: outer = oberste, inner = innerste bestätigte, range = innerste Ebene, deren aktuelle Range den Entry-Preis enthält (sonst oberste).',
      '1a = Ebene mit dem Trade, 1b = dagegen und BOS-Pivot (protected-high/-low dieser Ebene) bis Entry nicht per M5-Schluss gebrochen, 1c = gebrochen.',
      'Konfig = dobConfigTpR(aktive dob_guardrails, Entry, Gegen-DOB-Status); Regel = 1c → 5R, sonst Konfig. n = Win + Loss, Halbjahre nach Berliner Entry-Monat.'],
    carriers: {}, pins: {} };
  for (const [cName, list] of Object.entries(carriers)) {
    const out = { trades: list.length, konfig: block(list, cfgR), windows: {} };
    for (const w of WINDOWS) for (const level of LEVELS) {
      const groups = {};
      for (const t of list) (groups[classOf(t, w, level).cls] ??= []).push(t);
      out.windows[`h1_${w}d_${level}`] = {
        groups: Object.fromEntries(Object.entries(groups).sort().map(([g, l]) => [g, { r3: block(l, () => 3), r5: block(l, () => 5), konfig: block(l, cfgR) }])),
        rule1c5R: block(list, t => classOf(t, w, level).cls === '1c' ? 5 : cfgR(t)) };
    }
    result.carriers[cName] = out;
  }
  const byKey = new Map(all.map(t => [`${SYMBOL}:${dobTradeKey(t)}`, t]));
  for (const pin of pins) {
    const t = byKey.get(pin.dob_trade_key);
    result.pins[pin.id] = { note: pin.note, found: !!t, ...(t ? { direction: t.direction, counterDob: statusOf(t), r3: status(t, 3),
      levels: Object.fromEntries(WINDOWS.flatMap(w => LEVELS.map(level => { const c = classOf(t, w, level); return [`h1_${w}d_${level}`, `${c.trend}@${c.depth} ${c.cls}`]; }))) } : {}) };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-bos-plateau-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  for (const [cName, out] of Object.entries(result.carriers)) {
    console.log(`\n== ${cName}: ${out.trades} · Konfig ${f(out.konfig)}`);
    for (const [k, v] of Object.entries(out.windows)) console.log(k.padEnd(14), 'Regel', f(v.rule1c5R), '||', Object.entries(v.groups).map(([g, s]) => `${g}: 3R ${f(s.r3)} 5R ${f(s.r5)} Kfg ${f(s.konfig)}`).join(' | '));
  }
  for (const [id, p] of Object.entries(result.pins)) console.log('Pin', id, p.found ? `${p.direction} ${p.counterDob} ${p.r3} ${JSON.stringify(p.levels)}` : 'nicht gefunden');
} finally {
  await server.close();
}
