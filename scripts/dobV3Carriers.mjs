// Gemeinsame Grundlage der v3-Labor-Skripte: Träger wie der v3-Fill (bester Gegen-DOB-Status je Trade), Philips Konfig im Modus
// Kombi einmal ohne (a) und einmal mit (b) seinen Sperren, Ausgang zum TP nach Konfig. Damit zählen alle Messungen dieselben Trades.
import { loadDobRuns, DOB_SYMBOL } from './dobRuns.mjs';
import { dobTradeKey } from './dobSetupGrid.mjs';

export async function loadDobV3Lab(server, root) {
  const load = p => server.ssrLoadModule(p);
  const [{ createDobCounterDobGate, dobPoiRetestTime }, { supabase }, g, { dobPoiZoneAgeSeconds }, { candlePatternsIn, candleDirection }] = await Promise.all(
    ['/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js', '/src/dobHtfObPoi.js', '/src/candlePatterns.js'].map(load));
  const runs = await loadDobRuns(server, root);
  const { v2Carriers, m5Marked, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor } = runs;
  const { data: cfgRow, error } = await g.dobGuardrailsQuery(supabase, DOB_SYMBOL, 'htf_ob');
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
      zoneAgeSeconds: dobPoiZoneAgeSeconds(t.poi, t.chart.firstOrderBlockStart), counterDobStatus: st }));
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
  // Idee = Richtung + POI-Zone + Retest-Episode der Zone (DOB-LAB-IDEE); Regeln kausal in Entry-Reihenfolge, Ausgang zum tpR.
  const ideaOf = t => { const s = t.poi; return `${t.direction}:${s.timeframe}:${s.zoneStartTime}:${s.zone.bottom}:${s.zone.top}:${dobPoiRetestTime(t)}`; };
  const ideasOf = trades => { const ideas = new Map();
    for (const t of trades) (ideas.get(ideaOf(t)) ?? ideas.set(ideaOf(t), []).get(ideaOf(t))).push(t);
    for (const l of ideas.values()) l.sort((a, b) => a.entryTime - b.entryTime); return ideas; };
  const ideaRules = (trades, tpR) => {
    const res = t => { const o = outcome(t, tpR(t)); return { status: o.status, exit: o.recognizedAt ?? Infinity }; };
    const ideas = ideasOf(trades), pick = keep => [...ideas.values()].flatMap(l => { const kept = []; for (const t of l) if (keep(t, kept)) kept.push(t); return kept; });
    return { '(1) nur erster Entry je Idee': pick((t, kept) => kept.length === 0),
      '(2) kein Entry, solange einer derselben Idee offen ist': pick((t, kept) => kept.every(k => res(k).exit <= t.entryTime)),
      '(3) höchstens 2 Entries je Idee': pick((t, kept) => kept.length < 2),
      '(4) nach einem Loss derselben Idee keine weiteren': pick((t, kept) => !kept.some(k => res(k).status === 'loss' && res(k).exit <= t.entryTime)) };
  };
  // Price Action (DOB-PA): letzte n M5-Kerzen, die vor dem Entry geschlossen sind; Gegenmuster/-kerzen gegen die Trade-Richtung.
  const m5Index = t => { let lo = 0, hi = m5Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m5Marked[m].time + 300 <= t) lo = m + 1; else hi = m; } return lo; };
  const priceAction = (t, n) => {
    const end = m5Index(t.entryTime), candles = m5Marked.slice(Math.max(0, end - n), end), against = t.direction === 'short' ? 'bull' : 'bear';
    const patterns = candlePatternsIn(candles);
    return { counterPattern: patterns.some(p => p.side === against), withPattern: patterns.some(p => p.side !== against),
      counterCandles: candles.filter(c => candleDirection(c) === against).length, patterns };
  };
  const fmt = s => `${s.trades} T · ${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  // Philips gespeicherte Konfig komplett: Fall (b) filtert ohne features, Gegenkerzen nach seinem Modus hier (Abnahme 267 T, +143R).
  const b = cases[1], candleN = { '3of3': 3, '3of5': 5 }[b.cfg.counterCandlesMode];
  const philips = { ...b, name: 'Philips Konfig', trades: candleN ? b.trades.filter(t => priceAction(t, candleN).counterCandles < 3) : b.trades };
  return { ...runs, config, cases, philips, outcome, block, fmt, ideasOf, ideaRules, priceAction };
}
