// Pip-Skala an der Dealing Range (PLAN-dr-statistik-ui.md) — Pendant zur R-Skala (rScale.js), nur
// in FESTEN Pip-Abständen ab der nahen OB-Kante statt in Vielfachen des Risikos. 15 Pips sind 15
// Pips, unabhängig davon, wie weit die Range aufgespannt ist; die R-Leiter beantwortet dieselbe
// Frage normiert am eigenen Risiko. Philip 2026-09-20 zur Aufteilung: "a) die DR ist eng, dann
// sinkt die Wahrscheinlichkeit für ne weite Strecke über 15 Pips. b) Weite DR, ok 61% Chance auf
// 15 pips, kann man mal wagen." — deshalb hängt die Quote hier am Risiko-Band, die Marke nicht.
import { scaleAnchor } from "./tradeSetup.js";
import { fromPips, toPips } from "./pipConfig.js";
import { pipQuote, labelMitQuote } from "./drQuoten.js";

// Deckungsgleich mit den Spalten von Tabelle 6 in drQuoten.js — eine Stufe ohne gemessene Quote
// wäre am Chart nur eine Zahl ohne Einordnung.
export const PIP_SCALE_STEPS = [10, 15, 20, 25, 30, 35, 40];
// TP1 liegt bei rund 15 Pips, deshalb eigener Farb-/Breiten-Key (siehe chartColors.js), analog zu
// R_SCALE_MINIMUM.
export const PIP_SCALE_HIGHLIGHT = 15;

const KEINE_SKALA = Object.freeze({ anchorPrice: null, levels: [], bandRisk: 0 });

// Anker und Richtung wie bei der R-Leiter (scaleAnchor), nur ohne Stopp-Deckel: hier skaliert
// nichts mit dem Risiko, der Deckel hätte also nichts zu deckeln. bandRisk wandert trotzdem mit
// raus — die Quote je Marke hängt am Risiko-Band der Range.
export function pipScaleLevels(setup) {
  const { anchorPrice, bandRisk, sign } = scaleAnchor(setup);
  if (!(bandRisk > 0)) return KEINE_SKALA;
  return {
    anchorPrice,
    bandRisk,
    levels: PIP_SCALE_STEPS.map((pips) => ({ pips, price: anchorPrice + sign * fromPips(pips) })),
  };
}

// Fertige Zeichen-Spec für scaleRendering.js, siehe rScaleSpec. side: -1, damit die Marken bei
// gleichzeitig eingeblendeter R-Leiter zur anderen Seite zeigen und sich die Labels nicht decken.
export function pipScaleSpec(setup, instrument) {
  const { anchorPrice, levels, bandRisk } = pipScaleLevels(setup);
  if (!levels.length) return null;
  const riskPips = toPips(bandRisk);
  return {
    startTime: setup.obStartTime,
    anchorPrice,
    axisStyleKey: "pipScale",
    side: -1,
    levels: levels.map(({ pips, price }) => ({
      price,
      styleKey: pips === PIP_SCALE_HIGHLIGHT ? "pipScaleHighlight" : "pipScale",
      // Mit "P"-Suffix, anders als die R-Leiter: beide können gleichzeitig sichtbar sein, und die
      // Zahlenräume überlappen (10 steht in beiden Leitern).
      label: labelMitQuote(`${pips} P`, pipQuote(instrument, riskPips, pips)),
    })),
  };
}
