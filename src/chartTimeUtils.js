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
// genug ist, um in der Antwort mitzukommen. bar=null/undefined -> kein Offset, unverändert.
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

// <input type="time" step="1800"> liefert/erwartet "HH:MM" (Browser-Lokalzeit-Anzeige, aber reiner
// Text ohne Zeitzone) — Speicherformat in sessions.js/tradingSchedules.js ist durchgängig Minuten
// seit Mitternacht, daher der Roundtrip hier (ursprünglich nur in SessionsModal.vue, jetzt auch
// von der Handelszeiten-Seite gebraucht).
export function minutesToTimeInput(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function timeInputToMinutes(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
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

// PriceChart.vue: pollRecent() holt pro Tick nur die letzten RECENT_PAGE_SIZE Kerzen (Puffer für
// einen verpassten Poll, z.B. Tab im Hintergrund gedrosselt) — mergt sie mit dem bereits geladenen
// allCandles, indem der ältere Teil bis zum Start der frischen Seite übernommen und der Rest
// (potenziell überlappende/neue Kerzen) durch die frische Seite ersetzt wird.
export function mergeRecent(existing, freshRecent) {
  if (existing.length === 0 || freshRecent.length === 0) return freshRecent;
  const freshStart = freshRecent[0].time;
  const olderPrefix = existing.filter((c) => c.time < freshStart);
  return olderPrefix.concat(freshRecent);
}

// PriceChart.vue: jumpToTrade()/jumpToTimeRange() — reicht NICHT, nur "time < candles[0].time" zu
// prüfen (Bug-Report Philip 2026-07-30, dritte Runde) — ein gezielter Sprung dort kann bewusst eine
// LÜCKE mitten im Array hinterlassen (siehe Kommentar in jumpToTimeRange), ein späterer Sprung auf
// einen Zeitpunkt GENAU IN dieser Lücke sähe mit der reinen Array-Anfang-Prüfung fälschlich wie
// "schon geladen" aus — snapToBarTime würde dann nur die letzte Kerze VOR der Lücke treffen (genau
// das beobachtete "Kerzen bis 14.07. 20:05, X-Achse springt dann auf 23.07."). Prüft stattdessen,
// ob die NÄCHSTE Kerze bei/vor `time` höchstens eine Kerzenbreite entfernt liegt.
export function isTimeCovered(candles, time, barSeconds) {
  if (candles.length === 0 || time < candles[0].time || time > candles[candles.length - 1].time) return false;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (candles[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }
  return time - candles[lo].time <= barSeconds * 1.5;
}

// PriceChart.vue: refreshTradeMarkersInternal/-TradeSetupLinksInternal/-TradeTargetLinksInternal/
// -TradeConfirmationLinksInternal/-InvalidationLinesInternal — Bug-Report Philip 2026-07-31: im
// Replay auf ein früheres Datum springen zeigte trotzdem Marker/Ziele/Bestätigungen/Setup-Links
// eines SPÄTEREN Trades (z.B. eines Longs vom 30.07., während man im Chart auf dem 27.07. steht) —
// snapToBarTime (in tradeMarkers.js/liquidity.js/orderBlocks.js) klemmt eine Zeit, die nach der
// letzten geladenen Kerze liegt, auf eben diese letzte Kerze fest, statt den Trade auszublenden.
// Ohne Filter stapeln sich dadurch ALLE "noch nicht passierten" Trades am rechten Rand exakt
// übereinander. Reine Anzeige-Filterung hier (kein DB-/Datenmodell-Fix nötig) — ein Trade
// "existiert" erst im Chart, sobald seine Einstiegszeit auf oder vor der letzten aktuell geladenen
// Kerze liegt.
export function tradesVisibleForCandles(trades, candles) {
  if (candles.length === 0) return [];
  const lastTime = candles[candles.length - 1].time;
  return trades.filter((t) => t.entryTime <= lastTime);
}
