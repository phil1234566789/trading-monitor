// Deckt den Bug ab, wegen dem find_targets ein längst durchlaufenes 1H-Objekt als frisches Ziel
// vorschlug (GBPUSD, 09.09.2026): poi-watcher prüft die Kerzen VOR dem Erkennungszeitpunkt nie
// rückwirkend, die Zeile bleibt auf touched=false stehen.
import { describe, expect, it } from "vitest";
import { verifyLevelTouched, verifyZoneTouched } from "../supabase/functions/trading-monitor-mcp/verifyTouched.js";

const M5 = 300;
const HOUR = 3600;
// LIQUIDITY_FRACTAL_PERIOD (5) * barSeconds("1h") = 5 Stunden Bestätigungsfenster für ein 1H-Level.
const CONFIRM_1H = 5 * HOUR;

function candlesFrom(startSec, count, build) {
  return Array.from({ length: count }, (_, i) => ({ time: startSec + i * M5, ...build(i) }));
}
const flat = (price) => () => ({ open: price, high: price, low: price, close: price });

describe("verifyLevelTouched", () => {
  it("erkennt einen Touch, den die DB nicht kennt", () => {
    // Kurs läuft flach unter dem Level, eine Kerze weit nach dem Bestätigungsfenster tickt darüber.
    const pivotTime = 1000 * M5;
    const candles = candlesFrom(pivotTime - 10 * M5, 200, (i) =>
      i === 150 ? { open: 1.3, high: 1.36, low: 1.3, close: 1.3 } : { open: 1.3, high: 1.3, low: 1.3, close: 1.3 },
    );
    const level = { price: 1.355, direction: "high", pivotTime, timeframe: "1H", touched: false, touchedTime: null };
    const result = verifyLevelTouched(level, candles);
    expect(result.touched).toBe(true);
    expect(result.touchVerified).toBe(true);
    expect(result.touchedTime).toBe(candles[150].time);
  });

  it("ignoriert einen Touch INNERHALB des Fraktal-Bestätigungsfensters", () => {
    // Die Kerze, die das Level antippt, liegt noch in denselben 5 Stunden, in denen das 1H-Fraktal
    // überhaupt erst bestätigt wird — sie gehört zur Formation, ist kein Sweep.
    const pivotTime = 1000 * M5;
    const inWindow = Math.floor(CONFIRM_1H / M5) - 2;
    const candles = candlesFrom(pivotTime, 200, (i) =>
      i === inWindow ? { open: 1.3, high: 1.36, low: 1.3, close: 1.3 } : { open: 1.3, high: 1.3, low: 1.3, close: 1.3 },
    );
    const level = { price: 1.355, direction: "high", pivotTime, timeframe: "1H", touched: false, touchedTime: null };
    expect(verifyLevelTouched(level, candles).touched).toBe(false);
  });

  it("lässt den DB-Wert stehen, wenn das Level vor dem Kerzenfenster entstand", () => {
    const candles = candlesFrom(5000 * M5, 50, flat(1.3));
    const level = { price: 1.355, direction: "high", pivotTime: 100 * M5, timeframe: "1H", touched: false, touchedTime: null };
    const result = verifyLevelTouched(level, candles);
    expect(result.touched).toBe(false);
    expect(result.touchVerified).toBe(false);
  });

  it("korrigiert ein DB-touched=true zurück auf false, wenn der Kurs nie da war", () => {
    const pivotTime = 1000 * M5;
    const candles = candlesFrom(pivotTime - 10 * M5, 200, flat(1.3));
    const level = { price: 1.355, direction: "high", pivotTime, timeframe: "1H", touched: true, touchedTime: 12345 };
    const result = verifyLevelTouched(level, candles);
    expect(result.touched).toBe(false);
    expect(result.touchedTime).toBe(null);
  });
});

describe("verifyZoneTouched", () => {
  // Der Originalfall: 1H-OB 1.35225-1.35368, Kurs läuft später mit Tief 1.35303 hinein.
  const startTime = 1000 * M5;
  const zone = { top: 1.35368, bottom: 1.35225, startTime, timeframe: "1H", touched: false };

  it("erkennt den Durchlauf durch die Zone", () => {
    const candles = candlesFrom(startTime - 5 * M5, 100, (i) =>
      i === 60 ? { open: 1.354, high: 1.354, low: 1.35303, close: 1.3536 } : { open: 1.354, high: 1.3545, low: 1.354, close: 1.354 },
    );
    const result = verifyZoneTouched(zone, candles);
    expect(result.touched).toBe(true);
    expect(result.touchVerified).toBe(true);
  });

  it("bleibt ungetoucht, solange der Kurs oberhalb der Oberkante bleibt", () => {
    const candles = candlesFrom(startTime - 5 * M5, 100, flat(1.354));
    expect(verifyZoneTouched(zone, candles).touched).toBe(false);
  });

  it("lässt den DB-Wert stehen, wenn die Zone vor dem Kerzenfenster entstand", () => {
    const candles = candlesFrom(5000 * M5, 50, flat(1.3));
    const result = verifyZoneTouched(zone, candles);
    expect(result.touchVerified).toBe(false);
  });
});
