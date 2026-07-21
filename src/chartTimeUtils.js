import { barSecondsFor } from "./timeframes.js";

// timeToCoordinate() liefert nur fuer exakt vorhandene Bar-Zeiten ein Ergebnis (sonst
// null) — Zeitstempel aus der DB (Trades, POI-Zonen) treffen aber nicht zwingend exakt
// auf eine Kerze des aktuell gewaehlten Timeframes. Deshalb hier auf die Kerze "snappen",
// die den Zeitpunkt enthaelt (letzte Kerze mit time <= target).
export function snapToBarTime(candles, targetTime) {
  if (!candles || candles.length === 0) return null;
  if (targetTime <= candles[0].time) return candles[0].time;
  if (targetTime >= candles[candles.length - 1].time) return candles[candles.length - 1].time;

  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (candles[mid].time <= targetTime) lo = mid;
    else hi = mid - 1;
  }
  return candles[lo].time;
}

// cTrader behandelt den exakten toTimestamp-Moment IMMER als "die noch offene aktuelle Kerze"
// (siehe supabase/functions/_shared/ctrader/client.ts: fetchOneTrendbar-Kommentar) — auch
// RÜCKWIRKEND im Replay, selbst wenn diese Kerze in Wirklichkeit längst geschlossen ist. Ohne
// Ausgleich fehlt deshalb IMMER genau die letzte Kerze, deren Open-Zeit exakt replayUntil entspricht
// (Bug-Report Philip 2026-07-21: "Replay ist bei 03.07. 23:00, letzte Kerze aber nur 22:00" — und
// "+1 Kerze" bringt dadurch strukturell nie die frisch angeforderte Kerze mit). clipReplay()
// (PriceChart.vue) zeigt diese Kerze korrekt an (Filter ist `<=`), der FETCH selbst muss also um
// eine Barlänge WEITER als replayUntil anfragen, damit sie bei cTrader überhaupt "geschlossen"
// genug ist, um in der Antwort mitzukommen. bar=null/undefined (z.B. OKX/BTC, wo dieses cTrader-
// spezifische Verhalten laut bisherigen Bug-Reports nicht auftritt) -> kein Offset, unverändert.
export function replayFetchToMs(replayUntilSec, bar) {
  if (replayUntilSec == null) return undefined;
  const barOffsetMs = bar ? barSecondsFor(bar) * 1000 : 0;
  return replayUntilSec * 1000 + barOffsetMs;
}

// Für den "+1 Kerze"-Button (PriceChart.vue: nextReplayTime) — die frühste Kerze NACH `afterSec` in
// `candles` (oldest-first sortiert), oder null, wenn keine geladen ist. Ohne Markt-Öffnungszeiten zu
// kennen (Wochenende/Feiertag bei Forex, siehe Chat 2026-07-21: "Das ist der Freitag! Am WE gibts
// kein Forex!!") würde ein stures "+1 Bar" bei jedem Klick auf eine Zeit OHNE Kerze landen — der
// Button müsste dutzende Male geklickt werden, um über eine Wochenend-Lücke zu kommen ("bleibts
// hängen"). Sucht stattdessen direkt die nächste TATSÄCHLICH vorhandene Kerze, egal wie weit sie
// entfernt liegt — ein Klick überspringt die ganze Lücke auf einmal.
export function nextCandleAfter(candles, afterSec) {
  const found = candles.find((c) => c.time > afterSec);
  return found ? found.time : null;
}

// Für die "Alter"-Anzeige an LQ-Leveln/TSC-Zeilen (Chat 2026-07-22: "1h LQ-Sweep (1d 3h alt)",
// "Wochenende nicht mitzählen") — zählt nur die tatsächliche Marktzeit zwischen startSec und
// endSec, Samstag/Sonntag (UTC-Kalendertage) fallen komplett raus. Grobe, aber für eine reine
// Alters-ANZEIGE ausreichende Näherung (UTC-Kalendertag statt exakter Forex-Handelszeiten
// Fr ~22:00–So ~22:00) — iteriert Tag für Tag, zählt Werktage komplett bzw. anteilig am
// ersten/letzten Tag, Wochenendtage gar nicht.
export function businessSecondsBetween(startSec, endSec) {
  if (endSec == null || startSec == null || endSec <= startSec) return 0;
  const DAY = 86400;
  let total = 0;
  let cursor = startSec;
  while (cursor < endSec) {
    const dayStart = Math.floor(cursor / DAY) * DAY;
    const segmentEnd = Math.min(dayStart + DAY, endSec);
    const isWeekend = [0, 6].includes(new Date(dayStart * 1000).getUTCDay());
    if (!isWeekend) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}

// "1d 3h" / "3h 15m" / "15m" — Minuten fallen weg, sobald schon Tage angezeigt werden (genug
// Präzision für eine Alters-ANZEIGE, kein exakter Zeitstempel).
export function formatAge(seconds) {
  if (seconds == null || seconds < 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
