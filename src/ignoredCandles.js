// Frontend-Einstieg in markIgnoredCandles (sessionOccurrences.js) — dieselbe dünne Rolle wie
// sessionBonus.js: den `sessions`-Singleton nach Instrument filtern und die Browser-Lokalzeit als
// Offset mitgeben, damit ein ignoriertes Fenster niemals von dem Session-Band abweicht, das Philip
// auf demselben Chart sieht. Eigene Datei statt Anhängsel an sessions.js (schon ~400 Zeilen) oder
// sessionBonus.js (das macht Labels, nicht Kerzen).
import { sessions } from "./sessions.js";
import { markIgnoredCandles } from "./sessionOccurrences.js";

const tzOffsetMinutes = (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset();

// Pro Refresh neu gerechnet, nicht beim Kerzen-Fetch: Philip soll die Checkbox umstellen und das
// Ergebnis sofort im Chart sehen, nicht erst beim nächsten Poll.
export function markIgnored(candles, symbol) {
  return markIgnoredCandles(candles, sessions.filter((s) => s.instrument === symbol), tzOffsetMinutes);
}

// Für die Verbraucher, die die Kerze wirklich weglassen dürfen (Struktur-/Fraktal-Erkennung, siehe
// markIgnoredCandles) — die FVG-Erkennung darf das NICHT und liest stattdessen das Flag.
export function withoutIgnored(candles, symbol) {
  return markIgnored(candles, symbol).filter((c) => !c.ignored);
}
