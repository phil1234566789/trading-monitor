// LQ 2.0 Datenbasis, Schritt 2: Merkmale je gesweeptem LQ-1.0-Level (M5, P5) und Vergleich Positiv / Zufall / Negativ.
// Liest local-data/lq2-sweeps (aus sammle.mjs), schreibt analysis/lq2-sweeps/ergebnis.json. Keine DB-Zugriffe.
// Pivots, Sweep, BOS-2h-Regel, OBs, ATR und Sessions kommen aus src/, damit die Zahlen zum Chart passen.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { detectLiquidityLevels, LIQUIDITY_FRACTAL_PERIOD } from '../../src/liquidityDetection.js';
import { detectStrongLiquidityLevels } from '../../src/liquidity2.js';
import { wilderAtrValues } from '../../src/atr.js';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { sessionFromRow, markIgnoredCandles, buildSessionContextLookup, contextForPivot } from '../../src/sessionOccurrences.js';
import { berlinOffsetMinutes, formatDatedTime } from '../../src/berlinTime.js';
import { toPips } from '../../src/pipConfig.js';
import { instrumentConfig, obMinimum } from '../../src/instrumentConfig.js';

const here = fileURLToPath(new URL('.', import.meta.url));
let envDir = fileURLToPath(new URL('../..', import.meta.url));
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const dataDir = path.join(envDir, 'local-data', 'lq2-sweeps');
const input = JSON.parse(await readFile(path.join(dataDir, 'input.json'), 'utf8'));
const tz = s => berlinOffsetMinutes(s * 1000);
const SPAN_FROM = Date.parse('2026-01-05T00:00:00+01:00') / 1000; // erster Handelstag 2026, davor M5-Warmup
const SEED = 20261121;
const key = (dir, t) => `${dir}:${t}`;

// Mustertrades (UTC): DR #145 starker LS 18.11. 15:45 Berlin, popeliger LS 19:40, P557 LS 07:45 (XAU).
const MUSTER = [
  { instrument: 'GBPUSD', dir: 1, pivotTime: Date.parse('2026-11-18T14:45:00Z') / 1000, ref: 'DR #145 LS 15:45', group: 'pos' },
  { instrument: 'XAUUSD', dir: 1, pivotTime: Date.parse('2026-11-18T06:45:00Z') / 1000, ref: 'P557 LS 07:45', group: 'pos' },
  { instrument: 'GBPUSD', dir: 1, pivotTime: Date.parse('2026-11-18T18:40:00Z') / 1000, ref: 'DR #145 popeliger LS 19:40', group: 'neg' },
];

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function aggregate(candles, dur) {
  const out = [];
  for (const c of candles) {
    const t = Math.floor(c.time / dur) * dur, last = out[out.length - 1];
    if (last?.time === t) { last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low); last.close = c.close; }
    else out.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  return out;
}
const lowerBound = (arr, v, f) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(arr[m]) < v) lo = m + 1; else hi = m; } return lo; };
// Kopie von alternatingPivots aus src/liquidity2.js (dort nicht exportiert; Produktivcode bleibt unangetastet).
function alternatingPivots(highs, lows) {
  const result = [];
  for (const p of [...highs, ...lows].sort((a, b) => a.pivotTime - b.pivotTime)) {
    const last = result[result.length - 1];
    if (last?.dir !== p.dir) result.push(p);
    else if ((p.price - last.price) * p.dir > 0) result[result.length - 1] = p;
  }
  return result;
}

function sessionLabel(t, lookup) {
  for (const { label, occurrences } of lookup) if (occurrences.some(o => t >= o.startSec && t < o.endSec)) return label;
  const m = ((t / 60 + tz(t)) % 1440 + 1440) % 1440;
  // London steht nicht in der sessions-Tabelle: Lücke zwischen Asia-Ende und MMM-Start.
  return m >= 420 && m < 630 ? 'London' : 'Sonstige';
}

function featuresFor(instrument) {
  const raw = JSON.parse(readFileSync(path.join(dataDir, 'candles', `${instrument}-5m-${input.from}-${input.to}.json`), 'utf8'));
  const cfg = input.sessions.filter(s => s.instrument === instrument).map(sessionFromRow);
  const marked = markIgnoredCandles(raw, cfg, tz);
  const candles = marked.filter(c => !c.ignored);
  const idx = new Map(candles.map((c, i) => [c.time, i]));
  const { highs, lows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const strong = new Set(detectStrongLiquidityLevels(marked, { instrument }).map(l => key(l.dir, l.pivotTime)));
  const pivots = alternatingPivots(highs, lows);
  const altIdx = new Map(pivots.map((p, k) => [key(p.dir, p.pivotTime), k]));
  const h1 = aggregate(candles, 3600), atrH1 = wilderAtrValues(h1, 14);
  const atrAt = t => { const i = lowerBound(h1, t - 3600 + 1, c => c.time) - 1; return i >= 0 ? atrH1[i] : null; };
  const isForex = instrument !== 'XAUUSD', conf = instrumentConfig(instrument);
  // OB-Erkennung auf den ungefilterten Kerzen: FVGs dürfen nicht über die Spread-Hour-Lücke zusammenrücken.
  const obs = tf => detectOrderBlocks(tf === '5m' ? marked : aggregate(marked, 900), tf, isForex, isForex ? null : obMinimum(instrument, tf))
    .sort((a, b) => a.startTime - b.startTime);
  const zones = { m5: obs('5m'), m15: obs('15M') };
  // Pip-Toleranz Gold: 1 Forex-Pip ≙ 1/3 USD wie beim DOB-LQ-Sweep-Abgleich (XAU ≤ 1 USD ⇔ Forex ≤ 3 Pips).
  const tol = { tick: conf.tick * 1.01, pip: isForex ? 0.0001 : 1 / 3 };
  const onEdge = (list, L, t) => {
    const from = lowerBound(list, L.pivotTime - 3 * 86400, z => z.startTime);
    for (let i = from; i < list.length && list[i].startTime <= L.pivotTime + 3600; i++) {
      const z = list[i];
      if (z.endTime >= L.pivotTime && (Math.abs(z.top - L.price) <= t || Math.abs(z.bottom - L.price) <= t)) return true;
    }
    return false;
  };
  const lookup = buildSessionContextLookup(cfg, input.from, input.to, tz, candles);

  // Erster Schlusskurs durch jedes Swing-Level (für "gebrochene Swings im Impuls").
  const firstBreak = new Map();
  for (const s of [...highs, ...lows]) {
    let i = idx.get(s.pivotTime) + 1;
    while (i < candles.length && (s.price - candles[i].close) * -s.dir <= 0) i++;
    firstBreak.set(s, i);
  }
  const swingsSorted = { 1: [...lows].sort((a, b) => a.pivotTime - b.pivotTime), [-1]: [...highs].sort((a, b) => a.pivotTime - b.pivotTime) };

  const result = new Map();
  for (const dir of [1, -1]) {
    const levels = dir === 1 ? highs : lows;
    // Aktive Kandidaten zum Sweep-Zeitpunkt: bestätigt (Pivot + P Kerzen) und bis dahin unberührt.
    const byKnown = [...levels].sort((a, b) => a.pivotTime - b.pivotTime);
    let ptr = 0, active = [];
    for (const L of [...levels].filter(l => l.touched).sort((a, b) => a.touchedTime - b.touchedTime)) {
      const T = L.touchedTime;
      while (ptr < byKnown.length && byKnown[ptr].pivotTime + LIQUIDITY_FRACTAL_PERIOD * 300 <= T) active.push(byKnown[ptr++]);
      active = active.filter(a => !a.touched || a.touchedTime >= T);
      const lsIdx = idx.get(L.pivotTime), sweepIdx = idx.get(T);
      const atr = atrAt(L.pivotTime);
      const k = altIdx.get(key(dir, L.pivotTime));
      const f = { instrument, dir, pivotTime: L.pivotTime, touchedTime: T, price: L.price, hasAltPivot: k != null };
      f.ageHours = (T - L.pivotTime) / 3600;
      f.lhAfterLL = k != null && k >= 3 ? (pivots[k - 3].price - pivots[k - 1].price) * dir > 0 : null;
      f.isLH = k != null && k >= 2 ? (pivots[k - 2].price - L.price) * dir > 0 : null;
      f.bos2h = strong.has(key(dir, L.pivotTime));
      let bosIdx = null;
      if (k != null && k >= 1) for (let i = lsIdx + 1; i < sweepIdx; i++) if ((pivots[k - 1].price - candles[i].close) * dir > 0) { bosIdx = i; break; }
      f.bosBeforeSweep = bosIdx != null;
      f.bosMinutes = bosIdx != null ? (candles[bosIdx].time - L.pivotTime) / 60 : null;
      // Impuls wie Liquidität 2.0: bis zum ersten Gegen-Pivot ab dem BOS (ohne BOS: ab dem LS), höchstens bis vor den Sweep.
      const after = bosIdx != null ? candles[bosIdx].time : L.pivotTime;
      const next = k != null ? pivots.slice(k + 1, k + 40).find(p => p.dir !== dir && p.pivotTime >= after) : null;
      const endIdx = Math.min(next ? idx.get(next.pivotTime) : sweepIdx - 1, sweepIdx - 1);
      let extreme = L.price, extremeIdx = lsIdx;
      for (let i = lsIdx + 1; i <= endIdx; i++) {
        const v = dir === 1 ? candles[i].low : candles[i].high;
        if ((extreme - v) * dir > 0) { extreme = v; extremeIdx = i; }
      }
      const impulse = Math.abs(L.price - extreme);
      f.impulsePips = toPips(impulse, instrument);
      f.impulseAtr = atr ? impulse / atr : null;
      f.impulseMinutes = (candles[extremeIdx].time - L.pivotTime) / 60;
      // ponytail: nur Swings der 5 Tage vor dem LS; liquidity2.js zählt alle, ältere ungebrochene sind selten.
      const sw = swingsSorted[dir];
      let broken = 0;
      for (let i = lowerBound(sw, L.pivotTime - 5 * 86400, s => s.pivotTime); i < sw.length && sw[i].pivotTime < L.pivotTime; i++) {
        const b = firstBreak.get(sw[i]);
        if (b > lsIdx && b <= endIdx) broken++;
      }
      f.brokenSwings = broken;
      const sc = candles[sweepIdx];
      const depth = dir === 1 ? sc.high - L.price : L.price - sc.low;
      f.sweepDepthPips = toPips(depth, instrument);
      f.sweepDepthAtr = atr ? depth / atr : null;
      f.closedBack = (L.price - sc.close) * dir > 0;
      f.lsSession = sessionLabel(L.pivotTime, lookup);
      f.sweepSession = sessionLabel(T, lookup);
      const ctx = contextForPivot(L.pivotTime, dir, L.price, lookup);
      f.sessionExtreme = !!ctx && !ctx.endsWith('mid');
      f.m5ObTick = onEdge(zones.m5, L, tol.tick); f.m5ObPip = onEdge(zones.m5, L, tol.pip);
      f.m15ObTick = onEdge(zones.m15, L, tol.tick); f.m15ObPip = onEdge(zones.m15, L, tol.pip);
      const others = active.filter(a => a !== L);
      f.rankRecency = 1 + others.filter(a => a.pivotTime > L.pivotTime).length;
      const beyond = others.filter(a => (a.price - L.price) * dir > 0).map(a => Math.abs(a.price - L.price));
      const gap = beyond.length ? Math.min(...beyond) : null;
      f.gapNextPips = gap == null ? null : toPips(gap, instrument);
      f.gapNextAtr = gap == null || !atr ? null : gap / atr;
      result.set(key(dir, L.pivotTime), f);
    }
  }
  return { features: result, levelCount: highs.length + lows.length, candles: candles.length };
}

// ---- Stichproben ---------------------------------------------------------------------------------------------
const setupById = new Map(input.setups.map(s => [s.id, s]));
const rangeById = new Map(input.ranges.map(r => [r.id, r]));
const samples = [];
const add = s => samples.push(s);
const lsOfSetup = s => s && s.ls_price != null && (s.ls_timeframe == null || s.ls_timeframe === '5M')
  ? { dir: s.direction === 'short' ? 1 : -1, pivotTime: s.lsPivotTime } : null;

for (const p of input.pins) if (p.pin_type === 'model' && /taugt als LQ-Sweep Kraft/.test(p.note ?? ''))
  add({ source: 'pin', group: 'pos', instrument: p.m5_liquidity_instrument, dir: p.m5_liquidity_direction === 'high' ? 1 : -1, pivotTime: p.pivotTime, ref: `Pin ${p.id}` });

// Journal: Ausgang je Dealing Range (Idee hat funktioniert, wenn mindestens eine Position gewann).
const drOutcome = new Map();
for (const p of input.positions) {
  if (!p.dealing_range_id) continue;
  const win = p.outcome === 'win' || p.r_multiple > 0, loss = p.outcome === 'loss' || p.r_multiple < 0;
  const cur = drOutcome.get(p.dealing_range_id) ?? { win: false, loss: false, positions: [] };
  cur.win ||= win; cur.loss ||= loss; cur.positions.push(p.id);
  drOutcome.set(p.dealing_range_id, cur);
}
const journalNoLs = [];
for (const [drId, o] of drOutcome) {
  if (!o.win && !o.loss) continue;
  const dr = rangeById.get(drId); if (!dr) continue;
  const group = o.win ? 'pos' : 'neg', dir = dr.direction === 'short' ? 1 : -1;
  const ls = lsOfSetup(setupById.get(dr.trade_setup_id));
  if (ls) { add({ source: 'journal-setup', group, instrument: dr.instrument, ...ls, ref: `DR #${drId}` }); continue; }
  const ev = input.evidence.filter(e => (e.dealing_range_id === drId || o.positions.includes(e.trade_position_id)) && e.timeframe === '5M');
  const times = [...new Set(ev.map(e => e.sourceTime))];
  if (!times.length) journalNoLs.push(drId);
  for (const t of times) add({ source: 'journal-evidence', group, instrument: dr.instrument, dir, pivotTime: t, ref: `DR #${drId}` });
}

// Läufe: je Lauf und LS (POI-Setup) zählt der erste Trade.
const runStats = {};
const byRunLs = new Map();
for (const r of [...input.runs].sort((a, b) => a.entry_time - b.entry_time)) {
  if (!['success', 'loss'].includes(r.outcome) || !r.poiTradeSetupId) continue;
  const k = `${r.run_id}|${r.poiTradeSetupId}`;
  const cur = byRunLs.get(k) ?? { run: r.run_id, ts: r.poiTradeSetupId, first: r.outcome, wins: 0, trades: 0 };
  cur.trades++; if (r.outcome === 'success') cur.wins++;
  byRunLs.set(k, cur);
}
for (const v of byRunLs.values()) {
  const s = setupById.get(v.ts), ls = lsOfSetup(s);
  runStats[v.run] ??= { ls: 0, lsNot5m: 0 };
  if (!ls) { runStats[v.run].lsNot5m++; continue; }
  runStats[v.run].ls++;
  add({ source: `lauf:${v.run}`, group: v.first === 'success' ? 'pos' : 'neg', instrument: s.instrument, ...ls, ref: `TS ${v.ts}`, trades: v.trades, wins: v.wins });
}
for (const m of MUSTER) add({ source: 'muster', ...m });

// ---- Merkmale + Zuordnung ------------------------------------------------------------------------------------
const out = { measurement: 'lq2-sweeps-v1', git: execSync('git rev-parse --short HEAD').toString().trim(), snapshotAt: input.snapshotAt,
  span: { from: formatDatedTime(SPAN_FROM), to: formatDatedTime(input.to) }, seed: SEED, instruments: {}, journalDrOhneLs: journalNoLs, runStats };
const rnd = mulberry32(SEED);
const allRows = [];
for (const instrument of input.instruments) {
  const { features, levelCount, candles } = featuresFor(instrument);
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
const NUM = ['ageHours', 'impulsePips', 'impulseAtr', 'impulseMinutes', 'brokenSwings', 'bosMinutes', 'sweepDepthPips', 'sweepDepthAtr', 'rankRecency', 'gapNextAtr'];
const BOOL = ['hasAltPivot', 'lhAfterLL', 'isLH', 'bos2h', 'bosBeforeSweep', 'closedBack', 'sessionExtreme', 'm5ObTick', 'm5ObPip', 'm15ObTick', 'm15ObPip'];
const CAT = ['lsSession', 'sweepSession'];
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return +(s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)).toFixed(2); };
const normP = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return 2 * p; };
function auc(a, b) { // Mann-Whitney: P(a > b), zweiseitiges p über Normalapproximation
  a = a.filter(v => v != null); b = b.filter(v => v != null);
  if (a.length < 3 || b.length < 3) return null;
  const all = [...a.map(v => [v, 0]), ...b.map(v => [v, 1])].sort((x, y) => x[0] - y[0]);
  let rankA = 0;
  for (let i = 0; i < all.length;) { let j = i; while (j < all.length && all[j][0] === all[i][0]) j++; const r = (i + j + 1) / 2; for (let k = i; k < j; k++) if (all[k][1] === 0) rankA += r; i = j; }
  const U = rankA - a.length * (a.length + 1) / 2, m = a.length * b.length;
  const z = (U - m / 2) / Math.sqrt(m * (a.length + b.length + 1) / 12);
  return { auc: +(U / m).toFixed(3), p: +normP(z).toPrecision(2), n: [a.length, b.length] };
}
function prop(a, b) {
  const xa = a.filter(Boolean).length, xb = b.filter(Boolean).length, na = a.length, nb = b.length;
  if (na < 3 || nb < 3) return null;
  const p = (xa + xb) / (na + nb), se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return { a: +(xa / na * 100).toFixed(1), b: +(xb / nb * 100).toFixed(1), p: se ? +normP((xa / na - xb / nb) / se).toPrecision(2) : 1, n: [na, nb] };
}
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
await writeFile(path.join(here, 'ergebnis.json'), JSON.stringify(out, null, 1));
for (const [i, o] of Object.entries(out.instruments)) console.log(i, JSON.stringify(o.mengen), 'unmatched', o.unmatched.length);
