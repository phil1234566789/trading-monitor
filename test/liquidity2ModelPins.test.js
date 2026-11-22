import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { detectStrongLiquidityLevels } from "../src/liquidity2.js";

// LQ-Wache: Mustertrade-Pins (pin_context, chart_object_type 'liquidity2_ls', pin_type 'model') sind Spezifikation.
// Philip hat diese LS als handelbar markiert; jede künftige LQ-Variante muss sie weiter als starken LS erkennen.
// Wird hier etwas rot, ist das eine Frage an Philip, KEIN Test-Update (keinen Pin streichen, keine Fixture kürzen).
//
// Neuer Pin: Zeile in MODEL_PINS ergänzen und M5-Kerzen als test/fixtures/liquidity2/model-pins/<key mit _>.json
// ablegen (fxcm_candles, 12h vor dem Pivot bis 1h nach dem Sweep).
const MODEL_PINS = [
  { id: 623, key: "GBPUSD|5m|1|1795103700", note: "starkes LQ, wo man shorten kann" },
  { id: 624, key: "GBPUSD|5m|1|1795106700", note: "kann man auch shorten, aber vorsichtiger wegen MMM Session" },
  { id: 625, key: "GBPUSD|5m|1|1795013100", note: "auch nice zum shorten (DR #145, LH 18.11. 15:45)" },
  { id: 626, key: "GBPUSD|5m|1|1793906100", note: "hier kann man Asia Session shorten" },
  { id: 629, key: "GBPUSD|5m|1|1791800700", note: "auch gut zum shorten" },
];

// Pin-Schlüssel "INSTRUMENT|timeframe|dir|pivotTime" (chart_object_key) -> Testfall mit den passenden Kerzen.
export function modelPinCase(key) {
  const [instrument, timeframe, dir, pivotTime] = key.split("|");
  const file = new URL(`./fixtures/liquidity2/model-pins/${key.replaceAll("|", "_")}.json`, import.meta.url);
  return { instrument, timeframe, dir: Number(dir), pivotTime: Number(pivotTime), candles: JSON.parse(readFileSync(file, "utf8")) };
}

describe("LQ-Wache: Mustertrade-Pins liquidity2_ls bleiben starke LS", () => {
  it.each(MODEL_PINS)("Pin $id ($key): $note", ({ key }) => {
    const { instrument, dir, pivotTime, candles } = modelPinCase(key);
    const strong = detectStrongLiquidityLevels(candles, { instrument });
    expect(strong.some((l) => l.dir === dir && l.pivotTime === pivotTime), `LS ${key} wird nicht mehr als stark erkannt — Philip fragen, nicht den Test anpassen`).toBe(true);
  });
});
