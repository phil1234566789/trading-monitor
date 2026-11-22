// Liquidität 2.0 (Philip, 21.11.2026): nur "starke" LS, also Pivots, an denen andere Trader wirklich ihre SLs
// setzen. Short-LS (Long gespiegelt) ist stark, wenn
//   1. er ein Pivot-Hoch direkt nach einem LL ist (Pivot-Tief unter dem vorigen Pivot-Tief),
//   2. vor dem ersten Hoch über dem LS eine Kerze unter diesem LL schließt (BOS), höchstens
//      LIQUIDITY2_BOS_MAX_SECONDS nach dem LS,
//   3. und er bis zum ersten Hoch über ihm aktiv bleibt (danach gesweept).
// Pivots und Sweep kommen unverändert aus dem alten Algo (liquidityDetection.js), damit beide Indikatoren auf
// denselben Pivots stehen und der Vorher/Nachher-Vergleich nur die Auswahl zeigt.
// Mustertrade-Pins vom Typ liquidity2_ls sind Spezifikation: ein Umbau dieser Regel darf keinen davon verlieren
// (test/liquidity2ModelPins.test.js). Wird die Wache rot, Philip fragen, nicht den Test anpassen.
import { detectLiquidityLevels, liquidityTouch, LIQUIDITY_FRACTAL_PERIOD } from "./liquidityDetection.js";
import { wilderAtrValues } from "./atr.js";
import { toPips } from "./pipConfig.js";
import { fmtPrice, pricePrecisionForInstrument } from "./format.js";
import { registerChartObjectType } from "./chartObjectRegistry.js";

// Startwert aus Philips Beispielen (M5), noch nicht gemessen. Ein später BOS heißt: kein impulsiver Abgang, dort
// liegt keine SL-Häufung.
export const LIQUIDITY2_BOS_MAX_SECONDS = 2 * 3600;
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

// Erste Kerze nach dem LS, die unter dem LL schließt; null, wenn vorher der LS selbst berührt wird oder das
// Zeitfenster abläuft.
function findBos(candles, fromIdx, ls, structurePrice, maxSeconds) {
  for (let i = fromIdx + 1; i < candles.length; i++) {
    const c = candles[i];
    if (c.time - ls.pivotTime > maxSeconds || liquidityTouch(c, ls.price, ls.dir)) return null;
    if ((structurePrice - c.close) * ls.dir > 0) return i;
  }
  return null;
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

// Rückgabe wie detectLiquidityLevels-Level (price/dir/pivotTime/touched/touchedTime/endTime), ergänzt um
// structurePrice/structureTime (das LL bzw. HH), bosTime und die Impuls-Kennzahlen fürs Label. Der Impuls läuft
// vom LS bis zum ersten Gegen-Pivot ab dem BOS (oder bis zur letzten Kerze, solange der noch fehlt).
export function detectStrongLiquidityLevels(rohKerzen, { instrument, period = LIQUIDITY_FRACTAL_PERIOD, bosMaxSeconds = LIQUIDITY2_BOS_MAX_SECONDS } = {}) {
  const candles = rohKerzen.filter((c) => !c.ignored);
  if (candles.length === 0) return [];
  const { highs, lows } = detectLiquidityLevels(candles, period);
  const pivots = alternatingPivots(highs, lows);
  const indexOf = new Map(candles.map((c, i) => [c.time, i]));
  const atr = wilderAtrValues(candles, ATR_PERIOD);
  const result = [];

  for (let k = 3; k < pivots.length; k++) {
    const ls = pivots[k], structure = pivots[k - 1], previous = pivots[k - 3];
    // Short: structure ist ein Tief und muss unter dem vorigen Tief liegen (LL); Long gespiegelt (HH).
    if ((previous.price - structure.price) * ls.dir <= 0) continue;
    const lsIdx = indexOf.get(ls.pivotTime);
    const bosIdx = findBos(candles, lsIdx, ls, structure.price, bosMaxSeconds);
    if (bosIdx == null) continue;

    // Erster Gegen-Pivot NACH dem BOS — ein Zwischen-Pullback vor dem BOS beendet den Impuls nicht.
    const next = pivots.slice(k + 1).find((p) => p.dir !== ls.dir && p.pivotTime >= candles[bosIdx].time);
    const endIdx = next ? indexOf.get(next.pivotTime) : candles.length - 1;
    let extreme = ls.price;
    for (let i = lsIdx + 1; i <= endIdx; i++) extreme = ls.dir === 1 ? Math.min(extreme, candles[i].low) : Math.max(extreme, candles[i].high);
    const impulse = Math.abs(ls.price - extreme);
    const swings = ls.dir === 1 ? lows : highs;
    result.push({
      ...ls,
      structurePrice: structure.price,
      structureTime: structure.pivotTime,
      bosTime: candles[bosIdx].time,
      impulsePips: toPips(impulse, instrument),
      impulseAtr: atr[lsIdx] ? impulse / atr[lsIdx] : null,
      brokenSwings: countBrokenSwings(candles, swings, lsIdx, endIdx, ls.dir, indexOf),
    });
  }
  return result;
}

// "LS2 (3h) · 34 Pips / 2,1 ATR · 3 Swings" — Alter über dieselbe Formel wie der alte LQ-Algo (formatAge).
export function formatStrongLiquidityLabel(lvl, ageLabel) {
  const parts = [ageLabel ? `LS2 ${ageLabel}` : "LS2", `${lvl.impulsePips.toFixed(1).replace(".", ",")} Pips`];
  if (lvl.impulseAtr != null) parts[1] += ` / ${lvl.impulseAtr.toFixed(1).replace(".", ",")} ATR`;
  parts.push(`${lvl.brokenSwings} ${lvl.brokenSwings === 1 ? "Swing" : "Swings"}`);
  return parts.join(" · ");
}

// Pinnbar über die generische Chartobjekt-Registry (kind='chart_object'). Der Snapshot friert die Erkennung zum
// Pin-Zeitpunkt ein; algoVersion hochzählen, sobald sich die Auswahlregel oben ändert.
registerChartObjectType("liquidity2_ls", {
  algoVersion: "liquidity2-v1",
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
