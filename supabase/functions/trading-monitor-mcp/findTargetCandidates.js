// find_targets-Algorithmus, Deno-Kopie für Lana (Chat 2026-08-27: "jetzt bereite bitte alles so
// vor, dass Lana auch zugriff zur find target algo hat"). Port von src/findTargets.js
// (findNearestLiquidityTargets/findNearestObTargets/isTooFarFromPrice, Konstanten unverändert 1:1
// übernommen — Philip: "hast du die Konstanten schön in unserer Datei gelagert, wo die anderen
// Konstanten auch sind?"). Der Kandidaten-Pool selbst wird NICHT aus src/ importiert (Browser-
// Abhängigkeiten, siehe CLAUDE.md "MCP-Server"), sondern exakt dieselbe M5-live+HTF-DB-
// Zusammenstellung wie tools/dataExport.ts (dortige m5LiquidityLevels/m5ObZones/liquidityLevels/
// obZones-Bausteine) hier separat gebündelt, ohne den kompletten buildDataExport (Struktur-Trend,
// Sessions, Asia-Range) mitzuziehen — find_targets braucht nur die Kandidaten + den aktuellen Preis.
import { fetchForexCandles } from "./forexCandles.ts";
import { getLiquidityLevels, getObZones } from "./db.ts";
import { detectLiquidityLevels, filterRelevantLevels, LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "./liquidityDetection.js";
import { detectOrderBlocks } from "./orderBlockDetection.js";
import { PIP_SIZE } from "./pipConfig.js";

export const DEFAULT_LIQUIDITY_TARGET_LIMIT = 5;
export const DEFAULT_OB_TARGET_LIMIT = 3;
export const MAX_TARGET_DISTANCE_PIPS = 50;

// 1:1 aus src/findTargets.js — levels: {price, touched, ...}, direction ist die TARGET-Richtung
// ('long'/'short', nicht die Level-Richtung 'high'/'low' — die spielt hier keine Rolle).
export function findNearestLiquidityTargets(levels, { direction, currentPrice, limit = DEFAULT_LIQUIDITY_TARGET_LIMIT }) {
  if (currentPrice == null) return [];
  const onValidSide = (levels ?? []).filter((lvl) => (direction === "short" ? lvl.price < currentPrice : lvl.price > currentPrice));
  const untouched = onValidSide.filter((lvl) => !lvl.touched);
  return untouched
    .slice()
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, limit);
}

// 1:1 aus src/findTargets.js — zones: {dir: 1|-1, top, bottom, touched, invalidated, timeframe}.
export function findNearestObTargets(zones, { direction, currentPrice, limit = DEFAULT_OB_TARGET_LIMIT, timeframe = null }) {
  if (currentPrice == null) return [];
  const wantedDir = direction === "short" ? 1 : -1;
  const candidates = (zones ?? [])
    .filter((z) => !z.touched && !z.invalidated && z.dir === wantedDir)
    .filter((z) => timeframe == null || z.timeframe === timeframe)
    .map((z) => ({ zone: z, edgePrice: direction === "short" ? z.top : z.bottom }))
    .filter(({ edgePrice }) => (direction === "short" ? edgePrice < currentPrice : edgePrice > currentPrice));
  return candidates
    .sort((a, b) => Math.abs(a.edgePrice - currentPrice) - Math.abs(b.edgePrice - currentPrice))
    .slice(0, limit)
    .map(({ zone, edgePrice }) => ({ ...zone, targetPrice: edgePrice }));
}

// 1:1 aus src/findTargets.js.
export function isTooFarFromPrice(price, currentPrice, maxPips = MAX_TARGET_DISTANCE_PIPS) {
  if (currentPrice == null) return false;
  return Math.abs(price - currentPrice) > maxPips * PIP_SIZE;
}

// Dieselben Werte wie tools/dataExport.ts's M5_DETECTION_LOOKBACK_HOURS/-CANDLE_BUFFER/-BAR_SECONDS
// (dort dupliziert statt importiert, siehe CLAUDE.md "MCP-Server" — hier aus demselben Grund noch
// einmal dupliziert statt dataExport.ts anzufassen, das diese Konstanten nicht exportiert).
const M5_DETECTION_LOOKBACK_HOURS = 7 * 24;
const M5_DETECTION_CANDLE_BUFFER = 20;
const M5_BAR_SECONDS = 300;

// Dieselbe Dedupe-Schwelle wie tools/dataExport.ts's SAME_PRICE_EPSILON — ein live erkanntes
// M5-Level auf demselben Preis wie ein 1H/4H-Level ist redundant, das HTF-Level ist bedeutsamer.
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;

// Baut den Kandidaten-Pool (M5 live + HTF DB, beide Richtungen, beide Objektarten) für ein
// Instrument zu einem Zeitpunkt — dieselbe Zusammenstellung wie tools/dataExport.ts:229-307, nur
// ohne die dortigen Struktur-Trend-/Sessions-/Asia-Range-Bausteine.
async function buildCandidatePool(instrument, currentTimeSec) {
  const m5DetectionCount = Math.ceil((M5_DETECTION_LOOKBACK_HOURS * 3600) / M5_BAR_SECONDS) + M5_DETECTION_CANDLE_BUFFER;
  const [m5DetectionRaw, liquidityLevels, obZones] = await Promise.all([
    fetchForexCandles(instrument, "5m", { count: m5DetectionCount, toMs: currentTimeSec * 1000 }),
    getLiquidityLevels(instrument, undefined, false, currentTimeSec),
    getObZones(instrument, undefined, false, currentTimeSec),
  ]);
  // Nach currentTimeSec gekappt (nicht nur nach Tagesende) — sonst würde ein Replay-Zeitpunkt
  // Zonen/Level aus der "Zukunft" relativ zum Replay-Punkt sehen, dieselbe Kappung wie dataExport.ts.
  const m5Candles = m5DetectionRaw.filter((c) => c.time <= currentTimeSec);

  const { highs, lows } = detectLiquidityLevels(m5Candles, LIQUIDITY_FRACTAL_PERIOD);
  const m5LiquidityRaw = [
    ...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "high",
      price: l.price,
      pivotTime: l.pivotTime,
      touched: l.touched,
      touchedTime: l.touchedTime,
      timeframe: "5M",
    })),
    ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "low",
      price: l.price,
      pivotTime: l.pivotTime,
      touched: l.touched,
      touchedTime: l.touchedTime,
      timeframe: "5M",
    })),
  ];
  const m5Liquidity = m5LiquidityRaw.filter(
    (l) => !liquidityLevels.some((h) => h.direction === l.direction && Math.abs(h.price - l.price) <= SAME_PRICE_EPSILON),
  );
  const htfLiquidity = liquidityLevels.map((l) => ({
    id: l.id,
    direction: l.direction,
    price: l.price,
    pivotTime: Math.floor(new Date(l.pivot_time).getTime() / 1000),
    touched: l.touched,
    touchedTime: l.touched && l.end_time != null ? Math.floor(new Date(l.end_time).getTime() / 1000) : null,
    timeframe: l.timeframe,
  }));

  const m5Ob = detectOrderBlocks(m5Candles, "5m", true)
    .filter((z) => !z.invalidated)
    .map((z) => ({
      dir: z.dir,
      direction: z.dir === 1 ? "long" : "short",
      top: z.top,
      bottom: z.bottom,
      touched: z.touched,
      invalidated: z.invalidated,
      startTime: z.startTime,
      timeframe: "5M",
    }));
  const htfOb = obZones.map((z) => ({
    id: z.id,
    dir: z.direction === "long" ? 1 : -1,
    direction: z.direction,
    top: z.top,
    bottom: z.bottom,
    touched: z.touched,
    invalidated: z.invalidated,
    startTime: Math.floor(new Date(z.start_time).getTime() / 1000),
    timeframe: z.timeframe,
  }));

  return {
    liquidityLevels: [...m5Liquidity, ...htfLiquidity],
    obZones: [...m5Ob, ...htfOb],
  };
}

// Einstiegspunkt fürs find_targets-Tool — instrument+direction wie im Frontend, currentTimeSec
// optional (Replay-Unterstützung wie get_data_export, default "jetzt"). tooFar markiert (nicht
// filtert, siehe TargetPickerModal.vue's gleichnamige Begründung) Kandidaten über
// MAX_TARGET_DISTANCE_PIPS, damit Lana einen weit entfernten Kandidaten noch SIEHT, aber weiß, dass
// er ungewöhnlich ist.
export async function findTargetCandidates({ instrument, direction, currentTimeSec }) {
  const effectiveTimeSec = currentTimeSec ?? Math.floor(Date.now() / 1000);
  const [{ liquidityLevels, obZones }, priceCandles] = await Promise.all([
    buildCandidatePool(instrument, effectiveTimeSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveTimeSec * 1000 }),
  ]);
  const currentPrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  const liquidityCandidates = findNearestLiquidityTargets(liquidityLevels, { direction, currentPrice }).map((l) => ({
    ...l,
    tooFar: isTooFarFromPrice(l.price, currentPrice),
  }));
  const obCandidates = findNearestObTargets(obZones, { direction, currentPrice }).map((z) => ({
    ...z,
    tooFar: isTooFarFromPrice(z.targetPrice, currentPrice),
  }));

  return { instrument, direction, currentPrice, liquidityCandidates, obCandidates };
}
