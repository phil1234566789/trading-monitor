import { onScopeDispose, shallowRef, watch } from 'vue';
import { createSnapshotM1Reader } from '../tradeSetup2SnapshotIndicators.js';
import { fetchCandlesCached } from '../candleCache.js';
import { fetchInitialCandles } from '../forexCandles.js';

export function useSnapshotM1(props, snapshot, repository, fetchCandles = (symbol, count, at) =>
  fetchCandlesCached(fetchInitialCandles, symbol, '1m', count, (at - 60) * 1000, 0)) {
  const state = shallowRef({ result: null, message: '' });
  const read = createSnapshotM1Reader(repository, fetchCandles);
  let revision = 0;
  watch(() => [snapshot.value, props.showM1Structure, props.showLiquidityDebug, props.tradeSetup2RunId, props.currentBar], async () => {
    const ticket = ++revision, source = snapshot.value;
    state.value = { result: null, message: '' };
    if (!source || !props.showM1Structure || !props.showLiquidityDebug || !props.tradeSetup2RunId || !['1m', '5m'].includes(props.currentBar)) return;
    state.value = { result: null, message: 'M1-Ergänzung aus Archiv laden…' };
    try {
      const loaded = await read(props.tradeSetup2RunId, source);
      if (ticket === revision) state.value = loaded;
    } catch (error) {
      if (ticket === revision) state.value = { result: null, message: `M1-Ergänzung konnte nicht geladen werden: ${error.message}` };
    }
  }, { immediate: true, flush: 'sync' });
  // Gemeinsame Cache-Requests dürfen fertig werden; eine alte Auswahl darf jedoch
  // weder Linien noch Status in die neue Auswahl/den zurückgespulten Stand schreiben.
  onScopeDispose(() => { revision++; });
  return state;
}
