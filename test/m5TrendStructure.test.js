// M5-Struktur (PLAN-m5-trend.md): derselbe Algo auf echten M5-Kerzen, Referenzfall GBPUSD bis
// Mo 27.07.2026 20:10 Berlin (cTrader-Kerzen, wie das Frontend sie lädt), verankert am
// 1h-Outer-Start 15.07. 20:00 Berlin (structureWindow.cutoffOuter aus get_data_export).
import { describe, expect, it } from "vitest";
import candles from "./fixtures/gbpusd-m5-2026-07-27-m5-trend.json";
import { computeRangesPivots, buildMarketStructureState, deriveTrendReaction } from "../src/marketStructureAnalysis";
import { buildStructureWithPhases } from "../src/trendPhases.js";

const CUTOFF_OUTER = 1784138400; // 15.07.2026 20:00 Berlin
const M5 = 300;

function run(periodOuter, periodInner) {
  const po = computeRangesPivots(candles, periodOuter, CUTOFF_OUTER);
  const pi = computeRangesPivots(candles, periodInner, CUTOFF_OUTER);
  return buildStructureWithPhases(po, pi, periodOuter, periodInner, candles, M5);
}

describe("M5-Struktur-Trend (Referenzfall GBPUSD 27.07.2026)", () => {
  it.each([
    [5, 2],
    [10, 5],
    [20, 10],
  ])("P%i/P%i: M5-Trend am Referenzpunkt ist downtrend", (a, b) => {
    expect(deriveTrendReaction(run(a, b).state).trend).toBe("downtrend");
  });

  it("P5/P2: letzte Reaktion ist ein BOS (22.07. 15:20 Berlin)", () => {
    const { reaction } = deriveTrendReaction(run(5, 2).state);
    expect(reaction.type).toBe("BOS");
    expect(reaction.time).toBe(1784726400);
  });

  it("P10/P5: letzte Reaktion ist ein CHoCH (27.07. 09:10 Berlin)", () => {
    const { reaction } = deriveTrendReaction(run(10, 5).state);
    expect(reaction.type).toBe("CHoCH");
    expect(reaction.time).toBe(1785136200);
  });

  it("onStep ändert das Ergebnis nicht (reines Protokoll)", () => {
    const po = computeRangesPivots(candles, 5, CUTOFF_OUTER);
    const pi = computeRangesPivots(candles, 2, CUTOFF_OUTER);
    const plain = buildMarketStructureState(po, pi, 5, 2, candles, { barSeconds: M5 });
    expect(run(5, 2).state).toEqual(plain);
  });

  it("P5/P2: Trendphasen lückenlos, abwechselnd, bis zur letzten Kerze", () => {
    const { phases } = run(5, 2);
    expect(phases).toHaveLength(27);
    expect(phases.at(-1)).toMatchObject({ trend: "downtrend", to: candles.at(-1).time });
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].from).toBe(phases[i - 1].to);
      expect(phases[i].trend).not.toBe(phases[i - 1].trend);
    }
    expect(phases.every((p) => p.trend !== "unknown" && p.from < p.to)).toBe(true);
  });

  it("barSeconds verschiebt die Verarbeitung: mit dem 1h-Default (3600) liefe dieselbe Serie anders", () => {
    const po = computeRangesPivots(candles, 5, CUTOFF_OUTER);
    const pi = computeRangesPivots(candles, 2, CUTOFF_OUTER);
    const h1Delay = buildMarketStructureState(po, pi, 5, 2, candles);
    expect(h1Delay).not.toEqual(run(5, 2).state);
  });

  it("ohne State: trend unknown, keine Reaktion", () => {
    expect(deriveTrendReaction(null)).toEqual({ trend: "unknown", reaction: null });
  });
});
