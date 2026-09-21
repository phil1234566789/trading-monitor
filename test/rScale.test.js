import { describe, it, expect } from "vitest";
import { rScaleLevels, R_SCALE_STEPS, STOPP_DECKEL_PIPS } from "../src/rScale.js";
import { fromPips } from "../src/pipConfig.js";

// Short: nahe OB-Kante = obBottom, Risiko = Abstand zur Invalidierung (obTop) darüber, Marken
// laufen nach UNTEN. 4 Pips Risiko, also unter dem Deckel.
const shortSetup = { dir: 1, obTop: 1.3004, obBottom: 1.3 };
// Long: nahe OB-Kante = obTop, Invalidierung ist obBottom, Marken laufen nach OBEN.
const longSetup = { dir: -1, obTop: 1.3, obBottom: 1.2996 };
// 200 Pips strukturelles Risiko — weit über dem Deckel, die Marken rechnen gegen 6 Pips.
const weitesSetup = { dir: 1, obTop: 1.32, obBottom: 1.3 };

describe("rScaleLevels", () => {
  it("misst Short ab der OB-Unterkante nach unten", () => {
    const { anchorPrice, levels } = rScaleLevels(shortSetup);
    expect(anchorPrice).toBeCloseTo(1.3, 10);
    expect(levels.map((l) => l.r)).toEqual(R_SCALE_STEPS);
    // Risiko = 4 Pips -> 2 R liegt 8 Pips unter der Kante, 10 R 40 Pips.
    expect(levels[0].price).toBeCloseTo(1.2992, 10);
    expect(levels.at(-1).price).toBeCloseTo(1.296, 10);
  });

  it("misst Long ab der OB-Oberkante nach oben", () => {
    const { levels } = rScaleLevels(longSetup);
    expect(levels[0].price).toBeCloseTo(1.3008, 10);
    expect(levels.at(-1).price).toBeCloseTo(1.304, 10);
  });

  it("deckelt den Stopp, lässt das Band aber am strukturellen Risiko", () => {
    const { risk, bandRisk, levels } = rScaleLevels(weitesSetup);
    expect(risk).toBeCloseTo(fromPips(STOPP_DECKEL_PIPS), 10);
    expect(bandRisk).toBeCloseTo(0.02, 10);
    // 2 R = 12 Pips, 10 R = 60 Pips — für jede DR über dem Deckel dieselben Abstände.
    expect(levels[0].price).toBeCloseTo(1.2988, 10);
    expect(levels.at(-1).price).toBeCloseTo(1.294, 10);
  });

  it("zeichnet nichts bei Risiko 0 (beide OB-Kanten auf demselben Preis)", () => {
    expect(rScaleLevels({ ...shortSetup, obTop: shortSetup.obBottom }).levels).toEqual([]);
  });
});
