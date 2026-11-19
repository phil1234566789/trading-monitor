import { detectLiquidityLevels } from './liquidityDetection.js';
import { resolveStructureStartTime } from '../supabase/functions/_shared/resolveStructureStartTime.ts';

// Ein D1-P4-Pivot ist erst nach vier echten D1-Schlüssen bekannt; fehlen sie, ist er es noch nicht.
function dailyPivotKnownAt(daily, indices, pivotTime) {
  const later = daily[indices.get(pivotTime) + 4];
  return later ? later.time + 86400 : Infinity;
}

// Persistierte Pivots (daily_structure_pivots) kausal zum Zeitpunkt at, z. B. im Replay.
export function latestKnownDailyPivot(pivots, dailyCandles, at) {
  const daily = dailyCandles.slice().sort((a, b) => a.time - b.time);
  const indices = new Map(daily.map((c, i) => [c.time, i]));
  return pivots.filter(p => indices.has(p.pivotTime) && dailyPivotKnownAt(daily, indices, p.pivotTime) <= at)
    .sort((a, b) => b.pivotTime - a.pivotTime)[0] ?? null;
}

export function buildHistoricalDailyAnchors(dailyCandles, h1Candles) {
  const daily = dailyCandles.slice().sort((a, b) => a.time - b.time);
  const indices = new Map(daily.map((c, i) => [c.time, i]));
  const { highs, lows } = detectLiquidityLevels(daily, 4);
  // touched/endTime enthalten am Vollarchiv spätere Beobachtungen und gehören
  // deshalb niemals in den Anker. Bekannt wird er erst nach vier echten D1-Schlüssen.
  return [...highs, ...lows].map(level => {
    const pivot = { direction: level.dir === 1 ? 'high' : 'low', price: level.price, pivotTime: level.pivotTime };
    return { ...pivot, knownAt: dailyPivotKnownAt(daily, indices, level.pivotTime),
      structureStartTime: resolveStructureStartTime(pivot, h1Candles) };
  }).filter(p => p.structureStartTime != null).sort((a, b) => a.pivotTime - b.pivotTime);
}

export function historicalSettingsAt(settings, anchors, evaluatedAt) {
  const latest = anchors.findLast(p => p.knownAt <= evaluatedAt);
  return latest ? { ...settings, rangesFixedStartActive: true, rangesFixedStartTime: latest.structureStartTime } : null;
}
