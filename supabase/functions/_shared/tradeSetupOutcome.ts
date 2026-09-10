// Winrate-Backtest für trade_setups (milk-city-Task trade-setup-winrate-outcome-tracking-kriterien-
// filter, Chat 2026-09-05) — pro Setup wird EINMAL Entry/SL/TP berechnet und per Forward-Walk durch
// M5-Kerzen aufgelöst (win/loss/pending). Genutzt von poi-watcher (live, sobald ein neues Setup
// entsteht + bei jedem Tick zum Auflösen offener "pending"-Zeilen) und vom einmaligen Backfill-Script
// für den historischen Bestand — deshalb hier in _shared/ statt in einer der beiden Funktionen.

import { businessSecondsBetween } from "./ageTier.ts";

// Win-Definition (Philip 2026-09-05): 2,5 RR erreicht, SL max. 6 Pips — auch wenn die strukturelle
// Invalidierung (Gegenkante der M5-OB, siehe deriveEntryInvalidation) weiter weg liegt. sl_pips ist
// deshalb min(strukturelle Distanz, MAX_SL_PIPS), nie die volle OB-Höhe.
export const MAX_SL_PIPS = 6;
export const RR_TARGET = 2.5;

// Duplikat von PIP_SIZE (trading-monitor-mcp/pipConfig.js) statt Cross-Import — _shared/ ist die
// einzige Grenze, über die Edge Functions hinweg importieren (siehe poi-watcher/index.ts, das aus
// demselben Grund seine eigene lokale TRADE_SETUP_PIP_SIZE-Konstante führt statt pipConfig.js zu
// importieren). Gilt für beide unterstützten FX-Paare (GBPUSD/EURUSD).
export const PIP_SIZE = 0.0001;

export type SetupDirection = "short" | "long";

export interface OutcomeCandle {
  time: number; // Unix-Sekunden
  high: number;
  low: number;
}

// Entry/Invalidation-Formel — identisch zu deriveSetupEntryInvalidation in src/tradeIntake.js
// (Philips eigene Definition, siehe dortiger Kommentar): Short = OB-Unterkante Entry/Oberkante
// Invalidation, Long spiegelbildlich.
export function deriveEntryInvalidation(direction: SetupDirection, obTop: number, obBottom: number): { entry: number; invalidation: number } {
  return direction === "short" ? { entry: obBottom, invalidation: obTop } : { entry: obTop, invalidation: obBottom };
}

export interface SlTp {
  slPrice: number;
  tpPrice: number;
  slPips: number;
}

// slPips = min(strukturelle Entry->Invalidation-Distanz, MAX_SL_PIPS), tp = entry ± RR_TARGET * sl.
export function computeSlTp(direction: SetupDirection, entry: number, invalidation: number): SlTp {
  const structuralPips = Math.abs(entry - invalidation) / PIP_SIZE;
  const slPips = Math.min(structuralPips, MAX_SL_PIPS);
  const slDistance = slPips * PIP_SIZE;
  const tpDistance = RR_TARGET * slDistance;
  const slPrice = direction === "short" ? entry + slDistance : entry - slDistance;
  const tpPrice = direction === "short" ? entry - tpDistance : entry + tpDistance;
  return { slPrice, tpPrice, slPips };
}

export type SetupOutcome = "win" | "loss" | "pending";

export interface OutcomeResult {
  outcome: SetupOutcome;
  resolvedAt: number | null; // Unix-Sekunden der auflösenden Kerze, null bei pending
}

// Forward-Walk ab entryTimeSec (= ob_start_time, Setup gilt als sofort gefüllt) durch aufsteigend
// sortierte M5-Kerzen: was wird zuerst berührt, TP oder SL? Werden beide in derselben Kerze berührt
// (kein Tick-Datenzugriff für die exakte Innerhalb-Reihenfolge), zählt das konservativ als Loss statt
// die Winrate durch Bestcase-Annahmen zu schönen.
export function classifyOutcome(candles: OutcomeCandle[], direction: SetupDirection, entryTimeSec: number, slPrice: number, tpPrice: number): OutcomeResult {
  for (const candle of candles) {
    if (candle.time < entryTimeSec) continue;
    const hitSl = direction === "short" ? candle.high >= slPrice : candle.low <= slPrice;
    const hitTp = direction === "short" ? candle.low <= tpPrice : candle.high >= tpPrice;
    if (hitSl) return { outcome: "loss", resolvedAt: candle.time };
    if (hitTp) return { outcome: "win", resolvedAt: candle.time };
  }
  return { outcome: "pending", resolvedAt: null };
}

// Kriterium "Sweep-Alter": wie lange das gesweepte Level (ls_pivot_time) schon bestand, BEVOR es
// tatsächlich gesweept wurde (ls_touched_time) — ein frisch entstandenes Level, das sofort gesweept
// wird, vs. ein altes Level, das erst nach langer Zeit fällt. NICHT ls_touched_time->ob_start_time:
// das ist durch obMaxDelaySec (siehe _shared/tradeSetup.ts) algorithmisch auf max. 60 Minuten
// gedeckelt und damit als Kriterium wirkungslos (Backfill-Lauf 2026-09-05: 0 von 268 GBPUSD-Setups
// über 6h, weil strukturell unmöglich) — ls_pivot_time->ls_touched_time streut dagegen real (Median
// ~2h, Maximum >100 Tage bei Path B, siehe tradeSetup.ts-Kommentar "ls.pivotTime kann beliebig alt
// sein"). Rohwert statt festem Schwellwert, siehe Kopfkommentar der Migration.
// Business-Stunden (Wochenende raus), damit derselbe Sweep im Chart-Label und im Winrate-Filter
// dieselbe Klasse ergibt — siehe _shared/ageTier.ts.
export function computeSweepAgeHours(lsTouchedTimeSec: number, lsPivotTimeSec: number): number {
  return businessSecondsBetween(lsPivotTimeSec, lsTouchedTimeSec) / 3600;
}
