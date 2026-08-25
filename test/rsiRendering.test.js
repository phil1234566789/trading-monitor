import { describe, expect, it } from "vitest";
import { mergePinnedDivergences } from "../src/rsiRendering.js";

function candle(time) {
  return { time, open: 1, high: 1, low: 1, close: 1 };
}

// Task "Pin-Kontext: gepinnte Objekte direkt rendern" (Chat 2026-08-17/18) — bewusst NUR bei
// exaktem Zeit-Treffer (kein Snap-Toleranz wie bei Zonen/Leveln, siehe priceChartObZones.js/
// priceChartLiquidity.js): rsi_divergence speichert keine eigene Timeframe-Spalte, ein exakter
// fromTime/toTime-Treffer auf eine geladene Kerze ist der einzige Proxy dafür, dass der Chart
// gerade auf demselben Timeframe steht, auf dem die Divergenz erkannt wurde.
describe("mergePinnedDivergences", () => {
  const candles = [candle(100), candle(200), candle(300)];

  it("gibt divergences unverändert zurück, wenn keine Pins vorliegen", () => {
    const divergences = [{ type: "bullish", fromTime: 100, toTime: 200 }];
    expect(mergePinnedDivergences(divergences, [], candles)).toBe(divergences);
  });

  it("dedupliziert per type|fromTime|toTime — bereits gezeichnete Divergenz wird nicht doppelt hinzugefügt", () => {
    const divergences = [{ type: "bullish", fromTime: 100, toTime: 200 }];
    const pinned = [{ type: "bullish", fromTime: 100, toTime: 200 }];
    expect(mergePinnedDivergences(divergences, pinned, candles)).toHaveLength(1);
  });

  it("fügt eine gepinnte Divergenz hinzu, deren fromTime/toTime exakt auf geladene Kerzen treffen", () => {
    const pinned = [{ type: "bearish", fromTime: 100, toTime: 300 }];
    expect(mergePinnedDivergences([], pinned, candles)).toEqual(pinned);
  });

  it("verwirft eine gepinnte Divergenz ohne exakten Kerzen-Treffer (anderes Timeframe als beim Erkennen)", () => {
    const pinned = [{ type: "bearish", fromTime: 150, toTime: 300 }]; // 150 ist keine geladene Kerzenzeit
    expect(mergePinnedDivergences([], pinned, candles)).toEqual([]);
  });
});
