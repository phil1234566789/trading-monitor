import { describe, it, expect } from "vitest";
import { selectActiveMetadataSections, earliestRelevantTime } from "../src/debugMetadata.js";

// Bug-Report/Feature-Request Philip 2026-07-20: "hast du einen unit test geschrieben, welcher
// testet, dass nur metadaten von aktiven features beinhaltet sein sollen?" — genau das prüfen
// diese Tests, unabhängig von PriceChart.vue/lightweight-charts (siehe src/debugMetadata.js).

const ALL_OFF = { showLiquidity: false, showTradeSetups: false, showTradeSetupCockpit: false, showRanges: false };
const SECTIONS = {
  context: { symbol: "GBPUSD", timeframe: "1h", replay: { active: false } },
  orderBlocks: [{ startTime: 1 }],
  liquidity: [{ price: 1.3 }],
  tradeSetups: [{ dir: 1 }],
  tradeSetupCockpit: { h1Trend: "uptrend" },
  structure: { state: { trend: "uptrend" } },
};

describe("selectActiveMetadataSections", () => {
  it("includes only context + orderBlocks when every feature toggle is off", () => {
    const result = selectActiveMetadataSections(ALL_OFF, SECTIONS);
    expect(result).toEqual({ context: SECTIONS.context, orderBlocks: SECTIONS.orderBlocks });
  });

  it("keeps orderBlocks even when there is no toggle for it (ungated)", () => {
    const result = selectActiveMetadataSections(ALL_OFF, SECTIONS);
    expect(result.orderBlocks).toEqual(SECTIONS.orderBlocks);
  });

  it.each([
    ["showLiquidity", "liquidity"],
    ["showTradeSetups", "tradeSetups"],
    ["showTradeSetupCockpit", "tradeSetupCockpit"],
    ["showRanges", "structure"],
  ])("adds the %s section only when %s is toggled on, and omits it otherwise", (toggleKey, sectionKey) => {
    const on = selectActiveMetadataSections({ ...ALL_OFF, [toggleKey]: true }, SECTIONS);
    expect(on).toHaveProperty(sectionKey, SECTIONS[sectionKey]);

    const off = selectActiveMetadataSections(ALL_OFF, SECTIONS);
    expect(off).not.toHaveProperty(sectionKey);
  });

  it("includes multiple sections at once when multiple toggles are on", () => {
    const result = selectActiveMetadataSections({ ...ALL_OFF, showLiquidity: true, showRanges: true }, SECTIONS);
    expect(result).toHaveProperty("liquidity");
    expect(result).toHaveProperty("structure");
    expect(result).not.toHaveProperty("tradeSetups");
    expect(result).not.toHaveProperty("tradeSetupCockpit");
  });

  it("does not leak a toggled-off feature's data even if it is present in the input sections", () => {
    // Regression-Fall für genau das, was ohne Gate passiert wäre (siehe Chat): Liquidität ist aus,
    // die Rohdaten sind aber trotzdem da (z.B. weil sie kurz vorher noch an war) — die dürfen nicht
    // im Ergebnis auftauchen.
    const result = selectActiveMetadataSections(ALL_OFF, SECTIONS);
    expect(JSON.stringify(result)).not.toContain("1.3"); // liquidity[0].price
  });
});

describe("earliestRelevantTime", () => {
  const TIMES = { orderBlocks: [500], liquidity: [300], tradeSetups: [700, 200], structure: [100] };

  it("returns null when nothing is active and there are no orderBlocks times", () => {
    expect(earliestRelevantTime(ALL_OFF, { orderBlocks: [], liquidity: [300], tradeSetups: [700], structure: [100] })).toBeNull();
  });

  it("counts orderBlocks times even with every toggle off (ungated, like the section itself)", () => {
    expect(earliestRelevantTime(ALL_OFF, TIMES)).toBe(500);
  });

  it("ignores a toggled-off feature's times", () => {
    // Nur Structure an -> nur dessen Zeit (100) + die ungated orderBlocks-Zeit (500) zählen,
    // liquidity (300) und tradeSetups (700/200) NICHT, obwohl sie kleiner wären.
    const result = earliestRelevantTime({ ...ALL_OFF, showRanges: true }, TIMES);
    expect(result).toBe(100);
  });

  it("takes the minimum across all active (incl. ungated orderBlocks) times", () => {
    const result = earliestRelevantTime({ ...ALL_OFF, showLiquidity: true, showTradeSetups: true, showRanges: true }, TIMES);
    expect(result).toBe(100);
  });
});
