// Zeitebenen, deren OBs poi-watcher in ob_zones pflegt (Erkennung, Touch, Invalidierung), höchste zuerst.
// Watcher, Replay-Rückrechnung, MCP und Chart lesen dieselbe Liste; M5/M1 bleiben Live-Recompute.
export const WATCHED_OB_TIMEFRAMES = ['4H', '1H', '15M'];

export function isWatchedObTimeframe(timeframe) {
  return WATCHED_OB_TIMEFRAMES.includes(timeframe);
}

// Bei (praktisch) gleicher Preisspanne gewinnt die höhere Zeitebene (4H vor 1H vor 15M).
// zones dürfen nur WATCHED_OB_TIMEFRAMES enthalten (fremde hätten Rang -1 und gewönnen immer).
export function dropLowerTimeframeDuplicates(zones, epsilon) {
  const rank = (tf) => WATCHED_OB_TIMEFRAMES.indexOf(tf);
  return zones.filter((z) => !zones.some((h) => rank(h.timeframe) < rank(z.timeframe) &&
    Math.abs(h.top - z.top) <= epsilon && Math.abs(h.bottom - z.bottom) <= epsilon));
}
