import { describe, expect, it } from "vitest";
import { mergePinnedLevels, computeHtfLiquidityLevels, mergeDbLiquidityLevels } from "../src/priceChartLiquidity.js";

function candle(time, low, high) {
  return { time, low, high, open: (low + high) / 2, close: (low + high) / 2 };
}

// Task "Pin-Kontext: gepinnte Objekte direkt rendern" (Chat 2026-08-17/18) — ein gepinntes Level
// bleibt sichtbar, auch wenn showLiquidity aus ist oder der Chart auf einem anderen Timeframe steht.
describe("mergePinnedLevels", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25), candle(300, 0.9, 1.0)];

  it("gibt levels unverändert zurück, wenn keine Pins vorliegen", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    expect(mergePinnedLevels(levels, [], candles)).toBe(levels);
  });

  it("dedupliziert per Natural Key — bereits gezeichnetes Level wird nicht doppelt hinzugefügt", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    const pinned = [{ dir: 1, pivotTime: 100, touched: false }];
    expect(mergePinnedLevels(levels, pinned, candles)).toHaveLength(1);
  });

  it("übernimmt einen bereits bekannten touched-Status unverändert", () => {
    const pinned = [{ dir: 1, pivotTime: 100, touched: true, endTime: 250, price: 1.2 }];
    expect(mergePinnedLevels([], pinned, candles)).toEqual([{ dir: 1, pivotTime: 100, touched: true, endTime: 250, price: 1.2 }]);
  });

  it("heilt touched===null selbst anhand der geladenen Kerzen (m5_liquidity_level-Snapshot)", () => {
    const pinnedHigh = [{ dir: 1, pivotTime: 100, touched: null, price: 1.2 }]; // dir 1 (High) -> Touch wenn high>=price
    const result = mergePinnedLevels([], pinnedHigh, candles);
    expect(result[0]).toMatchObject({ touched: true, endTime: 200 }); // candle(200, 1.15, 1.25) hat high=1.25 >= 1.2
  });

  it("bleibt unberührt bis zur letzten geladenen Kerze, wenn kein Touch gefunden wird", () => {
    const pinnedLow = [{ dir: -1, pivotTime: 100, touched: null, price: 0.1 }]; // dir -1 (Low), kein low<=0.1 in den Kerzen
    const result = mergePinnedLevels([], pinnedLow, candles);
    expect(result[0]).toMatchObject({ touched: false, endTime: 300 });
  });
});

// Task "Chart-Objekte...", Punkt 12/13, Nachbesserung 2026-08-23 — die persistierten HTF-Level
// (1H+4H), unabhängig vom aktuell gewählten Chart-Timeframe.
describe("computeHtfLiquidityLevels", () => {
  const candles = [candle(100, 1.0, 1.1), candle(200, 1.15, 1.25)];

  it("filtert nach Instrument und Replay-Cutoff, endTime wird selbst geheilt", () => {
    const dbLevels = [
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 },
      { instrument: "GBPUSD", timeframe: "1H", pivotTime: 400, price: 1.2, dir: 1 }, // nach replayUntil
      { instrument: "EURUSD", timeframe: "1H", pivotTime: 50, price: 1.2, dir: 1 }, // falsches Instrument
    ];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", 300, 1.15);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ pivotTime: 50, endTime: 200 }); // selbst geheilt auf letzte Kerze
  });

  it("ohne replayUntil (live) zählt kein Zeit-Cutoff", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 9999, price: 1.2, dir: 1 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result).toHaveLength(1);
  });

  it("behält ein bereits bekanntes endTime statt es zu überschreiben", () => {
    const dbLevels = [{ instrument: "GBPUSD", timeframe: "1H", pivotTime: 50, endTime: 999, price: 1.2, dir: 1 }];
    const result = computeHtfLiquidityLevels(candles, dbLevels, "GBPUSD", null, 1.15);
    expect(result[0].endTime).toBe(999);
  });
});

// Bug-Report Philip 2026-08-23: die DB-Version (poi-watcher) gewinnt IMMER bei einer Überschneidung
// mit der Live-Neuberechnung — nur was NUR live erkannt wurde, kommt zusätzlich dazu.
describe("mergeDbLiquidityLevels", () => {
  it("gibt levels unverändert zurück, wenn keine DB-Level vorliegen", () => {
    const levels = [{ dir: 1, pivotTime: 100 }];
    expect(mergeDbLiquidityLevels(levels, [])).toBe(levels);
  });

  it("DB-Version gewinnt bei einer Überschneidung (gleicher Natural Key)", () => {
    const levels = [{ dir: 1, pivotTime: 100, touched: false, source: "live" }];
    const dbLevels = [{ dir: 1, pivotTime: 100, touched: true, source: "db" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([{ dir: 1, pivotTime: 100, touched: true, source: "db" }]);
  });

  it("live-only Level (kein DB-Pendant) bleibt zusätzlich erhalten", () => {
    const levels = [{ dir: 1, pivotTime: 100, source: "live" }];
    const dbLevels = [{ dir: -1, pivotTime: 200, source: "db" }];
    expect(mergeDbLiquidityLevels(levels, dbLevels)).toEqual([
      { dir: 1, pivotTime: 100, source: "live" },
      { dir: -1, pivotTime: 200, source: "db" },
    ]);
  });
});
