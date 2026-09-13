// Baut das `kontext`-Label, das an jedem Liquidity-Level in get_data_export/
// get_near_relevant_liquidity_levels hängt ("NY-High Major (6d 18h)") — dieselbe Label-Formel wie am
// Chart (src/liquidity.js: formatLiquidityLevelLabel).
//
// Eigene Datei seit 2026-09-13: die Logik saß vorher in dataExport.ts und war dadurch aus Vitest
// nicht erreichbar (dataExport.ts zieht über forexCandles.ts einen Deno-`npm:`-Import). Ungetestet
// trug sie eine dritte, abweichende Kopie der Alters-Einstufung mit 7-Tage-Major-Schwelle statt 5
// und labelte jedes Level zwischen 5 und 7 Handelstagen als "Medium" statt "Major" — "Major" löst
// das Handelsverbot aus liquidität.md aus, "Medium" nicht.
import { businessSecondsBetween, classifyAge } from "../_shared/ageTier.ts";

function formatAgeShort(seconds: number): string | null {
  if (seconds < 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// Bug-Report Philip 2026-08-26, dritte Runde: "Alter bedeutet von Entstehungspunkt bis touched.
// Falls noch nie touched, dann halt eben bis jetzt. Das gilt überall so." — Port von
// ageReferenceTime (src/chartTimeUtils.js).
export function ageReferenceTime(touchedTimeSec: number | null, nowSec: number): number {
  return touchedTimeSec ?? nowSec;
}

// Sweep/High/Low-Typtext ist bewusst raus (Chat 2026-08-26, zweite Runde: "dann kann das label
// 'sweep|high|low' ja weg"), Alter als reines "(3h)" statt "(3h alt)". touchedTimeSec hat Vorrang
// vor nowSec für Einstufung UND Alter — ein vor Tagen gesweeptes Level soll nicht scheinbar
// unbegrenzt weiter altern, nur weil seither Zeit vergeht.
export function formatKontext(bonus: string | null, pivotTimeSec: number, touchedTimeSec: number | null, nowSec: number): string {
  const reference = ageReferenceTime(touchedTimeSec, nowSec);
  const businessSec = businessSecondsBetween(pivotTimeSec, reference);
  const tier = classifyAge(businessSec);
  const tierLabel = tier !== "minor" ? `${tier[0].toUpperCase()}${tier.slice(1)}` : null;
  const age = formatAgeShort(businessSec);
  const ageLabel = age ? `(${age})` : null;
  return [bonus, tierLabel, ageLabel].filter((p): p is string => p != null && p !== "").join(" ");
}
