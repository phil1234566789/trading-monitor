// Gemeinsame Grundlage der v3-Labor-Skripte: Träger wie der v3-Fill (bester Gegen-DOB-Status je Trade), Philips Konfig im Modus
// Kombi einmal ohne (a) und einmal mit (b) seinen Sperren, Ausgang zum TP nach Konfig. Damit zählen alle Messungen dieselben Trades.
import { loadDobRuns, DOB_SYMBOL } from './dobRuns.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';

export async function loadDobV3Lab(server, root) {
  const load = p => server.ssrLoadModule(p);
  const [{ createDobCounterDobGate }, { supabase }, g, { dobSourceZoneAgeSeconds }] = await Promise.all(
    ['/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js', '/src/dobSourceOfStrength.js'].map(load));
  const runs = await loadDobRuns(server, root);
  const { v2Carriers, m5Marked, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor } = runs;
  const { data: cfgRow, error } = await supabase.from('dob_guardrails').select('*').eq('instrument', DOB_SYMBOL).maybeSingle();
  if (error) throw error;
  const config = g.dobGuardrailsFromRow(cfgRow);
  const gate = createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: DOB_SYMBOL });
  const RANK = { none: 0, dead: 1, live: 2 }, best = new Map();
  for (const t of v2Carriers) { const st = gate(t)?.status ?? 'none', k = dobTradeKey(t); if (!best.has(k) || RANK[st] < RANK[best.get(k).st]) best.set(k, { t, st }); }
  const combo = { counterDobMode: 'live_block_dead_5r' };
  const configs = [['(a) Kombi ohne Sperren', { ...g.DOB_GUARDRAILS_DEFAULT, defaultTpR: config.defaultTpR, entryWindows: config.entryWindows.filter(w => w.action === 'tp'), ...combo }],
    ['(b) Kombi mit Philips Sperren', { ...config, ...combo }]];
  // Je Träger: erlaubte Trades und ihr TP nach Konfig.
  const cases = configs.map(([name, cfg]) => {
    const list = [...best.values()].filter(({ t, st }) => !g.dobGuardrailReason(cfg, { entryTime: t.entryTime,
      zoneAgeSeconds: dobSourceZoneAgeSeconds(t.sourceOfStrength, t.chart.firstOrderBlockStart), counterDobStatus: st }));
    const tp = new Map(list.map(({ t, st }) => [t, g.dobConfigTpR(cfg, t.entryTime, st)]));
    return { name, cfg, trades: list.map(x => x.t), statusOf: new Map(list.map(x => [x.t, x.st])), tpR: t => tp.get(t) };
  });
  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const outcomes = new Map();
  const outcome = (t, r) => { const k = `${dobTradeKey(t)}:${r}`; if (!outcomes.has(k)) outcomes.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction,
    entryTime: t.entryTime, entryPrice: t.entryPrice, stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd,
    instrument: DOB_SYMBOL, rMultiple: r })); return outcomes.get(k); };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);
  // n = Win + Loss, ΣR = R·Win − Loss, rOf je Trade (fest oder TP nach Konfig).
  const stats = (list, rOf) => { let w = 0, l = 0, sum = 0;
    for (const t of list) { const r = rOf(t), s = outcome(t, r).status; if (s === 'success') { w++; sum += r; } else if (s === 'loss') { l++; sum -= 1; } }
    return { n: w + l, winrate: w + l ? +(w / (w + l) * 100).toFixed(1) : null, sumR: +sum.toFixed(1) }; };
  const block = (list, rOf) => ({ trades: list.length, ...stats(list, rOf), 'Jan–Jun': stats(list.filter(t => month(t) <= '2026-06'), rOf),
    'Jul–Nov': stats(list.filter(t => month(t) >= '2026-07'), rOf) });
  const fmt = s => `${s.trades} T · ${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  return { ...runs, config, cases, outcome, block, fmt };
}
