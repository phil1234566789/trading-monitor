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
