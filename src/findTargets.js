import { PIP_SIZE } from "./pipConfig.js";

// find_targets-Algorithmus, erster Baustein (PLAN-find-targets.md) — reine, testbare Auswahl-
// Logik statt inline im TSC, weil sie laut Plan doppelt genutzt werden soll: hier fürs Chart/TSC,
// später von Lana (MCP) für Trade-Vorschläge selbst. Aktuell nur der einfachste Fall (Philip
// 2026-08-27, "nur für die Einfachheit"): die nächsten UNBERÜHRTEN LQ-Level auf der fürs Ziel
// gültigen Seite des aktuellen Preises (Long: Target > aktueller Preis, Short: Target < aktueller
// Preis, siehe Plan-Dokument). OB-Kanten als weitere Kandidaten-Art und die Trend/Countertrend-
// Unterscheidung (ein Target vs. geordnete Liste) folgen später — bisher wird immer eine sortierte
// Liste zurückgegeben.
//
// Alle Stellschrauben des Algorithmus als benannte Konstanten hier gebündelt (Philip 2026-08-27:
// "hast du die Konstanten schön in unserer Datei gelagert, wo die anderen Konstanten auch sind?")
// statt als Magic Numbers an den jeweiligen Aufrufstellen in PriceChart.vue.
export const DEFAULT_LIQUIDITY_TARGET_LIMIT = 5;
export const DEFAULT_OB_TARGET_LIMIT = 3;
export const MAX_TARGET_DISTANCE_PIPS = 50;

// levels: Rohformat wie usePriceChartLiquidity.js: getCurrentLiquidityLevels() liefert (price,
// dir, pivotTime, touched, timeframe, ...) — dieselben Objekte, aus denen PriceChart.vue:
// findClickedTarget bereits ein Pivot-Target baut, hier nur vorsortiert statt per Chart-Klick.
export function findNearestLiquidityTargets(levels, { direction, currentPrice, limit = DEFAULT_LIQUIDITY_TARGET_LIMIT }) {
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
//
// timeframe (optional, Philip 2026-08-27: "zusätzlich den nächsten 1h OB und den nächsten 4h OB")
// filtert VOR der Distanz-Sortierung auf eine einzelne Zeitebene — derselbe Aufruf deckt damit
// sowohl die allgemeine, zeitebenen-übergreifende Top-N-Liste (timeframe weggelassen) als auch
// "der nächste 1H-OB"/"der nächste 4H-OB" (timeframe gesetzt, limit: 1) ab.
export function findNearestObTargets(zones, { direction, currentPrice, limit = DEFAULT_OB_TARGET_LIMIT, timeframe = null }) {
  if (currentPrice == null) return [];
  const wantedDir = direction === "short" ? 1 : -1;
  const candidates = (zones ?? [])
    .filter((z) => !z.touched && !z.invalidated && z.dir === wantedDir)
    .filter((z) => timeframe == null || z.timeframe === timeframe)
    .map((z) => ({ zone: z, edgePrice: direction === "short" ? z.top : z.bottom }))
    .filter(({ edgePrice }) => (direction === "short" ? edgePrice < currentPrice : edgePrice > currentPrice));
  return candidates
    .sort((a, b) => Math.abs(a.edgePrice - currentPrice) - Math.abs(b.edgePrice - currentPrice))
    .slice(0, limit)
    .map(({ zone, edgePrice }) => ({ ...zone, targetPrice: edgePrice }));
}

// Distanz-Deckel (Philip 2026-08-27: "falls ein LQ-Level oder OB ... über 50 pips weit entfernt
// ist, dann disable sie in der Liste") — bewusst NICHT rausgefiltert, sondern nur als "zu weit"
// markierbar (siehe TargetPickerModal.vue: mergedCandidates), damit Philip auch einen weit
// entfernten, aber ansonsten passenden Kandidaten noch SIEHT (nur nicht versehentlich auswählt).
export function isTooFarFromPrice(price, currentPrice, maxPips = MAX_TARGET_DISTANCE_PIPS) {
  if (currentPrice == null) return false;
  return Math.abs(price - currentPrice) > maxPips * PIP_SIZE;
}
