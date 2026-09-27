// Spread Hour soll aus der Erkennung verschwinden, "als ob die candles nicht da wären" (Philip
// 2026-09-24) — mit der einen Einschränkung, dass die FVG-Erkennung die Lücke NICHT zusammenziehen
// darf, weil sonst die Bewegung über sie hinweg als FVG herauskäme.
import { describe, expect, it } from "vitest";
import { markIgnoredCandles } from "../src/sessionOccurrences.js";
import { detectLiquidityLevels } from "../src/liquidityDetection.js";
import { detectOrderBlocks } from "../src/orderBlockDetection.js";

const M5 = 300;
// Spread Hour 23:00-00:00 wie in Philips Sessions-Modal, hier UTC gerechnet (tzOffset 0).
const SPREAD_HOUR = { instrument: "GBPUSD", fromMinutes: 23 * 60, toMinutes: 0, days: null, ignoreLiquidity: true };
const ASIA = { instrument: "GBPUSD", fromMinutes: 0, toMinutes: 7 * 60, days: null, ignoreLiquidity: false };

// 2026-01-05 (Montag) 22:00 UTC als Startpunkt — die Spread Hour liegt damit mitten in der Serie.
const START = Math.floor(Date.UTC(2026, 0, 5, 22, 0) / 1000);
const kerze = (idx, { high, low }) => ({ time: START + idx * M5, open: low, high, low, close: low, volume: 1 });
const mark = (candles, configs = [SPREAD_HOUR, ASIA]) => markIgnoredCandles(candles, configs, () => 0);

describe("markIgnoredCandles", () => {
  it("markiert nur die Kerzen der ignore_liquidity-Session", () => {
    const candles = Array.from({ length: 24 }, (_, i) => kerze(i, { high: 1.3, low: 1.29 }));
    const marked = mark(candles);
    // Index 0-11 = 22:00-22:55, Index 12-23 = 23:00-23:55.
    expect(marked.slice(0, 12).some((c) => c.ignored)).toBe(false);
    expect(marked.slice(12).every((c) => c.ignored === true)).toBe(true);
  });

  it("lässt alles unangetastet, wenn keine Session das Flag hat", () => {
    const candles = Array.from({ length: 24 }, (_, i) => kerze(i, { high: 1.3, low: 1.29 }));
    expect(mark(candles, [ASIA])).toBe(candles);
  });
});

describe("detectLiquidityLevels mit ignorierten Kerzen", () => {
  // Fraktal-Hoch bei Index 9 (Periode 5 braucht 5 Kerzen danach, 5+4 davor), danach genau EIN
  // Docht darüber — und der liegt in der Spread Hour.
  function serie() {
    // 36 Kerzen = 22:00 bis 00:55. Index 12-23 ist die Spread Hour; das Fraktal bei Index 9
    // behaelt seine 5 Bestaetigungskerzen also auch dann, wenn die Stunde herausfaellt.
    const candles = Array.from({ length: 36 }, (_, i) => kerze(i, { high: 1.3, low: 1.29 }));
    candles[9] = kerze(9, { high: 1.305, low: 1.29 });
    candles[15] = kerze(15, { high: 1.306, low: 1.29 }); // 23:15 -> in der Spread Hour
    return candles;
  }

  it("zählt einen Spread-Hour-Docht nicht als Touch", () => {
    const ohne = detectLiquidityLevels(serie(), 5).highs.find((l) => l.price === 1.305);
    expect(ohne.touched).toBe(true); // ohne Markierung beendet der Docht die Linie

    const mit = detectLiquidityLevels(mark(serie()), 5).highs.find((l) => l.price === 1.305);
    expect(mit.touched).toBe(false);
    expect(mit.touchedTime).toBe(null);
  });

  it("erzeugt kein Level aus einer Spread-Hour-Kerze", () => {
    // 30 Kerzen, damit Index 15 (23:15) die 5 Bestaetigungskerzen danach noch hat.
    const candles = Array.from({ length: 30 }, (_, i) => kerze(i, { high: 1.3, low: 1.29 }));
    candles[15] = kerze(15, { high: 1.31, low: 1.29 }); // einziges Hoch, aber in der Spread Hour
    expect(detectLiquidityLevels(candles, 5).highs.map((l) => l.price)).toContain(1.31);
    expect(detectLiquidityLevels(mark(candles), 5).highs.map((l) => l.price)).not.toContain(1.31);
  });
});

describe("detectOrderBlocks mit ignorierten Kerzen", () => {
  // Bärische FVG: c1.low deutlich über cur.high. c1 liegt vor der Spread Hour, cur dahinter — ohne
  // Schutz wäre das eine FVG über die Lücke hinweg, die es nie gab.
  function serie() {
    const candles = Array.from({ length: 20 }, (_, i) => kerze(i, { high: 1.3002, low: 1.3 }));
    candles[10] = { time: START + 10 * M5, open: 1.302, high: 1.3025, low: 1.302, close: 1.3022, volume: 1 };
    candles[11] = { time: START + 11 * M5, open: 1.3022, high: 1.3023, low: 1.3, close: 1.3, volume: 1 };
    candles[12] = { time: START + 12 * M5, open: 1.3, high: 1.3005, low: 1.2995, close: 1.2996, volume: 1 };
    return candles;
  }

  it("überspringt jedes Fenster, in dem eine ignorierte Kerze steckt", () => {
    const ohne = detectOrderBlocks(serie(), "5m", true, 0);
    expect(ohne.some((z) => z.startTime === START + 11 * M5)).toBe(true); // startTime = c2 (Index 11)

    // Index 12 ist 23:00 -> ignoriert, das Fenster 9..12 fällt damit komplett aus.
    const mit = detectOrderBlocks(mark(serie()), "5m", true, 0);
    expect(mit.some((z) => z.startTime === START + 11 * M5)).toBe(false);
  });
});
