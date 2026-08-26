import { describe, it, expect } from "vitest";
import { selectActiveMetadataSections, earliestRelevantTime, buildActiveMetadataSnapshot, hasActiveMetadata } from "../src/debugMetadata.js";

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

// buildActiveMetadataSnapshot/hasActiveMetadata kamen per Refactoring-Task "Sehr große Dateien
// refactoren" (Phase 6e, 2026-08-26) aus PriceChart.vue hierher — Tests für die Orchestrierung
// oben um die reine Zusammenstellungs-Logik ergänzt (Gating selbst bereits oben getestet).
const BASE_CTX = {
  ...ALL_OFF,
  context: { symbol: "GBPUSD", timeframe: "1h", replay: { active: false } },
  poiZonesMetadata: [],
  liquidityMetadata: [],
  liquidityEarliestTime: null,
  tradeSetupsMetadata: [],
  structureEarliestTime: null,
  cockpitMetadata: null,
  marketStructureTree: null,
  rangesFixedStartActive: false,
  rangesFixedStartTime: null,
  rangesPeriod: 5,
  rangesLookbackHours: 24,
  rangesMetadata: [],
  ranges2Period: 2,
  ranges2LookbackHours: 24,
  rangesMetadata2: [],
  candles: [],
  timeframe: "1h",
  lastDataExport: null,
};

describe("buildActiveMetadataSnapshot", () => {
  it("returns only context + empty orderBlocks when nothing is active and no candles are relevant", () => {
    const result = buildActiveMetadataSnapshot(BASE_CTX);
    expect(result).toEqual({ context: BASE_CTX.context, orderBlocks: [] });
  });

  it("adds a candles section, filtered from the earliest relevant time, when an (ungated) orderBlock has a startTime", () => {
    const result = buildActiveMetadataSnapshot({
      ...BASE_CTX,
      poiZonesMetadata: [{ startTime: 200 }],
      candles: [
        { time: 100, close: 1.1 },
        { time: 200, close: 1.2 },
        { time: 300, close: 1.3 },
      ],
    });
    expect(result.candles.since).toBe(200);
    expect(result.candles.data.map((c) => c.time)).toEqual([200, 300]);
  });

  it("adds dataExport when lastDataExport is set, regardless of toggles", () => {
    const result = buildActiveMetadataSnapshot({ ...BASE_CTX, lastDataExport: { instrument: "GBPUSD" } });
    expect(result.dataExport).toEqual({ instrument: "GBPUSD" });
  });

  it("omits dataExport when lastDataExport is null", () => {
    const result = buildActiveMetadataSnapshot(BASE_CTX);
    expect(result).not.toHaveProperty("dataExport");
  });

  it("includes structure.window as fixed only when rangesFixedStartActive AND a start time are both set", () => {
    const result = buildActiveMetadataSnapshot({
      ...BASE_CTX,
      showRanges: true,
      rangesFixedStartActive: true,
      rangesFixedStartTime: 500,
    });
    expect(result.structure.window.mode).toBe("fixed");
    expect(result.structure.window.since).toBe(500);
  });

  it("falls back to lookback window when rangesFixedStartActive is false even with a start time set", () => {
    const result = buildActiveMetadataSnapshot({
      ...BASE_CTX,
      showRanges: true,
      rangesFixedStartActive: false,
      rangesFixedStartTime: 500,
    });
    expect(result.structure.window).toEqual({ mode: "lookback" });
  });
});

describe("hasActiveMetadata", () => {
  const EMPTY_SNAPSHOT = { context: {}, orderBlocks: [] };

  it("is false when nothing is toggled and there are no orderBlocks/dataExport", () => {
    expect(hasActiveMetadata(EMPTY_SNAPSHOT, ALL_OFF)).toBe(false);
  });

  it("is true when orderBlocks are present, even with every toggle off (ungated)", () => {
    expect(hasActiveMetadata({ ...EMPTY_SNAPSHOT, orderBlocks: [{ startTime: 1 }] }, ALL_OFF)).toBe(true);
  });

  it("is true when a dataExport is present, even with every toggle off", () => {
    expect(hasActiveMetadata({ ...EMPTY_SNAPSHOT, dataExport: { instrument: "GBPUSD" } }, ALL_OFF)).toBe(true);
  });

  it.each(["showLiquidity", "showTradeSetups", "showTradeSetupCockpit", "showRanges"])(
    "is true when %s is toggled on, even with an empty snapshot",
    (toggleKey) => {
      expect(hasActiveMetadata(EMPTY_SNAPSHOT, { ...ALL_OFF, [toggleKey]: true })).toBe(true);
    },
  );
});
