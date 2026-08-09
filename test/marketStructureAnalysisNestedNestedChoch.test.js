// Chat 2026-08-09 ("wie viele Ebenen wie möglich"): bis hierhin war state.nestedTrend fest auf
// GENAU eine Ebene gedeckelt (applyMarketStructurePivot/applyInnerMarketStructurePivot riefen
// advanceNestedTrend/-Inner NICHT mehr auf, sobald sie selbst schon für einen Nested-Tracker liefen
// — siehe der jetzt entfernte `nested`-Flag). Der Typ (nestedTrend: MarketStructureState | null,
// range.type.ts) war von Anfang an selbstreferenziell — diese Datei beweist, dass die Freigabe
// dieser Sperre tatsächlich eine DRITTE Ebene (ein Gegentrend-Kandidat INNERHALB des bereits
// bestätigten Gegentrend-Kandidaten) korrekt aufbaut, UND dass eine Promotion eine bereits
// bestätigte dritte Ebene als neue zweite Ebene übernimmt statt sie zu verwerfen.
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
const confirmBreak = { type: "high", price: 1.2, pivotAt: "confirm", pivotTime: 40, touched: false };
// Ebene 2 (bärischer CHoCH innerhalb des Uptrends) — exakt wie in marketStructureAnalysisChoch.test.js.
const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
// Ebene 3 (bullischer CHoCH INNERHALB der Ebene-2-Struktur, also "CHoCH vom CHoCH"): pivotE seedet
// (Origin: Ebene-2-Low pivotD + erster Pullback-High danach), pivotF ist der qualifizierende
// Pullback-Low, pivotG bricht pivotE und bestätigt.
const pivotE = { type: "high", price: 1.06, pivotAt: "pivotE", pivotTime: 80, touched: false };
const pivotF = { type: "low", price: 1.05, pivotAt: "pivotF", pivotTime: 90, touched: false };
const pivotG = { type: "high", price: 1.18, pivotAt: "pivotG", pivotTime: 100, touched: false };

function tripleNestedState() {
  let state = initMarketStructureState(originLow, originHigh);
  for (const p of [pullback, confirmBreak, pivotB, pivotC, pivotD, pivotE, pivotF, pivotG]) {
    state = applyMarketStructurePivot(state, p);
  }
  return state;
}

describe("marketStructureAnalysis: dritte Verschachtelungsebene (nestedTrend.nestedTrend, CHoCH vom CHoCH)", () => {
  it("baut Ebene 3 automatisch auf, sobald Ebene 2 bestätigt ist — derselbe advanceNestedTrend-Mechanismus, jetzt auch auf einem Nested-Tracker selbst", () => {
    const state = tripleNestedState();

    expect(state.trend).toBe("uptrend");
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.trend).toBe("downtrend"); // Ebene 2, unverändert ggü. marketStructureAnalysisChoch.test.js
    expect(state.nestedTrend.currRange).toEqual({ high: { ...confirmBreak, type: "high" }, low: { ...pivotD, type: "low" } });

    const level3 = state.nestedTrend.nestedTrend;
    expect(level3).not.toBeNull();
    expect(level3.trend).toBe("uptrend");
    expect(level3.currRange).toEqual({ low: { ...pivotD, type: "low" }, high: { ...pivotG, type: "high" } });
    expect(level3.structurePivots).toEqual([{ ...pivotF, type: "protected-low" }]);
    // Eine vierte Ebene existiert (noch) nicht — es gab keinen weiteren Pullback+Bruch dafür.
    expect(level3.nestedTrend).toBeNull();
  });

  it("Promotion übernimmt eine bereits bestätigte dritte Ebene als neue zweite Ebene, statt sie zu verwerfen", () => {
    let state = tripleNestedState();
    const level3BeforePromotion = state.nestedTrend.nestedTrend;
    expect(level3BeforePromotion.trend).toBe("uptrend"); // Baseline aus dem Test oben

    const breakingPivot = { type: "low", price: 0.8, pivotAt: "break-low", pivotTime: 120, touched: false };
    // Gleiches Muster wie marketStructureAnalysisChoch.test.js "Promotion ohne weiteren Bruch": die
    // frühe Kerze löst die TOP-Level-Invalidierung aus (schließt unter dem Haupttrend-Ursprung 1.0),
    // die einzige Kerze NACH pivotD (Zeit 70) bleibt aber über dessen Preis (1.02) -> kein echter
    // Bruch der übernommenen (Ebene-2-)Range selbst -> ihr Ursprungs-Pivot (und damit dessen
    // pivotTime) bleibt unverändert, wodurch Ebene 3 NICHT als "stale" verworfen wird.
    const candles = [
      { time: 5, open: 0.6, high: 0.6, low: 0.4, close: 0.5 },
      { time: 75, open: 1.04, high: 1.05, low: 1.0, close: 1.03 },
    ];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("downtrend"); // Promotion: Ebene 2 wird neuer Haupttrend
    expect(state.currRange).toEqual({
      high: { ...confirmBreak, type: "high" },
      low: { ...pivotD, type: "sweeped-low" }, // nur Docht, kein echter Bruch der übernommenen Range
    });

    // Der entscheidende neue Fall: Ebene 3 (vorher nested.nestedTrend) ist jetzt state.nestedTrend,
    // nicht verworfen (vorher: nestedTrend: null bei jeder Promotion, siehe invalidateUptrend).
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.trend).toBe("uptrend");
    expect(state.nestedTrend.currRange.high).toEqual(level3BeforePromotion.currRange.high);
    // Der brechende Pivot selbst lief (wie schon bei der Ebene-1<->2-Promotion) auch noch gegen
    // Ebene 3 weiter — hier nur als Sweep (kein echter Bruch von deren eigenem Low), siehe oben.
    expect(state.nestedTrend.currRange.low).toEqual({ ...pivotD, type: "sweeped-low" });
  });
});
