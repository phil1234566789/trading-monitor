// Bug-Report Philip 2026-07-26 (Screenshot: nestedTrend.trend zeigt "uptrend" mit
// currRange.high=1.33937, obwohl keine 1h-Kerze je über dem alten High 1.33907 schließt): der
// Docht-vs-Bruch-Check (closesAboveOldHigh/closesBelowLevel) existierte für die BESTÄTIGENDE Seite
// (HIGH-Bruch bei direction="up", LOW-Bruch bei direction="down") bis dahin nur im Inner-
// (Periode-2-)Pfad (seit Chat 2026-07-24) — der ältere Outer-(Periode-5-)Pfad bestätigte einen
// reinen Docht-Bruch ohne jeden Kerzen-Check sofort. Jetzt über die geteilte
// evaluateConfirmingBreak-Funktion behoben (siehe marketStructureAnalysis.ts) — diese Datei
// sichert das für den Outer-Pfad in BEIDEN Richtungen ab, analog zu den längst bestehenden
// Inner-Pivot-Tests (marketStructureAnalysisInnerPivots.test.js: rangeState2_1/rangeState1_4).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot } from "../src/marketStructureAnalysis";

describe("marketStructureAnalysis: Outer-Pivot-Bestätigung respektiert Docht-vs-Bruch (evaluateConfirmingBreak, direction='up')", () => {
  const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
  const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
  const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
  const wickOnlyBreak = { type: "high", price: 1.2, pivotAt: "wick", pivotTime: 40, touched: false };

  it("Outer-Pivot bricht currRange.high NUR preislich (Docht drüber, aber kein Kerzenschluss drüber) -> nur 'sweeped-high', KEINE Bestätigung", () => {
    let state = initMarketStructureState(originLow, originHigh);
    state = applyMarketStructurePivot(state, pullback);
    // closesAboveOldHigh prüft gegen das ALTE High (1.1), nicht gegen wickOnlyBreak.price (1.2) —
    // Docht bis 1.25, aber Schluss bei 1.08 bleibt UNTER dem alten High 1.1 -> kein echter Bruch.
    const candles = [{ time: 30, open: 1.09, high: 1.25, low: 1.07, close: 1.08 }];
    state = applyMarketStructurePivot(state, wickOnlyBreak, { candles });

    expect(state.trend).toBe("unknown"); // NICHT bestätigt
    expect(state.currRange.high).toEqual({ ...originHigh, type: "sweeped-high" }); // Preis/Zeit bleiben
  });

  it("Outer-Pivot bricht currRange.high UND mindestens eine Kerze schließt tatsächlich drüber -> echter Bruch, Bestätigung läuft normal", () => {
    let state = initMarketStructureState(originLow, originHigh);
    state = applyMarketStructurePivot(state, pullback);
    const candles = [{ time: 30, open: 1.1, high: 1.25, low: 1.09, close: 1.22 }]; // Schluss über 1.1 UND über 1.2
    state = applyMarketStructurePivot(state, wickOnlyBreak, { candles });

    expect(state.trend).toBe("uptrend");
    expect(state.currRange.high).toEqual({ ...wickOnlyBreak, type: "high" });
  });
});

describe("marketStructureAnalysis: Outer-Pivot-Bestätigung respektiert Docht-vs-Bruch (evaluateConfirmingBreak, direction='down', eigenständige Downtrend-Erkennung)", () => {
  const originHigh = { type: "high", price: 1.2, pivotAt: "hi", pivotTime: 0, touched: false };
  const originLow = { type: "low", price: 1.1, pivotAt: "lo", pivotTime: 10, touched: false };
  const pullback = { type: "high", price: 1.15, pivotAt: "pb", pivotTime: 20, touched: false };
  const wickOnlyBreak = { type: "low", price: 1.0, pivotAt: "wick", pivotTime: 40, touched: false };

  it("Outer-Pivot bricht currRange.low NUR preislich (Docht drunter, aber kein Kerzenschluss drunter) -> nur 'sweeped-low', KEINE eigenständige Downtrend-Bestätigung", () => {
    let state = initMarketStructureState(originHigh, originLow);
    state = applyMarketStructurePivot(state, pullback);
    // closesBelowLevel prüft gegen das ALTE Low (1.1), nicht gegen wickOnlyBreak.price (1.0) —
    // Docht bis 0.95, aber Schluss bei 1.12 bleibt ÜBER dem alten Low 1.1 -> kein echter Bruch.
    const candles = [{ time: 30, open: 1.11, high: 1.13, low: 0.95, close: 1.12 }];
    state = applyMarketStructurePivot(state, wickOnlyBreak, { candles });

    expect(state.trend).toBe("unknown");
    expect(state.currRange.low).toEqual({ ...originLow, type: "sweeped-low" });
  });

  it("Outer-Pivot bricht currRange.low UND mindestens eine Kerze schließt tatsächlich drunter -> echter Bruch, eigenständige Downtrend-Bestätigung läuft", () => {
    let state = initMarketStructureState(originHigh, originLow);
    state = applyMarketStructurePivot(state, pullback);
    // Schluss bei 1.05 bleibt UNTER dem alten Low 1.1 -> echter Bruch (closesBelowLevel prüft
    // gegen das ALTE currRange.low, nicht gegen wickOnlyBreak.price selbst).
    const candles = [{ time: 30, open: 1.1, high: 1.11, low: 0.95, close: 1.05 }];
    state = applyMarketStructurePivot(state, wickOnlyBreak, { candles });

    expect(state.trend).toBe("downtrend");
    expect(state.currRange.low).toEqual({ ...wickOnlyBreak, type: "low" });
  });
});
