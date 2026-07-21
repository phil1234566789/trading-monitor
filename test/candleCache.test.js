import { describe, it, expect } from "vitest";
import { cachedCandlesUpTo, safeCompleteUpTo } from "../src/candleCache.js";

// Bug-Report Philip 2026-07-19 (#1): M5-Replay auf 08.07.2026 21:00 gestellt, Chart zeigte trotzdem
// nur Kerzen bis 02.07.2026 — der IndexedDB-Cache für GBPUSD:5m hatte ein Loch zwischen einem alten
// Replay-Fenster (endet 02.07.) und einem späteren, disjunkten Live-Fenster (beginnt Mitte Juli).
// Bug-Report Philip 2026-07-19 (#2): "+1 Kerze" im M5-Replay zeigt keine neue Kerze — eine reine
// Gap-Toleranz (frühere Zwischenversion) hätte auch die 5-Minuten-Lücke "neue Kerze einfach noch
// nicht gefetcht" fälschlich als "Cache reicht" durchgewunken. cachedCandlesUpTo verlangt jetzt
// stattdessen ein explizites completeUpTo (nur nach einem echten Fetch gesetzt, siehe
// fetchCandlesCached) statt aus der Kerzen-Lücke selbst zu raten.
function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

const BAR_SECONDS = 300; // 5m

describe("cachedCandlesUpTo", () => {
  it("returns the cached window when completeUpTo covers effectiveEndSec and depth is sufficient", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = 999 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result.length).toBe(1000);
    expect(result[result.length - 1].time).toBe(effectiveEndSec);
  });

  it("returns null when completeUpTo is null (never actually fetched that far)", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = 999 * BAR_SECONDS;

    const result = cachedCandlesUpTo(cached, null, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("returns null when effectiveEndSec falls inside a gap between disjoint cache windows, even though a later window happens to exist", () => {
    // Altes Fenster: Kerzen 0..999 (completeUpTo wäre hier korrekt deren letzte Zeit gewesen).
    const oldWindow = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const gapSeconds = 7 * 24 * 3600;
    const newWindowStart = oldWindow[oldWindow.length - 1].time + gapSeconds;
    const newWindow = Array.from({ length: 1000 }, (_, i) => candle(newWindowStart + i * BAR_SECONDS));
    const cached = [...oldWindow, ...newWindow];
    const completeUpTo = oldWindow[oldWindow.length - 1].time; // nur bis hierhin je verifiziert gefetcht

    // Replay-Zeitpunkt liegt genau in der Lücke, kurz vor dem neuen (disjunkten) Fenster.
    const effectiveEndSec = newWindowStart - BAR_SECONDS * 3;

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("'+1 Kerze': a single new bar not yet fetched must NOT be served from the stale cache", () => {
    const cached = Array.from({ length: 1000 }, (_, i) => candle(i * BAR_SECONDS));
    const completeUpTo = cached[cached.length - 1].time; // letzter erfolgreicher Fetch endete genau hier
    const effectiveEndSec = completeUpTo + BAR_SECONDS; // ein "+1 Kerze"-Klick weiter

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });

  it("tolerates a normal forex weekend gap as long as it was actually fetched that far (completeUpTo past it)", () => {
    const fridayClose = 1000 * BAR_SECONDS;
    const weekendGapSeconds = 60 * 3600;
    const before = Array.from({ length: 999 }, (_, i) => candle(i * BAR_SECONDS));
    const cached = [...before, candle(fridayClose)];

    const effectiveEndSec = fridayClose + weekendGapSeconds; // Montagmorgen, echte Marktschließung dazwischen
    const completeUpTo = effectiveEndSec; // dieser genaue Zeitpunkt wurde tatsächlich schon einmal gefetcht

    const result = cachedCandlesUpTo(cached, completeUpTo, effectiveEndSec, 1000);
    expect(result).not.toBeNull();
    expect(result[result.length - 1].time).toBe(fridayClose);
  });

  it("returns null when the cache doesn't have enough depth even without a gap", () => {
    const cached = Array.from({ length: 500 }, (_, i) => candle(i * BAR_SECONDS));
    const effectiveEndSec = cached[cached.length - 1].time;

    const result = cachedCandlesUpTo(cached, effectiveEndSec, effectiveEndSec, 1000);
    expect(result).toBeNull();
  });
});

// Bug-Report Philip 2026-07-21: fetchCandlesCached setzte completeUpTo bisher IMMER auf den vollen
// angefragten Zeitpunkt, egal wie weit die tatsächliche Antwort reichte — ein Fetch, der aus
// irgendeinem Grund (fehlerhafte Eingabe, eine API-Eigenheit wie cTraders "toTimestamp zählt selbst
// noch als offene Kerze", siehe replayFetchToMs in chartTimeUtils.js) kürzer ausfiel, poisoned den
// Cache dadurch DAUERHAFT (übersteht Reloads, siehe cachedCandlesUpTo oben — completeUpTo ist die
// einzige Quelle der Wahrheit für "reicht der Cache"). safeCompleteUpTo trennt jetzt "eine ECHTE
// Marktschließzeit" (Antwort reicht nur wenig kürzer, bleibt vertrauenswürdig) von "grob falsch/leer"
// (Antwort bricht weit vor dem angefragten Ziel ab, oder gar nicht erst) — Letzteres claimt keine
// Vollständigkeit mehr, damit der NÄCHSTE Aufruf automatisch neu fetcht statt für immer hängen zu bleiben.
describe("safeCompleteUpTo", () => {
  function candleAt(time) {
    return { time, open: 1, high: 1, low: 1, close: 1 };
  }

  it("trusts the full requested end time when the response reaches it exactly", () => {
    const fresh = [candleAt(1000), candleAt(1300), candleAt(1600)];
    expect(safeCompleteUpTo(fresh, 1600)).toBe(1600);
  });

  it("still trusts the full requested end time for a normal weekend-sized gap", () => {
    const fridayClose = 1_000_000;
    const fresh = [candleAt(fridayClose - 300), candleAt(fridayClose)];
    const mondayMorning = fridayClose + 60 * 3600; // ~60h Wochenend-Lücke
    expect(safeCompleteUpTo(fresh, mondayMorning)).toBe(mondayMorning);
  });

  it("caps completeUpTo at the actual last candle when the response falls far short of the target (grober Ausreißer)", () => {
    const fresh = [candleAt(1000), candleAt(1300)];
    const requestedEnd = 1300 + 10 * 24 * 3600; // 10 Tage weiter als tatsächlich geliefert
    expect(safeCompleteUpTo(fresh, requestedEnd)).toBe(1300);
  });

  it("claims no completeness at all for a completely empty response", () => {
    expect(safeCompleteUpTo([], 999_999)).toBeNull();
  });
});
