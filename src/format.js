export function fmtPrice(n) {
  return n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
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

export function fmtR(r) {
  return r != null ? `${r >= 0 ? "+" : ""}${r.toFixed(2)}R` : "–";
}
