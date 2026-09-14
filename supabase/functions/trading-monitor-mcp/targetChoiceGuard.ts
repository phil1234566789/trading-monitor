// Guard für add_trade_target (Schritt 5, siehe 05-dealing-range-bestaetigen.md) — pure Logik,
// testbar ohne DB/Deno-Fetches.
//
// find_targets liefert seine Kandidaten bereits nach Abstand zum Kurs sortiert
// (findTargetCandidates.js: findNearestLiquidityTargets/findNearestObTargets), Position 0 ist damit
// die Antwort und der Rest nur Sicht aufs Umfeld. Die bisherige Regel dazu war aber eine reine
// MITGLIEDSCHAFTS-Prüfung ("jedes Target sollte einer der Kandidaten sein") — die besteht ein schon
// vorab gefasstes Ziel immer, solange es irgendwo in der Liste auftaucht, und je weiter weg vom
// Kurs, desto mehr Kandidaten bestehen sie. Genau deshalb wurde die Liste wiederholt nur zum
// Abnicken statt zum Auswählen benutzt (Philip, 15.09.2026: "das Target wurde schon mehrere Male
// falsch ausgewählt, das ist nicht der erste Testlauf"). Mechanik bewusst wie die
// checkedM5ObSetups/checkedHtfSweeps-Pflichtfelder von log_fall_classification: das Überspringen
// bleibt erlaubt, es wird nur nicht mehr still.

import { PIP_SIZE } from "./pipConfig.js";

// Dieselbe Schwelle wie findTargetCandidates.js' SAME_PRICE_EPSILON — der gewählte Preis selbst
// darf nicht als "näherer, übersprungener Kandidat" gegen sich selbst zählen.
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;

export interface TargetCandidatePrice {
  price: number;
  label: string;
}

// find_targets' zwei Arrays auf eine flache Preis-Liste bringen: liquidityCandidates tragen den
// Preis in `price`, obCandidates in `targetPrice` (die Zonenkante, siehe findNearestObTargets).
export function flattenTargetCandidates(result: {
  liquidityCandidates?: Array<Record<string, unknown>> | null;
  obCandidates?: Array<Record<string, unknown>> | null;
}): TargetCandidatePrice[] {
  const liquidity = (result.liquidityCandidates ?? []).map((c) => ({
    price: Number(c.price),
    label: `${formatPrice(Number(c.price))} (${c.timeframe ?? "?"}-${c.direction === "high" ? "Hoch" : "Tief"})`,
  }));
  const ob = (result.obCandidates ?? []).map((c) => ({
    price: Number(c.targetPrice),
    label: `${formatPrice(Number(c.targetPrice))} (${c.timeframe ?? "?"}-OB ${c.direction})`,
  }));
  return [...liquidity, ...ob].filter((c) => Number.isFinite(c.price));
}

function formatPrice(price: number): string {
  return price.toFixed(5);
}

// Zahlen aus den Begründungstexten ziehen, damit ein Kandidat als "genannt" gilt. Deutsches Komma
// wird mitgelesen — Lana schreibt Preise im Chat mal als 1,35528, mal als 1.35528.
function mentionedPrices(skippedCandidates: readonly string[]): number[] {
  return skippedCandidates
    .flatMap((entry) => entry.replace(/,/g, ".").match(/\d+\.\d+/g) ?? [])
    .map(Number)
    .filter(Number.isFinite);
}

// Kandidaten, die NÄHER am aktuellen Kurs liegen als der gewählte Preis und in keiner Begründung
// vorkommen. Leeres Ergebnis = entweder der nächste Kandidat gewählt, oder jeder übersprungene
// begründet.
export function findUnexplainedNearerTargets(
  candidates: readonly TargetCandidatePrice[],
  args: { price: number; currentPrice: number; skippedCandidates?: readonly string[] | null },
): TargetCandidatePrice[] {
  const chosenDistance = Math.abs(args.price - args.currentPrice);
  const nearer = candidates.filter((c) => {
    if (Math.abs(c.price - args.price) <= SAME_PRICE_EPSILON) return false; // der gewählte Kandidat selbst
    return Math.abs(c.price - args.currentPrice) < chosenDistance;
  });
  const mentioned = mentionedPrices(args.skippedCandidates ?? []);
  return nearer.filter((c) => !mentioned.some((m) => Math.abs(m - c.price) <= SAME_PRICE_EPSILON));
}

export function unexplainedNearerTargetsError(unexplained: readonly TargetCandidatePrice[], currentPrice: number): string {
  const list = unexplained
    .slice()
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .map((c) => c.label)
    .join(", ");
  return (
    `${unexplained.length} näher am Kurs (${formatPrice(currentPrice)}) liegende find_targets-Kandidaten übersprungen: ${list}. ` +
    `Entweder den nächstgelegenen Kandidaten als price nehmen, oder für JEDEN dieser Preise einen Grund in skippedCandidates ` +
    `angeben (z.B. "1.35528 = Hoch, kein Short-Ziel"). Kein Target ohne diese Auswahl — die Kandidatenliste ist nach Abstand ` +
    `sortiert, Position 0 ist die Default-Antwort.`
  );
}
