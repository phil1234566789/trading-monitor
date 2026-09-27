// M5-Struktur: liegt der Anker (Start der innersten 1h-Ebene bzw. 1h-Outer-Start) vor der ältesten
// geladenen M5-Kerze, lädt der Composable die Lücke einmalig nach (loadOlderM5).
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/forexCandles.js", () => ({ fetchInitialCandles: vi.fn(async () => []) }));

const { fetchInitialCandles } = await import("../src/forexCandles.js");
const { usePriceChartMarketStructure } = await import("../src/composables/usePriceChartMarketStructure.js");

const series = { attachPrimitive() {}, detachPrimitive() {} };
const m5 = (from, n) => Array.from({ length: n }, (_, i) => ({ time: from + i * 300, open: 1, high: 1.001, low: 0.999, close: 1 }));

describe("M5-Struktur lädt fehlende Kerzen bis zum Anker nach", () => {
  it("fragt genau die Lücke zwischen Anker und ältester geladener Kerze an, nur einmal", async () => {
    const ms = usePriceChartMarketStructure();
    ms.create({}, series);
    const anchor = 1_000_000;
    // setzt outerCutoff = anchor (fixer Start), ohne 1h-Kerzen gibt es keinen State -> Fallback greift
    ms.computeRangesPivotsAndMetadata(m5(anchor, 30), { rangesPeriod: 5, rangesLookbackHours: 1, ranges2Period: 2, ranges2LookbackHours: 1, replayUntil: anchor + 90000, rangesFixedStartActive: true, rangesFixedStartTime: anchor });
    const loaded = m5(anchor + 300 * 1000, 50); // beginnt 1000 Kerzen nach dem Anker
    const args = { candles: loaded, m5CandlesClipped: loaded, symbol: "GBPUSD", replayUntil: null, showM5Structure: false, showM5TrendPhases: false, showLiquidityDebug: false, m5Period: 5, m5Period2: 2 };
    ms.refreshM5Structure(args);
    ms.refreshM5Structure(args);
    await Promise.resolve();
    expect(fetchInitialCandles).toHaveBeenCalledTimes(1);
    expect(fetchInitialCandles).toHaveBeenCalledWith("GBPUSD", "5m", 1020, loaded[0].time * 1000);
  });
});
