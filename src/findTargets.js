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

// OB-Kanten als zweite Kandidaten-Art (PLAN-find-targets.md: "OB-Kanten: Long -> Unterkante
// bärische OB, Short -> Oberkante bullische OB", Philip 2026-08-27: "nimm noch untouched OBs auf,
// die nähesten 2") — Ziel-Preis ist die dem aktuellen Preis ZUGEWANDTE Kante der jeweils
// GEGENLÄUFIGEN OB-Richtung: fällt der Preis auf eine bullische (Demand-)Zone darunter zu, wird
// zuerst deren Oberkante berührt; steigt er auf eine bärische (Supply-)Zone darüber zu, zuerst
// deren Unterkante — ein Short-Target braucht also bullische OBs (dir=1), ein Long-Target
// bärische (dir=-1), siehe orderBlocks.js/priceChartHitTest.js: matchOBZone für dieselbe
// dir===1->long-Konvention.
//
// zones: Rohformat wie PriceChart.vue: poiZonesMetadata (dir/top/bottom/startTime/timeframe/
// touched/invalidated, siehe priceChartObZones.js: collectObsZones). Rückgabe trägt zusätzlich
// targetPrice (die berechnete Kante), damit Aufrufer nicht dieselbe Long/Short-Fallunterscheidung
// ein zweites Mal nachbauen müssen.
export function findNearestObTargets(zones, { direction, currentPrice, limit = 2 }) {
  if (currentPrice == null) return [];
  const wantedDir = direction === "short" ? 1 : -1;
  const candidates = (zones ?? [])
    .filter((z) => !z.touched && !z.invalidated && z.dir === wantedDir)
    .map((z) => ({ zone: z, edgePrice: direction === "short" ? z.top : z.bottom }))
    .filter(({ edgePrice }) => (direction === "short" ? edgePrice < currentPrice : edgePrice > currentPrice));
  return candidates
    .sort((a, b) => Math.abs(a.edgePrice - currentPrice) - Math.abs(b.edgePrice - currentPrice))
    .slice(0, limit)
    .map(({ zone, edgePrice }) => ({ ...zone, targetPrice: edgePrice }));
}
