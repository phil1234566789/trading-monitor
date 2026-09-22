import { describe, it, expect } from "vitest";
import {
  findAntiConfluenceObCandidates,
  findAntiConfluenceSweepCandidates,
  findAntiConfluenceDivergenceCandidates,
  findInvalidationObCandidates,
  isFreshCounterInducement,
  MAX_HELD_OB_AGE_DAYS,
} from "./findAntiConfluences.js";

const DAY_SEC = 86400;
const NOW_SEC = 1_790_091_102; // 22.09.2026 17:31 Europe/Berlin
const SWEPT_TODAY = 1_790_064_000; // 22.09.2026 10:00 Europe/Berlin
const PIVOT_MAJOR = 1_785_394_800; // 30.07.2026 09:00 Europe/Berlin

describe("findAntiConfluenceObCandidates", () => {
  const currentPrice = 1.365;
  // Short-Zone: [tiefstes Target 1.35, aktueller Preis 1.365].
  const zoneLow = 1.35;
  const zoneHigh = currentPrice;
  const nowSec = 1_700_000_000;

  it("includes an open bullish OB inside the zone for a short", () => {
    const zones = [{ top: 1.36, bottom: 1.358, dir: 1, touched: false, invalidated: false, endTime: nowSec, timeframe: "1H" }];
    const result = findAntiConfluenceObCandidates(zones, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec });
    expect(result.map((z) => z.edgePrice)).toEqual([1.36]);
    expect(result[0].held).toBe(false);
  });

  it("includes a touched-but-held bullish OB when recent enough", () => {
    const zones = [{ top: 1.36, bottom: 1.358, dir: 1, touched: true, invalidated: false, endTime: nowSec - 2 * DAY_SEC, timeframe: "1H" }];
    const result = findAntiConfluenceObCandidates(zones, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec });
    expect(result.map((z) => z.edgePrice)).toEqual([1.36]);
    expect(result[0].held).toBe(true);
  });

  it("excludes a touched-but-held bullish OB once it's too old", () => {
    const zones = [
      { top: 1.36, bottom: 1.358, dir: 1, touched: true, invalidated: false, endTime: nowSec - (MAX_HELD_OB_AGE_DAYS + 1) * DAY_SEC, timeframe: "1H" },
    ];
    const result = findAntiConfluenceObCandidates(zones, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec });
    expect(result).toEqual([]);
  });

  it("excludes invalidated zones and the wrong (same-direction) OB", () => {
    const zones = [
      { top: 1.36, bottom: 1.358, dir: 1, touched: true, invalidated: true, endTime: nowSec, timeframe: "1H" },
      { top: 1.361, bottom: 1.359, dir: -1, touched: false, invalidated: false, endTime: nowSec, timeframe: "1H" }, // bärisch, für Short nicht gesucht
    ];
    const result = findAntiConfluenceObCandidates(zones, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec });
    expect(result).toEqual([]);
  });

  it("excludes a bullish OB beyond the target (below zoneLow) — Bug-Beispiel 30.08.2026", () => {
    const zones = [{ top: 1.349, bottom: 1.347, dir: 1, touched: false, invalidated: false, endTime: nowSec, timeframe: "1H" }];
    const result = findAntiConfluenceObCandidates(zones, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec });
    expect(result).toEqual([]);
  });

  it("mirrors for long: searches bearish OBs (dir=-1), using the bottom edge", () => {
    // Long-Zone: [aktueller Preis 1.365, höchstes Target 1.38].
    const zones = [{ top: 1.372, bottom: 1.37, dir: -1, touched: false, invalidated: false, endTime: nowSec, timeframe: "1H" }];
    const result = findAntiConfluenceObCandidates(zones, { direction: "long", zoneLow: currentPrice, zoneHigh: 1.38, currentPrice, nowSec });
    expect(result.map((z) => z.edgePrice)).toEqual([1.37]);
  });
});

describe("findAntiConfluenceSweepCandidates", () => {
  const currentPrice = 1.365;
  const zoneLow = 1.35;
  const zoneHigh = currentPrice;

  it("includes an already-touched low (bullish sweep) inside the zone for a short", () => {
    const levels = [{ price: 1.36, dir: -1, touched: true }];
    const result = findAntiConfluenceSweepCandidates(levels, { direction: "short", zoneLow, zoneHigh, currentPrice });
    expect(result.map((l) => l.price)).toEqual([1.36]);
  });

  it("excludes an untouched low and a high (wrong direction)", () => {
    const levels = [
      { price: 1.361, dir: -1, touched: false },
      { price: 1.362, dir: 1, touched: true },
    ];
    const result = findAntiConfluenceSweepCandidates(levels, { direction: "short", zoneLow, zoneHigh, currentPrice });
    expect(result).toEqual([]);
  });

  it("excludes a swept low outside the zone", () => {
    const levels = [{ price: 1.34, dir: -1, touched: true }];
    const result = findAntiConfluenceSweepCandidates(levels, { direction: "short", zoneLow, zoneHigh, currentPrice });
    expect(result).toEqual([]);
  });

  // Der reale Auslöser (EURUSD 22.09.2026): das 1H-Low 1,14339 lag 4 Pips UNTER der Zonenuntergrenze,
  // weil der Preis am selben Tag schon tiefer war als das eigene Ziel.
  it("includes a same-day major inducement even outside the zone", () => {
    const levels = [{ price: 1.34, dir: -1, touched: true, timeframe: "1H", pivotTime: PIVOT_MAJOR, touchedTime: SWEPT_TODAY }];
    const result = findAntiConfluenceSweepCandidates(levels, { direction: "short", zoneLow, zoneHigh, currentPrice, nowSec: NOW_SEC });
    expect(result.map((l) => l.price)).toEqual([1.34]);
  });
});

// Zonenfreie Inducement-Regel. NOW_SEC/SWEPT_TODAY sind der echte Fall vom 22.09.2026 (Dienstag,
// Sweep 10:00 Berlin), damit die Handelstags- und Wochenend-Arithmetik an echten Daten hängt.
describe("isFreshCounterInducement", () => {
  it("accepts a major inducement swept today on 1H", () => {
    expect(isFreshCounterInducement({ timeframe: "1H", pivotTime: PIVOT_MAJOR, touchedTime: SWEPT_TODAY }, NOW_SEC)).toBe(true);
  });

  it("accepts a medium inducement (level older than one trading day at sweep time)", () => {
    // Pivot am Sonntag davor — nur Montag + Dienstagmorgen zählen als Handelszeit, also medium.
    expect(isFreshCounterInducement({ timeframe: "4H", pivotTime: SWEPT_TODAY - 2 * DAY_SEC, touchedTime: SWEPT_TODAY }, NOW_SEC)).toBe(true);
  });

  it("rejects a minor inducement (level younger than one trading day)", () => {
    expect(isFreshCounterInducement({ timeframe: "1H", pivotTime: SWEPT_TODAY - 3 * 3600, touchedTime: SWEPT_TODAY }, NOW_SEC)).toBe(false);
  });

  it("rejects a sweep from an earlier trading day", () => {
    expect(isFreshCounterInducement({ timeframe: "1H", pivotTime: PIVOT_MAJOR, touchedTime: SWEPT_TODAY - DAY_SEC }, NOW_SEC)).toBe(false);
  });

  it("rejects an M5 sweep — an inducement is a 1H/4H event", () => {
    expect(isFreshCounterInducement({ timeframe: "5M", pivotTime: PIVOT_MAJOR, touchedTime: SWEPT_TODAY }, NOW_SEC)).toBe(false);
  });

  it("rejects a level that was never swept", () => {
    expect(isFreshCounterInducement({ timeframe: "1H", pivotTime: PIVOT_MAJOR, touchedTime: null }, NOW_SEC)).toBe(false);
  });
});

describe("findAntiConfluenceDivergenceCandidates", () => {
  const currentPrice = 1.365;
  const zoneLow = 1.35;
  const zoneHigh = currentPrice;

  it("includes a bullish divergence pivot inside the zone for a short", () => {
    const divergences = [{ type: "bullish", toPrice: 1.36, fromPrice: 1.355, fromRsi: 30, toRsi: 40 }];
    const result = findAntiConfluenceDivergenceCandidates(divergences, { direction: "short", zoneLow, zoneHigh, currentPrice });
    expect(result.map((d) => d.toPrice)).toEqual([1.36]);
  });

  it("excludes a bearish divergence for a short and one outside the zone", () => {
    const divergences = [
      { type: "bearish", toPrice: 1.36, fromPrice: 1.355, fromRsi: 70, toRsi: 60 },
      { type: "bullish", toPrice: 1.34, fromPrice: 1.335, fromRsi: 30, toRsi: 40 },
    ];
    const result = findAntiConfluenceDivergenceCandidates(divergences, { direction: "short", zoneLow, zoneHigh, currentPrice });
    expect(result).toEqual([]);
  });
});

describe("findInvalidationObCandidates", () => {
  const invalidation = 1.37; // Short-Invalidierung, oberhalb des aktuellen Preises

  it("includes an untouched bearish OB up to 10 pips above the invalidation for a short", () => {
    const zones = [{ top: 1.372, bottom: 1.3705, dir: -1, touched: false, invalidated: false }];
    const result = findInvalidationObCandidates(zones, { direction: "short", invalidation });
    expect(result.map((z) => z.edgePrice)).toEqual([1.3705]);
  });

  it("excludes a bearish OB more than 10 pips above the invalidation", () => {
    const zones = [{ top: 1.372, bottom: 1.3712, dir: -1, touched: false, invalidated: false }];
    const result = findInvalidationObCandidates(zones, { direction: "short", invalidation });
    expect(result).toEqual([]);
  });

  it("excludes a touched OB and one below the invalidation", () => {
    const zones = [
      { top: 1.372, bottom: 1.3705, dir: -1, touched: true, invalidated: false },
      { top: 1.369, bottom: 1.368, dir: -1, touched: false, invalidated: false },
    ];
    const result = findInvalidationObCandidates(zones, { direction: "short", invalidation });
    expect(result).toEqual([]);
  });

  it("returns an empty list without an invalidation price", () => {
    const zones = [{ top: 1.372, bottom: 1.3705, dir: -1, touched: false, invalidated: false }];
    expect(findInvalidationObCandidates(zones, { direction: "short", invalidation: null })).toEqual([]);
  });

  it("mirrors for long: bullish OBs below the invalidation, using the top edge", () => {
    const zones = [{ top: 1.3495, bottom: 1.348, dir: 1, touched: false, invalidated: false }];
    const result = findInvalidationObCandidates(zones, { direction: "long", invalidation: 1.35 });
    expect(result.map((z) => z.edgePrice)).toEqual([1.3495]);
  });
});
