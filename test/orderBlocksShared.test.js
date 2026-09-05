// Regressionstest für die typisierte Backend-Kopie von detectOrderBlocks (siehe "ACHTUNG DRITTE
// KOPIE"-Kopfkommentar in src/orderBlockDetection.js/_shared/orderBlocks.ts) — von poi-watcher/
// _shared/tradeSetup.ts genutzt. Bewusst dieselben Testfälle wie test/orderBlocks.test.js und
// test/orderBlockDetectionMcp.test.js, damit ein Auseinanderdriften der drei Kopien sofort auffällt.
import { describe, expect, it } from "vitest";
import { detectOrderBlocks } from "../supabase/functions/_shared/orderBlocks.ts";

describe("detectOrderBlocks (_shared-Kopie) — Invalidierung (Wick genügt, kein Kerzenschluss nötig)", () => {
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

describe("detectOrderBlocks (_shared-Kopie) — Retest-Status (retested)", () => {
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
