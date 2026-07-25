// Chat 2026-07-25 (gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts): der reale
// Live-Fall zeigt, dass sich ein Downtrend schon lange VOR der eigentlichen Invalidierung
// ankündigt — die Outer-Pivots 1.35583 (H) -> 1.35206 (L) -> 1.35429 (LH) -> 1.34601 (LL) bilden
// bereits eine bestätigte bärische Struktur (Change of Character), obwohl currRange.low des
// Haupttrends formal erst später real bricht. Diese Datei testet den parallel mitlaufenden
// Nested-Trend-Tracker (advanceNestedTrend, nicht exportiert — daher indirekt über
// applyMarketStructurePivot/buildMarketStructureState getestet, wie auch tryConfirmUptrend/
// markLqSweeps schon vorher nur indirekt getestet wurden) und die Promotion bei echter
// Invalidierung (applyInnerMarketStructurePivot).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
// Bricht originHigh und bestätigt den Uptrend (protected-low = pullback) — analog zum Origin-High
// aus dem Live-Fall (pivot7, 1.35583), das später zugleich der Nested-Origin-High wird.
const confirmBreak = { type: "high", price: 1.2, pivotAt: "confirm", pivotTime: 40, touched: false };

function confirmedUptrendState() {
  let state = initMarketStructureState(originLow, originHigh);
  state = applyMarketStructurePivot(state, pullback);
  state = applyMarketStructurePivot(state, confirmBreak);
  expect(state.trend).toBe("uptrend");
  expect(state.nestedTrend).toBeNull();
  expect(state.closedRanges).toEqual([]);
  return state;
}

describe("marketStructureAnalysis: Nested-Trend/CHoCH-Erkennung (advanceNestedTrend, direction='down')", () => {
  it("baut sich Schritt für Schritt auf: H -> L (Seed) -> LH (Pullback), noch NICHT bestätigt", () => {
    let state = confirmedUptrendState();
    // pivotB: analog pivot8 (1.35206) — erster Pullback-Low nach confirmBreak, seedet den Nested-Tracker.
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.trend).toBe("unknown");
    expect(state.nestedTrend.currRange).toEqual({ high: { ...confirmBreak, type: "high" }, low: { ...pivotB, type: "low" } });

    // pivotC: analog pivot9 (1.35429) — Lower High, bricht confirmBreak (1.2) NICHT -> bleibt Pullback.
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.trend).toBe("unknown"); // noch kein CHoCH
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]);
  });

  it("CHoCH-Bestätigung: Bruch von pivotB löst tryConfirmTrend(direction='down') aus, pivotC wird protected-high", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);

    // pivotD: analog pivot10 (1.34601) — bricht pivotB (1.05) nach unten, bestätigt den Gegentrend.
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotD);

    expect(state.nestedTrend.trend).toBe("downtrend");
    expect(state.nestedTrend.currRange.high).toEqual({ ...confirmBreak, type: "high" });
    expect(state.nestedTrend.currRange.low).toEqual({ ...pivotD, type: "low" });
    expect(state.nestedTrend.structurePivots).toEqual([{ ...pivotC, type: "protected-high" }]);
    // Der Haupttrend selbst bleibt davon unberührt — CHoCH ist nur ein Vorlauf-Signal.
    expect(state.trend).toBe("uptrend");
    // Anker fürs CHoCH-Label (Rendering) ist die URSPRÜNGLICHE Nested-Origin-Low (pivotB), NICHT
    // der brechende Pivot (pivotD) — Bug-Report Philip 2026-07-25: "IST 1.34601, SOLL 1.35206".
    expect(state.nestedTrend.appliedPivots[1]).toEqual({ ...pivotB, type: "low" });
    // firstConfirmedAt ist der Anker fürs Linien-ENDE der CHoCH-Darstellung, eingefroren auf den
    // Bestätigungsmoment selbst (pivotD) — siehe nächster Test für den eigentlichen Bug.
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "low" });
  });

  it("firstConfirmedAt bleibt eingefroren, auch wenn der noch nicht promotete Nested-Trend über pivotD hinaus weiterwandert", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");

    // Ein weiterer Pullback + ein NEUER, tieferer Bruch (analog: der Gegentrend läuft weiter,
    // solange die eigentliche Uptrend-Invalidierung noch nicht real passiert ist) — currRange.low
    // rückt vor, firstConfirmedAt darf sich NICHT mitverschieben (Bug-Report Philip 2026-07-25:
    // "CHOCH Linie geht noch zu weit" — die Linie wuchs vorher mit currRange.low mit).
    const pivotE = { type: "high", price: 1.08, pivotAt: "pivotE", pivotTime: 80, touched: false };
    const pivotF = { type: "low", price: 0.98, pivotAt: "pivotF", pivotTime: 90, touched: false };
    state = applyMarketStructurePivot(state, pivotE);
    state = applyMarketStructurePivot(state, pivotF);

    expect(state.nestedTrend.currRange.low).toEqual({ ...pivotF, type: "low" }); // weitergerückt
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "low" }); // unverändert
  });

  it("ein bereits bestätigter Nested-Trend wird verworfen, sobald der Haupttrend danach noch ein ECHTES neues Hoch bricht", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend"); // CHoCH bestätigt

    // Widerspricht der Lower-High-Prämisse des CHoCH: der Haupttrend bricht NACH der Bestätigung
    // noch ein neues, höheres Hoch (analog zu einer Fortsetzung des Uptrends statt der erwarteten
    // Umkehr) — Bug-Report Philip 2026-07-25: "Choch Linie immernoch zu weit", weil ein längst
    // überholter, bereits bestätigter Nested-Tracker vorher NIE wieder verworfen wurde.
    const newHigh = { type: "high", price: 1.3, pivotAt: "newHigh", pivotTime: 80, touched: false };
    state = applyMarketStructurePivot(state, newHigh);

    expect(state.currRange.high).toEqual({ ...newHigh, type: "high" });
    expect(state.nestedTrend).toBeNull(); // der überholte CHoCH ist weg, wartet auf einen neuen Pullback-Low
  });

  it("Reseed: eine weitere reguläre HH VOR der CHoCH-Bestätigung verwirft den bisherigen Nested-Tracker", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]); // noch unbestätigter Zwischenstand

    // Neues, höheres High bricht confirmBreak (1.2) -> currRange.high rückt vor, der alte
    // Nested-Ursprung (confirmBreak) ist damit überholt.
    const newHigh = { type: "high", price: 1.3, pivotAt: "newHigh", pivotTime: 65, touched: false };
    state = applyMarketStructurePivot(state, newHigh);
    expect(state.currRange.high).toEqual({ ...newHigh, type: "high" });
    expect(state.nestedTrend).toBeNull(); // verworfen, wartet auf den nächsten Pullback-Low

    const pivotF = { type: "low", price: 1.25, pivotAt: "pivotF", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotF);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.currRange).toEqual({ high: { ...newHigh, type: "high" }, low: { ...pivotF, type: "low" } });
  });
});

describe("marketStructureAnalysis: Promotion bei Invalidierung mit bereits bestätigtem Nested-Trend", () => {
  function chochConfirmedState() {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");
    return state;
  }

  it("echte Invalidierung (Kerze schließt unter currRange.low) übernimmt den bestätigten Nested-Trend statt komplett zurückzusetzen", () => {
    let state = chochConfirmedState();
    const nestedBeforePromotion = state.nestedTrend;
    const breakingPivot = { type: "low", price: 0.8, pivotAt: "break-low", pivotTime: 80, touched: false };
    // Kerze zwischen currRange.low (Zeit 0) und dem brechenden Pivot, schließt klar unter 1.0.
    const candles = [{ time: 75, open: 0.98, high: 0.99, low: 0.75, close: 0.85 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("downtrend"); // nicht 'unknown' -> Promotion statt vollem Reset
    expect(state.currRange).toEqual(nestedBeforePromotion.currRange);
    expect(state.structurePivots).toEqual(nestedBeforePromotion.structurePivots);
    expect(state.appliedPivots).toEqual(nestedBeforePromotion.appliedPivots);
    expect(state.innerStructurePivots).toEqual([]);
    expect(state.nestedTrend).toBeNull();
    // Alte Uptrend-Range archiviert für die Darstellung (einfache Linie, kein Zigzag).
    expect(state.closedRanges).toEqual([{ low: { ...originLow, type: "low" }, high: { ...confirmBreak, type: "high" }, trend: "uptrend" }]);
  });

  it("Fallback bleibt erhalten: ohne bestätigten Nested-Trend weiterhin voller Reset auf 'unknown', nestedTrend/closedRanges bleiben leer", () => {
    let state = confirmedUptrendState(); // kein nestedTrend aufgebaut
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "break-low", pivotTime: 50, touched: false };
    const candles = [{ time: 45, open: 0.98, high: 0.99, low: 0.85, close: 0.88 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("unknown");
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([]);
  });
});
