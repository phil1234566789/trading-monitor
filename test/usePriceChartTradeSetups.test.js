// computeTradeSetups kam per Refactoring-Task "Sehr große Dateien refactoren" (Phase 6f,
// 2026-08-26) aus PriceChart.vue in usePriceChartTradeSetups.js. Die eigentliche Erkennungs-
// Pipeline (detectLiquidityLevels -> detectSetupObs -> detectTradeSetups) ist bereits ausführlich
// in tradeSetupPipeline.test.js gegen echte Kerzen-Fixtures abgesichert — hier geht es nur um die
// Orchestrierung DRUMHERUM, die bei der Migration neu geschrieben wurde: den leeren-Kerzen-Guard,
// die history-Count-Slicing/setupNumber-Vergabe und die label-Zuordnung je Richtung.
import { describe, expect, it } from "vitest";
import { usePriceChartTradeSetups } from "../src/composables/usePriceChartTradeSetups.js";
import gbpusdM5LongSetup0720 from "./fixtures/gbpusd-m5-2026-07-20-long-setup.json";

// Reine M5-Fixture (kein H1-Sweep-Ursprung nötig, siehe tradeSetupPipeline.test.js) — erzeugt
// zuverlässig mindestens ein Long-Setup, marketStructureState bewusst leer (Path A würde ein
// echtes structurePivots-Fixture brauchen, hier nicht relevant).
const BASE_CTX = {
  marketStructureState: null,
  symbol: "GBPUSD",
  tradeSetupHistoryCount: 1,
};

describe("computeTradeSetups", () => {
  it("sets an empty array when there are no candles, without throwing", () => {
    const { tradeSetupsMetadata, computeTradeSetups } = usePriceChartTradeSetups();
    computeTradeSetups({ ...BASE_CTX, candles: [] });
    expect(tradeSetupsMetadata.value).toEqual([]);
  });

  it("finds the known Long setup from the fixture (obStartTime from tradeSetupPipeline.test.js) and labels it 'Long'", () => {
    const { tradeSetupsMetadata, computeTradeSetups } = usePriceChartTradeSetups();
    computeTradeSetups({ ...BASE_CTX, candles: gbpusdM5LongSetup0720 });
    // BEIDE Richtungen werden immer berechnet (siehe Kommentar in usePriceChartTradeSetups.js) —
    // die Fixture kann also auch Short-Kandidaten enthalten, nur der bekannte Long-Fall wird hier
    // konkret geprüft (obStartTime 1784530800, siehe tradeSetupPipeline.test.js).
    const known = tradeSetupsMetadata.value.find((s) => s.obStartTime === 1784530800);
    expect(known).toBeDefined();
    expect(known.label).toBe("Long");
  });

  it("returns no setups when tradeSetupHistoryCount is 0 (n=0 is a deliberate special case, not 'unlimited')", () => {
    const { tradeSetupsMetadata, computeTradeSetups } = usePriceChartTradeSetups();
    computeTradeSetups({ ...BASE_CTX, candles: gbpusdM5LongSetup0720, tradeSetupHistoryCount: 0 });
    expect(tradeSetupsMetadata.value).toEqual([]);
  });

  it("leaves setupNumber null when only one setup per direction is kept (tradeSetupHistoryCount <= 1)", () => {
    const { tradeSetupsMetadata, computeTradeSetups } = usePriceChartTradeSetups();
    computeTradeSetups({ ...BASE_CTX, candles: gbpusdM5LongSetup0720, tradeSetupHistoryCount: 1 });
    expect(tradeSetupsMetadata.value.every((s) => s.setupNumber === null)).toBe(true);
  });

  it("assigns chronological setupNumber (1..n) per direction once history > 1 is requested", () => {
    const { tradeSetupsMetadata, computeTradeSetups } = usePriceChartTradeSetups();
    computeTradeSetups({ ...BASE_CTX, candles: gbpusdM5LongSetup0720, tradeSetupHistoryCount: 5 });
    const longs = tradeSetupsMetadata.value.filter((s) => s.label === "Long");
    expect(longs.map((s) => s.setupNumber)).toEqual(longs.map((_, i) => i + 1));
  });
});

describe("usePriceChartTradeSetups: getM5Candles/getTrendAnalysisM5Candles", () => {
  it("start out empty for a fresh instance", () => {
    const { getM5Candles, getTrendAnalysisM5Candles } = usePriceChartTradeSetups();
    expect(getM5Candles()).toEqual([]);
    expect(getTrendAnalysisM5Candles()).toEqual([]);
  });
});
