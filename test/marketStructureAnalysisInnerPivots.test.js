// Reproduziert Philips Schritt-für-Schritt-Beispiel aus
// test/tdd_mit_claude/ranges/gbp_h1_uptrend_LQ_sweep_long_setup.ts 1:1 (rangeState1_1 -> rangeState1_4,
// Zeilen 1-174, Stand 2026-07-19) — verifiziert die eingebettete Periode-2-Erkennung
// (applyInnerMarketStructurePivot: "sweeped-high" vs. echter Bruch über closesAboveOldHigh, und die
// schnellere Uptrend-Bestätigung über tryConfirmUptrend, die jetzt auch ein eingebetteter Pivot
// auslösen kann).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const pivot1 = { type: "low", price: 1.32189, pivotAt: "01.07.2026 15:00", pivotTime: 1782910800, touched: false };
const pivot2 = { type: "high", price: 1.32918, pivotAt: "01.07.2026 16:00", pivotTime: 1782914400, touched: { price: 1.32918, touchedAt: "02.07.2026 04:00" } };
const pivot3 = { type: "low", price: 1.32635, pivotAt: "01.07.2026 23:00", pivotTime: 1782939600, touched: false };
// p2Pivot3 ist bewusst preisgleich mit pivot3 (Periode-2- und Periode-5-Fraktal treffen hier auf
// dieselbe Kerze) — trotzdem ein eigenständiger Lese-Schritt (erst als innerer, dann als
// übergeordneter Pivot), genau wie in der Testdatei.
const p2Pivot3 = { type: "low", price: 1.32635, pivotAt: "01.07.2026 23:00", pivotTime: 1782939600, touched: false };
const p2Pivot4 = { type: "high", price: 1.32947, pivotAt: "02.07.2026 04:00", pivotTime: 1782957600, touched: { price: 1.32947, touchedAt: "02.07.2026 08:00" } };
const p2Pivot5 = { type: "high", price: 1.33627, pivotAt: "02.07.2026 10:00", pivotTime: 1782979200, touched: { price: 1.33627, touchedAt: "02.07.2026 14:00" } };

// Echte H1-Kerzen ab pivot2 (01.07.2026 16:00) bis p2Pivot5 (02.07.2026 10:00), aus
// test/fixtures/gbpusd-h1-trend.json — für closesAboveOldHigh (applyInnerMarketStructurePivot)
// zwingend nötig: kein Close schließt über 1.32918 vor 02.07 08:00 (Close 1.33053) -> genau das
// entscheidet p2Pivot4 = Sweep, p2Pivot5 = echter Bruch.
const h1Candles = [
  { time: 1782914400, open: 1.32652, high: 1.32918, low: 1.32628, close: 1.32775 },
  { time: 1782918000, open: 1.32778, high: 1.32816, low: 1.32665, close: 1.32776 },
  { time: 1782921600, open: 1.3278, high: 1.32916, low: 1.32775, close: 1.32812 },
  { time: 1782925200, open: 1.32814, high: 1.32855, low: 1.32773, close: 1.32776 },
  { time: 1782928800, open: 1.32778, high: 1.32797, low: 1.32715, close: 1.3278 },
  { time: 1782932400, open: 1.32781, high: 1.32822, low: 1.32768, close: 1.32779 },
  { time: 1782936000, open: 1.3278, high: 1.32799, low: 1.32686, close: 1.32752 },
  { time: 1782939600, open: 1.32676, high: 1.32788, low: 1.32635, close: 1.32668 },
  { time: 1782943200, open: 1.32687, high: 1.32795, low: 1.32687, close: 1.32793 },
  { time: 1782946800, open: 1.32795, high: 1.32797, low: 1.32769, close: 1.32784 },
  { time: 1782950400, open: 1.32783, high: 1.32833, low: 1.32744, close: 1.32779 },
  { time: 1782954000, open: 1.32779, high: 1.32907, low: 1.32769, close: 1.32846 },
  { time: 1782957600, open: 1.32847, high: 1.32947, low: 1.32838, close: 1.32856 }, // p2Pivot4-Kerze
  { time: 1782961200, open: 1.32853, high: 1.32871, low: 1.328, close: 1.32864 },
  { time: 1782964800, open: 1.32864, high: 1.32921, low: 1.32852, close: 1.32892 },
  { time: 1782968400, open: 1.32891, high: 1.32926, low: 1.32864, close: 1.32911 },
  { time: 1782972000, open: 1.32911, high: 1.33258, low: 1.32909, close: 1.33053 }, // erster Close > 1.32918
  { time: 1782975600, open: 1.33051, high: 1.33383, low: 1.32979, close: 1.33362 },
  { time: 1782979200, open: 1.33362, high: 1.33627, low: 1.33355, close: 1.33568 }, // p2Pivot5-Kerze
];

describe("marketStructureAnalysis: eingebettete Periode-2-Pivots (sweeped-high)", () => {
  it("rangeState1_1: initMarketStructureState liest pivot1+pivot2, innerStructurePivots leer", () => {
    const s = initMarketStructureState(pivot1, pivot2);
    expect(s.trend).toBe("unknown");
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([]);
  });

  it("rangeState1_2: p2Pivot3 liegt innerhalb der Range -> landet in innerStructurePivots, appliedPivots unverändert", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    const s = applyInnerMarketStructurePivot(s1, p2Pivot3);
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([p2Pivot3]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2]);
  });

  // Abweichung von Philips rangeState2 (structurePivots dort []): pivot3 bricht currRange.low
  // nicht (1.32635 > 1.32189) -> nach der bestehenden, bereits getesteten Periode-5-Regel (Fall 3
  // in applyMarketStructurePivot) landet es in structurePivots, wie bei jedem anderen Pullback
  // auch. Siehe Chat 2026-07-19 — mit Philip abzugleichen, falls das anders gemeint war.
  it("rangeState2: pivot3 (übergeordnet) bricht currRange.low nicht -> Pullback in structurePivots, räumt innerStructurePivots leer", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    const s2 = applyInnerMarketStructurePivot(s1, p2Pivot3);
    const s = applyMarketStructurePivot(s2, pivot3);
    expect(s.currRange).toEqual({ high: pivot2, low: pivot1 });
    expect(s.structurePivots).toEqual([pivot3]);
    expect(s.innerStructurePivots).toEqual([]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });

  it("rangeState2_1: p2Pivot4 bricht currRange.high preislich, aber keine Kerze schließt drüber -> 'sweeped-high' statt echtem Bruch, appliedPivots unverändert", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    const s2 = applyInnerMarketStructurePivot(s1, p2Pivot3);
    const s3 = applyMarketStructurePivot(s2, pivot3);
    const s = applyInnerMarketStructurePivot(s3, p2Pivot4, { candles: h1Candles });
    expect(s.trend).toBe("unknown");
    expect(s.currRange).toEqual({ high: { ...pivot2, type: "sweeped-high" }, low: pivot1 });
    expect(s.innerStructurePivots).toEqual([p2Pivot4]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });

  // p2Pivot5 wird 2h nach seinem pivotTime erkannt (10:00 -> 12:00) — deutlich vor pivot4 (Periode
  // 5, erkannt erst um 19:00) — genau die "schneller erkannt"-Pointe der eingebetteten Periode-2-
  // Erkennung. Die Kerze um 08:00 schließt mit 1.33053 zum ersten Mal über 1.32918 (currRange.high)
  // -> closesAboveOldHigh sagt "echter Bruch", nicht mehr nur Sweep. pivot3 (in structurePivots,
  // nach dem eligible currRange.high pivot2 gelesen) ist der qualifizierende Pullback -> p2Pivot5
  // bestätigt den Uptrend genau wie ein übergeordneter Pivot es täte, wird zu protected-low
  // reklassifiziert.
  it("rangeState1_4: p2Pivot5 bricht currRange.high (echter Close-Bruch) UND bestätigt den Uptrend (dank pivot3 als qualifizierendem Pullback)", () => {
    const s1 = initMarketStructureState(pivot1, pivot2);
    const s2 = applyInnerMarketStructurePivot(s1, p2Pivot3);
    const s3 = applyMarketStructurePivot(s2, pivot3);
    const s4 = applyInnerMarketStructurePivot(s3, p2Pivot4, { candles: h1Candles });
    const s = applyInnerMarketStructurePivot(s4, p2Pivot5, { candles: h1Candles });
    expect(s.trend).toBe("uptrend");
    expect(s.currRange).toEqual({ high: { ...p2Pivot5, type: "high" }, low: pivot1 });
    expect(s.structurePivots).toEqual([{ ...pivot3, type: "protected-low" }]);
    expect(s.innerStructurePivots).toEqual([p2Pivot4, p2Pivot5]);
    expect(s.appliedPivots).toEqual([pivot1, pivot2, pivot3]);
  });
});
