// Labor DOB-LAB-IDEE (Philip): mehrere Trades auf dieselbe Idee (gleiche Kraft-Zone + Richtung + Retest-Episode der Zone).
// Konfig-Regeln (1) nur erster Entry, (2) kein Entry solange einer offen, (3) höchstens 2, (4) nach Loss keine weiteren; Träger wie der
// v3-Fill (Kombi), ohne und mit Philips Sperren. Ausgang je Trade zum TP nach Konfig. Schreibt analysis/dob-setup/lab-idea-xau-2026.json.
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
  const [{ createDobCounterDobGate, dobSourceRetestTime }, { supabase }, { dobGuardrailsFromRow, dobConfigTpR, dobGuardrailReason, DOB_GUARDRAILS_DEFAULT },
    { dobSourceZoneAgeSeconds }, { formatDatedTime }] = await Promise.all(
    ['/src/dobCounterDob.js', '/src/supabaseClient.js', '/src/dobGuardrails.js', '/src/dobSourceOfStrength.js', '/src/berlinTime.js'].map(load));
  const { v2Carriers, m5Marked, m1Marked, dataEnd, evaluateDoubleOrderBlockOutcome, berlinDateStrFor, gitHash } = await loadDobRuns(server, root);
  const { data: cfgRow, error } = await supabase.from('dob_guardrails').select('*').eq('instrument', SYMBOL).maybeSingle();
  if (error) throw error;
  const config = dobGuardrailsFromRow(cfgRow);
  // Träger wie der v3-Fill: bester Gegen-DOB-Status je Trade, Repräsentant = Paar mit diesem Status.
  const gate = createDobCounterDobGate({ m5Candles: m5Marked, m1Candles: m1Marked, instrument: SYMBOL });
  const RANK = { none: 0, dead: 1, live: 2 }, best = new Map();
  for (const t of v2Carriers) { const st = gate(t)?.status ?? 'none', k = dobTradeKey(t); if (!best.has(k) || RANK[st] < RANK[best.get(k).st]) best.set(k, { t, st }); }
  const ideaOf = t => { const s = t.sourceOfStrength;
    return `${t.direction}:${s.timeframe}:${s.zoneStartTime}:${s.zone.bottom}:${s.zone.top}:${dobSourceRetestTime(t)}`; };

  const lowerBound = t => { let lo = 0, hi = m1Marked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (m1Marked[m].time < t) lo = m + 1; else hi = m; } return lo; };
  const outcomes = new Map();
  const outcome = (t, r) => { const k = `${dobTradeKey(t)}:${r}`; if (!outcomes.has(k)) outcomes.set(k, evaluateDoubleOrderBlockOutcome({ direction: t.direction,
    entryTime: t.entryTime, entryPrice: t.entryPrice, stopPrice: t.stopPrice, candles: m1Marked.slice(lowerBound(t.entryTime)), evaluatedAt: dataEnd,
    instrument: SYMBOL, rMultiple: r })); return outcomes.get(k); };
  const month = t => berlinDateStrFor(t.entryTime).slice(0, 7);

  const comboMode = { counterDobMode: 'live_block_dead_5r' };
  const plain = { ...DOB_GUARDRAILS_DEFAULT, defaultTpR: config.defaultTpR, entryWindows: config.entryWindows.filter(w => w.action === 'tp'), ...comboMode };
  const saved = { ...config, ...comboMode };
  const result = { measurement: 'dob-lab-idea-v1', git: gitHash, symbol: SYMBOL, dataEnd, dataEndBerlin: berlinDateStrFor(dataEnd),
    methodology: ['Trades: v2 mit Gegen-DOB-Status wie der v3-Fill (bester über die tragenden Paare), Modus Kombi; (a) nur TP-Fenster/Default, (b) Philips gespeicherte Konfig mit Sperren.',
      'Idee = gleiche Richtung + gleiche Kraft-Zone (TF, Start, Kanten) + gleiche Retest-Episode der Zone (Start der letzten Touch-Episode vor OB1).',
      'Ausgang je Trade: evaluateDoubleOrderBlockOutcome zum TP nach Konfig (inkl. nur tote Gegen-DOBs → 5R). Offen = Ausgang nach dem Entry des nächsten Trades bzw. noch offen/unbekannt.',
      '(2) und (4) kausal in Entry-Reihenfolge über die zugelassenen Trades; (4) sperrt erst ab dem Ausstieg des Losses.',
      'n = Win + Loss, ΣR = R·Win − Loss; Halbjahre nach Berliner Entry-Monat.'],
    carriers: {} };
  for (const [cName, cfg] of [['(a) Kombi ohne Sperren', plain], ['(b) Kombi mit Philips Sperren', saved]]) {
    const list = [...best.values()].filter(({ t, st }) => !dobGuardrailReason(cfg, { entryTime: t.entryTime,
      zoneAgeSeconds: dobSourceZoneAgeSeconds(t.sourceOfStrength, t.chart.firstOrderBlockStart), counterDobStatus: st }));
    const rOf = new Map(list.map(({ t, st }) => [t, dobConfigTpR(cfg, t.entryTime, st)]));
    const res = t => { const o = outcome(t, rOf.get(t)); return { status: o.status, exit: o.recognizedAt ?? Infinity, r: rOf.get(t) }; };
    const stats = l => { let w = 0, lo = 0, sum = 0; for (const t of l) { const o = res(t); if (o.status === 'success') { w++; sum += o.r; } else if (o.status === 'loss') { lo++; sum -= 1; } }
      return { n: w + lo, winrate: w + lo ? +(w / (w + lo) * 100).toFixed(1) : null, sumR: +sum.toFixed(1) }; };
    const block = l => ({ trades: l.length, ...stats(l), 'Jan–Jun': stats(l.filter(t => month(t) <= '2026-06')), 'Jul–Nov': stats(l.filter(t => month(t) >= '2026-07')) });
    const ideas = new Map();
    for (const { t } of list) (ideas.get(ideaOf(t)) ?? ideas.set(ideaOf(t), []).get(ideaOf(t))).push(t);
    for (const l of ideas.values()) l.sort((a, b) => a.entryTime - b.entryTime);
    const pick = keep => [...ideas.values()].flatMap(l => { const kept = []; for (const t of l) if (keep(t, kept)) kept.push(t); return kept; });
    const rules = {
      'Konfig (alle Entries)': list.map(x => x.t),
      '(1) nur erster Entry je Idee': pick((t, kept) => kept.length === 0),
      '(2) kein Entry, solange einer derselben Idee offen ist': pick((t, kept) => kept.every(k => res(k).exit <= t.entryTime)),
      '(3) höchstens 2 Entries je Idee': pick((t, kept) => kept.length < 2),
      '(4) nach einem Loss derselben Idee keine weiteren': pick((t, kept) => !kept.some(k => res(k).status === 'loss' && res(k).exit <= t.entryTime)),
    };
    const sizes = [...ideas.values()].map(l => l.length);
    const byPos = pos => [...ideas.values()].flatMap(l => pos < 3 ? (l[pos - 1] ? [l[pos - 1]] : []) : l.slice(2));
    // Beispiel 28.08.: alle Ideen mit ≥ 3 Trades, die in einer Stunde komplett ausgestoppt wurden, als Beleg.
    const wipeouts = [...ideas.values()].filter(l => l.length >= 3 && l.every(t => res(t).status === 'loss')).length;
    result.carriers[cName] = { trades: list.length, ideas: ideas.size,
      distribution: { '1': sizes.filter(n => n === 1).length, '2': sizes.filter(n => n === 2).length, '3+': sizes.filter(n => n >= 3).length, max: Math.max(...sizes) },
      ideasWith3PlusAllLoss: wipeouts,
      ideasWith3PlusAnyWin: [...ideas.values()].filter(l => l.length >= 3 && l.some(t => res(t).status === 'success')).length,
      byPosition: { '1.': block(byPos(1)), '2.': block(byPos(2)), '3.+': block(byPos(3)) },
      rules: Object.fromEntries(Object.entries(rules).map(([n, l]) => [n, block(l)])),
      example2808: [...ideas.values()].filter(l => berlinDateStrFor(l[0].entryTime) === '2026-08-28').map(l => l.map(t => `${t.direction} ${formatDatedTime(t.entryTime)} ${res(t).status}`)) };
  }
  await fs.writeFile(path.join(root, 'analysis', 'dob-setup', 'lab-idea-xau-2026.json'), JSON.stringify(result, null, 2));
  const f = s => `${s.trades} T · ${s.n} ${s.winrate}% ${s.sumR}R (${s['Jan–Jun'].sumR}/${s['Jul–Nov'].sumR})`;
  for (const [c, v] of Object.entries(result.carriers)) {
    console.log(`\n== ${c}: ${v.trades} Trades, ${v.ideas} Ideen, Verteilung ${JSON.stringify(v.distribution)}, 3+ alle Loss ${v.ideasWith3PlusAllLoss}, 3+ mit Win ${v.ideasWith3PlusAnyWin}`);
    for (const [k, s] of Object.entries(v.byPosition)) console.log('Position', k.padEnd(5), f(s));
    for (const [k, s] of Object.entries(v.rules)) console.log(k.padEnd(56), f(s));
    console.log('28.08.:', JSON.stringify(v.example2808));
  }
} finally {
  await server.close();
}
