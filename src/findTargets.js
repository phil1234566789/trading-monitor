// find_targets-Algorithmus, erster Baustein (PLAN-find-targets.md) — reine, testbare Auswahl-
// Logik statt inline im TSC, weil sie laut Plan doppelt genutzt werden soll: hier fürs Chart/TSC,
// später von Lana (MCP) für Trade-Vorschläge selbst. Aktuell nur der einfachste Fall (Philip
// 2026-08-27, "nur für die Einfachheit"): die nächsten UNBERÜHRTEN LQ-Level auf der fürs Ziel
// gültigen Seite des aktuellen Preises (Long: Target > aktueller Preis, Short: Target < aktueller
// Preis, siehe Plan-Dokument). OB-Kanten als weitere Kandidaten-Art und die Trend/Countertrend-
// Unterscheidung (ein Target vs. geordnete Liste) folgen später — bisher wird immer eine sortierte
// Liste zurückgegeben.
//
// levels: Rohformat wie usePriceChartLiquidity.js: getCurrentLiquidityLevels() liefert (price,
// dir, pivotTime, touched, timeframe, ...) — dieselben Objekte, aus denen PriceChart.vue:
// findClickedTarget bereits ein Pivot-Target baut, hier nur vorsortiert statt per Chart-Klick.
export function findNearestLiquidityTargets(levels, { direction, currentPrice, limit = 2 }) {
  if (currentPrice == null) return [];
  const onValidSide = (levels ?? []).filter((lvl) => (direction === "short" ? lvl.price < currentPrice : lvl.price > currentPrice));
  const untouched = onValidSide.filter((lvl) => !lvl.touched);
  return untouched
    .slice()
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, limit);
}
