// Berlin-Zeit-Helfer fürs Frontend (Pendant zu supabase/functions/_shared/berlinTime.ts) — alles,
// was einen Unix-Zeitpunkt auf einen Berliner Kalendertag/eine Berliner Uhrzeit abbildet. Bis zum
// 23.09.2026 lag das in dataExport.js, zusammen mit dem Copy/Paste-Backtest-Export; der ist mit
// seinem "Daten-Export"-Knopf entfallen (der MCP-Weg get_data_export hat ihn abgelöst), die
// Zeit-Helfer haben aber Nutzer quer durch die App.
const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" });
// "longOffset" liefert z.B. "GMT+2" — DST-aware statt fixem Offset, siehe CLAUDE.md
// "Trading-hours/timezone handling".
const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });
// "en-CA" liefert direkt das ISO-Format, ohne Teile manuell zusammenzusetzen.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

function berlinOffsetMinutes(utcMs) {
  const part = OFFSET_FORMATTER.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = part.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) * 60 : 0;
}

// Wandelt "YYYY-MM-DD" (als Berlin-Kalendertag gemeint) in UTC-ms-Grenzen [start, end) um. Offset
// wird an der Mitternachts-Guess-Zeit bestimmt — für den theoretischen Fall einer DST-Umstellung
// exakt um Mitternacht wäre das ungenau, kommt in Europe/Berlin aber nicht vor (Umstellung ist
// immer um 02:00/03:00).
export function berlinDayRangeUtcMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMin = berlinOffsetMinutes(utcGuess);
  const startUtcMs = utcGuess - offsetMin * 60_000;
  return { startUtcMs, endUtcMs: startUtcMs + 86_400_000 };
}

// Berlin-Kalendertag ("YYYY-MM-DD") eines Unix-Sekunden-Zeitpunkts.
export function berlinDateStrFor(unixSec) {
  return DATE_FORMATTER.format(new Date(unixSec * 1000));
}

// "YYYY-MM-DD HH:mm" (Europe/Berlin) — die Schreibweise, die datierte Chart-Annotationen nutzen
// (siehe annotations.js), also eindeutig auch über einen Tageswechsel hinweg.
export function formatDatedTime(unixSec) {
  return `${berlinDateStrFor(unixSec)} ${TIME_FORMATTER.format(new Date(unixSec * 1000))}`;
}
