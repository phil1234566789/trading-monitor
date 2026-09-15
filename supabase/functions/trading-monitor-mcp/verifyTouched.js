// Live-Gegenprüfung des touched-Status für persistierte HTF-Objekte (1H/4H) gegen echte M5-Kerzen.
//
// Warum nötig: poi-watcher setzt touched nur vorwärts ab dem Zeitpunkt, an dem er ein Objekt
// ERKENNT. Ein 1H-OB wird aber erst erkannt, wenn seine FVG vollständig ist — die Kerzen davor
// werden nie rückwirkend gegen die Zonenkanten geprüft. Die Zeile startet dadurch mit
// touched=false in die Welt und bleibt es, auch wenn der Kurs längst durchgelaufen ist.
// Bug-Beispiel: GBPUSD 1H-OB 1.35225-1.35368 (08.09.2026 13:00) stand am 09.09. auf touched=false,
// obwohl der Kurs die Zone um 18:00 und 23:00 durchlaufen hatte — find_targets schlug sie deshalb
// als frisches Ziel vor, während der Chart-Dialog (der live nachrechnet) sie gar nicht anbot.
//
// Gegenstück zum Frontend, wo diese Prüfung längst passiert (priceChartLiquidity.js:
// mergePinnedLevels, priceChartObZones.js: mergePinnedZones).
import { LIQUIDITY_FRACTAL_PERIOD } from "../_shared/liquidityDetection.ts";
import { barSecondsFor } from "./timeframes.ts";

// Ein Fraktal existiert erst, wenn die period-te Folgekerze geschlossen hat — eine Kerze innerhalb
// dieses Fensters gehört noch zu der Formation, die den Pivot überhaupt entstehen ließ, und ist
// kein Touch. Dieselbe Verzögerung wie buildLevel() (liquidityDetection.ts: `i = p + period`), nur
// in Sekunden statt Kerzen-Index, weil hier immer M5-Kerzen durchsucht werden — auch für ein
// 1H/4H-Level.
function confirmationOffsetSec(timeframe) {
  return LIQUIDITY_FRACTAL_PERIOD * (barSecondsFor(timeframe) ?? 0);
}

// Nur prüfbar, wenn das Objekt innerhalb des geladenen Kerzenfensters entstanden ist — sonst
// fehlt genau der Zeitraum, in dem der Touch passiert sein könnte.
function coveredByCandles(fromSec, candles) {
  return candles.length > 0 && fromSec >= candles[0].time;
}

// level: {price, direction: 'high'|'low', pivotTime, timeframe, touched, touchedTime}
// Rückgabe trägt zusätzlich touchVerified — false heißt "außerhalb des Kerzenfensters entstanden,
// DB-Wert unverändert übernommen", nicht "ungetoucht".
export function verifyLevelTouched(level, candles) {
  const from = level.pivotTime + confirmationOffsetSec(level.timeframe);
  if (!coveredByCandles(level.pivotTime, candles)) return { ...level, touchVerified: false };
  const hit = candles.find(
    (c) => c.time > from && (level.direction === "high" ? c.high >= level.price : c.low <= level.price),
  );
  return { ...level, touched: hit != null, touchedTime: hit?.time ?? null, touchVerified: true };
}

// zone: {top, bottom, startTime, touched, ...}
// Nur touched wird nachgerechnet, nicht invalidated: für die Target-Auswahl ist "ungetoucht" das
// Kriterium (siehe trading-Repo target-findung.md), und eine invalidierte Zone ist zwangsläufig
// vorher getoucht worden — der DB-Wert kann hier also nichts kaputt machen, was touched nicht
// ohnehin schon abfängt.
export function verifyZoneTouched(zone, candles) {
  if (!coveredByCandles(zone.startTime, candles)) return { ...zone, touchVerified: false };
  const hit = candles.find((c) => c.time > zone.startTime && c.high >= zone.bottom && c.low <= zone.top);
  return { ...zone, touched: hit != null, touchVerified: true };
}
