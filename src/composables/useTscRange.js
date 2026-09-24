import { computed, ref, watch } from "vue";
import { fetchActiveTscRangeId, fetchDealingRangeCockpit } from "../trades.js";

export function useTscRange(instrument) {
  const rangeId = ref(null);
  const range = ref(null);
  const journalSelection = ref(null);
  const fromJournal = computed(() => journalSelection.value != null);
  const error = ref("");
  let request = 0;

  async function refresh() {
    const token = ++request;
    const id = rangeId.value;
    const loaded = id == null ? null : await fetchDealingRangeCockpit(id);
    if (token === request) range.value = loaded;
  }

  async function load() {
    const token = ++request;
    rangeId.value = null;
    range.value = null;
    error.value = "";
    try {
      const id = journalSelection.value?.id ?? await fetchActiveTscRangeId(instrument.value);
      const loaded = id == null ? null : await fetchDealingRangeCockpit(id);
      // Ein langsamer Symbolwechsel darf eine später geöffnete Journal-Range nicht ersetzen.
      if (token !== request) return;
      rangeId.value = loaded?.id ?? null;
      range.value = loaded;
      if (id != null && !loaded) error.value = "Dealing Range nicht mehr vorhanden.";
    } catch (cause) {
      if (token === request) error.value = `Dealing Range konnte nicht geladen werden: ${cause.message}`;
    }
  }

  watch(instrument, () => {
    if (journalSelection.value?.instrument !== instrument.value) journalSelection.value = null;
    void load();
  }, { immediate: true, flush: "sync" });

  async function openJournal(id, symbol) {
    journalSelection.value = { id, instrument: symbol };
    instrument.value = symbol;
    await load();
  }

  async function closeJournal() {
    journalSelection.value = null;
    await load();
  }

  return { rangeId, range, fromJournal, error, refresh, openJournal, closeJournal };
}
