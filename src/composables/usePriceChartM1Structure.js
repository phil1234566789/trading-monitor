import { onScopeDispose, shallowRef, watch } from 'vue';
import { activeM1Context, buildM1Structure, m1PrerequisiteReason, M1_STRUCTURE_PERIOD } from '../m1Structure.js';
import { evaluateM1Checklist, inactiveM1Checklist } from '../m1Checklist.js';
import { fetchInitialCandles } from '../forexCandles.js';
import { fetchCandlesCached } from '../candleCache.js';
import { nextCandlePollDelay } from '../candlePolling.js';
import { REPLAY_LOOKAHEAD_SEC } from '../timeframes.js';
import { markIgnored } from '../ignoredCandles.js';
import { renderLowerStructure } from '../structureOverlay.js';
import { closedReplayEvaluationTime, closedChecklistCandles } from '../tradeSetupChecklistTimeBasis.js';
import { renderM1Entry } from '../m1EntryRendering.js';
import { afterBrowserPaint } from '../afterBrowserPaint.js';
import { createSetup2Entry } from '../tradeSetup2EntryGate.js';
import { ENTRY_MODEL_1_VERSION } from '../entryModel1Conditions.js';

export function usePriceChartM1Structure(props, checklistState, {
  fetchCached = fetchCandlesCached, now = () => Date.now(), prerequisitesAt = () => checklistState.value,
  evaluationHorizon, detailSelected = () => false,
} = {}) {
  let series = null;
  let displayCandles = [];
  let rows = [];
  let context = null;
  let requestedThrough = null;
  let generation = 0;
  let timer;
  let disposed = false;
  let cancelRender = () => {};
  const primitives = [];
  const markers = [];
  const entryPrimitives = [];
  const status = shallowRef({ state: 'waiting', anchor: null, lastClosedAt: null });
  const check = shallowRef(inactiveM1Checklist('prerequisites'));
  const enabled = () => props.showM1Structure && !detailSelected();
  // Der sichtbare Chart-Schluss gilt für A–I gemeinsam. Ein M5-Replay um 09:25
  // kennt 09:30; erst tatsächlich vorhandene M1-Kerzen belegen diesen Stand auch für I.
  const requestedUntil = evaluationHorizon ?? (() => closedReplayEvaluationTime(
    props.replayUntil, Math.floor(now() / 1000), displayCandles, props.currentBar));
  const evaluationTime = () => {
    return closedChecklistCandles(rows, '1m', requestedUntil()).at(-1)?.time + 60 || null;
  };

  function markUpdating() {
    check.value = { ...inactiveM1Checklist('loading'), instrument: props.symbol, updating: true };
  }
  function render() {
    cancelRender();
    if (!series) return;
    markUpdating();
    cancelRender = afterBrowserPaint(renderNow);
  }
  function renderNow() {
    if (disposed || !series) return;
    const evaluatedAt = evaluationTime();
    const prerequisites = enabled() ? prerequisitesAt(evaluatedAt ?? requestedUntil()) : null;
    const reason = !enabled() ? 'disabled' : m1PrerequisiteReason(prerequisites);
    const knownContext = !reason && evaluatedAt != null ? activeM1Context(prerequisites) : null;
    const marked = markIgnored(rows, props.symbol);
    const result = knownContext && props.showM1Structure && status.value.state !== 'loading'
      ? buildM1Structure(marked, knownContext.anchor, evaluatedAt) : null;
    const missingClose = evaluatedAt != null && evaluatedAt < Math.floor(requestedUntil() / 60) * 60;
    let currentCheck;
    if (reason) currentCheck = inactiveM1Checklist(reason);
    else if (['loading', 'error'].includes(status.value.state)) currentCheck = inactiveM1Checklist(status.value.state);
    else if (missingClose || !result) currentCheck = inactiveM1Checklist('missing');
    else currentCheck = evaluateM1Checklist({ context: knownContext, structure: result, candles: marked, evaluatedAt });
    if (currentCheck.entry?.entryModel === ENTRY_MODEL_1_VERSION) {
      const entry=currentCheck.entry;
      currentCheck={...currentCheck,entry:createSetup2Entry({...prerequisites.context,
        instrument:props.symbol,evaluatedAt:entry.recognizedAt},()=>entry)};
      if (!currentCheck.entry) currentCheck.entryBlockedReason='Handelszeiten, Session oder News sperren diesen Entry.';
    }
    check.value = { ...currentCheck, evaluatedAt, instrument: props.symbol,
      updating: !!checklistState.value?.updating || status.value.state === 'loading' };
    renderM1Entry(series, detailSelected() ? null : currentCheck.entry, entryPrimitives, displayCandles, props.currentBar);
    renderLowerStructure(series, result, primitives, markers, displayCandles, {
      symbol: props.symbol, replayUntil: evaluationTime(), show: !!result && !detailSelected(),
      debug: !!result && props.showLiquidityDebug && !detailSelected(), barSeconds: 60, timeframe: '1m',
    });
    if (result && !['loading', 'error'].includes(status.value.state)) {
      status.value = { state: result.status, anchor: knownContext.anchor, lastClosedAt: evaluatedAt };
    }
  }

  async function load() {
    if (disposed || !context) return;
    const ticket = generation;
    const source = context;
    status.value = { ...status.value, state: 'loading' };
    markUpdating();
    try {
      // Kalenderdistanz deckt die komplette Strecke ab; zusätzlicher Vorlauf enthält
      // auch vor Wochenend-Ankern genügend tatsächliche Fraktalkerzen.
      // Ein späterer Strukturanker darf den ersten Retest und Entry nicht abschneiden.
      const start = Math.min(source.anchor.pivotTime, source.primary.reactionRecognizedAt ?? source.anchor.pivotTime);
      const count = Math.max(1, Math.ceil((requestedUntil() - start) / 60)) + M1_STRUCTURE_PERIOD * 2 + 1;
      const fetched = await fetchCached(fetchInitialCandles, source.instrument, '1m', count,
        props.replayUntil == null ? undefined : requestedUntil() * 1000, REPLAY_LOOKAHEAD_SEC);
      if (disposed || ticket !== generation) return;
      rows = fetched;
      status.value = { ...status.value, state: 'loaded' };
      render();
    } catch (error) {
      if (disposed || ticket !== generation) return;
      status.value = { state: 'error', anchor: source.anchor, lastClosedAt: status.value.lastClosedAt };
      render();
      console.error('M1-Struktur konnte nicht geladen werden:', error);
    } finally {
      if (!disposed && ticket === generation && context && props.replayUntil == null) {
        clearTimeout(timer);
        timer = setTimeout(load, nextCandlePollDelay('1m', now()));
      }
    }
  }

  function updateContext() {
    const horizon = requestedUntil();
    const next = enabled() && Number.isFinite(horizon) ? activeM1Context(prerequisitesAt(horizon)) : null;
    // Unmittelbar auf Symbol-/Replaywechsel löschen, auch bevor die Checklist nachlädt.
    const valid = next?.instrument === props.symbol ? next : null;
    const identity = c => c ? `${c.instrument}:${c.setupKey}:${c.anchor.pivotTime}:${c.anchor.price}` : '';
    const changed = identity(valid) !== identity(context)
      || (props.replayUntil != null && (valid?.evaluatedAt !== context?.evaluatedAt || horizon !== requestedThrough));
    context = valid;
    requestedThrough = horizon;
    if (changed || !valid) {
      generation++;
      clearTimeout(timer);
      rows = [];
      status.value = { state: valid ? 'loading' : 'waiting', anchor: valid?.anchor ?? null, lastClosedAt: null };
      render();
      if (valid) void load();
    } else render();
  }

  watch([checklistState, enabled], updateContext, { flush: 'sync' });
  if (evaluationHorizon) watch(evaluationHorizon, updateContext, { flush: 'sync' });
  watch(() => [props.symbol, props.replayUntil], () => {
    generation++; clearTimeout(timer); context = null; rows = [];
    status.value = { state: 'waiting', anchor: null, lastClosedAt: null }; render();
    // Der Checklist-Watcher läuft ebenfalls synchron; dessen neuen Stand danach übernehmen.
    updateContext();
  }, { flush: 'post' });
  watch(() => props.showLiquidityDebug, render);
  onScopeDispose(() => {
    disposed = true; generation++; clearTimeout(timer); cancelRender();
    if (series) renderM1Entry(series, null, entryPrimitives, [], props.currentBar);
    series = null;
  });
  return { status, check,
    create(value) { series = value; updateContext(); },
    refresh(candles) { displayCandles = candles; updateContext(); },
  };
}
