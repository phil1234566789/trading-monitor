import { onScopeDispose, shallowRef, watch } from 'vue';
import { activeM1Context, buildM1Structure } from '../m1Structure.js';
import { fetchInitialCandles } from '../forexCandles.js';
import { fetchCandlesCached } from '../candleCache.js';
import { nextCandlePollDelay } from '../candlePolling.js';
import { REPLAY_LOOKAHEAD_SEC } from '../timeframes.js';
import { markIgnored } from '../ignoredCandles.js';
import { renderLowerStructure } from '../structureOverlay.js';

export function usePriceChartM1Structure(props, checklistState, {
  fetchCached = fetchCandlesCached, now = () => Date.now(),
} = {}) {
  let series = null;
  let displayCandles = [];
  let rows = [];
  let context = null;
  let generation = 0;
  let timer;
  let disposed = false;
  const primitives = [];
  const markers = [];
  const status = shallowRef({ state: 'waiting', anchor: null, lastClosedAt: null });
  const evaluationTime = () => props.replayUntil == null ? Math.floor(now() / 1000) : context?.evaluatedAt;

  function render() {
    if (!series) return;
    const result = context && props.showM1Structure
      ? buildM1Structure(markIgnored(rows, context.instrument), context.anchor, evaluationTime(),
        props.m1StructurePeriod, props.m1Structure2Period) : null;
    renderLowerStructure(series, result, primitives, markers, displayCandles, {
      symbol: props.symbol, replayUntil: evaluationTime(), show: !!result,
      debug: !!result && props.showLiquidityDebug, barSeconds: 60,
    });
    if (result && status.value.state !== 'loading') status.value = { state: result.status, anchor: context.anchor,
      lastClosedAt: rows.findLast(c => c.time + 60 <= evaluationTime())?.time + 60 || null };
  }

  async function load() {
    if (disposed || !context) return;
    const ticket = generation;
    const source = context;
    try {
      const period = Math.max(props.m1StructurePeriod ?? 5, props.m1Structure2Period ?? 2);
      // Kalenderdistanz deckt die komplette Strecke ab; zusätzlicher Vorlauf enthält
      // auch vor Wochenend-Ankern genügend tatsächliche Fraktalkerzen.
      const count = Math.max(1, Math.ceil((evaluationTime() - source.anchor.pivotTime) / 60)) + period * 2 + 1;
      const fetched = await fetchCached(fetchInitialCandles, source.instrument, '1m', count,
        props.replayUntil == null ? undefined : source.evaluatedAt * 1000, REPLAY_LOOKAHEAD_SEC);
      if (disposed || ticket !== generation) return;
      rows = fetched;
      status.value = { ...status.value, state: 'loaded' };
      render();
    } catch (error) {
      if (disposed || ticket !== generation) return;
      status.value = { state: 'error', anchor: source.anchor, lastClosedAt: status.value.lastClosedAt };
      console.error('M1-Struktur konnte nicht geladen werden:', error);
    } finally {
      if (!disposed && ticket === generation && context && props.replayUntil == null) {
        clearTimeout(timer);
        timer = setTimeout(load, nextCandlePollDelay('1m', now()));
      }
    }
  }

  function updateContext() {
    const next = props.showM1Structure ? activeM1Context(checklistState.value) : null;
    // Unmittelbar auf Symbol-/Replaywechsel löschen, auch bevor die Checklist nachlädt.
    const valid = next?.instrument === props.symbol ? next : null;
    const identity = c => c ? `${c.instrument}:${c.setupKey}:${c.anchor.pivotTime}:${c.anchor.price}` : '';
    const changed = identity(valid) !== identity(context)
      || (props.replayUntil != null && valid?.evaluatedAt !== context?.evaluatedAt);
    context = valid;
    if (changed || !valid) {
      generation++;
      clearTimeout(timer);
      rows = [];
      status.value = { state: valid ? 'loading' : 'waiting', anchor: valid?.anchor ?? null, lastClosedAt: null };
      render();
      if (valid) void load();
    } else render();
  }

  watch([checklistState, () => props.showM1Structure], updateContext, { flush: 'sync' });
  watch(() => [props.symbol, props.replayUntil], () => {
    generation++; clearTimeout(timer); context = null; rows = [];
    status.value = { state: 'waiting', anchor: null, lastClosedAt: null }; render();
    // Der Checklist-Watcher läuft ebenfalls synchron; dessen neuen Stand danach übernehmen.
    updateContext();
  }, { flush: 'post' });
  watch(() => [props.m1StructurePeriod, props.m1Structure2Period], () => {
    generation++; clearTimeout(timer); rows = []; render(); if (context) void load();
  });
  watch(() => props.showLiquidityDebug, render);
  onScopeDispose(() => { disposed = true; generation++; clearTimeout(timer); series = null; });
  return { status,
    create(value) { series = value; updateContext(); },
    refresh(candles) { displayCandles = candles; render(); },
  };
}
