// Reproduziert Philips Schritt-für-Schritt-Beispiel aus tdd_mit_claude.ts 1:1
// (rangeState1 -> rangeState7) — verifiziert, dass initMarketStructureState/applyMarketStructurePivot
// exakt dieselben Zustände produzieren, die er von Hand für pivot1..pivot8 hergeleitet hat.
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot } from "../src/marketStructureAnalysis";

const pivot1 = { type: "low", price: 1.33667, pivotAt: "13.07.2026 03:00", pivotTime: 1783904400, touched: { price: 1.33667, touchedAt: "13.07.2026 16:00" } };
const pivot2 = { type: "high", price: 1.34115, pivotAt: "13.07.2026 10:00", pivotTime: 1783929600, touched: { price: 1.34115, touchedAt: "14.07.2026 14:00" } };
const pivot3 = { type: "low", price: 1.33416, pivotAt: "13.07.2026 23:00", pivotTime: 1783976400, touched: false };
const pivot4 = { type: "low", price: 1.33512, pivotAt: "14.07.2026 09:00", pivotTime: 1784012400, touched: false };
const pivot5 = { type: "high", price: 1.34434, pivotAt: "14.07.2026 14:00", pivotTime: 1784030400, touched: { price: 1.34434, touchedAt: "15.07.2026 15:00" } };
const pivot6 = { type: "low", price: 1.33681, pivotAt: "14.07.2026 19:00", pivotTime: 1784048400, touched: false };
const pivot7 = { type: "low", price: 1.33806, pivotAt: "15.07.2026 12:00", pivotTime: 1784109600, touched: false };
const pivot8 = { type: "high", price: 1.35578, pivotAt: "15.07.2026 20:00", pivotTime: 1784138400, touched: false };

describe("marketStructureAnalysis", () => {
  it("rangeState1: initMarketStructureState liest pivot1+pivot2, trend unknown", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    expect(s1.trend).toBe("unknown");
    expect(s1.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s1.structurePivots).toEqual([]);
    expect(s1.appliedPivots).toEqual([pivot1, pivot2]);
  });

  it("rangeState2: pivot3 ist tiefer als range-low -> range.low wird auf pivot3 gesetzt", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    const s2 = applyMarketStructurePivot(s1, pivot3);
    expect(s2.trend).toBe("unknown");
    expect(s2.currRange).toEqual({ high: pivot2, low: pivot3 });
    expect(s2.structurePivots).toEqual([]);
    expect(s2.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });

  it("rangeState3: pivot4 liegt innerhalb der Range -> landet in structurePivots, Range unverändert", () => {
    const s2 = applyMarketStructurePivot(initMarketStructureState(pivot1, pivot2), pivot3);
    const s3 = applyMarketStructurePivot(s2, pivot4);
    expect(s3.currRange).toEqual({ high: pivot2, low: pivot3 });
    expect(s3.structurePivots).toEqual([pivot4]);
    expect(s3.appliedPivots).toEqual([pivot1, pivot2, pivot3, pivot4]);
  });

  it("rangeState4: pivot5 bricht range-high, aber nur 1 Pullback-Low in der Struktur -> KEINE Trendbestätigung", () => {
    const s3 = applyMarketStructurePivot(applyMarketStructurePivot(initMarketStructureState(pivot1, pivot2), pivot3), pivot4);
    const s4 = applyMarketStructurePivot(s3, pivot5);
    expect(s4.trend).toBe("unknown");
    expect(s4.currRange).toEqual({ high: pivot5, low: pivot3 });
    expect(s4.structurePivots).toEqual([pivot4]);
    expect(s4.appliedPivots).toEqual([pivot1, pivot2, pivot3, pivot4, pivot5]);
  });

  it("rangeState5+6: pivot6/pivot7 liegen innerhalb der (neuen) Range -> beide landen in structurePivots", () => {
    let state = initMarketStructureState(pivot1, pivot2);
    for (const p of [pivot3, pivot4, pivot5, pivot6, pivot7]) state = applyMarketStructurePivot(state, p);
    expect(state.currRange).toEqual({ high: pivot5, low: pivot3 });
    expect(state.structurePivots).toEqual([pivot4, pivot6, pivot7]);
    expect(state.appliedPivots).toEqual([pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7]);
  });

  it("rangeState7: pivot8 bricht range-high mit 3 Pullback-Lows in der Struktur -> bestätigter Uptrend, jüngstes HL (pivot7) wird protected-low", () => {
    let state = initMarketStructureState(pivot1, pivot2);
    for (const p of [pivot3, pivot4, pivot5, pivot6, pivot7, pivot8]) state = applyMarketStructurePivot(state, p);
    expect(state.trend).toBe("uptrend");
    expect(state.currRange).toEqual({ high: pivot8, low: pivot3 });
    expect(state.structurePivots).toEqual([pivot4, pivot6, { ...pivot7, type: "protected-low" }]);
    expect(state.appliedPivots).toEqual([pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8]);
  });

  // Regressionstest für die Korrektur vom 2026-07-18: "≥2 Pullback-Lows in structurePivots reichen"
  // war FALSCH — Pullbacks müssen zeitlich NACH dem aktuellen range-high gelesen worden sein.
  // Zwei Pullbacks, die BEIDE vor dem aktuellen (aber eligible) range-high liegen, dürfen NICHT
  // bestätigen, obwohl die alte "nur zählen"-Regel das fälschlich getan hätte.
  it("bestätigt NICHT, wenn genug Pullback-Lows in der Struktur liegen, aber alle VOR dem aktuellen range-high gelesen wurden", () => {
    const a = { type: "low", price: 1.0, pivotAt: "a", pivotTime: 1 };
    const b = { type: "high", price: 1.1, pivotAt: "b", pivotTime: 2 }; // Ursprungspaar mit a
    const c = { type: "low", price: 0.95, pivotAt: "c", pivotTime: 3 }; // bricht a -> range-low = c, b damit NICHT eligible (b < c)
    const d1 = { type: "low", price: 0.97, pivotAt: "d1", pivotTime: 4 }; // innerhalb [c,b] -> Struktur, VOR e
    const d2 = { type: "low", price: 0.98, pivotAt: "d2", pivotTime: 5 }; // innerhalb [c,b] -> Struktur, VOR e
    const e = { type: "high", price: 1.15, pivotAt: "e", pivotTime: 6 }; // bricht b (nicht eligible) -> KEINE Bestätigung, nur Range-Erweiterung
    const f = { type: "high", price: 1.2, pivotAt: "f", pivotTime: 7 }; // bricht e (eligible, da nach c) — aber d1/d2 liegen VOR e -> 0 qualifizierende Pullbacks

    let state = initMarketStructureState(a, b);
    for (const p of [c, d1, d2, e, f]) state = applyMarketStructurePivot(state, p);

    expect(state.trend).toBe("unknown");
    expect(state.currRange).toEqual({ high: f, low: c });
  });
});
