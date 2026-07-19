// Reproduziert Philips Schritt-für-Schritt-Beispiel aus
// test/tdd_mit_claude/ranges/gbp_h1_uptrend_LQ_sweep_long_setup.ts 1:1 (rangeState1_1 -> rangeState2_1,
// Zeilen 1-134, Stand 2026-07-19) — verifiziert die eingebettete Periode-2-Erkennung
// (applyInnerRangePivot: "sweeped-high").
import { describe, expect, it } from "vitest";
import { initRangeState, applyRangePivot, applyInnerRangePivot } from "../src/rangeAnalysis";

const pivot1 = { type: "low", price: 1.32189, pivotAt: "01.07.2026 15:00", pivotTime: 1782910800, touched: false };
const pivot2 = { type: "high", price: 1.32918, pivotAt: "01.07.2026 16:00", pivotTime: 1782914400, touched: { price: 1.32918, touchedAt: "02.07.2026 04:00" } };
const pivot3 = { type: "low", price: 1.32635, pivotAt: "01.07.2026 23:00", pivotTime: 1782939600, touched: false };
// p2Pivot3 ist bewusst preisgleich mit pivot3 (Periode-2- und Periode-5-Fraktal treffen hier auf
// dieselbe Kerze) — trotzdem ein eigenständiger Lese-Schritt (erst als innerer, dann als
// übergeordneter Pivot), genau wie in der Testdatei.
const p2Pivot3 = { type: "low", price: 1.32635, pivotAt: "01.07.2026 23:00", pivotTime: 1782939600, touched: false };
const p2Pivot4 = { type: "high", price: 1.32947, pivotAt: "02.07.2026 04:00", pivotTime: 1782957600, touched: { price: 1.32947, touchedAt: "02.07.2026 08:00" } };

describe("rangeAnalysis: eingebettete Periode-2-Pivots (sweeped-high)", () => {
  it("rangeState1_1: initRangeState liest pivot1+pivot2, innerStructurePivots leer", () => {
    const s = initRangeState(pivot1, pivot2);
    expect(s.trend).toBe("unknown");
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([]);
  });

  it("rangeState1_2: p2Pivot3 liegt innerhalb der Range -> landet in innerStructurePivots, appliedPivots unverändert", () => {
    const s1 = initRangeState(pivot1, pivot2);
    const s = applyInnerRangePivot(s1, p2Pivot3);
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([p2Pivot3]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2]);
  });

  // Abweichung von Philips rangeState2 (structurePivots dort []): pivot3 bricht currRange.low
  // nicht (1.32635 > 1.32189) -> nach der bestehenden, bereits getesteten Periode-5-Regel (Fall 3
  // in applyRangePivot) landet es in structurePivots, wie bei jedem anderen Pullback auch. Siehe
  // Chat 2026-07-19 — mit Philip abzugleichen, falls das anders gemeint war.
  it("rangeState2: pivot3 (übergeordnet) bricht currRange.low nicht -> Pullback in structurePivots, räumt innerStructurePivots leer", () => {
    const s1 = initRangeState(pivot1, pivot2);
    const s2 = applyInnerRangePivot(s1, p2Pivot3);
    const s = applyRangePivot(s2, pivot3);
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.structurePivots).toEqual([pivot3]);
    expect(s.innerStructurePivots).toEqual([]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });

  it("rangeState2_1: p2Pivot4 bricht currRange.high preislich -> 'sweeped-high' statt echtem Bruch, appliedPivots unverändert", () => {
    const s1 = initRangeState(pivot1, pivot2);
    const s2 = applyInnerRangePivot(s1, p2Pivot3);
    const s3 = applyRangePivot(s2, pivot3);
    const s = applyInnerRangePivot(s3, p2Pivot4);
    expect(s.trend).toBe("unknown");
    expect(s.currRange).toEqual({ high: { ...pivot2, type: "sweeped-high" }, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([p2Pivot4]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });
});
