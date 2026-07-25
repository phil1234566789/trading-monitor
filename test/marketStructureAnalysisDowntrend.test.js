// Chat 2026-07-26 (Bug-Report Philip: "kein 1h downtrend erkannt" — live reproduziert mit GBPUSD,
// Fixed-Start 15.07.,18:00): der Haupttrend konnte bis dahin NUR über 'uptrend' laufen, ein
// Downtrend entstand ausschließlich über den Umweg "erst Uptrend bestätigen, dann Nested-CHoCH,
// dann Promotion" (siehe marketStructureAnalysisChoch.test.js). Landete der allererste
// Origin-Pivot zufällig als "High vor Low" (bärische Reihenfolge — z.B. weil ein Fixed-Start-/
// Replay-Fenster mitten in einem laufenden Downtrend beginnt), konnte 'uptrend' nie bestätigen
// (dessen Eligibility verlangt "Low vor High"), advanceNestedTrend sprang nie an, und der Downtrend
// blieb für IMMER unsichtbar, egal wie offensichtlich er im Chart war. Diese Datei testet die neue,
// EIGENSTÄNDIGE Downtrend-Bestätigung direkt aus 'unknown' heraus (ohne vorherigen Uptrend) und
// deren Invalidierung — unabhängig vom Nested-CHoCH-Mechanismus in marketStructureAnalysisChoch.test.js.
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

// Bärischer Origin: High VOR Low (spiegelbildlich zum bullischen Origin Low-vor-High in den
// übrigen Testdateien) — genau die Konstellation, die vorher permanent blockiert war.
const originHigh = { type: "high", price: 1.2, pivotAt: "hi", pivotTime: 0, touched: false };
const originLow = { type: "low", price: 1.1, pivotAt: "lo", pivotTime: 10, touched: false };
const pullback = { type: "high", price: 1.15, pivotAt: "pb", pivotTime: 20, touched: false };
// Bricht originLow und bestätigt den Downtrend (protected-high = pullback).
const confirmBreak = { type: "low", price: 1.05, pivotAt: "confirm", pivotTime: 30, touched: false };

describe("marketStructureAnalysis: eigenständige Downtrend-Erkennung aus 'unknown' (kein vorheriger Uptrend nötig)", () => {
  it("bestätigt direkt 'downtrend', wenn der Origin bärisch geordnet ist (High vor Low) und ein qualifizierender Pullback-High existiert", () => {
    let state = initMarketStructureState(originHigh, originLow);
    expect(state.trend).toBe("unknown");
    state = applyMarketStructurePivot(state, pullback); // Pullback, bricht nichts -> structurePivot
    expect(state.trend).toBe("unknown");
    state = applyMarketStructurePivot(state, confirmBreak); // bricht originLow -> sollte bestätigen
    expect(state.trend).toBe("downtrend");
    expect(state.currRange.low).toEqual({ ...confirmBreak, type: "low" });
    expect(state.structurePivots.find((p) => p.type === "protected-high")).toEqual({ ...pullback, type: "protected-high" });
    // Kein Umweg über einen Nested-Tracker nötig — direkt aus 'unknown' bestätigt.
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([]);
  });

  it("ein Periode-2-Pivot kann den Downtrend genauso direkt bestätigen (schnellere Erkennung, analog zur Uptrend-Bestätigung)", () => {
    let state = initMarketStructureState(originHigh, originLow);
    state = applyInnerMarketStructurePivot(state, pullback, { candles: [] });
    expect(state.trend).toBe("unknown");
    state = applyInnerMarketStructurePivot(state, confirmBreak, { candles: [] });
    expect(state.trend).toBe("downtrend");
    expect(state.currRange.low).toEqual({ ...confirmBreak, type: "low" });
  });

  it("bullischer Origin (Low vor High) bestätigt weiterhin nur 'uptrend', nie 'downtrend' (Regression: bestehendes Verhalten unverändert)", () => {
    const bullOriginLow = { type: "low", price: 1.0, pivotAt: "lo2", pivotTime: 0, touched: false };
    const bullOriginHigh = { type: "high", price: 1.1, pivotAt: "hi2", pivotTime: 10, touched: false };
    const bullPullback = { type: "low", price: 1.03, pivotAt: "pb2", pivotTime: 20, touched: false };
    const bullConfirm = { type: "high", price: 1.2, pivotAt: "confirm2", pivotTime: 30, touched: false };
    let state = initMarketStructureState(bullOriginLow, bullOriginHigh);
    state = applyMarketStructurePivot(state, bullPullback);
    state = applyMarketStructurePivot(state, bullConfirm);
    expect(state.trend).toBe("uptrend");
  });

  it("ein bestätigter Downtrend wird bei einem ECHTEN neuen Hoch invalidiert und als abgeschlossene Range archiviert (closedRanges), OHNE Promotion (kein Nested-CHoCH innerhalb eines Downtrends verdrahtet)", () => {
    let state = initMarketStructureState(originHigh, originLow);
    state = applyMarketStructurePivot(state, pullback);
    state = applyMarketStructurePivot(state, confirmBreak);
    expect(state.trend).toBe("downtrend");

    // Weiterer Pivot muss jetzt über direction="down" laufen (buildMarketStructureState würde das
    // dynamisch anhand von state.trend selbst entscheiden, siehe dort).
    const newHigh = { type: "high", price: 1.25, pivotAt: "newHigh", pivotTime: 40, touched: false };
    const candles = [{ time: 35, open: 1.1, high: 1.26, low: 1.09, close: 1.26 }]; // echter Schluss drüber
    state = applyMarketStructurePivot(state, newHigh, { candles, direction: "down" });

    expect(state.trend).toBe("unknown");
    // low ist der zum Invalidierungszeitpunkt gültige currRange.low (confirmBreak, per Bestätigung
    // weitergerückt), nicht mehr der ursprüngliche originLow.
    expect(state.closedRanges).toEqual([
      { low: { ...confirmBreak, type: "low" }, middle: { ...pullback, type: "protected-high" }, high: originHigh, trend: "downtrend" },
    ]);
    expect(state.nestedTrend).toBeNull();
  });

  it("bricht der neue Höchststand nur preislich (Docht drüber, aber kein Kerzenschluss drüber), bleibt es bei 'sweeped-high' statt Invalidierung", () => {
    let state = initMarketStructureState(originHigh, originLow);
    state = applyMarketStructurePivot(state, pullback);
    state = applyMarketStructurePivot(state, confirmBreak);
    expect(state.trend).toBe("downtrend");

    const wickOnly = { type: "high", price: 1.25, pivotAt: "wick", pivotTime: 40, touched: false };
    const candlesNoClose = [{ time: 35, open: 1.1, high: 1.26, low: 1.09, close: 1.18 }]; // Docht drüber, Schluss drunter
    state = applyMarketStructurePivot(state, wickOnly, { candles: candlesNoClose, direction: "down" });
    expect(state.trend).toBe("downtrend"); // bleibt bestätigt, keine Invalidierung
    expect(state.currRange.high).toEqual({ ...originHigh, type: "sweeped-high" });
  });
});
