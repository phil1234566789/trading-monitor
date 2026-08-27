import { describe, it, expect } from "vitest";
import { findNearestLiquidityTargets, findNearestObTargets } from "./findTargets.js";

describe("findNearestLiquidityTargets", () => {
  const currentPrice = 1.365;

  it("picks the nearest untouched levels below price for short", () => {
    const levels = [
      { price: 1.36, touched: false },
      { price: 1.359, touched: false },
      { price: 1.355, touched: false },
      { price: 1.37, touched: false }, // falsche Seite (oberhalb)
    ];
    const result = findNearestLiquidityTargets(levels, { direction: "short", currentPrice });
    expect(result.map((l) => l.price)).toEqual([1.36, 1.359]);
  });

  it("picks the nearest untouched levels above price for long", () => {
    const levels = [
      { price: 1.37, touched: false },
      { price: 1.372, touched: false },
      { price: 1.375, touched: false },
      { price: 1.36, touched: false }, // falsche Seite (unterhalb)
    ];
    const result = findNearestLiquidityTargets(levels, { direction: "long", currentPrice });
    expect(result.map((l) => l.price)).toEqual([1.37, 1.372]);
  });

  it("ignores already touched levels", () => {
    const levels = [
      { price: 1.36, touched: true },
      { price: 1.359, touched: false },
    ];
    const result = findNearestLiquidityTargets(levels, { direction: "short", currentPrice });
    expect(result.map((l) => l.price)).toEqual([1.359]);
  });

  it("respects a custom limit", () => {
    const levels = [
      { price: 1.36, touched: false },
      { price: 1.359, touched: false },
      { price: 1.355, touched: false },
    ];
    const result = findNearestLiquidityTargets(levels, { direction: "short", currentPrice, limit: 1 });
    expect(result.map((l) => l.price)).toEqual([1.36]);
  });

  it("returns an empty list without a current price", () => {
    const levels = [{ price: 1.36, touched: false }];
    expect(findNearestLiquidityTargets(levels, { direction: "short", currentPrice: null })).toEqual([]);
  });

  it("returns an empty list without candidates", () => {
    expect(findNearestLiquidityTargets([], { direction: "short", currentPrice })).toEqual([]);
    expect(findNearestLiquidityTargets(undefined, { direction: "short", currentPrice })).toEqual([]);
  });
});

describe("findNearestObTargets", () => {
  const currentPrice = 1.365;

  it("picks the nearest untouched bullish OBs below price for short, using the top edge", () => {
    const zones = [
      { top: 1.36, bottom: 1.358, dir: 1, touched: false, invalidated: false },
      { top: 1.359, bottom: 1.357, dir: 1, touched: false, invalidated: false },
      { top: 1.355, bottom: 1.353, dir: 1, touched: false, invalidated: false },
      { top: 1.37, bottom: 1.368, dir: 1, touched: false, invalidated: false }, // falsche Seite (oberhalb)
      { top: 1.361, bottom: 1.359, dir: -1, touched: false, invalidated: false }, // falsche Richtung (bärisch)
    ];
    const result = findNearestObTargets(zones, { direction: "short", currentPrice });
    expect(result.map((z) => z.targetPrice)).toEqual([1.36, 1.359]);
  });

  it("picks the nearest untouched bearish OBs above price for long, using the bottom edge", () => {
    const zones = [
      { top: 1.372, bottom: 1.37, dir: -1, touched: false, invalidated: false },
      { top: 1.375, bottom: 1.372, dir: -1, touched: false, invalidated: false },
      { top: 1.364, bottom: 1.36, dir: -1, touched: false, invalidated: false }, // falsche Seite (unterhalb)
      { top: 1.362, bottom: 1.36, dir: 1, touched: false, invalidated: false }, // falsche Richtung (bullisch)
    ];
    const result = findNearestObTargets(zones, { direction: "long", currentPrice });
    expect(result.map((z) => z.targetPrice)).toEqual([1.37, 1.372]);
  });

  it("ignores touched and invalidated zones", () => {
    const zones = [
      { top: 1.36, bottom: 1.358, dir: 1, touched: true, invalidated: false },
      { top: 1.359, bottom: 1.357, dir: 1, touched: false, invalidated: true },
      { top: 1.355, bottom: 1.353, dir: 1, touched: false, invalidated: false },
    ];
    const result = findNearestObTargets(zones, { direction: "short", currentPrice });
    expect(result.map((z) => z.targetPrice)).toEqual([1.355]);
  });

  it("respects a custom limit and returns an empty list without a current price", () => {
    const zones = [
      { top: 1.36, bottom: 1.358, dir: 1, touched: false, invalidated: false },
      { top: 1.359, bottom: 1.357, dir: 1, touched: false, invalidated: false },
    ];
    expect(findNearestObTargets(zones, { direction: "short", currentPrice, limit: 1 }).map((z) => z.targetPrice)).toEqual([1.36]);
    expect(findNearestObTargets(zones, { direction: "short", currentPrice: null })).toEqual([]);
  });
});
