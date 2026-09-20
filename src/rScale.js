// R-Skala an der Dealing Range (PLAN-dr-statistik-ui.md, Stufe 1) — waagrechte Marken bei 2-6 R
// ab der nahen OB-Kante, damit am Chart ablesbar ist, wie weit eine Dealing Range schon gelaufen
// ist. Reine Geometrie aus Werten, die der Chart ohnehin hält (kein Server, keine Statistik — die
// historischen Quoten je Marke sind Stufe 2).
import { deriveSetupEntryInvalidation } from "./tradeSetup.js";

// Kein 1 R — Philip 2026-09-20: "1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen."
export const R_SCALE_STEPS = [2, 3, 4, 5, 6];
// Laut Strategie das Minimum, deshalb eigener Farb-/Breiten-Key (siehe chartColors.js: rScaleMinimum).
export const R_SCALE_MINIMUM = 3;

const KEINE_SKALA = Object.freeze({ anchorPrice: null, levels: [] });

// Liefert anchorPrice (Fußpunkt des Lineals) MIT den Marken, damit die Zeichnung ihn nicht selbst
// ein zweites Mal herleitet — sonst zeigen Fußpunkt und Marken auf zwei unabhängige Rechnungen.
//
// Path B liefert kein echtes Invalidierungslevel: fractal ist dort auf ls gesetzt (siehe
// tradeSetup.js, detectTradeSetups) — das Risiko käme aus dem falschen Preis, die Skala zeichnete
// falsche Marken. Deshalb gar nicht erst zeichnen statt sie stillschweigend zu verschieben.
export function rScaleLevels(setup) {
  if (setup.pathType === "B") return KEINE_SKALA;
  // Bewusst nur setupEntry: das invalidation aus deriveSetupEntryInvalidation ist die ferne
  // OB-Kante (Journal-Definition), 1 R misst dagegen bis zum Extrem-Fraktal.
  const { setupEntry } = deriveSetupEntryInvalidation(setup);
  const risk = Math.abs(setup.fractal.price - setupEntry);
  if (!(risk > 0)) return KEINE_SKALA;
  const sign = setup.dir === 1 ? -1 : 1;
  return {
    anchorPrice: setupEntry,
    levels: R_SCALE_STEPS.map((r) => ({ r, price: setupEntry + sign * r * risk })),
  };
}
