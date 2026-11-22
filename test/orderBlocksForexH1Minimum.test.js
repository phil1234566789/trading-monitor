// EURUSD 1H 20.11.2026: bullische FVG 05:00-Hoch 1,09810 bis 07:00-Tief 1,09823 = 1,3 Pip. Seit Philips Regel vom 22.11.
// (1H-Forex-Minimum 3 Pip) bildet sie keinen OB mehr; dieselbe Lücke auf 3,0 Pip schon. Alle drei Kopien, damit sie nicht auseinanderlaufen.
import { expect, it } from "vitest";
import { detectOrderBlocks as frontend } from "../src/orderBlockDetection.js";
import { detectOrderBlocks as backend } from "../supabase/functions/_shared/orderBlocks.ts";
import { detectOrderBlocks as mcp } from "../supabase/functions/trading-monitor-mcp/orderBlockDetection.js";

const t = (iso) => Date.parse(iso) / 1000;
const candles = [ // fxcm_candles EURUSD 1h, Zeiten UTC (Berlin +1)
  { time: t("2026-11-20T03:00:00Z"), open: 1.09705, high: 1.09769, low: 1.09686, close: 1.09755 },
  { time: t("2026-11-20T04:00:00Z"), open: 1.09755, high: 1.09799, low: 1.09737, close: 1.09799 },
  { time: t("2026-11-20T05:00:00Z"), open: 1.09799, high: 1.0981, low: 1.09751, close: 1.09779 },
  { time: t("2026-11-20T06:00:00Z"), open: 1.09779, high: 1.09886, low: 1.09776, close: 1.09847 },
  { time: t("2026-11-20T07:00:00Z"), open: 1.09847, high: 1.09896, low: 1.09823, close: 1.09836 },
];

const copies = [["frontend", frontend], ["backend", backend], ["mcp", mcp]];
it.each(copies)("%s: 1,3-Pip-FVG bildet auf 1H Forex keinen OB (Minimum 3 Pip)", (_, detect) => {
  expect(detect(candles, "1H", true)).toEqual([]);
});
it.each(copies)("%s: 3,0-Pip-FVG bildet auf 1H Forex einen bullischen OB", (_, detect) => {
  const wide = candles.map((c, i) => (i === 4 ? { ...c, low: 1.0984 } : c));
  const zones = detect(wide, "1H", true);
  expect(zones).toHaveLength(1);
  expect(zones[0]).toMatchObject({ dir: 1, top: 1.0981, bottom: 1.09776, startTime: t("2026-11-20T06:00:00Z") });
  expect(zones[0].fvg).toBeCloseTo(0.0003, 9);
});
