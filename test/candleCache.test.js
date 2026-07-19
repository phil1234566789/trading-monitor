import { describe, it, expect } from "vitest";
import { cachedCandlesUpTo } from "../src/candleCache.js";

// Bug-Report Philip 2026-07-19: M5-Replay auf 08.07.2026 21:00 gestellt, Chart zeigte trotzdem nur
// Kerzen bis 02.07.2026 — der IndexedDB-Cache für GBPUSD:5m hatte ein Loch zwischen einem alten
// Replay-Fenster (endet 02.07.) und einem späteren, disjunkten Live-Fenster (beginnt Mitte Juli).
// Der alte Check verglich effectiveEndSec nur gegen die insgesamt LETZTE gecachte Kerze (die aus
// dem späteren Fenster stammte) statt gegen die Kerze, die tatsächlich zurückgegeben wird.
function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

const BAR_SECONDS = 300; // 5m

describe("cachedCandlesUpTo", () => {
  it("returns the cached window when it reaches contiguously up to effectiveEndSec", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = 999 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result.length).toBe(1000);
    expect(result[result.length - 1].time).toBe(effectiveEndSec);
  });

  it("returns null (forces a real fetch) when effectiveEndSec falls inside a gap between disjoint cache windows", () => {
    // Altes Fenster: Kerzen 0..999. Loch. Neues, disjunktes Fenster beginnt weit später (7 Tage
    // Lücke, wie im Bug-Report) und läuft bis "heute".
    const oldWindow = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const gapSeconds = 7 * 24 * 3600;
    const newWindowStart = oldWindow[oldWindow.length - 1].time + gapSeconds;
    const newWindow = Array.from({ length: 1000 }, (_, i) => candle(newWindowStart + i * BAR_SECONDS));
    const cached = [...oldWindow, ...newWindow];

    // Replay-Zeitpunkt liegt genau IN der Lücke, kurz vor dem neuen (disjunkten) Fenster — wie im
    // Bug-Report: der alte Check hätte hier fälschlich "Cache reicht" gesagt, weil IRGENDWO im
    // Cache-Array (dem späteren Fenster) eine Kerze >= effectiveEndSec existiert.
    const effectiveEndSec = newWindowStart - BAR_SECONDS * 3;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("tolerates a normal forex weekend gap (~60h) as a real cache hit", () => {
    const fridayClose = 1000 * BAR_SECONDS;
    const weekendGapSeconds = 60 * 3600; // knapp unter der 3-Tage-Toleranz
    const before = Array.from({ length: 999 }, (_, i) => candle(i * BAR_SECONDS));
    const cached = [...before, candle(fridayClose)];

    const effectiveEndSec = fridayClose + weekendGapSeconds;
    const result = cachedCandlesUpTo(cached, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result[result.length - 1].time).toBe(fridayClose);
  });

  it("returns null when the cache doesn't have enough depth even without a gap", () => {
    const cached = Array.from({ length: 500 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = cached[cached.length - 1].time;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });
});
