export function fmtPrice(n, precision = 2) {
  return n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: precision });
}

// Forex-Paare (GBPUSD/EURUSD) brauchen 5 Nachkommastellen, BTC-USDT 2 — siehe
// cfg.pricePrecision in supabase/functions/poi-watcher/index.ts (dieselbe Zuordnung).
export function pricePrecisionForInstrument(instrument) {
  return instrument === "BTC-USDT" ? 2 : 5;
}

// Akzeptiert sowohl Unix-Sekunden (Chart-Zeit) als auch ISO-Strings (direkt aus Supabase).
export function fmtDateTime(input) {
  if (input == null) return "–";
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Gleiches Muster wie newsMarkers.js: formatEventLabel — Wochentag-Kurzform ohne den von de-DE
// mitgelieferten Punkt ("Do." -> "Do"), Europe/Berlin wie der Rest der trading-hours-Logik.
const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" });

// "Do, 30.07.26" — für Tabellen, in denen nur das Datum (kein Zeitpunkt) relevant ist.
export function fmtDate(input) {
  if (input == null) return "–";
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  const weekday = WEEKDAY_SHORT_FORMATTER.format(d).replace(".", "");
  const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
  return `${weekday}, ${date}`;
}

// "11:05" — nur die Uhrzeit, ohne Sekunden.
export function fmtTime(input) {
  if (input == null) return "–";
  const d = typeof input === "number" ? new Date(input * 1000) : new Date(input);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function fmtR(r) {
  return r != null ? `${r >= 0 ? "+" : ""}${r.toFixed(2)}R` : "–";
}
