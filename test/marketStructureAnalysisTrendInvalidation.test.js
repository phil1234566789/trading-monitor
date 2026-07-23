// Chat 2026-07-24 (gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts): spiegelbildlicher
// Fall zum High-Bruch in applyInnerMarketStructurePivot — bis hierhin explizit "NICHT
// implementiert". Live beobachtet (GBPUSD 1h): ein eingebetteter (Periode-2-)Pivot bildet sich
// unter currRange.low, mehrere Kerzen schließen danach tatsächlich drunter (kein bloßer Docht) —
// der bestätigte Uptrend ist damit komplett invalidiert, nicht nur ein Sweep.
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
// Bringt den Uptrend zuerst in den bestätigten Zustand: pullback (qualifiziert) + Bruch.
const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
const confirmBreak = { type: "high", price: 1.2, pivotAt: "confirm", pivotTime: 40, touched: false };

function confirmedUptrendState() {
  let state = initMarketStructureState(originLow, originHigh);
  state = applyMarketStructurePivot(state, pullback);
  state = applyMarketStructurePivot(state, confirmBreak);
  expect(state.trend).toBe("uptrend");
  expect(state.currRange.high.pivotAt).toBe("confirm"); // 1.2, Zeit 40
  expect(state.currRange.low.pivotAt).toBe("lo"); // 1.0, Zeit 0 — nie ersetzt
  return state;
}

describe("marketStructureAnalysis: Uptrend-Invalidierung durch Low-Bruch (applyInnerMarketStructurePivot)", () => {
  it("bestätigter Uptrend + eingebetteter Pivot bricht currRange.low PREISLICH UND eine Kerze schließt tatsächlich drunter -> Trend zurück auf 'unknown', Algo startet komplett neu", () => {
    let state = confirmedUptrendState();
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "break-low", pivotTime: 50, touched: false };
    // Kerze zwischen currRange.low (Zeit 0) und dem brechenden Pivot (Zeit 50), schließt klar unter 1.0.
    const candles = [{ time: 45, open: 0.98, high: 0.99, low: 0.85, close: 0.88 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("unknown");
    // Alter currRange.high wird als neuer Origin-High WEITERVERWENDET, nicht verworfen.
    expect(state.currRange.high).toEqual({ ...confirmBreak, type: "high" });
    expect(state.currRange.low).toEqual({ ...breakingPivot, type: "low" });
    // Komplett frischer Start — alte Struktur ist weg.
    expect(state.structurePivots).toEqual([]);
    expect(state.innerStructurePivots).toEqual([]);
    expect(state.appliedPivots).toEqual([state.currRange.high, state.currRange.low]);
  });

  it("bestätigter Uptrend + eingebetteter Pivot bricht currRange.low NUR preislich (kein Close drunter) -> nur 'sweeped-low', Uptrend bleibt bestehen", () => {
    let state = confirmedUptrendState();
    const structurePivotsBefore = state.structurePivots;
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "sweep-low", pivotTime: 50, touched: false };
    // Docht unter 1.0, aber Close bleibt drüber -> kein echter Bruch.
    const candles = [{ time: 45, open: 1.02, high: 1.03, low: 0.95, close: 1.01 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("uptrend"); // unverändert
    expect(state.currRange.low).toEqual({ ...originLow, type: "sweeped-low" }); // Preis/Zeit unverändert, nur Typ
    expect(state.currRange.high.pivotAt).toBe("confirm"); // unverändert
    expect(state.structurePivots).toEqual(structurePivotsBefore); // alte Struktur bleibt komplett unangetastet (Inhalt, nicht Referenz — markLqSweeps baut das Array immer neu)
    expect(state.innerStructurePivots.find((p) => p.pivotAt === "sweep-low")).toBeTruthy();
  });

  it("Uptrend noch NICHT bestätigt (trend='unknown') + eingebetteter Pivot bricht currRange.low mit echtem Close drunter -> currRange.low wird nur ausgeweitet, nichts zu invalidieren", () => {
    let state = initMarketStructureState(originLow, originHigh); // trend: 'unknown', nie bestätigt
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "extend-low", pivotTime: 50, touched: false };
    const candles = [{ time: 5, open: 0.98, high: 0.99, low: 0.85, close: 0.88 }]; // schließt klar unter 1.0

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("unknown"); // weiterhin unbestätigt, kein Reset nötig
    expect(state.currRange.low).toEqual({ ...breakingPivot, type: "low" }); // einfach ausgeweitet
    expect(state.currRange.high).toEqual({ ...originHigh, type: "high" }); // unverändert
    expect(state.innerStructurePivots.find((p) => p.pivotAt === "extend-low")).toBeTruthy();
  });
});
