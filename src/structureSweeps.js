import { collectNestedChain } from './marketStructureAnalysis';

export function structureSweepPivots(state) {
  return (state?.structurePivots ?? []).filter(p => p.type === 'LQ-sweep');
}

export function latestStructureSweeps(state, evaluatedAt, barSeconds) {
  const sweeps = collectNestedChain(state).flatMap(level => structureSweepPivots(level))
    .filter(p => Number.isFinite(p.price) && Number.isFinite(p.touched?.touchedTime)
      && p.touched.touchedTime + barSeconds <= evaluatedAt);
  const latest = Math.max(...sweeps.map(p => p.touched.touchedTime));
  // Nur der jüngste aktuell klassifizierte Sweep: keine Pflichtbedingung und keine
  // Historie. Mehrere in derselben Kerze getroffene Levels bleiben gleichberechtigt.
  return [...new Map(sweeps.filter(p => p.touched.touchedTime === latest)
    .map(p => [`${p.pivotTime}:${p.price}`, { price: p.price, pivotTime: p.pivotTime, candleTime: p.touched.touchedTime }])).values()];
}
