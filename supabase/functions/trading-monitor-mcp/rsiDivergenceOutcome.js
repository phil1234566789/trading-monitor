// Experimentelle Erfolgs-Klassifikation für RSI-Divergenzen (Chat 2026-08-11, dritte Runde,
// Philip: "eine Statistik der Divergenz-Signale ... wie unterscheiden wir ein erfolgreiches Signal
// von einem Fehlsignal") — bewusst in einer EIGENEN, kleinen Datei statt in rsi.js verdrahtet, wie
// schon bei den Fehlalarm-Filtern dort: "wir basteln gerade", diese ganze Datei soll sich später
// komplett wegwerfen oder ersetzen lassen, ohne rsi.js/PriceChart.vue anzufassen. Noch NICHT ans
// UI oder eine Statistik-Ansicht angebunden — nur die Klassifikationsfunktion selbst.
//
// Definition "erfolgreich": strukturelle Bestätigung statt eines beliebigen Pip-Schwellenwerts —
// bricht der Kurs nach dem Divergenz-Pivot (toTime) durch die Struktur-Marke, die UNMITTELBAR
// DAVOR lag (das letzte Swing-Tief vor einem bearish-Hoch bzw. das letzte Swing-Hoch vor einem
// bullish-Tief)? Das ist ein echtes Break of Structure gegen den ursprünglichen Trend (dieselbe
// Sprache wie marketStructureAnalysis.ts' rangeBreakOfStructure), kein erfundener Zusatzparameter.
import { isSwingHigh, isSwingLow, DEFAULT_DIVERGENCE_FRACTAL_PERIOD } from "./rsi.js";

// Startwert bewusst hoch (Philip vermutet schon "eher zu viel") — hier als einzelner, leicht
// nachjustierbarer Parameter statt einer Konstante tief in der Funktion vergraben.
export const DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS = 60;

/**
 * @param {{time: number, close: number}[]} candles - dieselbe Serie, aus der die Divergenz stammt (braucht genug Kerzen NACH toTime)
 * @param {{type: "bearish" | "bullish", toTime: number}} divergence - ein Ergebnis von detectRsiDivergence/-History
 * @param {number} [period]
 * @param {number} [lookforwardBars]
 * @returns {{outcome: "hit" | "miss" | "pending" | "unknown", structureLevel?: number, structureTime?: number, breakTime?: number, barsToBreak?: number, windowEndTime?: number}}
 */
export function classifyDivergenceOutcome(
  candles,
  divergence,
  period = DEFAULT_DIVERGENCE_FRACTAL_PERIOD,
  lookforwardBars = DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS,
) {
  const isBearish = divergence.type === "bearish";
  const toIdx = candles.findIndex((c) => c.time === divergence.toTime);
  if (toIdx === -1) return { outcome: "unknown" };

  // Rückwärts ab (exklusive) toIdx das nächste Swing-Tief (bearish) / Swing-Hoch (bullish) suchen
  // — die Struktur-Marke, deren Bruch eine echte Trendwende bestätigen würde.
  let structureIdx = null;
  for (let i = toIdx - 1; i >= 0; i--) {
    if (isBearish ? isSwingLow(candles, i, period) : isSwingHigh(candles, i, period)) {
      structureIdx = i;
      break;
    }
  }
  if (structureIdx == null) return { outcome: "unknown" };
  const structureLevel = candles[structureIdx].close;
  const structureTime = candles[structureIdx].time;

  const intendedEnd = toIdx + 1 + lookforwardBars;
  const windowEnd = Math.min(candles.length, intendedEnd);
  // windowEndTime IMMER gesetzt (auch bei "hit"), nicht nur bei miss/pending — praktisch fürs
  // Debug-Zeichnen (siehe PriceChart.vue: refreshRsiDivergenceOutcomeDebugInternal), das die
  // Struktur-Marke bis zum tatsächlich geprüften Fensterende zeichnen will, nicht nur bis toTime.
  const windowEndTime = candles[Math.max(toIdx, windowEnd - 1)].time;
  for (let i = toIdx + 1; i < windowEnd; i++) {
    const broke = isBearish ? candles[i].close < structureLevel : candles[i].close > structureLevel;
    if (broke) {
      return { outcome: "hit", structureLevel, structureTime, breakTime: candles[i].time, barsToBreak: i - toIdx, windowEndTime };
    }
  }
  // Noch nicht genug Kerzen NACH toTime geladen, um das volle Fenster zu prüfen -> "pending" statt
  // fälschlich "miss" (der Ausgang steht einfach noch nicht fest, nicht "hat nicht geklappt").
  const hadFullWindow = candles.length >= intendedEnd;
  return { outcome: hadFullWindow ? "miss" : "pending", structureLevel, structureTime, windowEndTime };
}

// Kleine Statistik-Hilfe fürs manuelle Ausprobieren (z.B. in einem Scratch-Script) — noch keine
// eigene UI/Persistenz, siehe Datei-Kommentar oben. divergences: Ergebnis von
// detectRsiDivergenceHistory mit hohem maxCount.
export function summarizeDivergenceOutcomes(candles, divergences, period, lookforwardBars) {
  const counts = { hit: 0, miss: 0, pending: 0, unknown: 0 };
  const results = divergences.map((d) => {
    const result = classifyDivergenceOutcome(candles, d, period, lookforwardBars);
    counts[result.outcome]++;
    return { divergence: d, ...result };
  });
  const decided = counts.hit + counts.miss;
  return { counts, hitRate: decided > 0 ? counts.hit / decided : null, results };
}
