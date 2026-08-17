// Zentrale Pip-Größe für GBPUSD/EURUSD (Chat 2026-07-30) — vorher 3x unabhängig dupliziert:
// orderBlocks.js (PIP_SIZE), dataExport.js (PIP_SIZE), PriceChart.vue (TRADE_SETUP_PIP_SIZE).
// Alle drei importieren jetzt von hier, damit ein künftiger dritter FX-Pair mit anderer Pip-Größe
// nicht an drei Stellen einzeln nachgezogen werden muss. Siehe PIP-SETTINGS.md für die Übersicht
// aller Pip-/Pixel-Schwellwerte im Repo.
export const PIP_SIZE = 0.0001; // gilt für beide unterstützten FX-Paare (GBPUSD/EURUSD)

export function toPips(priceDiff) {
  return priceDiff / PIP_SIZE;
}

export function fromPips(pips) {
  return pips * PIP_SIZE;
}
