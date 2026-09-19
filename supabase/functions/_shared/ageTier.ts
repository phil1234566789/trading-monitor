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

// Wie lange das gesweepte Level (ls_pivot_time) schon bestand, BEVOR es tatsächlich gesweept wurde
// (ls_touched_time) — ein frisch entstandenes Level, das sofort fällt, gegen ein altes, das erst
// nach Tagen fällt. NICHT ls_touched_time->ob_start_time: das ist durch obMaxDelaySec
// (_shared/tradeSetup.ts) algorithmisch auf 60 Minuten gedeckelt und als Merkmal damit wirkungslos.
// Business-Stunden (Wochenende raus), damit derselbe Sweep im Chart-Label und im Telegram-Alarm
// dieselbe Klasse ergibt.
export function computeSweepAgeHours(lsTouchedTimeSec: number, lsPivotTimeSec: number): number {
  return businessSecondsBetween(lsPivotTimeSec, lsTouchedTimeSec) / 3600;
}
