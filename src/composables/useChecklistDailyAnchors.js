import { shallowRef, watch, onScopeDispose } from 'vue';
import { fetchInitialCandles } from '../forexCandles.js';
import { fetchCandlesCached } from '../candleCache.js';
import { berlinDateStrFor } from '../berlinTime.js';

// Persistierte D1-Pivots haben keinen kausalen knownAt-Wert. Die vier echten
// D1-Schlüsse stammen deshalb aus dem Archiv, nicht aus created_at des Cronjobs.
export function useChecklistDailyAnchors(props, enabled, evaluationTime, refresh) {
  const candles = shallowRef([]), status = shallowRef('missing');
  let revision = 0;
  watch(() => {
    const at = evaluationTime();
    return enabled() && props.dbTradeSetups?.length && Number.isFinite(at)
      ? `${props.symbol}:${berlinDateStrFor(at)}` : null;
  }, async key => {
    const ticket = ++revision;
    candles.value = [];
    status.value = key ? 'loading' : 'missing';
    if (!key) return;
    const instrument = props.symbol, at = evaluationTime();
    refresh();
    try {
      const rows = await fetchCandlesCached(fetchInitialCandles, instrument, '1D', 200, at * 1000, 0);
      if (ticket !== revision) return;
      candles.value = rows;
      status.value = rows.length ? 'ready' : 'missing';
    } catch (error) {
      if (ticket !== revision) return;
      console.error('D1-Anker der Checkliste konnten nicht geladen werden:', error);
      status.value = 'error';
    }
    refresh();
  }, { immediate: true });
  onScopeDispose(() => { revision++; });
  return { candles, status };
}
