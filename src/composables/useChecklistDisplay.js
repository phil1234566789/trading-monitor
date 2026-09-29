import { computed, shallowRef, watch } from 'vue';

export function useChecklistDisplay(props) {
  const previous = shallowRef(null);
  const incoming = computed(() => props.checklistState?.instrument === props.instrument ? props.checklistState : null);
  const incomingM1 = computed(() => props.m1Check?.instrument === props.instrument ? props.m1Check : null);
  const busy = computed(() => !incoming.value || incoming.value.updating || incoming.value.status === 'loading'
    || incomingM1.value?.updating || incomingM1.value?.reason === 'loading');
  watch([incoming, incomingM1, busy, () => props.instrument], () => {
    if (previous.value?.state?.instrument !== props.instrument) previous.value = null;
    if (!busy.value) previous.value = { state: incoming.value, m1: incomingM1.value };
  }, { immediate: true, flush: 'sync' });
  // Nur die Anzeige behält den letzten Stand. Algorithmus und Chart bekommen
  // weiterhin sofort die entwerteten Daten beim Replay-/Symbolwechsel.
  const retained = computed(() => busy.value && previous.value?.state?.instrument === props.instrument ? previous.value : null);
  return { busy, retained, incoming,
    state: computed(() => retained.value?.state ?? incoming.value),
    m1: computed(() => retained.value ? retained.value.m1 : incomingM1.value),
  };
}
