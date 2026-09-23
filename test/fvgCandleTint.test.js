import { describe, it, expect } from "vitest";
import { tintFvgCandles, fvgCandleTimes } from "../src/fvgCandleTint.js";

const kerzen = [
  { time: 100, open: 1, high: 2, low: 0.5, close: 1.5 },
  { time: 200, open: 1.5, high: 2.5, low: 1.4, close: 2.4 },
  { time: 300, open: 2.4, high: 2.6, low: 2.3, close: 2.5 },
];
const GELB = "#ffd54f";

describe("tintFvgCandles", () => {
  it("färbt genau die Impuls-Kerze des Setups", () => {
    const out = tintFvgCandles(kerzen, [{ obStartTime: 200 }], "5m", GELB);
    expect(out.map((c) => c.color)).toEqual([undefined, GELB, undefined]);
    expect(out[1].wickColor).toBe(GELB);
  });

  it("lässt die Eingabe unangetastet (keine Mutation der Kerzenliste)", () => {
    tintFvgCandles(kerzen, [{ obStartTime: 200 }], "5m", GELB);
    expect(kerzen[1].color).toBeUndefined();
  });

  it("färbt auf einem anderen Timeframe nichts ein", () => {
    expect(tintFvgCandles(kerzen, [{ obStartTime: 200 }], "1h", GELB)).toBe(kerzen);
  });

  it("kommt ohne Setups und mit unvollständigen Setups klar", () => {
    expect(tintFvgCandles(kerzen, [], "5m", GELB)).toBe(kerzen);
    expect(fvgCandleTimes([{ obStartTime: null }, undefined, { obStartTime: 200 }])).toEqual(new Set([200]));
  });
});
