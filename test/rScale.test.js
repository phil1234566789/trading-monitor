import { describe, it, expect } from "vitest";
import { rScaleLevels, R_SCALE_STEPS } from "../src/rScale.js";

// Short: nahe OB-Kante = obBottom, Risiko = Abstand zum Fraktal darüber, Marken laufen nach UNTEN.
const shortSetup = { dir: 1, pathType: "A", obTop: 1.31, obBottom: 1.3, fractal: { price: 1.32 } };
// Long: nahe OB-Kante = obTop, Marken laufen nach OBEN.
const longSetup = { dir: -1, pathType: "A", obTop: 1.3, obBottom: 1.29, fractal: { price: 1.28 } };

describe("rScaleLevels", () => {
  it("misst Short ab der OB-Unterkante nach unten", () => {
    const { anchorPrice, levels } = rScaleLevels(shortSetup);
    expect(anchorPrice).toBeCloseTo(1.3, 10);
    expect(levels.map((l) => l.r)).toEqual(R_SCALE_STEPS);
    // Risiko = 1,32 - 1,30 = 0,02 -> 2 R liegt bei 1,30 - 0,04
    expect(levels[0].price).toBeCloseTo(1.26, 10);
    expect(levels[4].price).toBeCloseTo(1.18, 10);
  });

  it("misst Long ab der OB-Oberkante nach oben", () => {
    const { anchorPrice, levels } = rScaleLevels(longSetup);
    expect(anchorPrice).toBeCloseTo(1.3, 10);
    expect(levels[0].price).toBeCloseTo(1.34, 10);
    expect(levels[4].price).toBeCloseTo(1.42, 10);
  });

  // Bei Path B ist fractal auf ls gesetzt (siehe tradeSetup.js) — das Risiko käme aus dem falschen
  // Preis, die Skala zeichnete falsche Marken.
  it("zeichnet bei Path B gar nichts", () => {
    expect(rScaleLevels({ ...shortSetup, pathType: "B" }).levels).toEqual([]);
  });

  it("zeichnet nichts bei Risiko 0 (Fraktal genau auf der OB-Kante)", () => {
    expect(rScaleLevels({ ...shortSetup, fractal: { price: shortSetup.obBottom } }).levels).toEqual([]);
  });
});
