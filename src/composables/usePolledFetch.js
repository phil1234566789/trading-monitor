import { ref, watch, onMounted, onUnmounted } from "vue";
import { useStatusBar } from "./useStatusBar.js";

// Generisches "fetch, dann alle intervalMs neu laden"-Composable — ersetzt die drei
// fast identischen Poll-Loops, die frueher in main.js (Trades, POI-Zonen) und
// protokoll.js (erreichte Zonen) dupliziert waren.
export function usePolledFetch(fetchFn, { intervalMs, onError = console.error, enabled = () => true } = {}) {
  const data = ref([]);
  const { markSuccess } = useStatusBar();
  let revision = 0;

  async function load() {
    if (!enabled()) return true;
    const ticket = ++revision;
    try {
      const rows = await fetchFn();
      if (ticket !== revision || !enabled()) return true;
      data.value = rows;
      markSuccess();
      return true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  let timer = null;
  watch(enabled, on => { if (on) void load(); else { revision++; data.value = []; } });
  onMounted(() => {
    load();
    if (intervalMs) timer = setInterval(load, intervalMs);
  });
  onUnmounted(() => {
    revision++;
    if (timer) clearInterval(timer);
  });

  return { data, refresh: load };
}
