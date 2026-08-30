import { describe, it, expect } from "vitest";
import { resolveStructureStartTime } from "../supabase/functions/_shared/resolveStructureStartTime.ts";

// resolveStructureStartTime löst einen 1D-Periode-4-Pivot (daily-structure-pivots/index.ts) auf
// die tatsächliche 1H-Kerze auf, deren High/Low den Pivot-Preis gebildet hat — siehe Task
// "Market-Structure-Startpunkt: 1D-Periode-4-Pivots".

const DAY_START = 1_800_000_000; // beliebiger, auf volle Stunden ausgerichteter Tagesanfang

function h1Candle(hourOffset, { high, low }) {
  return { time: DAY_START + hourOffset * 3600, open: 0, high: high ?? 0, low: low ?? 0, close: 0, volume: 0 };
}

describe("resolveStructureStartTime", () => {
  it("wählt bei mehreren Treffern am selben Tag die zeitlich älteste Kerze (Tie-Break)", () => {
    const pivot = { direction: "high", price: 1.35, pivotTime: DAY_START };
    const h1Candles = [h1Candle(10, { high: 1.35 }), h1Candle(2, { high: 1.35 }), h1Candle(18, { high: 1.35 })];
    expect(resolveStructureStartTime(pivot, h1Candles)).toBe(DAY_START + 2 * 3600);
  });

  it("matcht innerhalb der Epsilon-Toleranz gegen Float-Rundung, nicht nur exakt", () => {
    const pivot = { direction: "low", price: 1.35, pivotTime: DAY_START };
    const h1Candles = [h1Candle(5, { low: 1.35 + 0.000003 })]; // < 0.05 * 0.0001
    expect(resolveStructureStartTime(pivot, h1Candles)).toBe(DAY_START + 5 * 3600);
  });

  it("liefert null, wenn keine Kerze im Tagesfenster preislich matcht", () => {
    const pivot = { direction: "high", price: 1.35, pivotTime: DAY_START };
    const h1Candles = [
      h1Candle(5, { high: 1.35 + 0.00001 }), // außerhalb der Epsilon-Toleranz
      h1Candle(20, { high: 1.3 }),
    ];
    expect(resolveStructureStartTime(pivot, h1Candles)).toBeNull();
  });

  it("ignoriert Kerzen außerhalb der 1D-Tagesgrenze [pivotTime, pivotTime+86400)", () => {
    const pivot = { direction: "high", price: 1.35, pivotTime: DAY_START };
    const h1Candles = [
      { time: DAY_START - 3600, open: 0, high: 1.35, low: 0, close: 0, volume: 0 }, // vor Tagesbeginn
      { time: DAY_START + 86400, open: 0, high: 1.35, low: 0, close: 0, volume: 0 }, // exakt Tagesende (exklusiv)
    ];
    expect(resolveStructureStartTime(pivot, h1Candles)).toBeNull();
  });

  it("liefert null, wenn gar keine 1H-Historie für den Tag vorliegt", () => {
    const pivot = { direction: "low", price: 1.35, pivotTime: DAY_START };
    expect(resolveStructureStartTime(pivot, [])).toBeNull();
  });
});
