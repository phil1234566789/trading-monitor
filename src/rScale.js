// R-Skala an der Dealing Range (PLAN-dr-statistik-ui.md, Stufe 1) — waagrechte Marken bei 2-6 R
// ab der nahen OB-Kante, damit am Chart ablesbar ist, wie weit eine Dealing Range schon gelaufen
// ist. Reine Geometrie aus Werten, die der Chart ohnehin hält (kein Server, keine Statistik — die
// historischen Quoten je Marke sind Stufe 2).
import { deriveSetupEntryInvalidation } from "./tradeSetup.js";

// Kein 1 R — Philip 2026-09-20: "1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen."
export const R_SCALE_STEPS = [2, 3, 4, 5, 6];
// Laut Strategie das Minimum, deshalb eigener Farb-/Breiten-Key (siehe chartColors.js: rScaleMinimum).
export const R_SCALE_MINIMUM = 3;

const KEINE_SKALA = Object.freeze({ anchorPrice: null, levels: [], risk: 0 });

// Liefert anchorPrice (Fußpunkt des Lineals) MIT den Marken, damit die Zeichnung ihn nicht selbst
// ein zweites Mal herleitet — sonst zeigen Fußpunkt und Marken auf zwei unabhängige Rechnungen.
//
// Zeichnet seit 2026-09-20 an JEDEM Setup. Davor war Path B ausgenommen, weil dort `fractal` aufs
// gesweepte Level statt aufs Extrem zeigte und die Marken damit falsch lagen — die Invalidierung
// kommt jetzt pfadunabhängig aus der fernen OB-Kante (siehe deriveSetupEntryInvalidation).
export function rScaleLevels(setup) {
  const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
  const risk = Math.abs(invalidation - setupEntry);
  if (!(risk > 0)) return KEINE_SKALA;
  const sign = setup.dir === 1 ? -1 : 1;
  // risk wandert mit raus, damit die Quoten-Zuordnung (rScaleQuotes.js) es nicht ein zweites Mal
  // aus den OB-Kanten herleiten muss.
  return {
    anchorPrice: setupEntry,
    risk,
    levels: R_SCALE_STEPS.map((r) => ({ r, price: setupEntry + sign * r * risk })),
  };
}
