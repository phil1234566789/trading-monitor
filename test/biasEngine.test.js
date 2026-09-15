// isSpreadHourPivot + findIntermediateLevel (Schritt 3, siehe docs/state-machine.md +
// 03-htf-bias.md) — Fixtures für den 25.08.2026-Bug (Asia-High vom Vortag fälschlich als Target)
// UND den 31.08.2026-Fall (gleichgerichteter OB zwischen Preis und Trend-Target).
import { describe, expect, it } from "vitest";
import { isSpreadHourPivot, findIntermediateLevel, buildPendingDecisions } from "../supabase/functions/trading-monitor-mcp/biasEngine.ts";

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

describe("buildPendingDecisions", () => {
  const noForce = { signals: [], bullish: [], bearish: [], majorInducementSides: [], verdict: null };

  it("3.1 ist immer offen (4 Fall-Optionen), auch ohne Trend-Kraft-Hinweis", () => {
    const result = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false });
    const step31 = result.find((d) => d.substep === "3.1");
    expect(step31.options).toHaveLength(4);
    expect(step31.resolved).toBeUndefined();
  });

  it("beide Targets gefunden -> 3.2 resolved 'Standard'", () => {
    const result = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false });
    const step32 = result.find((d) => d.substep === "3.2");
    expect(step32.resolved).toMatch(/^Standard/);
    expect(step32.options).toBeUndefined();
  });

  it("kein Countertrend-OB -> 3.2 resolved 'kein Countertrend-Target'", () => {
    const result = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: false, intermediateLevelFound: false });
    expect(result.find((d) => d.substep === "3.2").resolved).toMatch(/^kein Countertrend-Target/);
  });

  it("kein Trend-Target -> 3.2 resolved 'kein Trend-Target aktuell'", () => {
    const result = buildPendingDecisions({ force: noForce, trendTargetFound: false, countertrendTargetFound: true, intermediateLevelFound: false });
    expect(result.find((d) => d.substep === "3.2").resolved).toMatch(/^kein Trend-Target aktuell/);
  });

  it("Zwischen-Level gefunden -> zusätzlicher Substep 3.2b", () => {
    const withLevel = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: true });
    const withoutLevel = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false });
    expect(withLevel.some((d) => d.substep === "3.2b")).toBe(true);
    expect(withoutLevel.some((d) => d.substep === "3.2b")).toBe(false);
  });

  it("3.3 (S/R-Zone) ist immer eine offene ja/nein-Wahl", () => {
    const result = buildPendingDecisions({ force: noForce, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false });
    const step33 = result.find((d) => d.substep === "3.3");
    expect(step33.options).toHaveLength(2);
  });

  // "Kein Trade bei ausgeglichenem Kampf" (allgemeines.md) ist nur beurteilbar, wenn beide Seiten
  // sichtbar sind — vorher lieferte 3.1 ein einzelnes Kraft-Verdikt ohne Gegenseite.
  it("3.1 weist beide Seiten getrennt aus", () => {
    const force = {
      signals: [],
      bullish: [{ text: "bullischer 1H-OB angetestet und hat gehalten ---> bullische Stärke." }],
      bearish: [{ text: "Major Inducement 1.35652 angelaufen ---> Kraft nach unten." }],
      majorInducementSides: [],
      verdict: null,
    };
    const prompt = buildPendingDecisions({ force, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false }).find((d) => d.substep === "3.1").prompt;
    expect(prompt).toContain("FÜR die Bullen:");
    expect(prompt).toContain("FÜR die Bären:");
  });

  it("3.1 meldet die Major-Inducement-Vorrangregel, wenn einer im Spiel ist", () => {
    const force = { signals: [], bullish: [], bearish: [{ text: "x" }], majorInducementSides: ["bearish"], verdict: null };
    const prompt = buildPendingDecisions({ force, trendTargetFound: true, countertrendTargetFound: true, intermediateLevelFound: false }).find((d) => d.substep === "3.1").prompt;
    expect(prompt).toContain("Major Inducement (bärisch) im Spiel");
    expect(prompt).toContain("Vorrangregel");
  });
});
