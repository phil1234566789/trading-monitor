import { describe, expect, it } from "vitest";
import { obBoxTouchState } from "../src/priceChartObZones.js";

// GBPUSD DR104, Target 132: Original-H4-Zone ist unberührt. M5-Kerzen innerhalb
// der Entstehungsphase dürfen die Journal-Markierung nicht vorzeitig beenden.
const start = Date.parse("2026-09-23T13:00:00Z") / 1000;
const item = { timeframe: "4H", sourceTime: start, rangeLow: 1.32629, rangeHigh: 1.3288499999999999, touchedTime: null };
const zone = { instrument: "GBPUSD", timeframe: "4H", startTime: start, top: item.rangeHigh, bottom: item.rangeLow,
  touched: false, invalidated: false, endTime: start + 86400 };
const ctx = { symbol: "GBPUSD", m5Candles: [], dbObZones: [zone], replayUntil: null, price: null };
const m5 = [{ time: start + 300, low: 1.326, high: 1.327 }, { time: start + 86400, low: 1.32, high: 1.321 }];

describe("journal HTF OB highlight", () => {
  it("uses the untouched original identically on M5 and H4", () => {
    for (const candles of [m5, [{ time: start + 14400, low: 1.32, high: 1.321 }]]) {
      expect(obBoxTouchState(item, candles, ctx)).toEqual({ touched: false, endTime: zone.endTime });
    }
  });
  it("keeps the original touch instead of taking an earlier M5 overlap or saved snapshot", () => {
    const touched = { ...zone, touched: true, endTime: start + 43200 };
    expect(obBoxTouchState({ ...item, touchedTime: start + 300 }, m5, { ...ctx, dbObZones: [touched] }))
      .toEqual({ touched: true, endTime: touched.endTime });
  });
  it("matches the original time, even when another zone has identical prices", () => {
    const other = { ...zone, startTime: start - 86400, touched: true, endTime: start - 43200 };
    expect(obBoxTouchState(item, m5, { ...ctx, dbObZones: [other, zone], price: 2 }))
      .toEqual({ touched: false, endTime: zone.endTime });
  });
  it("does not invent an HTF touch from M5 candles when the original is unavailable", () => {
    expect(obBoxTouchState(item, m5, { ...ctx, dbObZones: [] }))
      .toEqual({ touched: false, endTime: m5.at(-1).time });
  });
});
