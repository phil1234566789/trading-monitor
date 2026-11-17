// Messung DOB-Setup v3: Gegen-DOB-Gate je tragendem v2-Paar (wie der Lauf), Varianten „jeder Gegen-DOB“ und „nur lebende“.
// Schreibt analysis/dob-setup/counter-dob-gate-xau-2026.json.
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
  const [{ createDobCounterDobGate }, { supabase }, { dobGuardrailsFromRow, dobConfigTpR }] = await Promise.all(
    ['/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js'].map(load));
  const { runs, v2Carriers, uniqueDobTrades, m5Marked, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const { data: cfgRow, error } = await supabase.from('dob_guardrails').select('*').eq('instrument', SYMBOL).maybeSingle();
  if (error) throw error;
  const config = dobGuardrailsFromRow(cfgRow);
  const gate = createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL });
  const t0 = performance.now(), gated = v2Carriers.map(t => ({ ...t, counterDob: gate(t) })), ms = performance.now() - t0;

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
  const rates = list => ({ trades: list.length, r3: block(list, () => 3), r5: block(list, () => 5), tpKonfig: block(list, t => dobConfigTpR(config, t.entryTime)), r2: block(list, () => 2) });
  // Dedup wie die Statistik: ein Trade bleibt, sobald ein tragendes Paar das Gate passiert.
  const keep = pass => uniqueDobTrades(gated.filter(pass));
  const variants = { 'v2 ohne Gate': runs.v2, 'jeder Gegen-DOB sperrt': keep(t => !(t.counterDob?.count > 0)),
    'nur lebende Gegen-DOBs sperren': keep(t => !(t.counterDob?.liveCount > 0)) };
  // Klasse je Trade über alle tragenden Paare, bestes gewinnt (wie Dedup „bleibt, sobald ein Paar passiert“): keiner > nur tote > lebend.
  const RANK = { keiner: 0, 'nur tote': 1, lebend: 2 };
  const classOf = c => !c?.count ? 'keiner' : c.liveCount ? 'lebend' : 'nur tote';
  const best = new Map();
  for (const t of gated) { const k = dobTradeKey(t), cls = classOf(t.counterDob); if (!best.has(k) || RANK[cls] < RANK[best.get(k).cls]) best.set(k, { t, cls }); }
  const groups = Object.fromEntries(Object.keys(RANK).map(cls => [cls, [...best.values()].filter(x => x.cls === cls).map(x => x.t)]));
  const cfgR = t => dobConfigTpR(config, t.entryTime);
  // Kombi (Philip): lebend sperrt, nur tote → TP fest 5R, keiner → TP nach Konfig.
  const combo = [...groups.keiner, ...groups['nur tote']], comboR = t => groups['nur tote'].includes(t) ? 5 : cfgR(t);
  const result = { measurement: 'dob-counter-dob-gate-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Trades: v2-Träger (dobRuns.mjs), Gate je Paar (createDobCounterDobGate: detectDoubleOrderBlocks auf 2 Tagen bis Entry), dann Dedup wie die Statistik.',
      'Gegen-DOB: Paar in Gegenrichtung mit recognizedAt nach dem Quellen-Retest und spätestens am Entry, je OB2 einmal.',
      'Tot: ein M1-Schluss zwischen Erkennung und Entry jenseits der fernen OB2-Kante (bärisch über Oberkante, bullisch unter Unterkante).',
      'n = Win + Loss, ΣR = R·Win − Loss; tpKonfig = dobConfigTpR(aktive dob_guardrails, Entry); Halbjahre nach Berliner Entry-Monat.'],
    gateMsPerCarrier: +(ms / v2Carriers.length).toFixed(1), variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, rates(v)])),
    groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, { ...rates(v), r4: block(v, () => 4) }])),
    combo: { 'jeder sperrt (TP Konfig)': { trades: groups.keiner.length, tp: block(groups.keiner, cfgR) },
      'lebend sperrt, nur tote 5R, keiner Konfig': { trades: combo.length, tp: block(combo, comboR) } } };
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'counter-dob-gate-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  console.log(`Gate ${result.gateMsPerCarrier} ms je Träger`);
  for (const [k, v] of Object.entries(result.groups)) console.log('Gruppe', k.padEnd(10), v.trades, '2R', f(v.r2), '| 3R', f(v.r3), '| 4R', f(v.r4), '| 5R', f(v.r5), '| Kfg', f(v.tpKonfig));
  for (const [k, v] of Object.entries(result.combo)) console.log('Kombi', k.padEnd(44), v.trades, f(v.tp));
  for (const [k, v] of Object.entries(result.variants)) console.log(k.padEnd(32), v.trades, '3R', f(v.r3), '| 5R', f(v.r5), '| Kfg', f(v.tpKonfig), '| 2R', f(v.r2));
} finally {
  await server.close();
}
