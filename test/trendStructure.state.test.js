// buildTrendState gegen den echten GBPUSD-Downtrend (17.07.), abgesichert mit den Werten, die
// Philip per Marktstruktur-Analyse von Hand bestätigt hat:
// - Swing High 1.34805, Swing Low 1.34262 (die Struktur-Grenzen des aktuellen M5-Downtrends)
// - Protected High 1.34466, gebrochen durch das weitere High-Pivot ~1.3454 -> CHoCH
//   (der Downtrend bleibt aber gültig, solange 1.34805 nicht per Kerzenabschluss bricht)
import { describe, expect, it } from "vitest";
import { buildTrendState } from "../src/trendStructure.js";
import m5Candles from "./fixtures/gbpusd-m5-trend-2026-07-13.json";
import h1Candles from "./fixtures/gbpusd-h1-trend.json";

describe("buildTrendState — aktueller GBPUSD M5-Downtrend", () => {
  const state = buildTrendState(m5Candles, h1Candles);

  it("erkennt den aktuellen Trend als Downtrend (CHoCH allein reicht nicht für eine Umkehr)", () => {
    expect(state.direction).toBe("down");
  });

  it("setzt Swing High/Low korrekt", () => {
    expect(state.swingHigh.price).toBe(1.34805);
    expect(state.swingLow.price).toBe(1.34262);
  });

  it("markiert den CHoCH am gebrochenen Protected High (1.34466), ohne die Richtung zu kippen", () => {
    expect(state.choch).not.toBeNull();
    expect(state.choch.price).toBe(1.34466);
    expect(state.direction).toBe("down"); // CHoCH != Trendwende, siehe marktstruktur.md
  });

  it("Protected High läuft nach dem CHoCH als lokales Hoch weiter mit (~1.3454)", () => {
    expect(state.protectedHigh.price).toBeCloseTo(1.3454, 3);
  });

  it("sammelt Pivot-Highs/-Lows seit Trend-Bestätigung", () => {
    expect(state.pivotHighs.length).toBeGreaterThan(0);
    expect(state.pivotLows.length).toBeGreaterThan(0);
  });

  it("verkettet den vorherigen Trend-Abschnitt über previous", () => {
    expect(state.previous).not.toBeNull();
    expect(state.previous.invalidatedAt).toBe(state.confirmedAt);
  });
});
