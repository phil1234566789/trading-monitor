// Chat 2026-07-30: Fib-Level, siehe marketStructureAnalysis.rules.md ("Fibonacci-Level") für die
// volle Begründung. Range-Fib (currRange.low<->.high) war die erste, FALSCHE Annahme — Philips
// tatsächliche Fib-Ziehweise ist Protected-Fib (protected-low/-high <-> gegenüberliegende
// Range-Kante), ab einem Mindestabstand von RANGE_FIB_MIN_PP_DISTANCE_PIPS.
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot } from "../src/marketStructureAnalysis";
import { computeFibLevels, collectFibLevels, RANGE_FIB_MIN_PP_DISTANCE_PIPS } from "../src/marketStructureRendering";

const PIP_SIZE = 0.0001;

const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
const confirmBreak = { type: "high", price: 1.2, pivotAt: "confirm", pivotTime: 40, touched: false };

function confirmedUptrendState() {
  let state = initMarketStructureState(originLow, originHigh);
  state = applyMarketStructurePivot(state, pullback);
  state = applyMarketStructurePivot(state, confirmBreak);
  expect(state.trend).toBe("uptrend");
  expect(state.structurePivots.find((p) => p.type === "protected-low")?.pivotAt).toBe("pb");
  return state;
}

describe("marketStructureAnalysis: computeFibLevels (Range-Fib & Protected-Fib)", () => {
  it("Range-Fib ist immer der Mittelwert von currRange.low/.high, sobald der Trend bestätigt ist", () => {
    const state = confirmedUptrendState();
    const { rangeFib } = computeFibLevels(state);
    expect(rangeFib.a).toEqual(state.currRange.low);
    expect(rangeFib.b).toEqual(state.currRange.high);
    expect(rangeFib.price).toBeCloseTo((1.0 + 1.2) / 2, 10);
  });

  it("Protected-Fib zieht vom protected-low (nicht currRange.low) bis currRange.high, im Uptrend", () => {
    const state = confirmedUptrendState();
    const { protectedFib } = computeFibLevels(state);
    expect(protectedFib).not.toBeNull();
    expect(protectedFib.a.pivotAt).toBe("pb"); // protected-low, price 1.03 — NICHT originLow (1.0)
    expect(protectedFib.b).toEqual(state.currRange.high);
    expect(protectedFib.price).toBeCloseTo((1.03 + 1.2) / 2, 10);
  });

  it("Downtrend gespiegelt: Protected-Fib zieht von protected-high bis currRange.low", () => {
    // Eigenständige Downtrend-Bestätigung aus 'unknown' heraus (siehe marketStructureAnalysisDowntrend.test.js).
    const originHighD = { type: "high", price: 1.2, pivotAt: "hiD", pivotTime: 0, touched: false };
    const originLowD = { type: "low", price: 1.1, pivotAt: "loD", pivotTime: 10, touched: false };
    const pullbackD = { type: "high", price: 1.15, pivotAt: "pbD", pivotTime: 20, touched: false };
    const confirmBreakD = { type: "low", price: 1.0, pivotAt: "confirmD", pivotTime: 40, touched: false };

    let state = initMarketStructureState(originHighD, originLowD);
    state = applyMarketStructurePivot(state, pullbackD);
    state = applyMarketStructurePivot(state, confirmBreakD);
    expect(state.trend).toBe("downtrend");

    const { rangeFib, protectedFib } = computeFibLevels(state);
    expect(rangeFib.price).toBeCloseTo((state.currRange.low.price + state.currRange.high.price) / 2, 10);
    expect(protectedFib).not.toBeNull();
    expect(protectedFib.a.pivotAt).toBe("pbD"); // protected-high
    expect(protectedFib.b).toEqual(state.currRange.low);
  });

  it("noch unbestätigter Trend (kein protected-low je gesetzt) -> Protected-Fib ist null, Range-Fib trotzdem vorhanden", () => {
    // Ein einzelner Bruch ohne zuvor gesehenen Pullback bestätigt gar nichts (rangeState4,
    // siehe marketStructureAnalysis.test.js) — structurePivots bleibt leer, kann also nie ein
    // protected-low enthalten.
    let state = initMarketStructureState(originLow, originHigh);
    state = applyMarketStructurePivot(state, confirmBreak);
    expect(state.trend).toBe("unknown");
    const { rangeFib, protectedFib } = computeFibLevels(state);
    expect(protectedFib).toBeNull();
    expect(rangeFib.price).toBeCloseTo((state.currRange.low.price + state.currRange.high.price) / 2, 10);
  });

  it("Protected-Fib nur ab RANGE_FIB_MIN_PP_DISTANCE_PIPS Abstand zur gegenüberliegenden Range-Kante", () => {
    // Der Pullback selbst muss beim EINLESEN innerhalb der noch alten (engen) Range liegen (sonst
    // wäre er ein Bruch, kein Pullback) — der spätere BRUCH (breakingPivot) schiebt currRange.high
    // dann beliebig weit über den Pullback hinaus. Genau das ist der reale Fall (Bug-Report-Analog):
    // der Pullback bleibt fix stehen, während currRange.high über mehrere Pips weiterwandert.
    const oLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
    const oHigh = { type: "high", price: 1.001, pivotAt: "hi", pivotTime: 10, touched: false };
    const threshold = RANGE_FIB_MIN_PP_DISTANCE_PIPS * PIP_SIZE;
    const ppPrice = 1.0005; // zwischen oLow und oHigh -> reiner Pullback beim Einlesen

    // +1 Pip statt exakt +threshold — reine Fließkomma-Rundung würde eine Prüfung auf exakte
    // Gleichheit sonst flaky machen (1.0005+0.005 !== 1.0055 in IEEE754); die eigentlich
    // interessante Grenze ("ein Pip mehr/weniger kippt das Ergebnis") wird unten trotzdem geprüft.
    const breakAboveThreshold = { type: "high", price: ppPrice + threshold + PIP_SIZE, pivotAt: "breakAbove", pivotTime: 40, touched: false };
    const pullbackFixture = { type: "low", price: ppPrice, pivotAt: "pp", pivotTime: 20, touched: false };
    let stateAt = initMarketStructureState(oLow, oHigh);
    stateAt = applyMarketStructurePivot(stateAt, pullbackFixture);
    stateAt = applyMarketStructurePivot(stateAt, breakAboveThreshold);
    expect(computeFibLevels(stateAt).protectedFib).not.toBeNull();

    // Ein Pip knapper -> unter der Schwelle, kein Protected-Fib mehr.
    const breakBelowThreshold = { type: "high", price: ppPrice + threshold - PIP_SIZE, pivotAt: "breakBelow", pivotTime: 40, touched: false };
    let stateBelow = initMarketStructureState(oLow, oHigh);
    stateBelow = applyMarketStructurePivot(stateBelow, pullbackFixture);
    stateBelow = applyMarketStructurePivot(stateBelow, breakBelowThreshold);
    expect(computeFibLevels(stateBelow).protectedFib).toBeNull();
  });
});

describe("marketStructureAnalysis: collectFibLevels (Haupt- + Nested-Trend)", () => {
  it("sammelt Range- und Protected-Fib für den Haupttrend, wenn kein Nested-Trend läuft", () => {
    const state = confirmedUptrendState();
    const levels = collectFibLevels(state);
    expect(levels).toHaveLength(2); // rangeFib + protectedFib, kein nestedTrend
  });

  it("sammelt zusätzlich Range- und Protected-Fib des bestätigten Nested-Trends (CHoCH)", () => {
    // Aufbau identisch zu marketStructureAnalysisChoch.test.js: "CHoCH-Bestätigung".
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");

    const levels = collectFibLevels(state);
    expect(levels).toHaveLength(4); // 2x Haupttrend + 2x Nested

    const { protectedFib: nestedProtectedFib } = computeFibLevels(state.nestedTrend);
    expect(nestedProtectedFib.a.pivotAt).toBe("pivotC"); // protected-high des Nested-Trackers
    expect(nestedProtectedFib.b).toEqual(state.nestedTrend.currRange.low);
  });

  it("null-safe: kein State -> leere Liste", () => {
    expect(collectFibLevels(null)).toEqual([]);
    expect(collectFibLevels(undefined)).toEqual([]);
  });
});
