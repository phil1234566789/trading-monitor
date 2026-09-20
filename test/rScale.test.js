import { describe, it, expect } from "vitest";
import { rScaleLevels, R_SCALE_STEPS } from "../src/rScale.js";

// Short: nahe OB-Kante = obBottom, Risiko = Abstand zur Invalidierung (obTop) darüber, Marken
// laufen nach UNTEN.
const shortSetup = { dir: 1, obTop: 1.32, obBottom: 1.3 };
// Long: nahe OB-Kante = obTop, Invalidierung ist obBottom, Marken laufen nach OBEN.
const longSetup = { dir: -1, obTop: 1.3, obBottom: 1.28 };

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

  it("zeichnet nichts bei Risiko 0 (beide OB-Kanten auf demselben Preis)", () => {
    expect(rScaleLevels({ ...shortSetup, obTop: shortSetup.obBottom }).levels).toEqual([]);
  });
});
