// Reproduziert Philips Schritt-für-Schritt-Beispiel aus trendanalyse_testdriven_modelling.ts 1:1
// (stateSchritt1 -> stateSchritt2 -> stateSchritt3).
import { describe, expect, it } from "vitest";
import { initTrendState, applyPivot, zigzagSegments } from "../src/trendZigzag";
import candles from "./fixtures/gbpusd-m5-trend-2026-07-13.json";

function unixSec(iso) {
  return Math.floor(new Date(iso).getTime() / 1000);
}

const high = {
  type: "high",
  price: 1.35578,
  pivotAt: "15.07.2026 20:20",
  pivotTime: unixSec("2026-07-15T20:20:00+02:00"),
  touched: false,
};
const nextPivot1 = {
  type: "low",
  price: 1.35273,
  pivotAt: "15.07.2026 21:35",
  pivotTime: unixSec("2026-07-15T21:35:00+02:00"),
  touched: false,
};
const nextPivot2 = {
  price: 1.35392,
  pivotAt: "15.07.2026 22:25",
  pivotTime: unixSec("2026-07-15T22:25:00+02:00"),
  type: "high",
  touched: false,
};
const nextPivot3 = {
  price: 1.35269,
  pivotAt: "15.07.2026 23:55",
  pivotTime: unixSec("2026-07-15T23:55:00+02:00"),
  type: "low",
  touched: false,
};

describe("trendZigzag", () => {
  it("stateSchritt1: Ausgangszustand - swing-high/swing-low, confirmation unconfirmed", () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    expect(s1.confirmation).toBe("unconfirmed");
    expect(s1.range).toEqual({ high: { ...high, type: "swing-high" }, low: { ...nextPivot1, type: "swing-low" } });
    expect(s1.structure).toEqual([]);
    expect(s1.appliedPivots).toEqual([high, nextPivot1]);
    expect(s1.trendInvalidatingPivot).toBeNull();
  });

  it("stateSchritt2: Pivot bricht das swing-high nicht -> lower-high in structure[], confirmation bleibt unconfirmed", () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    const s2 = applyPivot(s1, nextPivot2, { candles });
    expect(s2.confirmation).toBe("unconfirmed");
    expect(s2.range).toEqual(s1.range);
    expect(s2.structure).toEqual([{ ...nextPivot2, type: "lower-high" }]);
    expect(s2.appliedPivots).toEqual([high, nextPivot1, nextPivot2]);
  });

  it("stateSchritt3: neuer Lower Low -> range.low aktualisiert sich, confirmation wird confirmed", () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    const s2 = applyPivot(s1, nextPivot2, { candles, fractalPeriod: 10 });
    const s3 = applyPivot(s2, nextPivot3, { candles, fractalPeriod: 10 });
    expect(s3.confirmation).toBe("confirmed");
    expect(s3.range).toEqual({ high: s1.range.high, low: nextPivot3 });
    expect(s3.appliedPivots).toEqual([high, nextPivot1, nextPivot2, nextPivot3]);
  });

  it('stateSchritt3: keine M5-Kerze zwischen nextPivot2 und der Bestätigung von nextPivot3 schließt unter dem alten Low -> nextPivot2 wird "weak-high"', () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    const s2 = applyPivot(s1, nextPivot2, { candles, fractalPeriod: 10 });
    const s3 = applyPivot(s2, nextPivot3, { candles, fractalPeriod: 10 });
    expect(s3.structure).toEqual([
      { ...nextPivot2, type: "weak-high" },
      { ...nextPivot3, type: "lower-low" },
    ]);
  });

  it("ein High über dem swing-high bricht die range NICHT (Reversal ist bewusst noch nicht implementiert)", () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    const higherHigh = { price: 1.4, pivotAt: "x", pivotTime: 0, type: "high", touched: false };
    const s2 = applyPivot(s1, higherHigh, { candles });
    expect(s2.range.high).toEqual(s1.range.high);
    expect(s2.structure).toEqual([]);
  });

  it("zigzagSegments: durch step1-3 ist alles klassifiziert -> nur das rote Struktur-Segment, kein grauer Tail", () => {
    const s1 = initTrendState({ trendOrdnung: 1, direction: "down", high, low: nextPivot1 });
    const s2 = applyPivot(s1, nextPivot2, { candles });
    const s3 = applyPivot(s2, nextPivot3, { candles });
    const [structureSegment, tailSegment] = zigzagSegments(s3);
    expect(structureSegment.points.map((p) => p.price)).toEqual([1.35578, 1.35273, 1.35392, 1.35269]);
    expect(tailSegment.points).toEqual([]);
  });

  it("zigzagSegments: ein noch nicht klassifizierter Pivot landet als grauer Tail (Linie ans letzte rote Pivot angehängt)", () => {
    // Synthetischer State (nicht über applyPivot erzeugt) - reicht, um den Segment-Split isoliert
    // von der Klassifizierungslogik zu testen: 2 Ursprungspivots + 1 structure-Eintrag sind "rot"
    // klassifiziert, das nachfolgend gelesene 4. Pivot ist noch nicht in structure[] gelandet -> grau.
    const untouchedTail = { price: 1.354, pivotAt: "y", pivotTime: 1, type: "high", touched: false };
    const state = {
      direction: "down",
      range: { high, low: nextPivot1 },
      structure: [{ ...nextPivot2, type: "lower-high" }],
      appliedPivots: [high, nextPivot1, nextPivot2, untouchedTail],
    };
    const [structureSegment, tailSegment] = zigzagSegments(state);
    expect(structureSegment.points).toEqual([high, nextPivot1, nextPivot2]);
    expect(tailSegment.points).toEqual([nextPivot2, untouchedTail]); // letztes rotes Pivot wiederholt, damit die Linie nahtlos weiterläuft
  });
});
