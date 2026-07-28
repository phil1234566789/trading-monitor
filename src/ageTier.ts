// Wiederverwendbare Alters-Einstufung für Pivots/Zonen (Chat 2026-07-28: "Diese Einstufung kannst
// du gleich typisiert/reusable/nachhaltig programmieren, wir werden das noch häufiger gebrauchen")
// — bewusst als eigenes, kleines, reines Modul, damit jede Stelle, die "wie alt/bedeutsam ist
// dieser Pivot" braucht (aktuell: Target-Labels/-Linien in TradesTable/TradeEditModal/PriceChart),
// dieselbe Einstufung nutzt statt eigener Schwellwerte.
//
// Nimmt bewusst bereits berechnete Business-Sekunden entgegen (siehe businessSecondsBetween in
// chartTimeUtils.js), nicht Zeitstempel direkt — Wochenenden sollen konsistent mit dem Rest der
// App (TSC-Alter, Liquiditäts-Debug-Labels) nicht mitzählen, das rechnet der Aufrufer schon vor.
export type AgeTier = "minor" | "medium" | "major";

const DAY_SECONDS = 24 * 60 * 60;
const WEEK_SECONDS = 7 * DAY_SECONDS;

// Philips Vorgabe (Chat 2026-07-28): < 1 Tag = minor, 1–7 Tage = medium, > 7 Tage = major.
export function classifyAge(businessSeconds: number): AgeTier {
  if (businessSeconds < DAY_SECONDS) return "minor";
  if (businessSeconds <= WEEK_SECONDS) return "medium";
  return "major";
}
