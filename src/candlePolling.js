import { barSecondsFor } from './timeframes.js';

// FXCM liefert erst nach dem Schlussabstand des Collectors. Auch eine erfolgreiche,
// aber noch alte Antwort muss bald erneut gelesen werden, nicht erst eine ganze Bar später.
export function nextCandlePollDelay(bar, nowMs = Date.now()) {
  const barMs = barSecondsFor(bar) * 1000;
  return Math.min(60_000, barMs - (nowMs % barMs) + 20_000);
}
