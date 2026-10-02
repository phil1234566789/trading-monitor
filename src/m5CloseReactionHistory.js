import { collectNestedChain } from './marketStructureAnalysis';

// Historische Close-Prüfungen brauchen keine angewendeten Pivotlisten, Phasen oder
// kompletten Unterbäume. Nur Seed-Identität und damalige Schutzlevel bleiben erhalten.
export function closeReactionHistory(state) {
  return state ? collectNestedChain(state).map(level => {
    const relevantTimes = new Set(level.structurePivots
      .filter(p => ['protected-low', 'protected-high', 'LQ-sweep'].includes(p.type)).map(p => p.pivotTime));
    return {
    trend: level.trend,
    currRange: { high: { pivotTime: level.currRange.high?.pivotTime }, low: { pivotTime: level.currRange.low?.pivotTime } },
    nestedTrend: level.nestedTrend ? { appliedPivots: level.nestedTrend.appliedPivots?.slice(0, 2).map(p => ({ pivotTime: p.pivotTime })) } : null,
    // Bei gleichem Pivotzeitpunkt muss find() weiterhin den ersten Eintrag sehen.
    structurePivots: level.structurePivots.filter(p => relevantTimes.has(p.pivotTime))
      .map(p => ({ pivotTime: p.pivotTime, type: p.type, touched: p.touched ? { touchedTime: p.touched.touchedTime } : undefined })),
    };
  }) : [];
}

export function createCloseReactionCache(maxWeight = 100_000) {
  const entries = new Map();
  let weight = 0;
  return {
    get size() { return entries.size; },
    has: key => entries.has(key),
    get: key => entries.get(key)?.value,
    set(key, value) {
      const cost = Math.max(1, value.reduce((sum, level) => sum + 1 + level.structurePivots.length, 0));
      if (cost > maxWeight) return;
      if (entries.has(key)) { weight -= entries.get(key).cost; entries.delete(key); }
      // Begrenze gehaltene Datensätze statt 512 großer Bäume: sonst verdrängen
      // sich schon 700 benötigte Zustände bei jedem M5-Schritt vollständig.
      while (weight + cost > maxWeight && entries.size) {
        const oldest = entries.keys().next().value;
        weight -= entries.get(oldest).cost;
        entries.delete(oldest);
      }
      entries.set(key, { value, cost });
      weight += cost;
    },
  };
}
