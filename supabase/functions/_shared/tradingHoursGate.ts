// Reiner Handelszeit-Fenster-Check (Europe/Berlin, DST-aware) — extrahiert aus
// trading-monitor-mcp/pretradeGates.ts (die dortige evaluateTradingHoursGate ruft jetzt hierhin
// durch), damit trade_setup_outcome.ts (poi-watcher + Backfill-Script) dieselbe Logik nutzen kann,
// ohne über eine Funktionsgrenze hinweg aus trading-monitor-mcp zu importieren (siehe _shared/ als
// die einzige Cross-Function-Grenze in diesem Repo, jede Edge Function importiert sonst nur aus
// ihrem eigenen Ordner).

const BERLIN_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" });
const BERLIN_HM_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false });

export type WeekdayGroup = "weekday" | "saturday" | "sunday";

export interface TradingWindows {
  weekday: [number, number][];
  saturday: [number, number][];
  sunday: [number, number][];
}

// Minuten seit Mitternacht + Wochentags-Gruppe in Europe/Berlin — Konvention wie
// trading_schedules.trading_windows/alarm_windows (siehe Migration 20260725120000_trading_schedules.sql).
export function berlinWeekdayAndMinutes(unixSec: number): { weekdayGroup: WeekdayGroup; minutesOfDay: number } {
  const date = new Date(unixSec * 1000);
  const weekdayShort = BERLIN_WEEKDAY_FORMATTER.format(date); // "Mon".."Sun"
  const weekdayGroup: WeekdayGroup = weekdayShort === "Sat" ? "saturday" : weekdayShort === "Sun" ? "sunday" : "weekday";
  const [hh, mm] = BERLIN_HM_FORMATTER.format(date).split(":").map(Number);
  return { weekdayGroup, minutesOfDay: hh * 60 + mm };
}

// Fenster sind [von,bis) in Minuten seit Mitternacht, from inklusiv/to exklusiv.
export function isWithinTradingWindows(nowSec: number, tradingWindows: TradingWindows): boolean {
  const { weekdayGroup, minutesOfDay } = berlinWeekdayAndMinutes(nowSec);
  const windows = tradingWindows[weekdayGroup] ?? [];
  return windows.some(([from, to]) => minutesOfDay >= from && minutesOfDay < to);
}
