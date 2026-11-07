const continuationLabel = 'Trendfortführung · Setup offen';
export const STRATEGY_SETUP_KEYS = ['countertrend', 'setup2', 'setup3', 'setup4', 'continuation', 'unknown'];
export const STRATEGY_SETUP_LABELS = {
  countertrend: 'Setup 1 · Countertrend mit LS',
  setup2: 'Setup 2 · Trendfortführung mit LS',
  setup3: 'Setup 3 · Trendfortführung mit Break and Retest (meist ohne LS)',
  setup4: 'Setup 4 · Trendfortführung mit Orderflow',
  continuation: continuationLabel,
  trendContinuation: continuationLabel,
  unknown: 'Setup nicht belegt',
  unclear: 'Setup unklar',
};
