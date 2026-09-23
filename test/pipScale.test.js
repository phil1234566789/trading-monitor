import { describe, it, expect } from "vitest";
import { pipScaleLevels, pipScaleSpec, PIP_SCALE_STEPS, PIP_SCALE_HIGHLIGHT } from "../src/pipScale.js";

// Short: nahe OB-Kante = obBottom, Marken laufen nach UNTEN. 4 Pips strukturelles Risiko.
const shortSetup = { dir: 1, obTop: 1.3004, obBottom: 1.3, obStartTime: 1000 };
// Long: nahe OB-Kante = obTop, Marken laufen nach OBEN.
const longSetup = { dir: -1, obTop: 1.3, obBottom: 1.2996, obStartTime: 1000 };

describe("pipScaleLevels", () => {
  it("misst Short ab der OB-Unterkante nach unten", () => {
    const { anchorPrice, levels } = pipScaleLevels(shortSetup);
    expect(anchorPrice).toBeCloseTo(1.3, 10);
    expect(levels.map((l) => l.pips)).toEqual(PIP_SCALE_STEPS);
    expect(levels[0].price).toBeCloseTo(1.299, 10);
    expect(levels.at(-1).price).toBeCloseTo(1.296, 10);
  });

  it("misst Long ab der OB-Oberkante nach oben", () => {
    const { levels } = pipScaleLevels(longSetup);
    expect(levels[0].price).toBeCloseTo(1.301, 10);
    expect(levels.at(-1).price).toBeCloseTo(1.304, 10);
  });

  // Der Unterschied zur R-Leiter: dort verschiebt ein weiteres Risiko-Band alle Marken, hier nicht.
  it("hält die Abstände unabhängig vom Risiko der Range", () => {
    const weitesSetup = { ...shortSetup, obTop: 1.32 };
    expect(pipScaleLevels(weitesSetup).levels.map((l) => l.price)).toEqual(
      pipScaleLevels(shortSetup).levels.map((l) => l.price),
    );
  });

  it("zeichnet nichts bei Risiko 0 (beide OB-Kanten auf demselben Preis)", () => {
    expect(pipScaleLevels({ ...shortSetup, obTop: shortSetup.obBottom }).levels).toEqual([]);
  });
});

describe("pipScaleSpec", () => {
  it("hängt die Quote des Risiko-Bands ans Label und hebt 15 P hervor", () => {
    const { levels, side, axisStyleKey } = pipScaleSpec(shortSetup, "GBPUSD");
    expect(axisStyleKey).toBe("pipScale");
    // Gegenseite zur R-Leiter, damit sich beide gleichzeitig nicht überzeichnen.
    expect(side).toBe(-1);
    const hervorgehoben = levels[PIP_SCALE_STEPS.indexOf(PIP_SCALE_HIGHLIGHT)];
    expect(hervorgehoben.styleKey).toBe("pipScaleHighlight");
    // 4 Pips Risiko -> Band "<= 5", dort 15 Pips = 49 % (drQuoten.js, Tabelle 6).
    expect(hervorgehoben.label).toBe("15 P – 49 %");
  });

  it("zeigt auf ungemessenem Instrument nur die Pip-Zahl", () => {
    const { levels } = pipScaleSpec(shortSetup, "EURUSD");
    expect(levels[0].label).toBe("10 P");
  });
});
