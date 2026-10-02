import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { fetchCandlesCached } from '../candleCache.js';
import { fetchInitialCandles } from '../forexCandles.js';
import { closedChecklistCandles } from '../tradeSetupChecklistTimeBasis.js';
import { markIgnoredCandles } from '../sessionOccurrences.js';
import { berlinOffsetMinutes } from '../berlinTime.js';
import { collectObsZones, filterHistorical } from '../priceChartObZones.js';
import { computeRangesPivots } from '../marketStructureAnalysis';
import { detectOrderBlocks } from '../orderBlocks.js';
import { obMinimum } from '../instrumentConfig.js';
import { supportsSnapshotIndicators } from '../tradeSetup2Configuration.js';
import { barSecondsFor } from '../timeframes.js';

export function useSnapshotIndicators(props, snapshot, repository, fetchCandles = (symbol, bar, at) =>
  fetchCandlesCached(fetchInitialCandles, symbol, bar, 1000, (at - barSecondsFor(bar)) * 1000, 0)) {
  const state = shallowRef({ zones: [], pivots: {}, message: '' });
  const requests = new Map();
  let revision = 0;
  watch(() => [snapshot.value, props.tradeSetup2RunId, props.currentBar, props.showObsM5, props.showObs1h,
    props.showObs4h, props.showHistoricalObs, props.showRanges, props.showM5Structure, props.showLiquidityDebug], async () => {
    const ticket = ++revision, source = snapshot.value;
    state.value = { zones: [], pivots: {}, message: '' };
    if (!source || !props.tradeSetup2RunId || !['1m', '5m'].includes(props.currentBar)) return;
    const bars = ['5m', '1h', '4h'].filter(bar => ({ '5m': props.showObsM5 || props.showM5Structure && props.showLiquidityDebug,
      '1h': props.showObs1h || props.showRanges && props.showLiquidityDebug, '4h': props.showObs4h })[bar]);
    if (!bars.length) return;
    state.value = { zones: [], pivots: {}, message: 'OBs und Debug-Pivots aus Archiv laden…' };
    const cached = (key, load) => {
      if (!requests.has(key)) {
        requests.set(key, load().catch(error => { requests.delete(key); throw error; }));
        if (requests.size > 24) requests.delete(requests.keys().next().value);
      }
      return requests.get(key);
    };
    try {
      const run = await cached(props.tradeSetup2RunId, () => repository.getRun(props.tradeSetup2RunId));
      if (ticket !== revision) return;
      const config = run?.configuration?.instruments?.find(c => c.instrument === source.instrument) ?? run?.configuration;
      if (config?.instrument !== source.instrument || !supportsSnapshotIndicators(config.setupVersion) || !Array.isArray(config.sessions)) {
        throw new Error('Gespeicherte Algorithmusversion oder Sessions fehlen.');
      }
      const frames = Object.fromEntries(await Promise.all(bars.map(async bar => {
        const rows = await cached(`${props.tradeSetup2RunId}:${source.knownAt}:${bar}`, () => fetchCandles(source.instrument, bar, source.knownAt));
        const closed = closedChecklistCandles(rows, bar, source.knownAt);
        const lastClose = closed.at(-1)?.time + barSecondsFor(bar);
        if (!closed.length || source.knownAt - lastClose >= barSecondsFor(bar)) throw new Error(`${bar}: aktuelles geschlossenes Archivfenster fehlt.`);
        return [bar, markIgnoredCandles(closed, config.sessions.filter(s => s.instrument === source.instrument), sec => berlinOffsetMinutes(sec * 1000))];
      })));
      if (ticket !== revision) return;
      // HTF-OBs aus damaligen Kerzen statt aus heute fortgeschriebenen DB-Zonen.
      const dbObZones = ['1h', '4h'].flatMap(bar => (frames[bar] ? detectOrderBlocks(frames[bar], bar === '1h' ? '1H' : '4H', false,
        obMinimum(source.instrument, bar === '1h' ? '1H' : '4H')).map(z => ({ ...z, instrument: source.instrument, timeframe: bar === '1h' ? '1H' : '4H' })) : []));
      const zones = filterHistorical(collectObsZones({ ...props, m5Candles: frames['5m'] ?? [], dbObZones,
        symbol: source.instrument, replayUntil: source.knownAt, price: null }), props.showHistoricalObs);
      const pivots = {};
      for (const bar of ['1h', '5m']) {
        if (!frames[bar]) continue;
        const candles = frames[bar].filter(c => !c.ignored);
        const outer = bar === '1h' ? config.rangesPeriod : config.m5StructurePeriod;
        const inner = bar === '1h' ? config.ranges2Period : config.m5Structure2Period;
        pivots[bar] = { pivotsOuter: computeRangesPivots(candles, outer ?? 5, -Infinity),
          pivotsInner: computeRangesPivots(candles, inner ?? 2, -Infinity) };
      }
      state.value = { zones, pivots, message: 'OBs und Debug-Pivots aus Archiv · bis zum gespeicherten Stand' };
    } catch (error) {
      if (ticket === revision) state.value = { zones: [], pivots: {}, message: `Indikator-Ergänzung nicht verfügbar: ${error.message}` };
    }
  }, { immediate: true, flush: 'sync' });
  onScopeDispose(() => { revision++; });
  return computed(() => state.value);
}
