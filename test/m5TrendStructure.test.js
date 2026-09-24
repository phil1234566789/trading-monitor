// M5-Struktur (PLAN-m5-trend.md): derselbe Algo auf echten M5-Kerzen, Referenzfall GBPUSD bis
// Mo 27.07.2026 20:10 Berlin (cTrader-Kerzen, wie das Frontend sie lädt), verankert am
// 1h-Outer-Start 15.07. 20:00 Berlin (structureWindow.cutoffOuter aus get_data_export).
import { describe, expect, it } from "vitest";
import candles from "./fixtures/gbpusd-m5-2026-07-27-m5-trend.json";
import candles0909 from "./fixtures/gbpusd-m5-2026-09-09-choch.json";
import candles0909Day from "./fixtures/gbpusd-m5-2026-09-09-full-day.json"; // bis 18:00 Berlin, früherer Start (2600 Kerzen)
import { computeRangesPivots, buildMarketStructureState, deriveTrendReaction, collectNestedChain } from "../src/marketStructureAnalysis";
import { buildStructureWithPhases } from "../src/trendPhases.js";
import { firstTouchAfter } from "../src/marketStructureRendering";

const CUTOFF_OUTER = 1784138400; // 15.07.2026 20:00 Berlin
const M5 = 300;

function run(periodOuter, periodInner, cs = candles, cutoff = CUTOFF_OUTER) {
  const po = computeRangesPivots(cs, periodOuter, cutoff);
  const pi = computeRangesPivots(cs, periodInner, cutoff);
  return buildStructureWithPhases(po, pi, periodOuter, periodInner, cs, M5);
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

  it("P10/P5: letzte Reaktion ist ein BOS (22.07. 15:20 Berlin)", () => {
    const { reaction } = deriveTrendReaction(run(10, 5).state);
    expect(reaction.type).toBe("BOS");
    expect(reaction.time).toBe(1784726400);
  });

  it("onStep ändert das Ergebnis nicht (reines Protokoll)", () => {
    const po = computeRangesPivots(candles, 5, CUTOFF_OUTER);
    const pi = computeRangesPivots(candles, 2, CUTOFF_OUTER);
    const plain = buildMarketStructureState(po, pi, 5, 2, candles, { barSeconds: M5 });
    expect(run(5, 2).state).toEqual(plain);
  });

  it("P5/P2: Trendphasen lückenlos, jeder Wechsel ändert Trend oder Vorstufe, bis zur letzten Kerze", () => {
    const { phases } = run(5, 2);
    expect(phases).toHaveLength(50); // seit "voll nach Fortsetzung" schalten auch Fortsetzung/BOS um
    expect(phases.at(-1)).toMatchObject({ trend: "downtrend", pre: false, to: candles.at(-1).time });
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].from).toBe(phases[i - 1].to);
      expect([phases[i].trend, phases[i].pre]).not.toEqual([phases[i - 1].trend, phases[i - 1].pre]);
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

// Philips CHoCH vom 09.09.2026 (Messlinie 09:30 -> 09:50 bei 1,35576): das Tief ist nur ein P2-Pivot
// und startete den CHoCH-Kandidaten bis zur P2-Seed-Regel gar nicht. Kerzen bis 10:55 Berlin,
// Anker = 1h-cutoffOuter 21.08. 11:00 (die 2500 geladenen Kerzen reichen nur bis 27.08. zurück).
describe("M5-CHoCH am 09.09.2026 (P2-Tief startet den Kandidaten)", () => {
  const CUTOFF_0909 = 1787302800;
  const upTo = (t) => candles0909.filter((c) => c.time <= t);
  const isChochLow = (p) => p != null && Math.abs(p.price - 1.35576) < 1e-9; // cTrader-Preise tragen Float-Reste

  it("bis 10:05 noch kein CHoCH auf dem 1,35576-Tief", () => {
    const chain = collectNestedChain(run(5, 2, upTo(1788941100), CUTOFF_0909).state);
    expect(chain.some((l) => isChochLow(l.appliedPivots[1]))).toBe(false);
  });

  it("Algo bestätigt 10:20, Band (Downtrend-Vorstufe) beginnt rückdatiert an der Berührungs-Kerze 09:50", () => {
    const { state, phases, events } = run(5, 2, upTo(1788942600), CUTOFF_0909);
    const innermost = collectNestedChain(state).at(-1);
    expect(innermost.trend).toBe("downtrend");
    expect(isChochLow(innermost.appliedPivots[1])).toBe(true);
    expect(innermost.appliedPivots[1].pivotTime).toBe(1788939000);
    const { reaction } = deriveTrendReaction(state);
    expect(reaction.type).toBe("CHoCH");
    expect(isChochLow(reaction)).toBe(true);
    expect(phases.at(-1)).toMatchObject({ trend: "downtrend", pre: true, from: 1788940200 });
    expect(events.at(-1)).toMatchObject({ reason: "CHoCH", trend: "downtrend", pre: true, at: 1788942000, touchAt: 1788940200 });
  });

  it("CHoCH-Linie: bärischer Anker (Tief) endet an der ersten Kerze, die es von oben BERÜHRT — 09:50, nicht sofort", () => {
    const anchor = { price: 1.35576, pivotTime: 1788939000 };
    expect(firstTouchAfter(candles0909, anchor, M5, true)).toBe(1788940200);
  });

  it("voll rot erst nach Fortsetzung (LH 1,35481 + Bruch mit 1,35298 um 12:10), zurück auf Vorstufe beim BOS um 13:40", () => {
    const { events } = run(5, 2, candles0909Day, CUTOFF_0909);
    const t = (hhmmUtc) => Date.parse(`2026-09-09T${hhmmUtc}:00Z`) / 1000;
    const down = events.filter((e) => e.trend === "downtrend" && e.at >= t("08:00") && e.at <= t("12:00"));
    expect(down.map((e) => [e.at, e.pre, e.reason])).toEqual([
      [t("08:20"), true, "CHoCH"],
      [t("10:10"), false, "Fortsetzung"],
      [t("11:40"), true, "BOS"],
    ]);
  });
});
