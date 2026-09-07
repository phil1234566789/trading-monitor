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
import { detectLiquidityLevels, filterRelevantLevels, LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "../_shared/liquidityDetection.ts";
import { detectOrderBlocks } from "./orderBlockDetection.js";
import { PIP_SIZE } from "./pipConfig.js";
import { M5_DETECTION_LOOKBACK_HOURS, M5_DETECTION_CANDLE_BUFFER, M5_BAR_SECONDS } from "./tools/dataExport.ts";

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

// Dieselbe Dedupe-Schwelle wie tools/dataExport.ts's SAME_PRICE_EPSILON — ein live erkanntes
// M5-Level auf demselben Preis wie ein 1H/4H-Level ist redundant, das HTF-Level ist bedeutsamer.
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;

// Baut den Kandidaten-Pool (M5 live + HTF DB, beide Richtungen, beide Objektarten) für ein
// Instrument zu einem Zeitpunkt — dieselbe Zusammenstellung wie tools/dataExport.ts:229-307, nur
// ohne die dortigen Struktur-Trend-/Sessions-/Asia-Range-Bausteine. Exportiert (statt modul-privat)
// — findAntiConfluenceCandidates.js braucht denselben Pool (M5 live + HTF DB, beide Richtungen),
// nur mit anderen Filtern als find_targets, kein zweiter DB-Fetch dafür (DRY, siehe CLAUDE.md).
export async function buildCandidatePool(instrument, currentTimeSec) {
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

  // ALLE live erkannten Zonen (auch invalidierte) — der !invalidated-Filter läuft weiter unten NACH
  // dem Merge, nicht hier, sonst hätte eine seither invalidierte Zone keinen Merge-Partner mehr und
  // der eingefrorene (falsche) DB-Stand würde unverändert durchrutschen (siehe Kommentar unten).
  const m5ObAll = detectOrderBlocks(m5Candles, "5m", true).map((z) => ({
    dir: z.dir,
    direction: z.dir === 1 ? "long" : "short",
    top: z.top,
    bottom: z.bottom,
    touched: z.touched,
    invalidated: z.invalidated,
    startTime: z.startTime,
    // endTime fehlte hier bisher (anders als dataExport.ts: computeM5LiquidityAndObZones) — bei
    // touched-Zonen der eingefrorene Touch-Zeitpunkt (siehe orderBlockDetection.js), Pflicht für
    // findAntiConfluenceObCandidates' Handelstag-Filter (siehe dort).
    endTime: z.endTime,
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
  // getObZones(instrument, undefined, ...) liefert ALLE Timeframes, auch bereits persistierte 5M-
  // Zonen (z.B. über einen Pin/eine Confirmation angelegt, siehe db.ts findOrCreateObZoneId) — ohne
  // Dedup taucht so eine Zone DOPPELT auf: einmal live neu erkannt (ohne id), einmal aus der DB (MIT
  // id). direction+startTime sind deterministisch aus denselben M5-Kerzen abgeleitet, deshalb reicht
  // ein exakter Schlüssel (kein Preis-Epsilon nötig wie bei m5Liquidity oben).
  //
  // WICHTIG (Bug-Report Philip 07.09.2026, GBPUSD-Backtest 28.08.): touched/invalidated/endTime einer
  // persistierten 5M-Zeile werden nach dem Insert NIE aktualisiert (poi-watcher verfolgt M5 nie live
  // nach, siehe get_pin_context-Tool-Beschreibung "touched/invalidated werden für M5-Zeilen aber nie
  // live nachverfolgt") — ein erster Dedup-Versuch bevorzugte fälschlich genau diesen eingefrorenen
  // DB-Stand statt der frischen Live-Erkennung (OB #3134439, seit 22.08. mit touched:false/
  // invalidated:false eingefroren, obwohl der Kurs am 28.08. klar unter die Zonen-Unterkante
  // durchgebrochen ist — live also invalidated:true). Deshalb: bei einem Match gewinnt die LIVE-Zone
  // für top/bottom/touched/invalidated/endTime, nur die referenzierbare id kommt von htfOb dazu.
  const htfObM5ByKey = new Map(htfOb.filter((z) => z.timeframe === "5M").map((z) => [`${z.direction}_${z.startTime}`, z]));
  const m5ObMerged = m5ObAll
    .map((z) => {
      const persisted = htfObM5ByKey.get(`${z.direction}_${z.startTime}`);
      // liveVerified markiert: touched/invalidated kommen HIER aus der frischen Live-Erkennung, nicht
      // aus einem eingefrorenen DB-Insert-Default — findAntiConfluenceCandidates.js verlässt sich für
      // 5M NUR auf diese verifizierten Einträge (siehe dort).
      return { ...(persisted ? { ...z, id: persisted.id } : z), liveVerified: true };
    })
    .filter((z) => !z.invalidated);
  // Persistierte 5M-Zonen AUSSERHALB des M5-Detektions-Lookbacks (M5_DETECTION_LOOKBACK_HOURS, aktuell
  // 21 Tage) haben KEIN Live-Pendant zum Mergen — ihr touched/invalidated bleibt für find_targets als
  // bisheriger Bestwert erhalten (kein Fehler, nur unverifiziert), aber OHNE liveVerified-Flag, damit
  // find_anti_confluences sie NICHT ungeprüft als "untouched" werten kann (Bug-Report Philip
  // 07.09.2026: drei uralte, "weak"-OBs aus Mai zeigten touched:false seit Zeilen-Anlage 09.08., ohne
  // dass seither je erneut geprüft wurde — nicht verifizierbar heißt nicht "als untouched behandeln").
  const htfObDeduped = htfOb.filter((z) => z.timeframe !== "5M" || !m5ObAll.some((m) => m.direction === z.direction && m.startTime === z.startTime));

  return {
    liquidityLevels: [...m5Liquidity, ...htfLiquidity],
    obZones: [...m5ObMerged, ...htfObDeduped],
    // Zusätzlich zurückgegeben (find_targets selbst braucht es nicht) — findAntiConfluenceCandidates.js
    // will RSI-Divergenzen auf denselben M5-Kerzen erkennen, ohne den identischen Fetch ein zweites
    // Mal auszulösen (DRY, siehe CLAUDE.md).
    m5Candles,
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
