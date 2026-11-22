import { computed, shallowRef, watch } from 'vue';
import { fetchInitialCandles } from '../forexCandles.js';
import { fetchCandlesCached } from '../candleCache.js';
import { latestKnownDailyPivot } from '../tradeSetup2Anchors.js';

// Strukturstart für "Start ab 1D-Pivot": live der neueste persistierte Pivot, im Replay der zum
// Replay-Zeitpunkt schon bekannte (vier D1-Schlüsse, wie LS-Reaktion) — sonst zeigt ein Replay einen
// Anker aus der Zukunft.
export function useDailyPivotStructureStart(pivots, symbol, replayUntil) {
  const daily = shallowRef([]);
  let revision = 0;
  watch([symbol, replayUntil], async ([instrument, at]) => {
    const ticket = ++revision;
    daily.value = [];
    if (at == null) return;
    try {
      const rows = await fetchCandlesCached(fetchInitialCandles, instrument, '1D', 200, at * 1000, 0);
      if (ticket === revision) daily.value = rows;
    } catch (error) {
      console.error('D1-Kerzen für den Replay-Strukturstart konnten nicht geladen werden:', error);
    }
  }, { immediate: true });
  return computed(() => {
    const own = pivots.value.filter(p => p.instrument === symbol.value && p.structureStartTime != null);
    const pivot = replayUntil.value == null
      ? own.sort((a, b) => b.pivotTime - a.pivotTime)[0]
      : latestKnownDailyPivot(own, daily.value, replayUntil.value);
    return pivot?.structureStartTime ?? null;
  });
}
