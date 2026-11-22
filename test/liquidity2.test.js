import { describe, it, expect } from "vitest";
import { detectStrongLiquidityLevels, formatStrongLiquidityLabel, LIQUIDITY2_MIN_IMPULSE_ATR, LIQUIDITY2_MIN_BROKEN_SWINGS } from "../src/liquidity2.js";
import gbpusd from "./fixtures/liquidity2/gbpusd-m5-2026-11-18.json";
import xauusd from "./fixtures/liquidity2/xauusd-m5-2026-11-18.json";

// Philips Beispiele vom 21.11.2026 (echte fxcm_candles, M5, mit Vorlauf für die H1-ATR). Zeiten in Berlin = UTC+1 (CET).
// Pflicht unter LQ 2.1: DR #145 LH 15:45 drin, 19:40 draußen; Gold 07:45 und 06:30 drin.
const berlin = (iso) => Date.parse(`${iso}:00+01:00`) / 1000;
const at = (levels, iso) => levels.find((l) => l.pivotTime === berlin(iso));

describe("Liquidität 2.1 — GBPUSD M5 18.11.2026", () => {
  const levels = detectStrongLiquidityLevels(gbpusd, { instrument: "GBPUSD" });

  it("LH 15:45 nach LL 15:30 ist ein starker Short-LS mit BOS 16:35 und Sweep am 19.11. 11:40", () => {
    const ls = at(levels, "2026-11-18T15:45");
    expect(ls).toMatchObject({ dir: 1, price: 1.31693, structurePrice: 1.31565, structureTime: berlin("2026-11-18T15:30") });
    expect(ls.bosTime).toBe(berlin("2026-11-18T16:35"));
    expect(ls.touchedTime).toBe(berlin("2026-11-19T11:40"));
  });

  it("Pivot-Hoch 19:40 und LH 14:50 (Tief davor ist ein HL) sind keine starken LS", () => {
    for (const iso of ["2026-11-18T14:50", "2026-11-18T19:40"]) expect(at(levels, iso)).toBeUndefined();
  });

  it("jeder starke LS erfüllt Impuls ≥ 0,85 H1-ATR und ≥ 1 gebrochenen Swing", () => {
    expect(levels.length).toBeGreaterThan(0);
    for (const l of levels) {
      expect(l.impulseAtr).toBeGreaterThanOrEqual(LIQUIDITY2_MIN_IMPULSE_ATR);
      expect(l.brokenSwings).toBeGreaterThanOrEqual(LIQUIDITY2_MIN_BROKEN_SWINGS);
    }
  });

  it("Label zeigt Alter, Impuls in Pips/H1-ATR, gebrochene Swings und die Sweep-Session", () => {
    expect(formatStrongLiquidityLabel(at(levels, "2026-11-18T15:45"), "(1d)", "NY")).toBe("LS2 (1d) · 33,9 Pips / 2,5 ATR · 3 Swings · Sweep NY");
  });
});

describe("Liquidität 2.1 — XAUUSD M5 18.11.2026", () => {
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
