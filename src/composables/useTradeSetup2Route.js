import { watch } from 'vue';

export function useTradeSetup2Route(query, state, symbols) {
  watch(query, q => {
    if (typeof q.setup2 !== 'string' || !q.setup2 || typeof q.run !== 'string' || !q.run) return;
    if (q.variant === 'wide' || q.variant === 'narrow' || q.variant === 'both') state.tradeSetup2Variant.value = q.variant==='both'?'':q.variant;
    if (symbols.includes(q.instrument)) state.currentSymbol.value = q.instrument;
    state.currentBar.value = q.bar === '1m' ? '1m' : '5m';
    const time = typeof q.replay === 'string' && q.replay.trim() ? Number(q.replay) : NaN;
    if (Number.isSafeInteger(time) && time > 0) {
      state.replayTime.value = time;
      state.replayActive.value = true;
    }
  }, { immediate: true });
}
