// R-Skala an der Dealing Range (PLAN-dr-statistik-ui.md, Stufe 1) — waagrechte Marken bei 2-10 R
// ab der nahen OB-Kante, damit am Chart ablesbar ist, wie weit eine Dealing Range schon gelaufen
// ist. Reine Geometrie aus Werten, die der Chart ohnehin hält (kein Server, keine Statistik — die
// historischen Quoten je Marke sind Stufe 2).
import { deriveSetupEntryInvalidation } from "./tradeSetup.js";
import { fromPips } from "./pipConfig.js";

// Kein 1 R — Philip 2026-09-20: "1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen."
export const R_SCALE_STEPS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
// Laut Strategie das Minimum, deshalb eigener Farb-/Breiten-Key (siehe chartColors.js: rScaleMinimum).
export const R_SCALE_MINIMUM = 3;
// Philip tradet mit gedeckeltem Stopp ("deckel bitte einbauen, auch in die R-Skala", 2026-09-20):
// ohne Deckel meint dieselbe "3 R" am Chart eine andere Pip-Strecke als in seiner Position. 6 statt
// 7 Pips, weil auf jeder R-Stufe gemessen besser. Noch enger wäre in der Messung noch besser, aber
// die Reihe hat keinen Boden — die Simulation kennt weder Spread noch Slippage, die Untergrenze
// kommt aus der Praxis, nicht aus den Daten.
export const STOPP_DECKEL_PIPS = 6;

const KEINE_SKALA = Object.freeze({ anchorPrice: null, levels: [], risk: 0, bandRisk: 0 });

// Liefert anchorPrice (Fußpunkt des Lineals) MIT den Marken, damit die Zeichnung ihn nicht selbst
// ein zweites Mal herleitet — sonst zeigen Fußpunkt und Marken auf zwei unabhängige Rechnungen.
//
// Zeichnet seit 2026-09-20 an JEDEM Setup. Davor war Path B ausgenommen, weil dort `fractal` aufs
// gesweepte Level statt aufs Extrem zeigte und die Marken damit falsch lagen — die Invalidierung
// kommt jetzt pfadunabhängig aus der fernen OB-Kante (siehe deriveSetupEntryInvalidation).
export function rScaleLevels(setup) {
  const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
  const bandRisk = Math.abs(invalidation - setupEntry);
  if (!(bandRisk > 0)) return KEINE_SKALA;
  const risk = Math.min(bandRisk, fromPips(STOPP_DECKEL_PIPS));
  const sign = setup.dir === 1 ? -1 : 1;
  // Beide Risiken wandern mit raus, damit die Quoten-Zuordnung (rScaleQuotes.js) nichts ein zweites
  // Mal aus den OB-Kanten herleitet: risk (gedeckelt) trägt die Geometrie, bandRisk (strukturell)
  // das Quoten-Band — der Deckel verschiebt nur den Stopp, nicht, wie weit die Range aufspannt.
  return {
    anchorPrice: setupEntry,
    risk,
    bandRisk,
    levels: R_SCALE_STEPS.map((r) => ({ r, price: setupEntry + sign * r * risk })),
  };
}
