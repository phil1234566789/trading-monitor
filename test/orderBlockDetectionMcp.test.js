// Regressionstest für die DRITTE, unabhängige Kopie von detectOrderBlocks (siehe Kopfkommentar in
// supabase/functions/trading-monitor-mcp/orderBlockDetection.js und src/orderBlockDetection.js:
// "ACHTUNG DRITTE KOPIE") — diese Kopie hatte den Wick-Invalidierungs-Fix vom 05.09.2026
// (test/orderBlocks.test.js) zunächst NICHT mitbekommen, weil dataExport.ts/get_data_snapshot aus
// dieser MCP-lokalen Datei importieren, nicht aus _shared/orderBlocks.ts. Bewusst dieselben
// Testfälle wie dort, damit ein künftiges Auseinanderdriften der drei Kopien sofort auffällt.
import { describe, expect, it } from "vitest";
import { detectOrderBlocks } from "../supabase/functions/trading-monitor-mcp/orderBlockDetection.js";

describe("detectOrderBlocks (MCP-lokale Kopie) — Invalidierung (Wick genügt, kein Kerzenschluss nötig)", () => {
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
