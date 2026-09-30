// Abgeschlossene Ranges behalten ihren damaligen geschützten Wendepunkt.
// Live-Zeichnung und gespeicherte Belege verwenden dieselbe Punktfolge.
export function structureRangePath(range) {
  return range.middle ? [range.low,range.middle,range.high] : [range.low,range.high];
}
