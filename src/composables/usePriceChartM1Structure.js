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

export function usePriceChartM1Structure(props, checklistState, {
  fetchCached = fetchCandlesCached, now = () => Date.now(), prerequisitesAt = () => checklistState.value,
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
  const check = shallowRef(inactiveM1Checklist('prerequisites'));
  // Diese Obergrenze steuert nur den Abruf. Einen M1-Bewertungsstand liefert erst
  // die tatsächlich vorhandene geschlossene Kerze, auch bei Lücken und Wochenenden.
  const requestedUntil = () => Math.min(Math.floor(now() / 1000), props.replayUntil == null ? Infinity : props.replayUntil + 60);
  const evaluationTime = () => {
    const cutoff = closedReplayEvaluationTime(props.replayUntil, Math.floor(now() / 1000), rows, '1m');
    return closedChecklistCandles(rows, '1m', cutoff).at(-1)?.time + 60 || null;
  };

  function render() {
    if (!series) return;
    const evaluatedAt = evaluationTime();
    const prerequisites = props.showM1Structure ? prerequisitesAt(evaluatedAt ?? requestedUntil()) : null;
    const reason = !props.showM1Structure ? 'disabled' : m1PrerequisiteReason(prerequisites);
    const knownContext = !reason && evaluatedAt != null ? activeM1Context(prerequisites) : null;
    const marked = markIgnored(rows, props.symbol);
    const result = knownContext && props.showM1Structure
      ? buildM1Structure(marked, knownContext.anchor, evaluatedAt) : null;
    const missingClose = evaluatedAt != null && evaluatedAt < Math.floor(requestedUntil() / 60) * 60;
    let currentCheck;
    if (reason) currentCheck = inactiveM1Checklist(reason);
    else if (['loading', 'error'].includes(status.value.state)) currentCheck = inactiveM1Checklist(status.value.state);
    else if (missingClose || !result) currentCheck = inactiveM1Checklist('missing');
    else currentCheck = evaluateM1Checklist({ context: knownContext, structure: result, candles: marked, evaluatedAt });
    check.value = { ...currentCheck, evaluatedAt, instrument: props.symbol };
    renderLowerStructure(series, result, primitives, markers, displayCandles, {
      symbol: props.symbol, replayUntil: evaluationTime(), show: !!result,
      debug: !!result && props.showLiquidityDebug, barSeconds: 60,
    });
    if (result && !['loading', 'error'].includes(status.value.state)) {
      status.value = { state: result.status, anchor: knownContext.anchor, lastClosedAt: evaluatedAt };
    }
  }

  async function load() {
    if (disposed || !context) return;
    const ticket = generation;
    const source = context;
    try {
      // Kalenderdistanz deckt die komplette Strecke ab; zusätzlicher Vorlauf enthält
      // auch vor Wochenend-Ankern genügend tatsächliche Fraktalkerzen.
      const count = Math.max(1, Math.ceil((requestedUntil() - source.anchor.pivotTime) / 60)) + M1_STRUCTURE_PERIOD * 2 + 1;
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
    const next = props.showM1Structure ? activeM1Context(prerequisitesAt(requestedUntil())) : null;
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
  watch(() => props.showLiquidityDebug, render);
  onScopeDispose(() => { disposed = true; generation++; clearTimeout(timer); series = null; });
  return { status, check,
    create(value) { series = value; updateContext(); },
    refresh(candles) { displayCandles = candles; render(); },
  };
}
