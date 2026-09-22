import { fromPips } from "./pipConfig.js";
import { detectRsiDivergenceHistory } from "./rsi.js";
import { businessSecondsBetween } from "./chartTimeUtils.js";
import { classifyAge } from "./ageTier";
import { berlinDateStrFor } from "./dataExport.js";

// find_anti_confluences-Algorithmus, Browser-Kopie (Chat 2026-08-30) — bewusste FE/BE-
// Duplizierung wie findTargets.js/findTargetCandidates.js (siehe dortiger MCP-Server-Zwilling
// supabase/functions/trading-monitor-mcp/findAntiConfluenceCandidates.js für die volle
// Begründung/Bug-Historie der Regel). Zone = tiefstes Short-Target bis aktueller Preis (bzw.
// aktueller Preis bis höchstes Long-Target); Anti-Confluence = alles GEGENLÄUFIGE (bullisch gegen
// Short, bärisch gegen Long) in dieser Zone + unberührte gegenläufige OBs knapp jenseits der
// Invalidierung + gegenläufige Major/Medium-Inducements von heute, die als einzige Regel hier
// zonenfrei gilt (siehe isFreshCounterInducement).
export const MAX_HELD_OB_AGE_DAYS = 14;
export const MAX_INVALIDATION_OB_DISTANCE_PIPS = 10;
const DAY_SECONDS = 86400;
// Ein Inducement ist laut Handbuch ein LQ-Sweep auf 1H/4H (trading-Repo liquidität.md), M5 zählt nicht.
const INDUCEMENT_TIMEFRAMES = new Set(["1H", "4H"]);

function inBand(price, low, high) {
  return price >= low && price <= high;
}

function byDistance(getPrice, currentPrice) {
  return (a, b) => Math.abs(getPrice(a) - currentPrice) - Math.abs(getPrice(b) - currentPrice);
}

// zones: Rohformat wie poiZonesMetadata (dir/top/bottom/touched/invalidated/startTime/endTime/
// timeframe, siehe priceChartObZones.js: collectObsZones) — dieselbe Form wie bei
// findNearestObTargets in findTargets.js, hier aber ALLE (offenen UND gehaltenen) Zonen in der
// ganzen Zone statt nur der nächsten N.
export function findAntiConfluenceObCandidates(zones, { direction, zoneLow, zoneHigh, currentPrice, nowSec }) {
  const wantedDir = direction === "short" ? 1 : -1;
  return (zones ?? [])
    .filter((z) => z.dir === wantedDir && !z.invalidated)
    .map((z) => ({ ...z, edgePrice: direction === "short" ? z.top : z.bottom, held: z.touched }))
    .filter((z) => inBand(z.edgePrice, zoneLow, zoneHigh))
    .filter((z) => !z.held || (nowSec - z.endTime) / DAY_SECONDS <= MAX_HELD_OB_AGE_DAYS)
    .sort(byDistance((z) => z.edgePrice, currentPrice));
}

// levels: Rohformat wie usePriceChartLiquidity.js: getCurrentLiquidityLevels() (price/dir/
// pivotTime/touched/timeframe) — anders als der MCP-Zwilling (buildCandidatePool liefert
// direction: 'high'/'low') trägt das Frontend-Rohformat `dir` (1|-1), siehe findTargets.js.
export function findAntiConfluenceSweepCandidates(levels, { direction, zoneLow, zoneHigh, currentPrice, nowSec }) {
  const wantedLevelDir = direction === "short" ? -1 : 1;
  return (levels ?? [])
    .filter((l) => l.dir === wantedLevelDir && l.touched)
    .filter((l) => inBand(l.price, zoneLow, zoneHigh) || isFreshCounterInducement(l, nowSec))
    .sort(byDistance((l) => l.price, currentPrice));
}

// Zonenfreie Zusatzregel (Philip 22.09.2026, EURUSD-Short: gesweeptes 1H-Low 1,14339 fehlte in der
// Lupe, Zone begann erst bei 1,14378). Die Zonen-Regel ist von find_targets geerbt und fragt "was
// liegt noch VOR mir" — ein Inducement ist aber ein bereits gelaufener Sweep und liegt damit immer
// am Extrem der bisherigen Bewegung, also jenseits des eigenen Ziels, sobald der Preis dort schon
// tiefer (bzw. höher) war. Diese Fallklasse konnte die Zonen-Regel strukturell nie finden.
// liquidität.md#regel--kein-trade-gegen-einen-kraftvollen-major-inducement fragt selbst nirgends
// nach der Ziel-Zone. Minor bleibt bewusst zonengebunden — sonst zählt jedes heute entstandene und
// gleich wieder abgeräumte Level als Gegenargument.
export function isFreshCounterInducement(level, nowSec) {
  if (nowSec == null || level.touchedTime == null || level.pivotTime == null) return false;
  if (!INDUCEMENT_TIMEFRAMES.has(level.timeframe?.toUpperCase())) return false;
  if (berlinDateStrFor(level.touchedTime) !== berlinDateStrFor(nowSec)) return false;
  return classifyAge(businessSecondsBetween(level.pivotTime, level.touchedTime)) !== "minor";
}

// divergences: Rohformat wie rsi.js: detectRsiDivergenceHistory ({type, toPrice, ...}).
export function findAntiConfluenceDivergenceCandidates(divergences, { direction, zoneLow, zoneHigh, currentPrice }) {
  const wantedType = direction === "short" ? "bullish" : "bearish";
  return (divergences ?? [])
    .filter((d) => d.type === wantedType)
    .filter((d) => inBand(d.toPrice, zoneLow, zoneHigh))
    .sort(byDistance((d) => d.toPrice, currentPrice));
}

// Eigene, von der Ziel-Zone unabhängige Regel (Philip 2026-08-30): eine unberührte GEGENLÄUFIGE OB
// knapp jenseits der Invalidierung — bärisch über der Invalidierung bei Short, bullisch darunter
// bei Long.
export function findInvalidationObCandidates(zones, { direction, invalidation, maxPips = MAX_INVALIDATION_OB_DISTANCE_PIPS }) {
  if (invalidation == null) return [];
  const wantedDir = direction === "short" ? -1 : 1;
  const maxDistance = fromPips(maxPips);
  return (zones ?? [])
    .filter((z) => z.dir === wantedDir && !z.touched && !z.invalidated)
    .map((z) => ({ ...z, edgePrice: direction === "short" ? z.bottom : z.top }))
    .filter((z) => {
      const distance = direction === "short" ? z.edgePrice - invalidation : invalidation - z.edgePrice;
      return distance >= 0 && distance <= maxDistance;
    })
    .sort(byDistance((z) => z.edgePrice, invalidation));
}

// Reine Zusammenstellung (kein Fetch, anders als der MCP-Zwilling) — Aufrufer (PriceChart.vue)
// liefert bereits lokal vorhandene Rohdaten, siehe openAntiConfluencePicker.
export function findAntiConfluenceCandidates({ direction, zoneBoundPrice, currentPrice, invalidation, obZones, liquidityLevels, candles, nowSec }) {
  const zoneLow = direction === "short" ? zoneBoundPrice : currentPrice;
  const zoneHigh = direction === "short" ? currentPrice : zoneBoundPrice;
  const divergences = detectRsiDivergenceHistory(candles);
  return {
    obCandidates: findAntiConfluenceObCandidates(obZones, { direction, zoneLow, zoneHigh, currentPrice, nowSec }),
    sweepCandidates: findAntiConfluenceSweepCandidates(liquidityLevels, { direction, zoneLow, zoneHigh, currentPrice, nowSec }),
    divergenceCandidates: findAntiConfluenceDivergenceCandidates(divergences, { direction, zoneLow, zoneHigh, currentPrice }),
    invalidationObCandidates: findInvalidationObCandidates(obZones, { direction, invalidation }),
  };
}
