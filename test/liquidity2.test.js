import { describe, it, expect } from "vitest";
import { detectStrongLiquidityLevels, formatStrongLiquidityLabel } from "../src/liquidity2.js";
import gbpusd from "./fixtures/liquidity2/gbpusd-m5-2026-11-18.json";
import xauusd from "./fixtures/liquidity2/xauusd-m5-2026-11-18.json";

// Philips Beispiele vom 21.11.2026 (echte fxcm_candles, M5). Zeiten in Berlin = UTC+1 (CET).
const berlin = (iso) => Date.parse(`${iso}:00+01:00`) / 1000;
const at = (levels, iso) => levels.find((l) => l.pivotTime === berlin(iso));

describe("Liquidität 2.0 — GBPUSD M5 18.11.2026", () => {
  const levels = detectStrongLiquidityLevels(gbpusd, { instrument: "GBPUSD" });

  it("LH 15:45 nach LL 15:30 ist ein starker Short-LS mit BOS 16:35 und Sweep am 19.11. 11:40", () => {
    const ls = at(levels, "2026-11-18T15:45");
    expect(ls).toMatchObject({ dir: 1, price: 1.31693, structurePrice: 1.31565, structureTime: berlin("2026-11-18T15:30") });
    expect(ls.bosTime).toBe(berlin("2026-11-18T16:35"));
    expect(ls.touchedTime).toBe(berlin("2026-11-19T11:40"));
  });

  it("LH 14:10/14:50 und Pivot-Hoch 19:40 sind keine starken LS", () => {
    for (const iso of ["2026-11-18T14:10", "2026-11-18T14:50", "2026-11-18T19:40"]) expect(at(levels, iso)).toBeUndefined();
  });

  it("am 18.11. ist 15:45 der einzige starke LS", () => {
    const day = levels.filter((l) => l.pivotTime < berlin("2026-11-19T00:00"));
    expect(day.map((l) => l.pivotTime)).toEqual([berlin("2026-11-18T15:45")]);
  });

  it("Label zeigt Alter, Impuls in Pips/ATR und gebrochene Swings", () => {
    expect(formatStrongLiquidityLabel(at(levels, "2026-11-18T15:45"), "(1d)")).toBe("LS2 (1d) · 33,9 Pips / 6,9 ATR · 3 Swings");
  });
});

describe("Liquidität 2.0 — XAUUSD M5 18.11.2026", () => {
  const levels = detectStrongLiquidityLevels(xauusd, { instrument: "XAUUSD" });

  it("LH 07:45 nach LL 07:25 (3.775,81) ist stark: BOS 08:00, Sweep 10:35", () => {
    const ls = at(levels, "2026-11-18T07:45");
    expect(ls).toMatchObject({ dir: 1, price: 3783.64, structurePrice: 3775.81 });
    expect(ls.bosTime).toBe(berlin("2026-11-18T08:00"));
    expect(ls.touchedTime).toBe(berlin("2026-11-18T10:35"));
  });

  it("LH 06:30 ist ebenfalls stark: Impuls bricht 07:15 das Range-Tief 06:05 (3.780,09)", () => {
    const ls = at(levels, "2026-11-18T06:30");
    expect(ls).toMatchObject({ price: 3797.8, structurePrice: 3780.09, structureTime: berlin("2026-11-18T06:05") });
    expect(ls.bosTime).toBe(berlin("2026-11-18T07:15"));
  });
});

describe("Liquidität 2.0 — Regeln", () => {
  // Synthetisch: H(10) L(5) H(8) L(3) H(6) — 6 ist LH nach LL 3; danach entscheidet nur das BOS-Timing.
  const bar = 300;
  const build = (path) => path.map((p, i) => ({ time: i * bar, open: p, high: p + 0.1, low: p - 0.1, close: p }));
  const zigzag = (tail) => build([...Array(8).fill(7), 10, ...Array(6).fill(7), 5, ...Array(6).fill(6.5), 8, ...Array(6).fill(5.5), 3, ...Array(6).fill(4.5), 6, ...Array(6).fill(5), ...tail]);

  it("BOS innerhalb des Fensters macht den LS stark, ein späterer BOS nicht", () => {
    const fast = detectStrongLiquidityLevels(zigzag([2, ...Array(6).fill(2.5)]), { instrument: "GBPUSD" });
    expect(fast.some((l) => l.price === 6.1)).toBe(true);
    const slow = detectStrongLiquidityLevels(zigzag([...Array(30).fill(4.5), 2, ...Array(6).fill(2.5)]), { instrument: "GBPUSD" });
    expect(slow.some((l) => l.price === 6.1)).toBe(false);
  });
});
