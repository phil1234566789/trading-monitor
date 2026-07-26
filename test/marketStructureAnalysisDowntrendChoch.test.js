// Chat 2026-07-26 ("Bescheid :D" — Antwort auf die Rückfrage, ob der bullische Gegentrend-Tracker
// innerhalb eines Downtrends ebenfalls gebaut werden soll): spiegelbildlicher Nested-Tracker zu
// marketStructureAnalysisChoch.test.js, diesmal direction="up" innerhalb eines bestätigten
// Downtrends (statt direction="down" innerhalb eines Uptrends). Dieselbe Mechanik
// (advanceNestedTrend/-Inner, jetzt bidirektional über state.trend statt hart auf 'uptrend'
// verdrahtet), dieselbe Promotion bei echter Invalidierung (invalidateDowntrend, jetzt mit
// Promotion-Zweig analog zu invalidateUptrend).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const originHigh = { type: "high", price: 1.2, pivotAt: "hi", pivotTime: 0, touched: false };
const originLow = { type: "low", price: 1.1, pivotAt: "lo", pivotTime: 10, touched: false };
const pullback = { type: "high", price: 1.15, pivotAt: "pb", pivotTime: 20, touched: false };
// Bricht originLow und bestätigt den Downtrend (protected-high = pullback) — analog zu confirmBreak
// aus marketStructureAnalysisChoch.test.js, nur gespiegelt.
const confirmBreak = { type: "low", price: 1.05, pivotAt: "confirm", pivotTime: 40, touched: false };

function confirmedDowntrendState() {
  let state = initMarketStructureState(originHigh, originLow);
  state = applyMarketStructurePivot(state, pullback);
  state = applyMarketStructurePivot(state, confirmBreak);
  expect(state.trend).toBe("downtrend");
  expect(state.nestedTrend).toBeNull();
  expect(state.closedRanges).toEqual([]);
  return state;
}

describe("marketStructureAnalysis: Nested-Trend/CHoCH-Erkennung innerhalb eines Downtrends (advanceNestedTrend, direction='up')", () => {
  it("baut sich Schritt für Schritt auf: L -> H (Seed) -> HL (Pullback), noch NICHT bestätigt", () => {
    let state = confirmedDowntrendState();
    // pivotB: erster Pullback-High nach confirmBreak, seedet den Nested-Tracker.
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.trend).toBe("unknown");
    expect(state.nestedTrend.currRange).toEqual({ low: { ...confirmBreak, type: "low" }, high: { ...pivotB, type: "high" } });

    // pivotC: Higher Low, bricht confirmBreak (1.05) NICHT -> bleibt Pullback.
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.trend).toBe("unknown"); // noch kein CHoCH
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]);
  });

  it("CHoCH-Bestätigung: Bruch von pivotB löst tryConfirmTrend(direction='up') aus, pivotC wird protected-low", () => {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);

    // pivotD: bricht pivotB (1.08) nach oben, bestätigt den Gegentrend.
    const pivotD = { type: "high", price: 1.12, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotD);

    expect(state.nestedTrend.trend).toBe("uptrend");
    expect(state.nestedTrend.currRange.low).toEqual({ ...confirmBreak, type: "low" });
    expect(state.nestedTrend.currRange.high).toEqual({ ...pivotD, type: "high" });
    expect(state.nestedTrend.structurePivots).toEqual([{ ...pivotC, type: "protected-low" }]);
    // Der Haupttrend selbst bleibt davon unberührt — CHoCH ist nur ein Vorlauf-Signal.
    expect(state.trend).toBe("downtrend");
    expect(state.nestedTrend.appliedPivots[1]).toEqual({ ...pivotB, type: "high" });
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "high" });
  });

  it("firstConfirmedAt bleibt eingefroren, auch wenn der noch nicht promotete Nested-Trend über pivotD hinaus weiterwandert", () => {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "high", price: 1.12, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("uptrend");

    // Ein weiterer Pullback + ein NEUER, höherer Bruch — bewusst UNTER dem Haupttrend-Ursprung
    // (1.2, originHigh), sonst würde pivotF selbst schon den Haupttrend invalidieren/promoten.
    const pivotE = { type: "low", price: 1.09, pivotAt: "pivotE", pivotTime: 80, touched: false };
    const pivotF = { type: "high", price: 1.15, pivotAt: "pivotF", pivotTime: 90, touched: false };
    state = applyMarketStructurePivot(state, pivotE);
    state = applyMarketStructurePivot(state, pivotF);

    expect(state.nestedTrend.currRange.high).toEqual({ ...pivotF, type: "high" }); // weitergerückt
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "high" }); // unverändert
  });

  it("ein bereits bestätigter Nested-Trend wird verworfen, sobald der Haupttrend danach noch ein ECHTES neues Tief bricht", () => {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "high", price: 1.12, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("uptrend"); // CHoCH bestätigt

    // Widerspricht der Higher-Low-Prämisse des CHoCH: der Haupttrend bricht NACH der Bestätigung
    // noch ein neues, tieferes Tief.
    const newLow = { type: "low", price: 0.95, pivotAt: "newLow", pivotTime: 80, touched: false };
    state = applyMarketStructurePivot(state, newLow);

    expect(state.currRange.low).toEqual({ ...newLow, type: "low" });
    expect(state.nestedTrend).toBeNull(); // der überholte CHoCH ist weg, wartet auf einen neuen Pullback-High
  });

  it("Reseed: ein weiteres reguläres LL VOR der CHoCH-Bestätigung verwirft den bisherigen Nested-Tracker", () => {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]); // noch unbestätigter Zwischenstand

    // Neues, tieferes Low bricht confirmBreak (1.05) -> currRange.low rückt vor, der alte
    // Nested-Ursprung (confirmBreak) ist damit überholt.
    const newLow = { type: "low", price: 1.0, pivotAt: "newLow", pivotTime: 65, touched: false };
    state = applyMarketStructurePivot(state, newLow);
    expect(state.currRange.low).toEqual({ ...newLow, type: "low" });
    expect(state.nestedTrend).toBeNull(); // verworfen, wartet auf den nächsten Pullback-High

    const pivotF = { type: "high", price: 1.03, pivotAt: "pivotF", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotF);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.currRange).toEqual({ low: { ...newLow, type: "low" }, high: { ...pivotF, type: "high" } });
  });

  it("ein Periode-2-Pivot lässt currRange.high des bereits bestätigten Nested-Trends weiter nachrücken", () => {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "high", price: 1.12, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("uptrend");

    // Bricht nestedTrend.currRange.high (1.12), aber NICHT den Haupttrend (dessen currRange.high
    // bleibt bei 1.2) — reiner Periode-2-Pivot, kein Outer-Pivot.
    const innerHigh = { type: "high", price: 1.13, pivotAt: "innerHigh", pivotTime: 75, touched: false };
    state = applyInnerMarketStructurePivot(state, innerHigh, { candles: [] });

    expect(state.nestedTrend.currRange.high).toEqual({ ...innerHigh, type: "high" });
    expect(state.nestedTrend.trend).toBe("uptrend"); // bleibt bestätigt, nur weitergerückt
    expect(state.trend).toBe("downtrend"); // Haupttrend unberührt
    expect(state.currRange.high).toEqual({ ...originHigh, type: "high" });
  });
});

describe("marketStructureAnalysis: Promotion bei Invalidierung eines Downtrends mit bereits bestätigtem (bullischem) Nested-Trend", () => {
  function chochConfirmedState() {
    let state = confirmedDowntrendState();
    const pivotB = { type: "high", price: 1.08, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "low", price: 1.06, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "high", price: 1.12, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("uptrend");
    return state;
  }

  it("echte Invalidierung (Kerze schließt über currRange.high) übernimmt den bestätigten Nested-Trend als neuen Haupttrend (Promotion), statt komplett zurückzusetzen", () => {
    let state = chochConfirmedState();
    // Bricht den Haupttrend-Ursprung (currRange.high = 1.2) mit echtem Kerzenschluss drüber.
    // direction="down" explizit, weil dieser Test applyMarketStructurePivot direkt (nicht über
    // buildMarketStructureState) aufruft — die Richtungswahl anhand von state.trend übernimmt sonst
    // buildMarketStructureState (siehe dort), hier muss sie von Hand mitgegeben werden.
    const breakingPivot = { type: "high", price: 1.25, pivotAt: "break-high", pivotTime: 100, touched: false };
    const candles = [{ time: 95, open: 1.12, high: 1.26, low: 1.11, close: 1.26 }];
    state = applyMarketStructurePivot(state, breakingPivot, { candles, direction: "down" });

    expect(state.trend).toBe("uptrend");
    expect(state.currRange.low).toEqual({ ...confirmBreak, type: "low" });
    expect(state.currRange.high).toEqual({ ...breakingPivot, type: "high" }); // breakingPivot bricht nested.currRange.high (1.12) selbst noch mit
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([
      { low: { ...confirmBreak, type: "low" }, middle: { ...pullback, type: "protected-high" }, high: { ...originHigh, type: "high" }, trend: "downtrend" },
    ]);
  });

  it("Fallback bleibt erhalten: ohne bestätigten Nested-Trend weiterhin voller Reset auf 'unknown', nestedTrend/closedRanges bleiben leer für den Nested-Kandidaten", () => {
    let state = confirmedDowntrendState(); // kein nestedTrend aufgebaut
    const breakingPivot = { type: "high", price: 1.3, pivotAt: "break-high", pivotTime: 50, touched: false };
    const candles = [{ time: 45, open: 1.05, high: 1.32, low: 1.04, close: 1.31 }];

    state = applyMarketStructurePivot(state, breakingPivot, { candles, direction: "down" });

    expect(state.trend).toBe("unknown");
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([
      { low: { ...confirmBreak, type: "low" }, middle: { ...pullback, type: "protected-high" }, high: { ...originHigh, type: "high" }, trend: "downtrend" },
    ]);
  });
});
