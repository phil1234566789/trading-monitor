// Live-Touch-Erkennung für die persistierten 1H/4H-Objekte (ob_zones, liquidity_levels) gegen die
// M5-Kerzen statt gegen den Einzelpreis im Moment des Cron-Ticks.
//
// Bug-Report Philip 2026-09-22: ein Docht, der zwischen zwei Ticks in eine Zone hinein- und noch
// in derselben M5-Kerze wieder herauslief, wurde gar nicht erkannt — der Tick sieht nur den Preis
// im Moment des Ticks (da längst wieder draußen), und detectOrderBlocks holt den Touch erst beim
// Schluss der vollen 1H/4H-Kerze nach (bis zu 59min, bei 4H knapp 4h). Genau diese scharfe
// Abweisung an der Zonenkante ist aber das Signal, auf das der Alarm wartet.
//
// Datenquelle sind die M5-Kerzen, die poi-watcher ohnehin jeden Tick für die Trade-Setup-Erkennung
// lädt — kein zusätzlicher Abruf.
import type { Candle } from "../_shared/orderBlocks.ts";

// Nur das jüngste Kerzenfenster prüfen, nicht die vollen ~25h geladener M5-Historie: sonst kippt
// der erste Lauf nach dem Deploy alle in dieser Zeit gestreiften Zonen auf einmal auf touched und
// löst eine Alarmsalve aus. pg_cron läuft alle 5 Min (20260713120000_poi_watcher_cron_5min.sql),
// 15 Min decken also zwei ausgefallene Ticks mit ab; mehrfach geprüfte Kerzen schaden nicht, weil
// eine bereits getouchte Zeile vom Aufrufer ohnehin übersprungen wird. Ceiling: fällt der Cron
// länger als dieses Fenster aus, bleibt ein Touch in der Lücke unerkannt (wie bisher auch) — ein
// mitgeführter "zuletzt geprüft"-Zeitstempel wäre der Ausbau, falls das real vorkommt.
export const LIVE_TOUCH_WINDOW_SEC = 15 * 60;

export function recentCandles(m5: Candle[], nowSec: number): Candle[] {
  return m5.filter((c) => c.time >= nowSec - LIVE_TOUCH_WINDOW_SEC);
}

// Dieselbe Overlap-Bedingung, die detectOrderBlocks intern für den Kerzen-Touch benutzt
// (_shared/orderBlocks.ts).
export function findZoneTouch(candles: Candle[], top: number, bottom: number): Candle | null {
  return candles.find((c) => c.low <= top && c.high >= bottom) ?? null;
}

export function findLevelTouch(
  candles: Candle[],
  price: number,
  direction: "high" | "low",
): Candle | null {
  return candles.find((c) => (direction === "high" ? c.high >= price : c.low <= price)) ?? null;
}

// Preis, mit dem die Kerze in die Zone gelaufen ist — nicht der Tick-Preis, der im Docht-Fall
// schon wieder außerhalb der Zone liegt (sonst meldet der Alarm einen Preis, der die Zone gar
// nicht berührt).
export function zoneTouchPrice(c: Candle, top: number, bottom: number): number {
  if (c.low >= bottom) return c.low; // von oben hereingelaufen
  if (c.high <= top) return c.high; // von unten hereingelaufen
  return c.close; // Kerze durchläuft die Zone komplett
}

export function levelTouchPrice(c: Candle, direction: "high" | "low"): number {
  return direction === "high" ? c.high : c.low;
}
