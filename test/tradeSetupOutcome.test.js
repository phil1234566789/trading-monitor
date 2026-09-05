// Winrate-Backtest-Kernlogik (siehe supabase/functions/_shared/tradeSetupOutcome.ts) — Win-Definition
// Philip 2026-09-05: 2,5 RR, SL max. 6 Pips, auch wenn die strukturelle Invalidierung weiter weg liegt.
import { describe, expect, it } from "vitest";
import {
  deriveEntryInvalidation,
  computeSlTp,
  classifyOutcome,
  computeSweepAgeHours,
  classifyInducementAge,
  PIP_SIZE,
} from "../supabase/functions/_shared/tradeSetupOutcome.ts";

describe("deriveEntryInvalidation", () => {
  it("Short: Entry = OB-Unterkante, Invalidation = OB-Oberkante", () => {
    expect(deriveEntryInvalidation("short", 1.271, 1.269)).toEqual({ entry: 1.269, invalidation: 1.271 });
  });

  it("Long: Entry = OB-Oberkante, Invalidation = OB-Unterkante", () => {
    expect(deriveEntryInvalidation("long", 1.271, 1.269)).toEqual({ entry: 1.271, invalidation: 1.269 });
  });
});

describe("computeSlTp", () => {
  it("nutzt die strukturelle Distanz, wenn sie unter 6 Pips liegt", () => {
    const entry = 1.271;
    const invalidation = entry - 4 * PIP_SIZE; // 4 Pips entfernt, Short
    const { slPips, slPrice, tpPrice } = computeSlTp("short", entry, invalidation);
    expect(slPips).toBeCloseTo(4, 8);
    expect(slPrice).toBeCloseTo(entry + 4 * PIP_SIZE, 8);
    expect(tpPrice).toBeCloseTo(entry - 2.5 * 4 * PIP_SIZE, 8);
  });

  it("kappt bei 6 Pips, auch wenn die Invalidierung weiter weg liegt", () => {
    const entry = 1.271;
    const invalidation = entry - 15 * PIP_SIZE; // 15 Pips entfernt, weit hinter dem Cap
    const { slPips, slPrice, tpPrice } = computeSlTp("short", entry, invalidation);
    expect(slPips).toBe(6);
    expect(slPrice).toBeCloseTo(entry + 6 * PIP_SIZE, 8);
    expect(tpPrice).toBeCloseTo(entry - 2.5 * 6 * PIP_SIZE, 8);
  });

  it("Long spiegelbildlich: SL oberhalb, TP unterhalb der Invalidierung liegt falsch herum -> SL unter Entry, TP darüber", () => {
    const entry = 1.271;
    const invalidation = entry + 15 * PIP_SIZE;
    const { slPips, slPrice, tpPrice } = computeSlTp("long", entry, invalidation);
    expect(slPips).toBe(6);
    expect(slPrice).toBeCloseTo(entry - 6 * PIP_SIZE, 8);
    expect(tpPrice).toBeCloseTo(entry + 2.5 * 6 * PIP_SIZE, 8);
  });
});

describe("classifyOutcome", () => {
  const entryTimeSec = 1000;
  // Short: SL oberhalb Entry, TP unterhalb Entry.
  const slPrice = 1.275;
  const tpPrice = 1.265;

  it("TP zuerst berührt -> win", () => {
    const candles = [
      { time: 1000, high: 1.272, low: 1.270 },
      { time: 1300, high: 1.271, low: 1.264 }, // low <= tpPrice
    ];
    expect(classifyOutcome(candles, "short", entryTimeSec, slPrice, tpPrice)).toEqual({ outcome: "win", resolvedAt: 1300 });
  });

  it("SL zuerst berührt -> loss", () => {
    const candles = [
      { time: 1000, high: 1.272, low: 1.270 },
      { time: 1300, high: 1.276, low: 1.271 }, // high >= slPrice
    ];
    expect(classifyOutcome(candles, "short", entryTimeSec, slPrice, tpPrice)).toEqual({ outcome: "loss", resolvedAt: 1300 });
  });

  it("beide im selben Candle berührt -> konservativ loss", () => {
    const candles = [{ time: 1300, high: 1.276, low: 1.264 }];
    expect(classifyOutcome(candles, "short", entryTimeSec, slPrice, tpPrice)).toEqual({ outcome: "loss", resolvedAt: 1300 });
  });

  it("weder TP noch SL berührt -> pending", () => {
    const candles = [{ time: 1300, high: 1.272, low: 1.270 }];
    expect(classifyOutcome(candles, "short", entryTimeSec, slPrice, tpPrice)).toEqual({ outcome: "pending", resolvedAt: null });
  });

  it("Kerzen vor entryTimeSec werden ignoriert", () => {
    const candles = [
      { time: 500, high: 1.276, low: 1.264 }, // vor Entry, zaehlt nicht
      { time: 1300, high: 1.272, low: 1.270 },
    ];
    expect(classifyOutcome(candles, "short", entryTimeSec, slPrice, tpPrice)).toEqual({ outcome: "pending", resolvedAt: null });
  });
});

describe("computeSweepAgeHours", () => {
  it("berechnet die Stunden zwischen Level-Entstehung (ls_pivot_time) und Sweep (ls_touched_time)", () => {
    const lsPivotTimeSec = 1000;
    const lsTouchedTimeSec = lsPivotTimeSec + 6 * 3600;
    expect(computeSweepAgeHours(lsTouchedTimeSec, lsPivotTimeSec)).toBe(6);
  });
});

describe("classifyInducementAge", () => {
  it("unter 24h -> minor", () => {
    expect(classifyInducementAge(0)).toBe("minor");
    expect(classifyInducementAge(23.9)).toBe("minor");
  });

  it("24h bis unter 120h -> medium", () => {
    expect(classifyInducementAge(24)).toBe("medium");
    expect(classifyInducementAge(119.9)).toBe("medium");
  });

  it("ab 120h (5 Tage) -> major", () => {
    expect(classifyInducementAge(120)).toBe("major");
    expect(classifyInducementAge(2660)).toBe("major");
  });
});
