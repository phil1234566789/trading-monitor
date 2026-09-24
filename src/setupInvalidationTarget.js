import { deriveSetupEntryInvalidation } from "./tradeSetup.js";

export function setupInvalidationTarget(setup, levels, instrument) {
  const { invalidation } = deriveSetupEntryInvalidation(setup);
  const touches = (setup.sweeps ?? [{ level: setup.ls }])
    .map((s) => s.level?.touchedTime).filter(Number.isFinite);
  if (!touches.length) return null;
  const start = Math.min(...touches);
  // Der gesweepte Level (und bei Path B auch setup.fractal) ist NICHT das Extrem.
  // Nur einen echten M5-Pivot am unveränderten Invalidierungspreis im Sweep→OB-Fenster verknüpfen.
  const candidates = levels.filter((level) => level.dir === setup.dir &&
    level.price === invalidation && level.pivotTime >= start && level.pivotTime <= setup.obStartTime);
  const level = candidates.reduce((latest, item) => !latest || item.pivotTime > latest.pivotTime ? item : latest, null);
  if (!level) return null;
  return {
    kind: "pivot", instrument, timeframe: "5M", levelDirection: setup.dir === 1 ? "high" : "low",
    price: invalidation, sourceTime: level.pivotTime, touchedTime: level.touchedTime ?? null,
  };
}
