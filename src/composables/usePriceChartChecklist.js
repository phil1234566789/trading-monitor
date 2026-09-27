import { onScopeDispose, watch } from 'vue';
import { createChecklistDataAdapter } from '../tradeSetupChecklistData.js';
import { checklistEvaluationTime, evaluateTradeSetupChecklist } from '../tradeSetupChecklist.js';

export function usePriceChartChecklist(props, sessionConfigs, emit, now = () => Date.now() / 1000, timeData = {}) {
  const adapter = createChecklistDataAdapter();
  let disposed = false;
  let timeBoundaryTimer;
  const settings = () => ({
    rangesPeriod: props.rangesPeriod, ranges2Period: props.ranges2Period,
    rangesLookbackHours: props.rangesLookbackHours, ranges2LookbackHours: props.ranges2LookbackHours,
    rangesFixedStartActive: props.rangesFixedStartActive, rangesFixedStartTime: props.rangesFixedStartTime,
  });
  function refresh() {
    if (disposed || !props.showTradeSetupChecklist) return;
    const data = adapter.snapshot();
    const result = evaluateTradeSetupChecklist({
      instrument: props.symbol,
      evaluatedAt: checklistEvaluationTime(props.replayUntil, Math.floor(now())),
      h1Candles: data.h1.candles, m5Candles: data.m5.candles,
      dataStatus: data.status, settings: settings(), sessionConfigs,
      tradingWindows: timeData.tradingSchedules?.[props.symbol]?.tradingWindows,
      news: timeData.newsEvents,
      // Der manuell gepflegte Kalender besitzt bislang keinen Abdeckungsnachweis.
      newsCoverage: undefined,
    });
    emit('checklist-state-change', result);
    scheduleTimeBoundary();
  }
  function scheduleTimeBoundary() {
    clearTimeout(timeBoundaryTimer);
    if (disposed || !props.showTradeSetupChecklist || props.replayUntil != null) return;
    const at = now();
    // Session-/Handelsfenster wechseln an Minuten, News auch an sekundengenauen
    // Sperrgrenzen. Dieser Timer lädt keine Kerzen und ersetzt keinen vorhandenen Poll.
    const boundaries = (timeData.newsEvents ?? []).flatMap(event => [event.eventTime - 1800, event.eventTime + 900]);
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
  watch(() => [props.rangesPeriod, props.ranges2Period, props.showTradeSetupChecklist], () => { refresh(); scheduleTimeBoundary(); });
  watch(sessionConfigs, refresh, { deep: true });
  watch(() => [timeData.tradingSchedules, timeData.newsEvents], refresh, { deep: true });
  onScopeDispose(() => { disposed = true; clearTimeout(timeBoundaryTimer); adapter.reset(null); });
  return {
    begin(tf) { const ticket = adapter.begin(tf); refresh(); return ticket; },
    finish(ticket, response, candles) {
      if (!disposed && adapter.finish(ticket, response, candles)) refresh();
    },
    refresh,
  };
}
