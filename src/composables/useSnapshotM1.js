import { shallowRef } from 'vue';
import {watchSnapshotOverlay} from './watchSnapshotOverlay.js';
import { createSnapshotM1Reader, snapshotOverlayTime } from '../tradeSetup2SnapshotIndicators.js';
import { fetchCandlesCached } from '../candleCache.js';
import { fetchInitialCandles } from '../forexCandles.js';

export function useSnapshotM1(props, snapshot, repository, fetchCandles = (symbol, count, at) =>
  fetchCandlesCached(fetchInitialCandles, symbol, '1m', count, (at - 60) * 1000, 0), evaluationTime = () => props.replayUntil) {
  const state = shallowRef({ result: null, message: '' });
  const read = createSnapshotM1Reader(repository, fetchCandles);
  watchSnapshotOverlay(() => [snapshot.value, evaluationTime(), props.showM1Structure, props.tradeSetup2RunId, props.currentBar],
    ()=>{state.value = { result: null, message: '' };},async signal => {
    const source = snapshot.value;
    if (!source || !props.showM1Structure || !props.tradeSetup2RunId || !['1m', '5m'].includes(props.currentBar)) return;
    state.value = { result: null, message: 'Historische M1-Kerzen laden und Struktur sowie Debug-Pivots berechnen …' };
    try {
      const loaded = await read(props.tradeSetup2RunId, source, snapshotOverlayTime(source, evaluationTime()),{signal});
      if (!signal.aborted) state.value = loaded;
    } catch (error) {
      if (!signal.aborted) state.value = { result: null, message: `M1-Ergänzung konnte nicht geladen werden: ${error.message}` };
    }
  });
  return state;
}
