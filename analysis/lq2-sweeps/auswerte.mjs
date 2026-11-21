// LQ 2.0 Datenbasis, Schritt 2: Positiv / Zufall / Negativ je LS und Lauf-Trades je Halbjahr. Liest local-data/lq2-sweeps (aus sammle.mjs),
// schreibt analysis/lq2-sweeps/ergebnis.json.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { formatDatedTime } from '../../src/berlinTime.js';
import { here, input, SPAN_FROM, SEED, key, mulberry32, featuresFor, samples, journalNoLs, runStats, NUM, BOOL, CAT, q, auc, prop } from './merkmale.mjs';

// ---- Merkmale + Zuordnung ------------------------------------------------------------------------------------
const out = { measurement: 'lq2-sweeps-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), snapshotAt: input.snapshotAt,
  span: { from: formatDatedTime(SPAN_FROM), to: formatDatedTime(input.to) }, seed: SEED, instruments: {}, journalDrOhneLs: journalNoLs, runStats };
const rnd = mulberry32(SEED);
const allRows = [], featureMaps = {};
for (const instrument of input.instruments) {
  const { features, levelCount, candles } = featuresFor(instrument);
  featureMaps[instrument] = features;
  const mine = samples.filter(s => s.instrument === instrument);
  let unmatched = [];
  for (const s of mine) {
    let f = features.get(key(s.dir, s.pivotTime));
    // Fallback ±1 Kerze: TS-/Evidence-Zeiten können eine Kerze neben dem Fraktal liegen.
    if (!f) for (const d of [-300, 300]) f ??= features.get(key(s.dir, s.pivotTime + d));
    if (!f) { unmatched.push({ ...s, berlin: formatDatedTime(s.pivotTime) }); continue; }
    allRows.push({ ...s, ...f, berlin: formatDatedTime(f.pivotTime) });
  }
  const pool = [...features.values()].filter(f => f.pivotTime >= SPAN_FROM);
  const posKeys = new Set(allRows.filter(r => r.instrument === instrument && r.group === 'pos').map(r => key(r.dir, r.pivotTime)));
  const n = Math.min(pool.length, Math.max(10 * posKeys.size, 3000));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const f of pool.slice(0, n)) allRows.push({ source: 'zufall', group: 'zufall', ...f });
  out.instruments[instrument] = { m5Candles: candles, lq1Levels: levelCount, sweptInSpan: [...features.values()].filter(f => f.pivotTime >= SPAN_FROM).length, randomN: n,
    unmatched: unmatched.map(({ source, ref, berlin, dir }) => ({ source, ref, berlin, dir })),
    bySource: Object.fromEntries(Object.entries(Object.groupBy(mine, s => `${s.source}/${s.group}`)).map(([k, v]) => [k, v.length])) };
}

// ---- Statistik ------------------------------------------------------------------------------------------------
const uniq = rows => [...new Map(rows.map(r => [key(r.dir, r.pivotTime), r])).values()];
function groups(instrument) {
  const rows = allRows.filter(r => r.instrument === instrument);
  const pos = uniq(rows.filter(r => r.group === 'pos')), neg = uniq(rows.filter(r => r.group === 'neg'));
  const posK = new Set(pos.map(r => key(r.dir, r.pivotTime))), negK = new Set(neg.map(r => key(r.dir, r.pivotTime)));
  const conflict = [...posK].filter(k => negK.has(k));
  return {
    positiv: pos.filter(r => !negK.has(key(r.dir, r.pivotTime))), negativ: neg.filter(r => !posK.has(key(r.dir, r.pivotTime))),
    zufall: rows.filter(r => r.group === 'zufall'), conflict: conflict.length,
    pin: rows.filter(r => r.source === 'pin'), journalPos: uniq(rows.filter(r => r.source.startsWith('journal') && r.group === 'pos')),
    journalNeg: uniq(rows.filter(r => r.source.startsWith('journal') && r.group === 'neg')),
    laufPos: uniq(rows.filter(r => r.source.startsWith('lauf') && r.group === 'pos')), laufNeg: uniq(rows.filter(r => r.source.startsWith('lauf') && r.group === 'neg')),
  };
}
const describe = rows => ({
  n: rows.length,
  ...Object.fromEntries(NUM.map(f => { const v = rows.map(r => r[f]).filter(x => x != null); return [f, { q25: q(v, .25), med: q(v, .5), q75: q(v, .75) }]; })),
  ...Object.fromEntries(BOOL.map(f => [f, rows.length ? +(rows.filter(r => r[f]).length / rows.length * 100).toFixed(1) : null])),
  ...Object.fromEntries(CAT.map(f => [f, Object.fromEntries(Object.entries(Object.groupBy(rows, r => r[f])).map(([k, v]) => [k, +(v.length / rows.length * 100).toFixed(1)]))])),
});
const compare = (a, b) => Object.fromEntries([...NUM.map(f => [f, auc(a.map(r => r[f]), b.map(r => r[f]))]), ...BOOL.map(f => [f, prop(a.map(r => !!r[f]), b.map(r => !!r[f]))])]);

const RULES = {
  'LQ2.0 heute (LH nach LL + BOS ≤ 2 h)': r => r.bos2h,
  'LH nach LL': r => r.lhAfterLL,
  'LS ist LH (bzw. HL)': r => r.isLH,
  'BOS vor dem Sweep (ohne Zeitlimit)': r => r.bosBeforeSweep,
  'LH nach LL + BOS vor Sweep': r => r.lhAfterLL && r.bosBeforeSweep,
  '≥ 1 gebrochener Swing': r => r.brokenSwings >= 1,
  '≥ 2 gebrochene Swings': r => r.brokenSwings >= 2,
  'Impuls ≥ 0,5 H1-ATR': r => r.impulseAtr >= 0.5,
  'Impuls ≥ 1 H1-ATR': r => r.impulseAtr >= 1,
  'Alter ≥ 2 h': r => r.ageHours >= 2,
  'Alter ≥ 6 h': r => r.ageHours >= 6,
  'Sweep schließt zurück': r => r.closedBack,
  'Session-High/-Low': r => r.sessionExtreme,
  'M5/M15-OB-Kante (Pip)': r => r.m5ObPip || r.m15ObPip,
  'Impuls ≥ 0,5 ATR + ≥ 1 Swing': r => r.impulseAtr >= 0.5 && r.brokenSwings >= 1,
  'Impuls ≥ 1 ATR + ≥ 1 Swing': r => r.impulseAtr >= 1 && r.brokenSwings >= 1,
  'Impuls ≥ 1 ATR + Alter ≥ 2 h': r => r.impulseAtr >= 1 && r.ageHours >= 2,
  '≥ 1 Swing + Alter ≥ 2 h': r => r.brokenSwings >= 1 && r.ageHours >= 2,
  'Impuls ≥ 0,5 ATR + ≥ 1 Swing + Alter ≥ 2 h': r => r.impulseAtr >= 0.5 && r.brokenSwings >= 1 && r.ageHours >= 2,
};
const share = (rows, fn) => rows.length ? +(rows.filter(fn).length / rows.length * 100).toFixed(1) : null;
function ruleTable(g) {
  // Lauf-Trades: Winrate des ersten Trades je LS, behalten vs. verworfen (das ist der eigentliche Nutzen-Test).
  const lauf = [...g.laufPos.map(r => ({ ...r, win: true })), ...g.laufNeg.map(r => ({ ...r, win: false }))];
  return Object.fromEntries(Object.entries(RULES).map(([name, fn]) => {
    const kept = lauf.filter(fn), dropped = lauf.filter(r => !fn(r));
    const wr = rows => rows.length ? +(rows.filter(r => r.win).length / rows.length * 100).toFixed(1) : null;
    return [name, { positivBehalten: share(g.positiv, fn), pinBehalten: share(g.pin, fn), journalWinBehalten: share(g.journalPos, fn),
      negativBehalten: share(g.negativ, fn), zufallRaus: g.zufall.length ? +(100 - share(g.zufall, fn)).toFixed(1) : null,
      laufWinrateBehalten: wr(kept), laufWinrateVerworfen: wr(dropped), laufBehalten: kept.length, laufVerworfen: dropped.length,
      laufP: prop(kept.map(r => r.win), dropped.map(r => r.win))?.p ?? null }];
  }));
}

for (const instrument of input.instruments) {
  const g = groups(instrument), o = out.instruments[instrument];
  o.mengen = { positiv: g.positiv.length, negativ: g.negativ.length, zufall: g.zufall.length, konfliktPosNeg: g.conflict, pin: g.pin.length,
    journalPos: g.journalPos.length, journalNeg: g.journalNeg.length, laufPos: g.laufPos.length, laufNeg: g.laufNeg.length };
  o.verteilung = Object.fromEntries(['positiv', 'negativ', 'zufall', 'pin', 'journalPos', 'journalNeg', 'laufPos', 'laufNeg'].map(k => [k, describe(g[k])]));
  o.vergleich = { positivVsZufall: compare(g.positiv, g.zufall), laufGewinnerVsVerlierer: compare(g.laufPos, g.laufNeg),
    pinVsZufall: compare(g.pin, g.zufall), journalGewinnerVsVerlierer: compare(g.journalPos, g.journalNeg) };
  o.regeln = ruleTable(g);
  // Je Lauf getrennt (v0/v1 überlappen sich), nur Gewinner vs. Verlierer.
  o.jeLauf = Object.fromEntries([...new Set(allRows.filter(r => r.instrument === instrument && r.source.startsWith('lauf')).map(r => r.source))].map(src => {
    const rows = allRows.filter(r => r.instrument === instrument && r.source === src);
    const p = rows.filter(r => r.group === 'pos'), n = rows.filter(r => r.group === 'neg');
    return [src, { gewinner: p.length, verlierer: n.length, vergleich: compare(p, n), regeln: ruleTable({ ...g, laufPos: p, laufNeg: n }) }];
  }));
}
out.einzelfaelle = allRows.filter(r => ['pin', 'muster'].includes(r.source) || r.source.startsWith('journal'))
  .map(({ source, group, ref, instrument, dir, berlin, ...f }) => ({ source, group, ref, instrument, dir, berlin,
    ...Object.fromEntries([...NUM, ...BOOL, ...CAT].map(k => [k, typeof f[k] === 'number' ? +f[k].toFixed(2) : f[k]])) }));
// Trade-Ebene: ALLE Trades je Lauf (nicht nur der erste je LS) mit dem LS ihres TS1.1-POI, Gewinner gegen Verlierer je Halbjahr
// (Berliner Entry-Monat). Ein Merkmal zählt nur, wenn es in H1 und H2 trennt (p < 0,05, gleiche Richtung). Trades desselben LS sind
// nicht unabhängig: das p ist daher zu optimistisch.
const halfOf = t => +formatDatedTime(t).slice(5, 7) <= 6 ? 'H1' : 'H2';
const lsByTs = new Map(input.setups.map(s => [s.id, s]));
out.tradeEbene = {};
for (const run of [...new Set(input.runs.map(r => r.run_id))].sort()) {
  const trades = input.runs.filter(r => r.run_id === run && ['success', 'loss'].includes(r.outcome)).map(r => {
    const s = lsByTs.get(r.poiTradeSetupId);
    if (!s || s.ls_price == null || (s.ls_timeframe != null && s.ls_timeframe !== '5M')) return null;
    const f = featureMaps[s.instrument]?.get(key(s.direction === 'short' ? 1 : -1, s.lsPivotTime));
    return f && { ...f, win: r.outcome === 'success', half: halfOf(r.entry_time) };
  }).filter(Boolean);
  const res = { trades: trades.length, ohneLs: input.runs.filter(r => r.run_id === run && ['success', 'loss'].includes(r.outcome)).length - trades.length };
  for (const h of ['H1', 'H2']) { const l = trades.filter(t => t.half === h); res[h] = { n: l.length, winrate: l.length ? +(100 * l.filter(t => t.win).length / l.length).toFixed(1) : null }; }
  res.merkmale = Object.fromEntries([...NUM, ...BOOL].map(f => {
    const e = Object.fromEntries(['H1', 'H2'].map(h => { const l = trades.filter(t => t.half === h), v = t => typeof t[f] === 'boolean' ? +t[f] : t[f];
      return [h, auc(l.filter(t => t.win).map(v), l.filter(t => !t.win).map(v))]; }));
    return [f, { ...e, trenntBeide: !!(e.H1 && e.H2 && e.H1.p < 0.05 && e.H2.p < 0.05 && Math.sign(e.H1.auc - 0.5) === Math.sign(e.H2.auc - 0.5)) }];
  }));
  res.trenntInBeidenHalbjahren = Object.entries(res.merkmale).filter(([, e]) => e.trenntBeide).map(([f, e]) => `${f} (AUC ${e.H1.auc}/${e.H2.auc})`);
  out.tradeEbene[run] = res;
}
await writeFile(path.join(here, 'ergebnis.json'), JSON.stringify(out, null, 1));
for (const [i, o] of Object.entries(out.instruments)) console.log(i, JSON.stringify(o.mengen), 'unmatched', o.unmatched.length);
for (const [run, r] of Object.entries(out.tradeEbene)) console.log(run, r.trades, 'ohne LS', r.ohneLs, JSON.stringify(r.H1), JSON.stringify(r.H2), 'trennt:', r.trenntInBeidenHalbjahren.join(', ') || '–');
