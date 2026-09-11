// Regressionsfall GBPUSD 09.09.2026: der 09:20-Tick setzte als Watch-Level einen 12 Tage alten
// OB-Rand, waehrend zeitgleich die eigentliche Entry-Zone entstand — die konnte den Loop nicht
// wecken, weil nur bereits GESPEICHERTE Watch-Level als Trigger galten (siehe obFormationTrigger.ts).
import { describe, expect, it } from "vitest";
import { firstObFormationTimeAfter } from "../supabase/functions/trading-monitor-mcp/obFormationTrigger.ts";

// Zwei baerische FVGs hintereinander: Zone A (startTime 600) wird auf der Kerze t=900 gebildet und
// ist mit deren Schluss (t=1200) bekannt, Zone B (startTime 900) entsprechend bei t=1500.
const candles = [
  { time: 0, open: 1.361, high: 1.3612, low: 1.3608, close: 1.3609 },
  { time: 300, open: 1.3609, high: 1.361, low: 1.36, close: 1.3601 },
  { time: 600, open: 1.3601, high: 1.3602, low: 1.3595, close: 1.3596 },
  { time: 900, open: 1.3596, high: 1.3598, low: 1.359, close: 1.3591 },
  { time: 1200, open: 1.3591, high: 1.3593, low: 1.3588, close: 1.3589 },
];

describe("firstObFormationTimeAfter", () => {
  it("meldet den Kerzenschluss, mit dem die neue Zone ueberhaupt erkennbar wurde", () => {
    expect(firstObFormationTimeAfter(candles, 0, 9999)).toBe(1200);
  });

  it("meldet nach einem Tick auf Zone A die naechste Formation statt erneut Zone A", () => {
    expect(firstObFormationTimeAfter(candles, 1200, 9999)).toBe(1500);
  });

  it("gibt null zurueck, wenn seit sinceSec keine Zone mehr entstanden ist", () => {
    expect(firstObFormationTimeAfter(candles, 1500, 9999)).toBe(null);
  });

  it("meldet keine Formation, deren bildende Kerze zum Stichzeitpunkt noch laeuft", () => {
    expect(firstObFormationTimeAfter(candles, 0, 1199)).toBe(null);
  });

  it("gibt null zurueck, wenn gar keine FVG im Fenster liegt", () => {
    const flat = candles.map((c, i) => ({ time: i * 300, open: 1.36, high: 1.3601, low: 1.3599, close: 1.36 }));
    expect(firstObFormationTimeAfter(flat, 0, 9999)).toBe(null);
  });
});
