// Bug-Report Philip 2026-07-26: eine M5-FVG (bullische Lücke) um 09:00 wurde nicht als Order-Block
// erkannt. Ursache: detectOrderBlocks wendete für JEDEN Timeframe denselben IRRELEVANT_PCT-
// Schwellenwert (0,05% vom Preis) an — auf GBPUSD/EURUSD (~1.3) sind das ~6-7 Pip, viel zu grob für
// eine M5-Lücke. Im Pine-Original (tv-indikator/src/calculations.pine) hat der Lower-TF-Modus
// (M1/M3/M5, capMode=true) gar KEIN Mindestmaß — Philip wollte explizit "mindestens 1 Pip" statt
// komplett ohne Minimum.
import { describe, expect, it } from "vitest";
import { detectOrderBlocks } from "../src/orderBlocks.js";

// c1 (candles[1]) hat high=close=1.30000 (refPrice), damit sich Gap-% und Gap-in-Pip sauber von
// Hand nachrechnen lassen. candles[0] ist reiner Puffer (Schleife startet erst bei i=3).
function candlesWithBullGap(gapAbs) {
  return [
    { time: 0, open: 1.29990, high: 1.3, low: 1.2998, close: 1.29995 },
    { time: 300, open: 1.29995, high: 1.3, low: 1.2999, close: 1.3 }, // c1
    { time: 600, open: 1.3, high: 1.30005, low: 1.29998, close: 1.30002 }, // c2
    { time: 900, open: 1.30002, high: 1.30008 + gapAbs, low: 1.3 + gapAbs, close: 1.30006 + gapAbs }, // cur
  ];
}

describe("detectOrderBlocks — HTF (kein/unbekannter Timeframe, Prozent-Schwelle unverändert)", () => {
  it("legt keine Zone an, wenn die Lücke unter IRRELEVANT_PCT (0,05%) liegt", () => {
    const gapAbs = 1.3 * (0.02 / 100); // 0,02% ≈ 2,6 Pip — unter der HTF-Schwelle
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1h")).toEqual([]);
  });

  it("legt eine Zone an, wenn die Lücke IRRELEVANT_PCT erreicht", () => {
    const gapAbs = 1.3 * (0.06 / 100); // 0,06% — über der HTF-Schwelle
    const zones = detectOrderBlocks(candlesWithBullGap(gapAbs), "1h");
    expect(zones).toHaveLength(1);
    expect(zones[0].dir).toBe(1);
  });

  it("verhält sich ohne timeframe-Argument identisch zu HTF (Altverhalten)", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs))).toEqual([]);
  });
});

describe("detectOrderBlocks — Lower-TF (1m/3m/5m, Pip-Schwelle statt Prozent)", () => {
  it("legt KEINE Zone an, wenn die Lücke unter 1 Pip liegt", () => {
    const gapAbs = 0.5 * 0.0001; // 0,5 Pip
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "5m")).toEqual([]);
  });

  it("legt eine Zone an, sobald die Lücke (mindestens) 1 Pip erreicht", () => {
    const gapAbs = 1.01 * 0.0001; // knapp über 1 Pip statt exakt an der Grenze (Floating-Point)
    const zones = detectOrderBlocks(candlesWithBullGap(gapAbs), "5m");
    expect(zones).toHaveLength(1);
    expect(zones[0].dir).toBe(1);
  });

  it("Regressionsfall aus dem Bug-Report: 0,02%-Lücke (≈2,6 Pip) wird auf M5 erkannt, auf HTF nicht", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "5m")).toHaveLength(1);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1h")).toHaveLength(0);
  });

  it("gilt gleichermaßen für 1m und 3m (nicht nur 5m)", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1m")).toHaveLength(1);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "3m")).toHaveLength(1);
  });
});
