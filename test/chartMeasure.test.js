import { describe, expect, it } from "vitest";
import { formatPips, measureDrawing, MEASURE_COLOR } from "../src/chartMeasure.js";

// Reales Datum statt selbst geratener CEST/CET-Offsets (gleiches Vorgehen wie
// annotations.test.js) — 30.07.2026 09:00 Europe/Berlin, +45 Minuten.
const START_SEC = 1_785_394_800;
const END_SEC = START_SEC + 45 * 60;

describe("formatPips", () => {
  it("rechnet Preisdifferenz in Pips um, deutsches Dezimalkomma, eine Nachkommastelle", () => {
    expect(formatPips(0.00123)).toBe("12,3 Pips");
  });

  it("zeigt den Betrag — die Richtung steckt in der Strecke, nicht im Label", () => {
    expect(formatPips(-0.00123)).toBe("12,3 Pips");
  });
});

describe("measureDrawing", () => {
  it("baut eine line-Annotation mit datierten Berlin-Zeiten und Pip-Label", () => {
    const { title, annotations } = measureDrawing({ time: START_SEC, price: 1.345 }, { time: END_SEC, price: 1.34623 });
    expect(annotations).toEqual([
      {
        type: "line",
        from: { price: 1.345, time: "2026-07-30 09:00" },
        to: { price: 1.34623, time: "2026-07-30 09:45" },
        text: "12,3 Pips",
        color: MEASURE_COLOR,
      },
    ]);
    expect(title).toBe("📏 12,3 Pips · 2026-07-30 09:00");
  });
});
