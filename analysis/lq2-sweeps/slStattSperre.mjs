// SL statt Sperre: Trifft die FVG-Anti-Confluence (R1, Varianten A/B) einen DOB-Entry, vergleichen wir
// (a) wie gelaufen (DOB-Ergebnis), (b) gesperrt (0 R) und (c) SL hinter den letzten bestätigten, unberührten P2-Swing jenseits des
// Hindernisses, Ziel unverändert. Proxy: Der Struktur-Algo markiert solche LH nicht als protected (DR #148: 14:30), daher P2-Fraktale.
// Nur lokale Daten (sammle.mjs, sammleDob.mjs). Schreibt sl-statt-sperre.json.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectLiquidityLevels } from '../../src/liquidityDetection.js';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { wilderAtrValues } from '../../src/atr.js';
import { markIgnoredCandles, sessionFromRow } from '../../src/sessionOccurrences.js';
import { berlinOffsetMinutes, formatDatedTime } from '../../src/berlinTime.js';
import { instrumentConfig, FOREX_MIN_FVG_PIPS } from '../../src/instrumentConfig.js';
import { mulberry32 } from './merkmale.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
let envDir = fileURLToPath(new URL('../..', import.meta.url));
while (!existsSync(path.join(envDir, '.env')) && path.dirname(envDir) !== envDir) envDir = path.dirname(envDir);
const data = path.join(envDir, 'local-data', 'lq2-sweeps');
const input = JSON.parse(await readFile(path.join(data, 'input.json'), 'utf8'));
const trades = JSON.parse(await readFile(path.join(data, 'dob-trades.json'), 'utf8'));
const tz = s => berlinOffsetMinutes(s * 1000);
const DAY = 86400, LOOKBACK = 2 * DAY, NEAR_ATR = 0.5, HORIZON = 10 * DAY;
const lb = (a, v, f) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (f(a[m]) < v) lo = m + 1; else hi = m; } return lo; };
const agg = (c, dur) => { const o = []; for (const x of c) { const t = Math.floor(x.time / dur) * dur, l = o.at(-1);
  if (l?.time === t) { l.high = Math.max(l.high, x.high); l.low = Math.min(l.low, x.low); l.close = x.close; l.ignored &&= x.ignored; } else o.push({ ...x, time: t }); } return o; };

function prepare(instrument) {
  const raw = JSON.parse(await_read(path.join(data, 'candles', `${instrument}-5m-${input.from}-${input.to}.json`)));
  const m5 = markIgnoredCandles(raw, input.sessions.filter(s => s.instrument === instrument).map(sessionFromRow), tz);
  const isForex = instrument !== 'XAUUSD', conf = instrumentConfig(instrument);
  const tfs = { '5m': [m5, 300], '15M': [agg(m5, 900), 900], '1H': [agg(m5, 3600), 3600] };
  const zones = [];
  for (const [tf, [c, dur]] of Object.entries(tfs)) {
    // OBs: bekannt mit Schluss der FVG-Kerze (startTime + 2 Kerzen); ungetestet bis touchedTime, gültig bis zur Invalidierung.
    for (const z of detectOrderBlocks(c, tf, isForex, isForex ? null : conf.minFvg[tf] ?? 0))
      zones.push({ kind: 'OB', tf, dir: z.dir, top: z.top, bottom: z.bottom, start: z.startTime, known: z.startTime + 2 * dur,
        // Touch/Invalidierung erst mit Schluss der berührenden Kerze bekannt (DR #148: 1H-OB 13:00 beim Entry noch ungetestet).
        dead: Math.min((z.touchedTime ?? Infinity) + dur, z.invalidated ? z.endTime + dur : Infinity) });
    // FVGs: offen, bis der Kurs sie vollständig durchlaufen hat (q40: Docht oder Schluss darin reicht nicht).
    const clean = c.filter(x => !x.ignored), min = isForex ? FOREX_MIN_FVG_PIPS[tf] * 0.0001 : conf.minFvg[tf] ?? 0;
    for (let i = 2; i < clean.length; i++) for (const dir of [1, -1]) {
      const bottom = dir === 1 ? clean[i - 2].high : clean[i].high, top = dir === 1 ? clean[i].low : clean[i - 2].low;
      if (top - bottom <= Math.max(min, 1e-9)) continue;
      let dead = Infinity;
      for (let j = i + 1; j < clean.length && clean[j].time < clean[i].time + LOOKBACK + HORIZON; j++)
        if (dir === 1 ? clean[j].low < bottom : clean[j].high > top) { dead = clean[j].time + dur; break; }
      zones.push({ kind: 'FVG', tf, dir, top, bottom, start: clean[i - 1].time, known: clean[i].time + dur, dead });
    }
  }
  zones.sort((a, b) => a.known - b.known);
  const c5 = m5.filter(x => !x.ignored), h1 = agg(c5, 3600), atr = wilderAtrValues(h1, 14);
  const atrAt = t => { const i = lb(h1, t - 3599, x => x.time) - 1; return i >= 0 ? atr[i] : null; };
  const swings = { M5: detectLiquidityLevels(c5, 2), M15: detectLiquidityLevels(agg(c5, 900), 2) };
  return { c5, zones, atrAt, swings, buffer: 5 * conf.tick };
}
import { readFileSync } from 'node:fs';
function await_read(f) { return readFileSync(f, 'utf8'); }

// Short (dir −1): bullische Zonen (dir 1) zwischen Ziel und Entry, deren Oberkante höchstens 0,5 H1-ATR unter dem Entry liegt
// (DR #148: 15M-FVG 13:30 umschließt den Entry). Long gespiegelt.
function obstacles(P, t, side, entry, target, atr, near = NEAR_ATR) {
  const out = [];
  for (let i = lb(P.zones, t - LOOKBACK, z => z.known); i < P.zones.length && P.zones[i].known <= t; i++) {
    const z = P.zones[i];
    if (z.dir !== -side || z.dead <= t || z.start < t - LOOKBACK) continue;
    const hit = side === -1 ? z.bottom < entry && z.top >= entry - near * atr && z.top > target
      : z.top > entry && z.bottom <= entry + near * atr && z.bottom < target;
    if (hit) out.push(z);
  }
  return out;
}
// Letzter bestätigter (Pivot + 3 Kerzen), bis zum Entry unberührter P2-Swing jenseits des ursprünglichen SL.
function structureSl(P, tfKey, t, side, sl) {
  const list = side === -1 ? P.swings[tfKey].highs : P.swings[tfKey].lows, dur = tfKey === 'M5' ? 300 : 900;
  let best = null;
  for (const s of list) {
    if (s.pivotTime + 3 * dur > t || s.pivotTime < t - LOOKBACK) continue;
    if (s.touched && s.touchedTime < t) continue;
    if ((s.price - sl) * -side <= 0) continue;
    if (!best || s.pivotTime > best.pivotTime) best = s;
  }
  return best && { price: best.price - side * P.buffer, pivotTime: best.pivotTime, swing: best.price };
}
// M5-Simulation ab der Entry-Kerze; SL und Ziel in derselben Kerze zählt konservativ als SL.
function simulate(P, entryTime, side, sl, target) {
  for (let i = lb(P.c5, Math.floor(entryTime / 300) * 300, x => x.time); i < P.c5.length && P.c5[i].time < entryTime + HORIZON; i++) {
    const x = P.c5[i];
    if (side === -1 ? x.high >= sl : x.low <= sl) return { win: false, time: x.time };
    if (side === -1 ? x.low <= target : x.high >= target) return { win: true, time: x.time };
  }
  return null;
}

// R eines Trades mit anderem SL. Semantik 'fest': Zielpreis bleibt; 'kR': Ziel = 2 × neues Risiko. null = offen.
function withSl(P, row, slPrice, semantik) {
  const risk = Math.abs(slPrice - row.entryPrice), target = semantik === 'kR' ? row.entryPrice + row.side * 2 * risk : row.target;
  const res = simulate(P, row.entryTime, row.side, slPrice, target);
  return res == null ? null : res.win ? (semantik === 'kR' ? 2 : Math.abs(row.target - row.entryPrice) / risk) : -1;
}
const CONTROL_REPS = 20, CONTROL_SEED = 20261123;
const B = t => { const s = formatDatedTime(t); return `${s.slice(8, 10)}.${s.slice(5, 7)}. ${s.slice(11)}`; };
const rows = [];
for (const instrument of input.instruments) {
  const P = prepare(instrument);
  for (const tr of trades.filter(r => r.instrument === instrument && ['success', 'loss'].includes(r.outcome) && r.entry_time < input.to - DAY)) {
    const side = tr.direction === 'short' ? -1 : 1, t = Math.floor(tr.entry_time / 300) * 300, atr = P.atrAt(t);
    const risk = Math.abs(tr.entry_price - tr.stop_price), targetR = Math.abs(tr.target_price - tr.entry_price) / risk;
    const ra = tr.outcome === 'success' ? targetR : -1;
    const obs = atr ? obstacles(P, t, side, tr.entry_price, tr.target_price, atr) : [];
    const hitA = obs.some(z => z.kind === 'FVG'), hitB = obs.some(z => z.kind === 'OB');
    // Streng: der Entry liegt in der Gegen-Zone (DR #148: 15M-FVG 13:30 und 1H-OB 13:00 umschließen den Entry).
    const hitStrict = atr ? obstacles(P, t, side, tr.entry_price, tr.target_price, atr, 0).length > 0 : false;
    const half = +formatDatedTime(tr.entry_time).slice(5, 7) <= 6 ? 'H1' : 'H2';
    const row = { run: tr.run_id, instrument, id: tr.id, side, entry: B(tr.entry_time), entryTime: tr.entry_time, entryPrice: tr.entry_price, sl: tr.stop_price,
      target: tr.target_price, targetR: +targetR.toFixed(2), outcome: tr.outcome, ra, hitA, hitB, hitStrict, half,
      hindernis: obs.slice(0, 3).map(z => `${z.kind} ${z.tf} ${B(z.start)} ${z.bottom.toFixed(5)}–${z.top.toFixed(5)}`),
      // Abstand Entry ↔ Hinderniskante in H1-ATR; negativ = Entry liegt in der Zone.
      hindernisse: obs.map(z => ({ kind: z.kind, tf: z.tf, dist: +((side === -1 ? tr.entry_price - z.top : z.bottom - tr.entry_price) / atr).toFixed(2) })) };
    const own = simulate(P, tr.entry_time, side, tr.stop_price, tr.target_price);
    row.simA = own ? (own.win ? 'win' : 'loss') : 'offen';
    for (const tfKey of ['M5', 'M15']) {
      const s = obs.length || hitStrict ? structureSl(P, tfKey, t, side, tr.stop_price) : null;
      if (!s) { row[`c${tfKey}`] = { R: ra, keinPunkt: obs.length > 0 || hitStrict }; continue; }
      const res = simulate(P, tr.entry_time, side, s.price, tr.target_price), newRisk = Math.abs(s.price - tr.entry_price);
      row[`c${tfKey}`] = { R: res == null ? 0 : res.win ? +(Math.abs(tr.target_price - tr.entry_price) / newRisk).toFixed(3) : -1,
        sl: +s.price.toFixed(5), swing: B(s.pivotTime), riskFaktor: +(newRisk / risk).toFixed(2), ergebnis: res ? (res.win ? 'win' : 'loss') : 'offen', zeit: res ? B(res.time) : null };
    }
    if (row.cM15.sl != null) row.cM15.R_kR = withSl(P, row, row.cM15.sl, 'kR');
    rows.push(row);
  }
  // Kontrolle (d): SL-Faktor von (c) M15 eines zufällig gezogenen ANDEREN Treffers desselben Laufs, angewandt aufs eigene DOB-Risiko.
  // Prüft, ob der Strukturpunkt etwas bringt oder nur die SL-Weite. Fester Seed, 20 Wiederholungen.
  const rnd = mulberry32(CONTROL_SEED);
  for (const run of [...new Set(rows.filter(r => r.instrument === instrument).map(r => r.run))]) {
    const hits = rows.filter(r => r.run === run && (r.hitA || r.hitB || r.hitStrict) && r.cM15.riskFaktor);
    for (const [i, row] of hits.entries()) {
      row.dFest = []; row.dKR = [];
      for (let k = 0; k < CONTROL_REPS; k++) {
        let j = Math.floor(rnd() * (hits.length - 1)); if (j >= i) j++;
        const sl = row.entryPrice - row.side * hits[j].cM15.riskFaktor * Math.abs(row.entryPrice - row.sl);
        row.dFest.push(withSl(P, row, sl, 'fest')); row.dKR.push(withSl(P, row, sl, 'kR'));
      }
    }
  }
}

const stats = list => {
  let cum = 0, peak = 0, dd = 0;
  for (const r of list) { cum += r; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const taken = list.filter(r => r !== 0);
  return { trades: taken.length, winrate: taken.length ? +(100 * taken.filter(r => r > 0).length / taken.length).toFixed(1) : null, sumR: +cum.toFixed(1), maxDD: +dd.toFixed(1) };
};
const variants = { a: r => r.ra, b: r => (r.hitA || r.hitB ? 0 : r.ra), cM5: r => (r.hitA || r.hitB ? r.cM5.R : r.ra), cM15: r => (r.hitA || r.hitB ? r.cM15.R : r.ra),
  b_nurA: r => (r.hitA ? 0 : r.ra), cM5_nurA: r => (r.hitA ? r.cM5.R : r.ra),
  b_streng: r => (r.hitStrict ? 0 : r.ra), cM5_streng: r => (r.hitStrict ? r.cM5.R : r.ra), cM15_streng: r => (r.hitStrict ? r.cM15.R : r.ra) };
const out = { measurement: 'sl-statt-sperre-v1', definitionen: {
  treffer: `bullische (Short) bzw. bärische (Long) Zone M5/M15/H1 der letzten 2 Tage, beim Entry offen (FVG nicht vollständig durchlaufen = A) bzw. ungetestet (OB = B), zwischen Ziel und Entry, Kante höchstens ${NEAR_ATR} H1-ATR hinter dem Entry`,
  c: 'SL = letzter bestätigter, bis Entry unberührter P2-Swing (M5 bzw. M15) der letzten 2 Tage jenseits des DOB-SL, plus 5 Ticks; Ziel unverändert; ohne solchen Swing bleibt (a)',
  a: 'DOB-Ergebnis (success = Ziel-R, loss = −1)', simulation: 'M5 ab Entry-Kerze, SL vor Ziel bei gleicher Kerze, 10 Tage Horizont' },
  gruppen: {} };
const groupsBy = { ...Object.fromEntries([...new Set(rows.map(r => r.run))].map(run => [run, rows.filter(r => r.run === run)])), 'alle LQ-Sweep': rows.filter(r => r.run.includes('lq-sweep')), 'alle HTF-OB v3': rows.filter(r => r.run.includes('setup')) };
for (const [g, list] of Object.entries(groupsBy)) {
  const sorted = [...list].sort((a, b) => a.entryTime - b.entryTime), hits = sorted.filter(r => r.hitA || r.hitB);
  out.gruppen[g] = { trades: list.length, treffer: hits.length, trefferA: hits.filter(r => r.hitA).length, trefferB: hits.filter(r => r.hitB).length,
    simStimmt: +(100 * list.filter(r => (r.simA === 'win') === (r.outcome === 'success') && r.simA !== 'offen').length / list.length).toFixed(1),
    trefferStreng: sorted.filter(r => r.hitStrict).length,
    gesamt: Object.fromEntries(Object.entries(variants).map(([k, f]) => [k, stats(sorted.map(f))])),
    halbjahre: Object.fromEntries(['H1', 'H2'].map(h => [h, Object.fromEntries(Object.entries(variants).map(([k, f]) => [k, stats(sorted.filter(r => r.half === h).map(f))]))])),
    nurTreffer: Object.fromEntries(['a', 'cM5', 'cM15'].map(k => [k, stats(hits.map(variants[k]))])),
    keinStrukturpunkt: hits.filter(r => r.cM5.keinPunkt).length,
    riskFaktorMedian: (() => { const v = hits.map(r => r.cM5.riskFaktor).filter(Boolean).sort((a, b) => a - b); return v[v.length >> 1] ?? null; })() };
}
out.dr148 = rows.filter(r => r.instrument === 'GBPUSD' && r.entry === '01.10. 15:14');
out.beispiele = rows.filter(r => (r.hitA || r.hitB) && r.outcome === 'loss' && r.cM5.ergebnis === 'win').slice(0, 4)
  .concat(rows.filter(r => (r.hitA || r.hitB) && r.outcome === 'success' && r.cM5.ergebnis === 'loss').slice(0, 2));
out.treffer = rows.filter(r => r.hitA || r.hitB).map(({ entryTime, ...r }) => r);
out.alle = rows.map(({ hindernis, ...r }) => r);
await writeFile(path.join(here, 'sl-statt-sperre.json'), JSON.stringify(out, null, 1));
for (const [g, s] of Object.entries(out.gruppen)) console.log(g.padEnd(24), `n ${s.trades} Treffer ${s.treffer} (A ${s.trefferA}, B ${s.trefferB}) sim=DOB ${s.simStimmt}% kein Punkt ${s.keinStrukturpunkt} Risiko×${s.riskFaktorMedian}`,
  '\n   ', Object.entries(s.gesamt).map(([k, v]) => `${k}: ${v.sumR}R WR ${v.winrate}% n ${v.trades} DD ${v.maxDD}`).join(' | '),
  '\n    nur Treffer:', Object.entries(s.nurTreffer).map(([k, v]) => `${k}: ${v.sumR}R WR ${v.winrate}% n ${v.trades} DD ${v.maxDD}`).join(' | '));
console.log('DR148', JSON.stringify(out.dr148.map(r => ({ run: r.run, hitA: r.hitA, hitB: r.hitB, ra: r.ra, cM5: r.cM5, cM15: r.cM15, h: r.hindernis }))));
