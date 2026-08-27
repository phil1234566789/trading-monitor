import { describe, it, expect } from "vitest";
import { findNearestLiquidityTargets } from "./findTargets.js";

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
