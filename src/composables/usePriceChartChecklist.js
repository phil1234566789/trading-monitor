import { onScopeDispose, shallowRef, watch } from 'vue';
import { createChecklistDataAdapter } from '../tradeSetupChecklistData.js';
import { checklistEvaluationTime, evaluateTradeSetupChecklist } from '../tradeSetupChecklist.js';

export function usePriceChartChecklist(props, sessionConfigs, emit, now = () => Date.now() / 1000, timeData = {}, statistics = null) {
  const adapter = createChecklistDataAdapter();
  const state = shallowRef(null);
  const enabled = () => props.showTradeSetupChecklist || props.showM1Structure;
  let disposed = false;
  let timeBoundaryTimer;
  let saveQueue = Promise.resolve();
  let revision = 0;
  let m1PrerequisiteCache;
  const settings = () => ({
    rangesPeriod: props.rangesPeriod, ranges2Period: props.ranges2Period,
    rangesLookbackHours: props.rangesLookbackHours, ranges2LookbackHours: props.ranges2LookbackHours,
    rangesFixedStartActive: props.rangesFixedStartActive, rangesFixedStartTime: props.rangesFixedStartTime,
    m5StructurePeriod: props.m5StructurePeriod, m5Structure2Period: props.m5Structure2Period,
  });
  function refresh() {
    if (disposed || !enabled()) { state.value = null; return; }
    const currentRevision = ++revision;
    const data = adapter.snapshot();
    const result = evaluateAt(checklistEvaluationTime(props.replayUntil, Math.floor(now()), data.m5.candles), data);
    state.value = result;
    emit('checklist-state-change', result);
    if (statistics && result.status === 'ready') {
      const savedSettings = settings();
      const savedSessions = JSON.parse(JSON.stringify(sessionConfigs));
      // Schreibantworten dürfen nach Symbol-/Replaywechsel keinen alten UI-Stand publizieren.
      saveQueue = saveQueue.catch(() => {}).then(() => statistics.save(result, savedSettings, savedSessions))
        .then(count => {
          if (!disposed && revision === currentRevision) emit('checklist-state-change', { ...result, statistics: { status: 'saved', count } });
        }).catch(error => {
          console.error('Checklist-Statistik konnte nicht gespeichert werden:', error);
          if (!disposed && revision === currentRevision) emit('checklist-state-change', { ...result, statistics: { status: 'error' } });
        });
    }
    scheduleTimeBoundary();
  }
  function evaluateAt(evaluatedAt, data) {
    return evaluateTradeSetupChecklist({
      instrument: props.symbol,
      evaluatedAt,
      h1Candles: data.h1.candles, m5Candles: data.m5.candles,
      dataStatus: data.status, settings: settings(), sessionConfigs,
      tradingWindows: timeData.tradingSchedules?.[props.symbol]?.tradingWindows,
      news: timeData.newsEvents,
      newsLoadStatus: timeData.newsCalendar?.status,
    });
  }
  function m1PrerequisitesAt(at) {
    const data = adapter.snapshot();
    // I darf nicht A–H vom späteren Replay-M5-Schluss übernehmen. Die Struktur-
    // Voraussetzungen ändern sich nur mit neuen M5/H1-Kerzen, nicht mit jedem M1-Poll.
    const cutoff = Number.isFinite(at) ? Math.floor(at / 300) * 300 : null;
    const key = JSON.stringify([props.symbol, cutoff, data.status, settings(), sessionConfigs]);
    if (m1PrerequisiteCache?.key !== key || m1PrerequisiteCache.h1 !== data.h1.candles || m1PrerequisiteCache.m5 !== data.m5.candles) {
      m1PrerequisiteCache = { key, h1: data.h1.candles, m5: data.m5.candles, result: evaluateAt(cutoff, data) };
    }
    return m1PrerequisiteCache.result;
  }
  function scheduleTimeBoundary() {
    clearTimeout(timeBoundaryTimer);
    if (disposed || !enabled() || props.replayUntil != null) return;
    const at = now();
    // Session-/Handelsfenster wechseln an Minuten, News auch an sekundengenauen
    // Sperrgrenzen. Dieser Timer lädt keine Kerzen und ersetzt keinen vorhandenen Poll.
    const boundaries = (timeData.newsEvents ?? []).flatMap(event => [event.eventTime - 1800, event.eventTime, event.eventTime + 900]);
    const next = Math.min(Math.floor(at / 60) * 60 + 60, ...boundaries.filter(t => t > at));
    timeBoundaryTimer = setTimeout(refresh, Math.max(1, (next - at) * 1000));
  }
  watch(() => [props.symbol, props.replayUntil], values => {
    adapter.reset(JSON.stringify(values));
    refresh();
  }, { immediate: true, flush: 'sync' });
  watch(() => [props.rangesLookbackHours, props.ranges2LookbackHours, props.rangesFixedStartActive, props.rangesFixedStartTime], () => {
    adapter.invalidate('h1');
    refresh();
  }, { flush: 'sync' });
  watch(() => [props.rangesPeriod, props.ranges2Period, props.m5StructurePeriod, props.m5Structure2Period, props.showTradeSetupChecklist, props.showM1Structure], () => { refresh(); scheduleTimeBoundary(); });
  watch(sessionConfigs, refresh, { deep: true });
  watch(() => [timeData.tradingSchedules, timeData.newsEvents, timeData.newsCalendar?.status], refresh, { deep: true });
  onScopeDispose(() => { disposed = true; clearTimeout(timeBoundaryTimer); adapter.reset(null); });
  return {
    state,
    m1PrerequisitesAt,
    begin(tf) { const ticket = adapter.begin(tf); refresh(); return ticket; },
    finish(ticket, response, candles) {
      if (!disposed && adapter.finish(ticket, response, candles)) refresh();
    },
    refresh,
  };
}
