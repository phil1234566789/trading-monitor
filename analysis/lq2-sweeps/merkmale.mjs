// LQ 2.0 Datenbasis: gemeinsame Merkmalsberechnung je gesweeptem LQ-1.0-Level (M5, P5) und Stichproben (Pins, Journal, Läufe,
// Muster). Pivots, Sweep, BOS-2h-Regel, OBs, ATR und Sessions kommen aus src/, damit die Zahlen zum Chart passen. Keine DB-Zugriffe.
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLiquidityLevels, LIQUIDITY_FRACTAL_PERIOD } from '../../src/liquidityDetection.js';
import { detectStrongLiquidityLevels } from '../../src/liquidity2.js';
import { wilderAtrValues } from '../../src/atr.js';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { sessionFromRow, markIgnoredCandles, buildSessionContextLookup, contextForPivot } from '../../src/sessionOccurrences.js';
import { berlinOffsetMinutes } from '../../src/berlinTime.js';
import { toPips } from '../../src/pipConfig.js';
import { instrumentConfig, obMinimum } from '../../src/instrumentConfig.js';

export const here = fileURLToPath(new URL('.', import.meta.url));
let envDir = fileURLToPath(new URL('../..', import.meta.url));
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const dataDir = path.join(envDir, 'local-data', 'lq2-sweeps');
export const input = JSON.parse(await readFile(path.join(dataDir, 'input.json'), 'utf8'));
export const tz = s => berlinOffsetMinutes(s * 1000);
export const SPAN_FROM = Date.parse('2026-01-05T00:00:00+01:00') / 1000; // erster Handelstag 2026, davor M5-Warmup
export const SEED = 20261121;
export const key = (dir, t) => `${dir}:${t}`;

// Mustertrades (UTC): DR #145 starker LS 18.11. 15:45 Berlin, popeliger LS 19:40, P557 LS 07:45 (XAU).
const MUSTER = [
  { instrument: 'GBPUSD', dir: 1, pivotTime: Date.parse('2026-11-18T14:45:00Z') / 1000, ref: 'DR #145 LS 15:45', group: 'pos' },
  { instrument: 'XAUUSD', dir: 1, pivotTime: Date.parse('2026-11-18T06:45:00Z') / 1000, ref: 'P557 LS 07:45', group: 'pos' },
  { instrument: 'GBPUSD', dir: 1, pivotTime: Date.parse('2026-11-18T18:40:00Z') / 1000, ref: 'DR #145 popeliger LS 19:40', group: 'neg' },
];

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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

// Reaktions-Fenster: 1 h, 3 h, bis Sessionende (Berliner Grenzen wie in `sessions`, London = Lücke 07:00–10:30).
// Startwert, am DR-#145-Sweep geprüft; je nach Bedarf 15–60 min.
const SWEEP_ZONE_SEC = 30 * 60;
const SESSION_BOUNDS = [420, 630, 780, 840, 1320, 1380, 1440];
const sessionEnd = t => { const m = ((t / 60 + tz(t)) % 1440 + 1440) % 1440; return t + (SESSION_BOUNDS.find(b => b > m) - m) * 60; };
// trendAt: stündliche TS1.1-Kette aus elternTrend.mjs (Stand zur vollen Stunde vor dem Sweep), sonst null.
function trendLookup(instrument) {
  const file = path.join(dataDir, `trend-${instrument}.json`);
  if (!existsSync(file)) return () => null;
  const byHour = new Map(JSON.parse(readFileSync(file, 'utf8')).map(x => [x.at, x]));
  return t => byHour.get(Math.floor(t / 3600) * 3600) ?? null;
}

export function featuresFor(instrument) {
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
  const trendAt = trendLookup(instrument);

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
      // Sweep-Kerze: Größe in ATR und Lage des Schlusses (1 = Schluss am Gegen-Ende, 0 = am gesweepten Extrem).
      const atrSweep = atrAt(T), range = sc.high - sc.low;
      f.sweepRangeAtr = atrSweep ? range / atrSweep : null;
      f.sweepRejection = range > 0 ? (dir === 1 ? sc.high - sc.close : sc.close - sc.low) / range : null;
      f.sweepBodyAtr = atrSweep ? Math.abs(sc.close - sc.open) / atrSweep : null;
      // Gegen-FVG direkt nach dem Sweep (M5-OB in Reaktionsrichtung, entsteht bis 2 Kerzen danach). Schon Teil der Reaktion.
      f.counterFvg = zones.m5.some(z => z.dir === -dir && z.startTime >= T - 300 && z.startTime <= T + 600);
      const tr = trendAt(T), want = dir === 1 ? 'downtrend' : 'uptrend';
      const side = v => v === 'uptrend' || v === 'downtrend' ? v === want : null;
      f.withRoot = side(tr?.root); f.withCurrent = side(tr?.current);
      // Sweep-Zone: 30 min ab dem ersten Touch. Ein Sweep läuft oft über mehrere Kerzen (DR #145: Touch und Rückschluss 11:40, Hoch
      // erst 11:45), deshalb ist erst das Zonen-Extrem die Re-Sweep-Grenze. Ohne M5-Schluss zurück hinter den LS in der Zone = Durchbruch.
      let ext = dir === 1 ? sc.high : sc.low, backIdx = null, zoneEnd = sweepIdx;
      for (let i = sweepIdx; i < candles.length && candles[i].time < T + SWEEP_ZONE_SEC; i++) {
        ext = dir === 1 ? Math.max(ext, candles[i].high) : Math.min(ext, candles[i].low);
        if (backIdx == null && (L.price - candles[i].close) * dir > 0) backIdx = i;
        zoneEnd = i;
      }
      f.breakout = backIdx == null;
      f.backMinutes = backIdx != null ? (candles[backIdx].time - T) / 60 : null;
      f.zoneDepthAtr = atrSweep ? Math.abs(ext - L.price) / atrSweep : null;
      // Reaktion ab dem Touch: MFE vom LS weg, bis nach der Zone das Zonen-Extrem erneut überschritten wird (Re-Sweep).
      const ends = { '1h': T + 3600, '3h': T + 3 * 3600, session: Math.max(T + 3600, Math.min(sessionEnd(T), T + 12 * 3600)) };
      let mfe = 0, mae = 0, resweep = null;
      const mark = {};
      for (let i = sweepIdx; i < candles.length && candles[i].time < ends.session; i++) {
        const c = candles[i];
        if (i > zoneEnd && resweep == null && (dir === 1 ? c.high > ext : c.low < ext)) resweep = c.time;
        if (resweep == null) mfe = Math.max(mfe, dir === 1 ? L.price - c.low : c.high - L.price);
        if (i > zoneEnd) mae = Math.max(mae, dir === 1 ? c.high - ext : ext - c.low);
        for (const [w, end] of Object.entries(ends)) if (c.time < end) mark[w] = { mfe, mae, resweep };
      }
      for (const w of Object.keys(ends)) {
        const m = mark[w];
        f[`mfe_${w}`] = atrSweep ? m.mfe / atrSweep : null;
        f[`mae_${w}`] = atrSweep ? m.mae / atrSweep : null;
        f[`resweep_${w}`] = m.resweep != null;
      }
      f.resweepMinutes = resweep != null ? (resweep - T) / 60 : null;
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
export const setupById = new Map(input.setups.map(s => [s.id, s]));
const rangeById = new Map(input.ranges.map(r => [r.id, r]));
export const samples = [];
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
export const journalNoLs = [];
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
export const runStats = {};
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

export const NUM = ['ageHours', 'impulsePips', 'impulseAtr', 'impulseMinutes', 'brokenSwings', 'bosMinutes', 'sweepDepthPips', 'sweepDepthAtr', 'rankRecency', 'gapNextAtr'];
export const BOOL = ['hasAltPivot', 'lhAfterLL', 'isLH', 'bos2h', 'bosBeforeSweep', 'closedBack', 'sessionExtreme', 'm5ObTick', 'm5ObPip', 'm15ObTick', 'm15ObPip'];
export const CAT = ['lsSession', 'sweepSession'];
export const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return +(s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)).toFixed(2); };
const normP = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return 2 * p; };
export function auc(a, b) { // Mann-Whitney: P(a > b), zweiseitiges p über Normalapproximation
  a = a.filter(v => v != null); b = b.filter(v => v != null);
  if (a.length < 3 || b.length < 3) return null;
  const all = [...a.map(v => [v, 0]), ...b.map(v => [v, 1])].sort((x, y) => x[0] - y[0]);
  let rankA = 0;
  for (let i = 0; i < all.length;) { let j = i; while (j < all.length && all[j][0] === all[i][0]) j++; const r = (i + j + 1) / 2; for (let k = i; k < j; k++) if (all[k][1] === 0) rankA += r; i = j; }
  const U = rankA - a.length * (a.length + 1) / 2, m = a.length * b.length;
  const z = (U - m / 2) / Math.sqrt(m * (a.length + b.length + 1) / 12);
  return { auc: +(U / m).toFixed(3), p: +normP(z).toPrecision(2), n: [a.length, b.length] };
}
export function prop(a, b) {
  const xa = a.filter(Boolean).length, xb = b.filter(Boolean).length, na = a.length, nb = b.length;
  if (na < 3 || nb < 3) return null;
  const p = (xa + xb) / (na + nb), se = Math.sqrt(p * (1 - p) * (1 / na + 1 / nb));
  return { a: +(xa / na * 100).toFixed(1), b: +(xb / nb * 100).toFixed(1), p: se ? +normP((xa / na - xb / nb) / se).toPrecision(2) : 1, n: [na, nb] };
}
