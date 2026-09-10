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

// Major-Grenze seit 2026-09-10 bei 5 Handelstagen statt 7 Tagen — mit dem Wochenendabzug oben
// dieselbe Kalenderwoche, jetzt deckungsgleich mit der Inducement-Definition des Handbuchs
// (trading-Repo, liquidität.md#inducement--klassifizierung-nach-alter). MUSS mit
// supabase/functions/_shared/ageTier.ts identisch bleiben, sonst weicht das Chart-Label wieder vom
// Winrate-Filter ab.
export const MINOR_MAX_SECONDS = DAY_SECONDS;
export const MAJOR_MIN_SECONDS = 5 * DAY_SECONDS;

export function classifyAge(businessSeconds: number): AgeTier {
  if (businessSeconds < MINOR_MAX_SECONDS) return "minor";
  if (businessSeconds < MAJOR_MIN_SECONDS) return "medium";
  return "major";
}
