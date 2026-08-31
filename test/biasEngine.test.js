// isSpreadHourPivot + findIntermediateLevel (Schritt 3, siehe docs/state-machine.md +
// 03-htf-bias.md) — Fixtures für den 25.08.2026-Bug (Asia-High vom Vortag fälschlich als Target)
// UND den 31.08.2026-Fall (gleichgerichteter OB zwischen Preis und Trend-Target).
import { describe, expect, it } from "vitest";
import { isSpreadHourPivot, findIntermediateLevel, determineTrendForce } from "../supabase/functions/trading-monitor-mcp/biasEngine.ts";

function utc(h, m = 0, day = 31) {
  return Date.UTC(2026, 7, day, h, m, 0) / 1000; // August 2026, CEST = UTC+2
}

describe("isSpreadHourPivot", () => {
  it("23:30 Berlin liegt in der Spread Hour", () => {
    expect(isSpreadHourPivot(utc(21, 30))).toBe(true); // 21:30 UTC = 23:30 Berlin
  });
  it("22:59 Berlin liegt noch nicht in der Spread Hour", () => {
    expect(isSpreadHourPivot(utc(20, 59))).toBe(false);
  });
  it("00:00 Berlin (nach Mitternacht) liegt nicht mehr in der Spread Hour", () => {
    expect(isSpreadHourPivot(Date.UTC(2026, 7, 31, 22, 0, 0) / 1000)).toBe(false); // 22:00 UTC = 00:00 Berlin (01.09.)
  });
});

describe("findIntermediateLevel", () => {
  const currentPrice = 1.364;
  const trendTargetPrice = 1.36558; // das (laut Bug-Beispiel utopische) Trend-Target

  it("Bug-Beispiel 25.08.2026: wählt das HEUTIGE Asia-High statt eines stale Vortages-Levels im Pool", () => {
    const result = findIntermediateLevel({
      direction: "long",
      currentPrice,
      trendTargetPrice,
      liquidityLevels: [
        // Stale Vortages-Level, preislich zufällig näher an currentPrice als das echte Asia-High.
        { price: 1.36401, direction: "high", touched: false, timeframe: "5M", id: null, pivotTime: utc(3, 0, 24) },
      ],
      obZones: [],
      asiaRange: { rangeHigh: 1.36403, rangeLow: 1.3588, today: true },
    });
    expect(result).not.toBeNull();
    expect(result.kind).toBe("asia_range");
    expect(result.price).toBe(1.36403);
  });

  it("findet einen gleichgerichteten unberührten OB zwischen Preis und Trend-Target (31.08.2026-Fall)", () => {
    const result = findIntermediateLevel({
      direction: "long",
      currentPrice,
      trendTargetPrice,
      liquidityLevels: [],
      obZones: [{ dir: 1, top: 1.3648, bottom: 1.3644, touched: false, invalidated: false, timeframe: "1H", id: 236, startTime: utc(9, 0, 27) }],
      asiaRange: null,
    });
    expect(result).not.toBeNull();
    expect(result.kind).toBe("ob");
    expect(result.refId).toBe(236);
    expect(result.price).toBe(1.3644); // nähere Kante (bottom) bei Long
  });

  it("ignoriert Level außerhalb des Fensters [currentPrice, trendTarget)", () => {
    const result = findIntermediateLevel({
      direction: "long",
      currentPrice,
      trendTargetPrice,
      liquidityLevels: [{ price: 1.37, direction: "high", touched: false, timeframe: "1H", id: 1, pivotTime: utc(9, 0) }],
      obZones: [],
      asiaRange: null,
    });
    expect(result).toBeNull();
  });

  it("ignoriert einen Spread-Hour-Pivot", () => {
    const result = findIntermediateLevel({
      direction: "long",
      currentPrice,
      trendTargetPrice,
      liquidityLevels: [{ price: 1.3645, direction: "high", touched: false, timeframe: "M5", id: 2, pivotTime: utc(21, 30) }],
      obZones: [],
      asiaRange: null,
    });
    expect(result).toBeNull();
  });

  it("gibt null zurück, wenn nichts im Fenster liegt", () => {
    expect(findIntermediateLevel({ direction: "long", currentPrice, trendTargetPrice, liquidityLevels: [], obZones: [], asiaRange: null })).toBeNull();
  });
});

describe("determineTrendForce", () => {
  it("gehaltener gegenläufiger OB -> Stärke-Signal (high confidence)", () => {
    const result = determineTrendForce("downtrend", { direction: "long", timeframe: "1H", touched: true, invalidated: false }, null, null);
    expect(result.ob.verdict).toBe("held");
    expect(result.ob.confidence).toBe("high");
    expect(result.ob.text).toMatch(/bärische Stärke/);
  });

  it("invalidierter gegenläufiger OB -> Schwäche-Signal", () => {
    const result = determineTrendForce("downtrend", { direction: "long", timeframe: "1H", touched: true, invalidated: true }, null, null);
    expect(result.ob.verdict).toBe("broken");
    expect(result.ob.text).toMatch(/Schwäche/);
  });

  it("gesweeptes gegenläufiges Level, Preis auf Trend-Seite -> Sweep-Stärke (medium confidence)", () => {
    // Downtrend, gegenläufiges Level ist ein 'high' (Widerstand) bei 1.365 — Preis danach unter dem
    // Level (Trend-Seite) -> gilt als gehalten/geswept.
    const result = determineTrendForce("downtrend", null, { direction: "high", price: 1.365, timeframe: "1H", touched: true, kontext: "Asia-High" }, 1.364);
    expect(result.level.verdict).toBe("swept");
    expect(result.level.confidence).toBe("medium");
  });

  it("gesweeptes gegenläufiges Level, Preis auf Gegenseite -> sauberer Durchbruch", () => {
    const result = determineTrendForce("downtrend", null, { direction: "high", price: 1.365, timeframe: "1H", touched: true, kontext: "Asia-High" }, 1.366);
    expect(result.level.verdict).toBe("broken");
  });
});
