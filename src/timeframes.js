export const TIMEFRAMES = [
  { label: "1m", bar: "1m" },
  { label: "3m", bar: "3m" },
  { label: "5m", bar: "5m" },
  { label: "15m", bar: "15m" },
  { label: "1h", bar: "1H" },
  { label: "4h", bar: "4H" },
  { label: "1D", bar: "1D" },
];

export function okxBarFor(label) {
  return TIMEFRAMES.find((tf) => tf.label === label).bar;
}

// Bar-Dauer in Sekunden je TIMEFRAMES-Label — zentrale Quelle, u.a. für candleCache.js (Delta-
// Fetch-Größe) und PriceChart.vue (an den Kerzenschluss ausgerichtetes Polling, siehe Chat
// 2026-07-20: "mir reicht pro M1 Kerzenschluss ... nicht 30s zu spät gefetched").
const BAR_SECONDS = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1D": 86400 };

export function barSecondsFor(label) {
  return BAR_SECONDS[label] ?? 60;
}

// Wie weit im Replay-Modus vorausgefetcht wird (siehe PriceChart.vue: fetchCandlesCached-Aufrufe),
// damit wiederholtes "+1 Kerze"-Klicken erstmal komplett aus dem Cache bedient wird (Chat
// 2026-07-23: 429 beim Replay-Klicken, vorher nur 4h). Aus 2500 M5-Kerzen abgeleitet (Twelve Data
// erlaubt bis 5000 Kerzen/Request, 2500 Historie + 2500 Lookahead in EINEM Request beim
// Replay-Einstieg, siehe TRADE_SETUP_M5_CANDLE_LIMIT) — dieselbe Sekundenzahl ergibt für 1H
// automatisch ~208 Kerzen Vorausschau (750000 / 3600), synchron zum selben Zeit-Fenster, ohne
// dass jede Timeframe ihre eigene Kerzenzahl braucht.
export const REPLAY_LOOKAHEAD_SEC = 2500 * BAR_SECONDS["5m"];
