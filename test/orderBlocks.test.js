// Bug-Report Philip 2026-07-26: eine M5-FVG (bullische Lücke) um 09:00 wurde nicht als Order-Block
// erkannt. Ursache: detectOrderBlocks wendete für JEDEN Timeframe denselben IRRELEVANT_PCT-
// Schwellenwert (0,05% vom Preis) an — auf GBPUSD/EURUSD (~1.3) sind das ~6-7 Pip, viel zu grob für
// eine M5-Lücke. Im Pine-Original (tv-indikator/src/calculations.pine) hat der Lower-TF-Modus
// (M1/M3/M5, capMode=true) gar KEIN Mindestmaß — Philip wollte explizit "mindestens 1 Pip" statt
// komplett ohne Minimum.
import { describe, expect, it } from "vitest";
import { detectOrderBlocks } from "../src/orderBlocks.js";

// c1 (candles[1]) hat high=close=1.30000 (refPrice), damit sich Gap-% und Gap-in-Pip sauber von
// Hand nachrechnen lassen. candles[0] ist reiner Puffer (Schleife startet erst bei i=3).
function candlesWithBullGap(gapAbs) {
  return [
    { time: 0, open: 1.29990, high: 1.3, low: 1.2998, close: 1.29995 },
    { time: 300, open: 1.29995, high: 1.3, low: 1.2999, close: 1.3 }, // c1
    { time: 600, open: 1.3, high: 1.30005, low: 1.29998, close: 1.30002 }, // c2
    { time: 900, open: 1.30002, high: 1.30008 + gapAbs, low: 1.3 + gapAbs, close: 1.30006 + gapAbs }, // cur
  ];
}

describe("detectOrderBlocks — HTF (kein/unbekannter Timeframe, Prozent-Schwelle unverändert)", () => {
  it("legt keine Zone an, wenn die Lücke unter IRRELEVANT_PCT (0,05%) liegt", () => {
    const gapAbs = 1.3 * (0.02 / 100); // 0,02% ≈ 2,6 Pip — unter der HTF-Schwelle
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1h")).toEqual([]);
  });

  it("legt eine Zone an, wenn die Lücke IRRELEVANT_PCT erreicht", () => {
    const gapAbs = 1.3 * (0.06 / 100); // 0,06% — über der HTF-Schwelle
    const zones = detectOrderBlocks(candlesWithBullGap(gapAbs), "1h");
    expect(zones).toHaveLength(1);
    expect(zones[0].dir).toBe(1);
  });

  it("verhält sich ohne timeframe-Argument identisch zu HTF (Altverhalten)", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs))).toEqual([]);
  });
});

describe("detectOrderBlocks — Lower-TF (1m/3m/5m, Pip-Schwelle statt Prozent)", () => {
  // M5-Minimum am 2026-07-28 von 1 auf 0,5 Pip gesenkt (Bug-Report: eine 0,7-Pip-FVG auf
  // EURUSD wurde vom 1-Pip-Minimum verschluckt) — M1/M3 blieben bei 1 Pip.
  it("5m: legt KEINE Zone an, wenn die Lücke unter 0,5 Pip liegt", () => {
    const gapAbs = 0.3 * 0.0001; // 0,3 Pip
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "5m")).toEqual([]);
  });

  it("5m: legt eine Zone an, sobald die Lücke (mindestens) 0,5 Pip erreicht", () => {
    const gapAbs = 0.51 * 0.0001; // knapp über 0,5 Pip statt exakt an der Grenze (Floating-Point)
    const zones = detectOrderBlocks(candlesWithBullGap(gapAbs), "5m");
    expect(zones).toHaveLength(1);
    expect(zones[0].dir).toBe(1);
  });

  it("1m/3m: legt KEINE Zone an, wenn die Lücke unter 1 Pip liegt (Minimum dort unverändert)", () => {
    const gapAbs = 0.5 * 0.0001; // 0,5 Pip — reicht auf 5m mittlerweile, auf 1m/3m nicht
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1m")).toEqual([]);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "3m")).toEqual([]);
  });

  it("1m/3m: legt eine Zone an, sobald die Lücke (mindestens) 1 Pip erreicht", () => {
    const gapAbs = 1.01 * 0.0001; // knapp über 1 Pip statt exakt an der Grenze (Floating-Point)
    const zones = detectOrderBlocks(candlesWithBullGap(gapAbs), "1m");
    expect(zones).toHaveLength(1);
    expect(zones[0].dir).toBe(1);
  });

  it("Regressionsfall aus dem Bug-Report: 0,02%-Lücke (≈2,6 Pip) wird auf M5 erkannt, auf HTF nicht", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "5m")).toHaveLength(1);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1h")).toHaveLength(0);
  });

  it("gilt gleichermaßen für 1m und 3m (nicht nur 5m)", () => {
    const gapAbs = 1.3 * (0.02 / 100);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "1m")).toHaveLength(1);
    expect(detectOrderBlocks(candlesWithBullGap(gapAbs), "3m")).toHaveLength(1);
  });
});

// Bug-Report Philip 2026-09-05 (GBPUSD-Retest 28.08.2026): ein bärisches Trade-Setup-OB wurde
// trotz eines Wicks über die Zone weiterhin als gültig/gehalten ausgewiesen, weil die Invalidierung
// bisher einen kompletten Kerzenschluss jenseits der Zone verlangte — nach Philips Handelsregel
// verliert eine OB bei jeder Preisüberschreitung sofort ihre Relevanz, ein Wick genügt.
describe("detectOrderBlocks — Invalidierung (Wick genügt, kein Kerzenschluss nötig)", () => {
  it("bullische Zone: ein Low-Wick unter die Zone invalidiert sie, auch wenn die Kerze darüber schließt", () => {
    const candles = [
      { time: 0, open: 1.2999, high: 1.3, low: 1.2998, close: 1.29995 },
      { time: 300, open: 1.29995, high: 1.3, low: 1.2999, close: 1.3 }, // c1
      { time: 600, open: 1.3, high: 1.30005, low: 1.29998, close: 1.30002 }, // c2
      { time: 900, open: 1.30002, high: 1.30158, low: 1.3013, close: 1.30145 }, // cur, Gap ~0,1%
      { time: 1200, open: 1.3013, high: 1.301, low: 1.2995, close: 1.3005 }, // Wick unter bottom, Close darüber
    ];
    const zones = detectOrderBlocks(candles, "1h");
    expect(zones).toHaveLength(1);
    expect(zones[0].invalidated).toBe(true);
  });

  it("bärische Zone: ein High-Wick über die Zone invalidiert sie, auch wenn die Kerze darunter schließt", () => {
    const candles = [
      { time: 0, open: 1.30005, high: 1.3003, low: 1.3, close: 1.30005 },
      { time: 300, open: 1.30005, high: 1.3001, low: 1.3, close: 1.3 }, // c1
      { time: 600, open: 1.3, high: 1.30002, low: 1.29995, close: 1.29998 }, // c2
      { time: 900, open: 1.29998, high: 1.2987, low: 1.2984, close: 1.2985 }, // cur, Gap ~0,1%
      { time: 1200, open: 1.2985, high: 1.3005, low: 1.298, close: 1.299 }, // Wick über top, Close darunter
    ];
    const zones = detectOrderBlocks(candles, "1h");
    expect(zones).toHaveLength(1);
    expect(zones[0].invalidated).toBe(true);
  });
});

// Feature Philip 05.09.2026 (siehe trading/orderblöcke.md#retest-status): eine getouchte, nicht
// invalidierte OB gilt erst als "Retest bestätigt" (= Confluence), wenn die Reaktion nachweislich
// abgeschlossen ist — HTF (1H/4H) über einen späteren Kerzenschluss außerhalb der Zone (kein
// FVG-Nachweis üblich auf HTF), M5 über eine gleichgerichtete FVG NACH dem Touch.
describe("detectOrderBlocks — Retest-Status (retested)", () => {
  it("HTF: ein späterer Kerzenschluss außerhalb der Zone bestätigt den Retest", () => {
    const candles = [
      { time: 0, open: 1.30005, high: 1.3003, low: 1.3, close: 1.30005 },
      { time: 300, open: 1.30005, high: 1.3001, low: 1.3, close: 1.3 }, // c1 (low=1.3 -> bottom)
      { time: 600, open: 1.3, high: 1.30002, low: 1.29995, close: 1.29998 }, // c2 (high=1.30002 -> top)
      { time: 900, open: 1.29998, high: 1.2987, low: 1.2984, close: 1.2985 }, // cur, erzeugt die Zone
      { time: 1200, open: 1.2985, high: 1.30001, low: 1.2986, close: 1.29995 }, // Touch (innerhalb der Zone)
      { time: 1500, open: 1.29995, high: 1.2999, low: 1.2965, close: 1.297 }, // schließt komplett unter bottom
    ];
    const zones = detectOrderBlocks(candles, "1h");
    const zone = zones.find((z) => z.dir === -1);
    expect(zone.touched).toBe(true);
    expect(zone.invalidated).toBe(false);
    expect(zone.retested).toBe(true);
  });

  it("HTF: ohne einen späteren Kerzenschluss außerhalb der Zone bleibt der Retest unbestätigt", () => {
    const candles = [
      { time: 0, open: 1.30005, high: 1.3003, low: 1.3, close: 1.30005 },
      { time: 300, open: 1.30005, high: 1.3001, low: 1.3, close: 1.3 }, // c1
      { time: 600, open: 1.3, high: 1.30002, low: 1.29995, close: 1.29998 }, // c2
      { time: 900, open: 1.29998, high: 1.2987, low: 1.2984, close: 1.2985 }, // cur, erzeugt die Zone
      { time: 1200, open: 1.2985, high: 1.30001, low: 1.2986, close: 1.29995 }, // Touch
      { time: 1500, open: 1.29995, high: 1.30001, low: 1.29999, close: 1.30001 }, // bleibt innerhalb der Zone
    ];
    const zones = detectOrderBlocks(candles, "1h");
    const zone = zones.find((z) => z.dir === -1);
    expect(zone.touched).toBe(true);
    expect(zone.invalidated).toBe(false);
    expect(zone.retested).toBe(false);
  });

  it("M5: eine gleichgerichtete FVG nach dem Touch bestätigt den Retest", () => {
    const candles = [
      { time: 0, open: 1.30095, high: 1.301, low: 1.3009, close: 1.30095 },
      { time: 300, open: 1.30095, high: 1.301, low: 1.3008, close: 1.3009 }, // c1 (low=1.3008 -> bottom Zone A)
      { time: 600, open: 1.3009, high: 1.3009, low: 1.3007, close: 1.3008 }, // c2 (Zone A startTime)
      { time: 900, open: 1.3008, high: 1.30002, low: 1.2999, close: 1.3 }, // cur, erzeugt Zone A (top=1.301, bottom=1.3008)
      { time: 1200, open: 1.3, high: 1.30085, low: 1.30005, close: 1.3007 }, // Touch von Zone A
      { time: 1500, open: 1.3007, high: 1.3009, low: 1.3007, close: 1.3008 }, // c1 der künftigen Zone B
      { time: 1800, open: 1.3008, high: 1.30075, low: 1.3002, close: 1.3003 }, // c2/Impuls-Kerze Zone B
      { time: 2100, open: 1.3003, high: 1.29995, low: 1.2995, close: 1.2997 }, // cur, erzeugt Zone B (bearisch, startTime 1800)
    ];
    const zones = detectOrderBlocks(candles, "5m");
    const zoneA = zones.find((z) => z.dir === -1 && z.startTime === 600);
    expect(zoneA.touched).toBe(true);
    expect(zoneA.invalidated).toBe(false);
    expect(zoneA.retested).toBe(true);
  });

  it("M5: ohne eine spätere gleichgerichtete FVG bleibt der Retest unbestätigt", () => {
    const candles = [
      { time: 0, open: 1.30095, high: 1.301, low: 1.3009, close: 1.30095 },
      { time: 300, open: 1.30095, high: 1.301, low: 1.3008, close: 1.3009 }, // c1
      { time: 600, open: 1.3009, high: 1.3009, low: 1.3007, close: 1.3008 }, // c2 (Zone A startTime)
      { time: 900, open: 1.3008, high: 1.30002, low: 1.2999, close: 1.3 }, // cur, erzeugt Zone A
      { time: 1200, open: 1.3, high: 1.30085, low: 1.30005, close: 1.3007 }, // Touch von Zone A, keine weitere Kerze danach
    ];
    const zones = detectOrderBlocks(candles, "5m");
    const zoneA = zones.find((z) => z.dir === -1 && z.startTime === 600);
    expect(zoneA.touched).toBe(true);
    expect(zoneA.invalidated).toBe(false);
    expect(zoneA.retested).toBe(false);
  });
});
