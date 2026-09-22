import { ref, watch, onScopeDispose } from 'vue';

export function m5ClockState(nowMs, latestTime) {
  const now = Math.floor(nowMs / 1000);
  const boundary = Math.floor(now / 300) * 300;
  return {
    remaining: 300 - (now - boundary),
    expected: boundary - 300,
    latest: latestTime ?? null,
    missing: latestTime !== boundary - 300,
    sinceClose: now - boundary,
  };
}

export function useM5CandleClock({ enabled, getLatestTime, reload }) {
  const state = ref({ remaining: 300, status: 'loading', latest: null });
  let timer, generation = 0, busy = false, lastAttempt = -Infinity, attempts = 0, warned = false;

  function refresh() {
    const next = m5ClockState(Date.now(), getLatestTime());
    // Ein HTTP-Erfolg mit alten Kerzen ist kein Frische-Nachweis. Die Warnung bleibt
    // bis zum tatsächlichen Eintreffen der erwarteten Schlusskerze bestehen.
    if (!next.missing) warned = false;
    else if (next.sinceClose >= 60 && (attempts >= 2 || busy)) warned = true;
    const status = !next.missing ? 'current' : warned ? 'stale' : 'loading';
    state.value = { ...next, status, busy };
    if (!next.missing) attempts = 0;
    return next;
  }

  async function retry() {
    if (!enabled() || busy) return;
    const ownGeneration = generation;
    busy = true;
    lastAttempt = Date.now();
    attempts++;
    refresh();
    try { await reload(); } catch { /* Die sichtbare Warnung folgt dem tatsächlichen Kerzenstand. */ }
    finally {
      if (ownGeneration === generation) { busy = false; refresh(); }
    }
  }

  function tick() {
    const next = refresh();
    if (next.missing && Date.now() - lastAttempt >= 15_000) void retry();
  }

  watch(enabled, (active) => {
    clearInterval(timer);
    generation++;
    busy = false;
    attempts = 0;
    warned = false;
    lastAttempt = -Infinity;
    if (active) timer = setInterval(tick, 1000);
  }, { immediate: true });
  onScopeDispose(() => { clearInterval(timer); generation++; });
  return { state, retry };
}
