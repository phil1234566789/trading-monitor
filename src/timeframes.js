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
