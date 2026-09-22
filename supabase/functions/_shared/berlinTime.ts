// Port der reinen Zeit-Helfer aus src/dataExport.js (berlinOffsetMinutes/berlinDayRangeUtcMs) —
// nur Intl.DateTimeFormat, keine Browser-Abhängigkeiten, deshalb unproblematisch 1:1 kopierbar.

const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });

export function berlinOffsetMinutes(utcMs: number): number {
  const part = OFFSET_FORMATTER.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = part.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) * 60 : 0;
}

export function berlinDayRangeUtcMs(dateStr: string): { startUtcMs: number; endUtcMs: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMin = berlinOffsetMinutes(utcGuess);
  const startUtcMs = utcGuess - offsetMin * 60_000;
  return { startUtcMs, endUtcMs: startUtcMs + 86_400_000 };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

export function berlinDateStrFor(unixSec: number): string {
  return DATE_FORMATTER.format(new Date(unixSec * 1000));
}

const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" });

// "YYYY-MM-DD HH:mm" — exakt das Format, das das time-Feld in claude_annotations akzeptiert (siehe
// DATED_TIME_RE in src/claudeAnnotations.js), damit post_chart_annotations diesen Zeitpunkt direkt
// verwenden kann, ohne selbst formatieren zu müssen.
export function berlinDateTimeStrFor(unixSec: number): string {
  return `${berlinDateStrFor(unixSec)} ${TIME_FORMATTER.format(new Date(unixSec * 1000))}`;
}
