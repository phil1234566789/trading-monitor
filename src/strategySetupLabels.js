export const STRATEGY_SETUP_KEYS = ['setup1', 'setup3', 'setup4', 'continuation', 'unknown'];
export const STRATEGY_SETUP_LABELS = {
  setup1: 'Setup 1 mit LS',
  setup3: 'Setup 3 · Trendfortführung mit Break and Retest (meist ohne LS)',
  setup4: 'Setup 4 · Trendfortführung mit Orderflow',
  continuation: 'Trendfortführung · Setup offen',
  unknown: 'Setup nicht belegt',
  unclear: 'Setup unklar',
};

// Alte Journalwerte und Runmodelle bleiben lesbar; nur die sichtbare Taxonomie wird vereinigt.
export function normalizeStrategySetup(value) {
  if (value === 'countertrend' || value === 'setup2') return 'setup1';
  return value === 'trendContinuation' ? 'continuation' : value;
}
export function strategySetupLabel(value) {
  return STRATEGY_SETUP_LABELS[normalizeStrategySetup(value)] ?? STRATEGY_SETUP_LABELS.unknown;
}
