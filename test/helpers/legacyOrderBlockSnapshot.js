// Die eingefrorene Performance-Referenz kennt das neue Touch-Metadatum nicht.
// Alle bisherigen Detektionsfelder bleiben exakt verglichen; touchedTime hat eigene Lebenszyklus-Tests.
export const legacyOrderBlockSnapshot = zones => zones.map(({ touchedTime, ...zone }) => zone);
