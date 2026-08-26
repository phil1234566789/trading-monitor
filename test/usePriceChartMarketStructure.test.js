// computeRangesPivotsAndMetadata kam per Refactoring-Task "Sehr große Dateien refactoren" (Phase
// 6g, 2026-08-26) aus PriceChart.vue (computeRangesPivotsFor/refreshRangesInternal) in
// usePriceChartMarketStructure.js. Die eigentliche Fraktal-/Trendalgorithmus-Logik (computeRangesPivots/
// buildMarketStructureState) ist bereits an anderer Stelle getestet (tradeSetupPipeline.test.js,
// marketStructureAnalysis-Tests) — hier geht es nur um die Orchestrierung DRUMHERUM, die bei der
// Migration neu geschrieben wurde: leerer-Kerzen-Guard, die rangesMetadata-Spiegelung fürs
// Debug-Panel und die earliestTime-Berechnung fürs Debug-Metadaten-Panel.
import { describe, expect, it } from "vitest";
import { usePriceChartMarketStructure } from "../src/composables/usePriceChartMarketStructure.js";
import gbpusdH1LongSetup from "./fixtures/gbpusd-h1-2026-07-08-long-setup.json";

// now = letzte Kerze der Fixture + eine H1-Bar Puffer, lookbackHours großzügig genug, um die
// GESAMTE ~33 Tage lange Fixture abzudecken (deterministisch statt von echtem Date.now() abhängig).
const NOW = gbpusdH1LongSetup[gbpusdH1LongSetup.length - 1].time + 3600;
const BASE_CTX = {
  rangesPeriod: 5,
  rangesLookbackHours: 800,
  ranges2Period: 2,
  ranges2LookbackHours: 800,
  replayUntil: NOW,
  rangesFixedStartActive: false,
  rangesFixedStartTime: null,
};

describe("computeRangesPivotsAndMetadata", () => {
  it("sets both rangesMetadata refs to null and returns earliestTime:null when there are no candles", () => {
    const { rangesMetadata, rangesMetadata2, computeRangesPivotsAndMetadata } = usePriceChartMarketStructure();
    const result = computeRangesPivotsAndMetadata([], BASE_CTX);
    expect(rangesMetadata.value).toBeNull();
    expect(rangesMetadata2.value).toBeNull();
    expect(result).toEqual({ earliestTime: null });
  });

  it("fills rangesMetadata/rangesMetadata2 from a real H1 fixture and returns the earliest pivot time across both periods", () => {
    const { rangesMetadata, rangesMetadata2, computeRangesPivotsAndMetadata } = usePriceChartMarketStructure();
    const result = computeRangesPivotsAndMetadata(gbpusdH1LongSetup, BASE_CTX);
    expect(rangesMetadata.value).not.toBeNull();
    expect(rangesMetadata.value.length).toBeGreaterThan(0);
    expect(rangesMetadata2.value).not.toBeNull();
    expect(rangesMetadata2.value.length).toBeGreaterThan(0);
    // earliestTime muss der kleinste rohe pivotTime über BEIDE Perioden sein, nicht nur Periode 5.
    expect(typeof result.earliestTime).toBe("number");
    expect(result.earliestTime).toBeGreaterThanOrEqual(gbpusdH1LongSetup[0].time);
    expect(result.earliestTime).toBeLessThanOrEqual(NOW);
  });

  it("respects rangesFixedStartActive over the rolling lookback (fixed start further back finds an earlier/equal pivot set)", () => {
    const { computeRangesPivotsAndMetadata: computeA } = usePriceChartMarketStructure();
    const rollingResult = computeA(gbpusdH1LongSetup, { ...BASE_CTX, rangesLookbackHours: 24, ranges2LookbackHours: 24 });

    const { computeRangesPivotsAndMetadata: computeB } = usePriceChartMarketStructure();
    const fixedResult = computeB(gbpusdH1LongSetup, {
      ...BASE_CTX,
      rangesFixedStartActive: true,
      rangesFixedStartTime: gbpusdH1LongSetup[0].time,
    });

    // Ein 24h-Rolling-Fenster ab NOW findet höchstens die Pivots der letzten 24h der Fixture, ein
    // fixer Start am allerersten Kerzen-Zeitpunkt deckt die komplette Fixture ab -> der fixe Fall
    // muss einen mindestens genauso frühen (typischerweise deutlich früheren) earliestTime liefern.
    expect(fixedResult.earliestTime).not.toBeNull();
    if (rollingResult.earliestTime != null) {
      expect(fixedResult.earliestTime).toBeLessThanOrEqual(rollingResult.earliestTime);
    }
  });
});

describe("usePriceChartMarketStructure: getRangesH1Candles/getCurrentFibLevels", () => {
  it("start out empty for a fresh instance", () => {
    const { getRangesH1Candles, getCurrentFibLevels } = usePriceChartMarketStructure();
    expect(getRangesH1Candles()).toEqual([]);
    expect(getCurrentFibLevels()).toEqual([]);
  });
});
