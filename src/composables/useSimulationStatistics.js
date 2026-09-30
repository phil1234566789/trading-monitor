import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { simulationDateFilter } from '../tradeSetupSimulationStatistics.js';
import { useStatusBar } from './useStatusBar.js';

export function useSimulationStatistics(repository) {
  const { markSuccess } = useStatusBar();
  const runs = ref([]);
  const runId = ref('');
  const instrument = ref('');
  const variant = ref('wide');
  const from = ref('');
  const to = ref('');
  const rows = ref([]);
  const setups = ref([]);
  const loading = ref(false);
  const error = ref('');
  const selectedRun = computed(() => runs.value.find(run => run.id === runId.value) ?? null);
  let revision = 0;
  let timer;

  async function refresh() {
    const ticket = ++revision;
    loading.value = true;
    error.value = '';
    rows.value = [];
    setups.value = [];
    try {
      const bounds = simulationDateFilter(from.value, to.value);
      const available = await repository.listRuns();
      if (ticket !== revision) return;
      markSuccess();
      runs.value = available.toSorted((a, b) => (b.evaluatedAt ?? 0) - (a.evaluatedAt ?? 0) || a.id.localeCompare(b.id));
      const id = runId.value || runs.value[0]?.id;
      if (!id) return;
      if (!runId.value) {
        // Die Auswahl löst den Watcher aus; dieser lädt genau den gewählten Lauf.
        runId.value = id;
        return;
      }
      const [results, detected] = await Promise.all([
        repository.listResults({ runId: id, instrument: instrument.value || undefined, variant: variant.value, ...bounds }),
        repository.listSetups({ runId: id, instrument: instrument.value || undefined }),
      ]);
      if (ticket === revision) {
        rows.value = results.toSorted((a, b) => b.entryTime - a.entryTime || a.entryId.localeCompare(b.entryId));
        setups.value = detected;
      }
    } catch (cause) {
      if (ticket === revision) error.value = cause?.code === 'PGRST205'
        ? 'Die Simulationsdaten sind noch nicht verfügbar. Bitte später erneut versuchen.'
        : cause?.message || 'Die Statistik konnte nicht geladen werden.';
    } finally {
      if (ticket === revision) loading.value = false;
    }
  }

  watch([runId, instrument, variant, from, to], refresh);
  onMounted(() => {
    refresh();
    timer = setInterval(() => {
      if (!loading.value && selectedRun.value?.status === 'running') refresh();
    }, 15_000);
  });
  onUnmounted(() => { revision++; clearInterval(timer); });
  return { runs, runId, selectedRun, instrument, variant, from, to, rows, setups, loading, error, refresh };
}
