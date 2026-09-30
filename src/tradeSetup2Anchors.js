import { detectLiquidityLevels } from './liquidityDetection.js';
import { resolveStructureStartTime } from '../supabase/functions/_shared/resolveStructureStartTime.ts';

export function buildHistoricalDailyAnchors(dailyCandles, h1Candles) {
  const daily = dailyCandles.slice().sort((a, b) => a.time - b.time);
  const indices = new Map(daily.map((c, i) => [c.time, i]));
  const { highs, lows } = detectLiquidityLevels(daily, 4);
  // touched/endTime enthalten am Vollarchiv spätere Beobachtungen und gehören
  // deshalb niemals in den Anker. Bekannt wird er erst nach vier echten D1-Schlüssen.
  return [...highs, ...lows].map(level => {
    const pivot = { direction: level.dir === 1 ? 'high' : 'low', price: level.price, pivotTime: level.pivotTime };
    return { ...pivot, knownAt: daily[indices.get(level.pivotTime) + 4].time + 86400,
      structureStartTime: resolveStructureStartTime(pivot, h1Candles) };
  }).filter(p => p.structureStartTime != null).sort((a, b) => a.pivotTime - b.pivotTime);
}

export function historicalSettingsAt(settings, anchors, evaluatedAt) {
  const latest = anchors.findLast(p => p.knownAt <= evaluatedAt);
  return latest ? { ...settings, rangesFixedStartActive: true, rangesFixedStartTime: latest.structureStartTime } : null;
}
