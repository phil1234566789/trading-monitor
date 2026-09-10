// Backend-Spiegel von src/ageTier.ts — dieselbe bewusste Cross-Runtime-Duplikation wie
// orderBlocks/liquidity/tradeSetup (siehe CLAUDE.md). Schwellen UND Wochenend-Regel müssen in
// beiden Dateien identisch bleiben: bis 2026-09-10 taten sie das nicht (Frontend 1d/7d auf
// Business-Sekunden, Backend 24h/120h auf Rohdauer), wodurch dasselbe Level im Chart "Medium" und
// im Winrate-Filter "Major" war.
export type AgeTier = "minor" | "medium" | "major";

const DAY_SECONDS = 24 * 60 * 60;

// Wochenenden zählen nicht mit (Forex steht still), deshalb entspricht "ab 5 Handelstagen" gerade
// einer vollen Kalenderwoche — Philip 2026-09-10: "wenn das WE rausgerechnet wird, dann ist major
// ab > 5d (also eine Woche)". Grenzen konsistent als [min,max), exakt 5 Handelstage ist also schon
// major (dieselbe Konvention wie die Minor-Grenze "< 1 Tag", und wie sie die DB-Filter in db.ts
// brauchen).
export const MINOR_MAX_SECONDS = DAY_SECONDS;
export const MAJOR_MIN_SECONDS = 5 * DAY_SECONDS;
export const MINOR_MAX_HOURS = MINOR_MAX_SECONDS / 3600;
export const MAJOR_MIN_HOURS = MAJOR_MIN_SECONDS / 3600;

// Zeichengleiche Portierung von businessSecondsBetween (src/chartTimeUtils.js) — Sa/So nach
// UTC-Kalendertag fallen komplett raus.
export function businessSecondsBetween(startSec: number, endSec: number): number {
  if (endSec == null || startSec == null || endSec <= startSec) return 0;
  let total = 0;
  let cursor = startSec;
  while (cursor < endSec) {
    const dayStart = Math.floor(cursor / DAY_SECONDS) * DAY_SECONDS;
    const segmentEnd = Math.min(dayStart + DAY_SECONDS, endSec);
    const isWeekend = [0, 6].includes(new Date(dayStart * 1000).getUTCDay());
    if (!isWeekend) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}

export function classifyAge(businessSeconds: number): AgeTier {
  if (businessSeconds < MINOR_MAX_SECONDS) return "minor";
  if (businessSeconds < MAJOR_MIN_SECONDS) return "medium";
  return "major";
}

// Ein Inducement ist fachlich genau dieses Alters-Tier des gesweepten Levels (trading-Repo,
// liquidität.md#inducement--klassifizierung-nach-alter) — eigener Name, aber keine eigene
// Einstufung. Stunden-Variante, weil trade_setup_outcomes.sweep_age_hours in Stunden liegt.
// Bewusste Näherung: das Handbuch definiert Inducements nur für H1/4H-Sweeps, hier wird
// timeframe-unabhängig gerechnet (trade_setups hält nicht fest, ob ls von H1 oder M5 kommt).
export type InducementClass = AgeTier;

export function classifyInducementAge(sweepAgeBusinessHours: number): InducementClass {
  return classifyAge(sweepAgeBusinessHours * 3600);
}

// Umkehrung von classifyInducementAge als [min,max)-Stundenbereich — für get_trade_setup_winrate,
// damit dort "minor"/"medium"/"major" statt roher Stundenwerte übergeben werden kann.
export function inducementAgeRange(cls: InducementClass): { minHours?: number; maxHours?: number } {
  if (cls === "minor") return { maxHours: MINOR_MAX_HOURS };
  if (cls === "medium") return { minHours: MINOR_MAX_HOURS, maxHours: MAJOR_MIN_HOURS };
  return { minHours: MAJOR_MIN_HOURS };
}
