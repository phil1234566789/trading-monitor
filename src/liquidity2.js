// Liquidität 2.1 (Philip, 22.11.2026, Variante B aus analysis/lq2-sweeps): nur "starke" LS, also Pivots, an denen
// andere Trader wirklich ihre SLs setzen. Short-LS (Long gespiegelt) ist stark, wenn
//   1. er ein Pivot-Hoch direkt nach einem LL ist (Pivot-Tief unter dem vorigen Pivot-Tief),
//   2. der Impuls vom LS weg mindestens LIQUIDITY2_MIN_IMPULSE_ATR H1-ATR misst,
//   3. und der Impuls mindestens LIQUIDITY2_MIN_BROKEN_SWINGS Swing-Tiefs per Schlusskurs bricht.
// Aktiv bis zum ersten Hoch über dem LS (danach gesweept). Die 2.0-Bedingung "BOS ≤ 2 h" ist ersatzlos weg: Sie
// trennte in den Daten kaum (Lift 1,3), Impuls und Swings tragen. Einen Asia-Ausschluss gibt es bewusst nicht.
// Pivots und Sweep kommen unverändert aus dem alten Algo (liquidityDetection.js), damit beide Indikatoren auf
// denselben Pivots stehen und der Vorher/Nachher-Vergleich nur die Auswahl zeigt.
// Mustertrade-Pins vom Typ liquidity2_ls sind Spezifikation: ein Umbau dieser Regel darf keinen davon verlieren
// (test/liquidity2ModelPins.test.js). Wird die Wache rot, Philip fragen, nicht den Test anpassen.
import { detectLiquidityLevels, LIQUIDITY_FRACTAL_PERIOD } from "./liquidityDetection.js";
import { closedHourAtrResolver } from "./atr.js";
import { toPips } from "./pipConfig.js";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";
import { registerChartObjectType } from "./chartObjectRegistry.js";

// 0,85 statt der runden 1,0 aus der Analyse: Pin 626 (Asia-Short, 0,87 H1-ATR) muss drin bleiben.
export const LIQUIDITY2_MIN_IMPULSE_ATR = 0.85;
export const LIQUIDITY2_MIN_BROKEN_SWINGS = 1;
const ATR_PERIOD = 14;

// "Zwei gleichrangige Pivots direkt hintereinander: das extremere zählt" — danach wechseln Hoch und Tief strikt ab.
// Bei Gleichstand bleibt das ältere stehen, wie beim Equal-High-Pivot im Fraktal selbst.
function alternatingPivots(highs, lows) {
  const result = [];
  for (const p of [...highs, ...lows].sort((a, b) => a.pivotTime - b.pivotTime)) {
    const last = result[result.length - 1];
    if (last?.dir !== p.dir) result.push(p);
    else if ((p.price - last.price) * p.dir > 0) result[result.length - 1] = p;
  }
  return result;
}

// Swing-Tiefs (Short; Long gespiegelt), die vor dem LS entstanden, bis zum LS noch nicht per Schlusskurs gebrochen
// waren und im Impuls per Schlusskurs gebrochen werden.
// ponytail: B&R-Level zählen noch nicht mit, nur Fraktal-Swings — erst wenn es eine B&R-Erkennung im Frontend gibt.
function countBrokenSwings(candles, swings, lsIdx, endIdx, dir, indexOf) {
  const closedThrough = (price, from, to) => {
    for (let i = from; i <= to; i++) if ((price - candles[i].close) * dir > 0) return true;
    return false;
  };
  return swings.filter((s) => {
    const idx = indexOf.get(s.pivotTime);
    return idx < lsIdx && !closedThrough(s.price, idx + 1, lsIdx) && closedThrough(s.price, lsIdx + 1, endIdx);
  }).length;
}

// Impuls-Messung wie analysis/lq2-sweeps/merkmale.mjs, damit Chart und Messung dieselben Zahlen liefern:
// BOS = erster Schluss hinter dem LL vor dem Sweep (optional, nur Info). Der Impuls läuft vom LS bis zum ersten
// Gegen-Pivot ab dem BOS (ohne BOS ab dem LS), höchstens bis vor den Sweep, sonst bis zur letzten Kerze.
function measureImpulse(candles, pivots, k, lsIdx, indexOf) {
  const ls = pivots[k], structure = pivots[k - 1], dir = ls.dir;
  const sweepIdx = ls.touched ? indexOf.get(ls.touchedTime) : candles.length;
  let bosIdx = null;
  for (let i = lsIdx + 1; i < sweepIdx; i++) if ((structure.price - candles[i].close) * dir > 0) { bosIdx = i; break; }
  const after = bosIdx != null ? candles[bosIdx].time : ls.pivotTime;
  const next = pivots.slice(k + 1).find((p) => p.dir !== dir && p.pivotTime >= after);
  const endIdx = Math.min(next ? indexOf.get(next.pivotTime) : candles.length - 1, sweepIdx - 1);
  let extreme = ls.price;
  for (let i = lsIdx + 1; i <= endIdx; i++) extreme = dir === 1 ? Math.min(extreme, candles[i].low) : Math.max(extreme, candles[i].high);
  return { bosTime: bosIdx != null ? candles[bosIdx].time : null, endIdx, impulse: Math.abs(ls.price - extreme) };
}

// Rückgabe wie detectLiquidityLevels-Level (price/dir/pivotTime/touched/touchedTime/endTime), ergänzt um
// structurePrice/structureTime (das LL bzw. HH), bosTime (oder null) und die Impuls-Kennzahlen fürs Label.
export function detectStrongLiquidityLevels(rohKerzen, { instrument, period = LIQUIDITY_FRACTAL_PERIOD } = {}) {
  const candles = rohKerzen.filter((c) => !c.ignored);
  if (candles.length === 0) return [];
  const { highs, lows } = detectLiquidityLevels(candles, period);
  const pivots = alternatingPivots(highs, lows);
  const indexOf = new Map(candles.map((c, i) => [c.time, i]));
  const atrAt = closedHourAtrResolver(candles, ATR_PERIOD);
  const result = [];

  for (let k = 3; k < pivots.length; k++) {
    const ls = pivots[k], structure = pivots[k - 1], previous = pivots[k - 3];
    // Short: structure ist ein Tief und muss unter dem vorigen Tief liegen (LL); Long gespiegelt (HH).
    if ((previous.price - structure.price) * ls.dir <= 0) continue;
    const atr = atrAt(ls.pivotTime);
    if (!atr) continue;
    const lsIdx = indexOf.get(ls.pivotTime);
    const { bosTime, endIdx, impulse } = measureImpulse(candles, pivots, k, lsIdx, indexOf);
    if (impulse / atr < LIQUIDITY2_MIN_IMPULSE_ATR) continue;
    const brokenSwings = countBrokenSwings(candles, ls.dir === 1 ? lows : highs, lsIdx, endIdx, ls.dir, indexOf);
    if (brokenSwings < LIQUIDITY2_MIN_BROKEN_SWINGS) continue;
    result.push({
      ...ls,
      structurePrice: structure.price,
      structureTime: structure.pivotTime,
      bosTime,
      impulsePips: toPips(impulse, instrument),
      impulseAtr: impulse / atr,
      brokenSwings,
    });
  }
  return result;
}

// "LS2 (3h) · 34 Pips / 2,1 ATR · 3 Swings · Sweep NY" — Alter über dieselbe Formel wie der alte LQ-Algo (formatAge).
// Die Sweep-Session ist reine Info (NY reagiert in den Daten deutlich besser, Asia schlechter), kein Filter.
export function formatStrongLiquidityLabel(lvl, ageLabel, sweepSession = null) {
  const parts = [ageLabel ? `LS2 ${ageLabel}` : "LS2", `${lvl.impulsePips.toFixed(1).replace(".", ",")} Pips`];
  if (lvl.impulseAtr != null) parts[1] += ` / ${lvl.impulseAtr.toFixed(1).replace(".", ",")} ATR`;
  parts.push(`${lvl.brokenSwings} ${lvl.brokenSwings === 1 ? "Swing" : "Swings"}`);
  if (sweepSession) parts.push(`Sweep ${sweepSession}`);
  return parts.join(" · ");
}

// Pinnbar über die generische Chartobjekt-Registry (kind='chart_object'). Der Snapshot friert die Erkennung zum
// Pin-Zeitpunkt ein; algoVersion hochzählen, sobald sich die Auswahlregel oben ändert.
registerChartObjectType("liquidity2_ls", {
  name: "Liquidität 2.0 (LS2)",
  algoVersion: "liquidity2-v2",
  key: (lvl) => `${lvl.dir}|${lvl.pivotTime}`,
  snapshot: (lvl) => ({
    dir: lvl.dir, price: lvl.price, pivotTime: lvl.pivotTime, touched: lvl.touched ?? false, touchedTime: lvl.touchedTime ?? null,
    structurePrice: lvl.structurePrice, structureTime: lvl.structureTime, bosTime: lvl.bosTime,
    impulsePips: lvl.impulsePips, impulseAtr: lvl.impulseAtr, brokenSwings: lvl.brokenSwings,
  }),
  time: (s) => s.pivotTime,
  line: (s) => ({ price: s.price, dir: s.dir, from: s.pivotTime, to: s.touchedTime ?? null,
    styleKey: s.touched ? "liquidity2Sweep" : s.dir === 1 ? "liquidity2High" : "liquidity2Low" }),
  label: (s, instrument) => `LS2 ${s.dir === 1 ? "Hoch" : "Tief"} ${fmtPrice(s.price, pricePrecisionForInstrument(instrument))}`,
});
