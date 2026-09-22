import { describe, expect, it } from "vitest";
import {
  LIVE_TOUCH_WINDOW_SEC,
  findLevelTouch,
  findZoneTouch,
  levelTouchPrice,
  recentCandles,
  zoneTouchPrice,
} from "../supabase/functions/poi-watcher/liveTouch.ts";

const candle = (time, { open = 1, high = 1, low = 1, close = 1 } = {}) => ({ time, open, high, low, close });

describe("findZoneTouch", () => {
  // Der Fall aus dem Bug-Report (Zone 3335263, GBPUSD 1H long, 22.09.2026 10:05): der Docht
  // reicht in die Zone, die Kerze schließt wieder außerhalb — der Tick-Preis hätte nichts gesehen.
  it("erkennt einen Docht, der in derselben Kerze wieder aus der Zone läuft", () => {
    const candles = [candle(1000, { high: 1.3360, low: 1.33500, close: 1.33541 })];
    const hit = findZoneTouch(candles, 1.33508, 1.33390);
    expect(hit).not.toBeNull();
    expect(zoneTouchPrice(hit, 1.33508, 1.33390)).toBe(1.33500);
  });

  it("meldet nichts, wenn die Kerze die Zone gar nicht erreicht", () => {
    const candles = [candle(1000, { high: 1.3360, low: 1.33520, close: 1.33541 })];
    expect(findZoneTouch(candles, 1.33508, 1.33390)).toBeNull();
  });

  it("nimmt bei einer die Zone komplett durchlaufenden Kerze den Close als Touch-Preis", () => {
    const hit = candle(1000, { high: 1.3400, low: 1.3300, close: 1.3350 });
    expect(zoneTouchPrice(hit, 1.33508, 1.33390)).toBe(1.3350);
  });
});

describe("findLevelTouch", () => {
  it("erkennt den Docht über ein High-Level und meldet das Docht-Extrem", () => {
    const candles = [candle(1000, { high: 1.3400, low: 1.3380, close: 1.3385 })];
    const hit = findLevelTouch(candles, 1.3395, "high");
    expect(levelTouchPrice(hit, "high")).toBe(1.3400);
  });

  it("erkennt den Docht unter ein Low-Level", () => {
    const candles = [candle(1000, { high: 1.3400, low: 1.3380, close: 1.3395 })];
    expect(findLevelTouch(candles, 1.3385, "low")).not.toBeNull();
    expect(findLevelTouch(candles, 1.3375, "low")).toBeNull();
  });
});

describe("recentCandles", () => {
  // Ohne das Fenster würde der erste Lauf nach dem Deploy ~25h Historie auf einmal als
  // frische Touches melden (Alarmsalve).
  it("lässt nur Kerzen innerhalb des Fensters durch", () => {
    const nowSec = 100_000;
    const candles = [
      candle(nowSec - LIVE_TOUCH_WINDOW_SEC - 1),
      candle(nowSec - LIVE_TOUCH_WINDOW_SEC),
      candle(nowSec - 60),
    ];
    expect(recentCandles(candles, nowSec).map((c) => c.time)).toEqual([
      nowSec - LIVE_TOUCH_WINDOW_SEC,
      nowSec - 60,
    ]);
  });
});
