import { ref, onMounted, onUnmounted } from "vue";
import { useStatusBar } from "./useStatusBar.js";

// Generisches "fetch, dann alle intervalMs neu laden"-Composable — ersetzt die drei
// fast identischen Poll-Loops, die frueher in main.js (Trades, POI-Zonen) und
// protokoll.js (erreichte Zonen) dupliziert waren.
export function usePolledFetch(fetchFn, { intervalMs, onError = console.error } = {}) {
  const data = ref([]);
  const { markSuccess } = useStatusBar();

  async function load() {
    try {
      data.value = await fetchFn();
      markSuccess();
    } catch (err) {
      onError(err);
    }
  }

  let timer = null;
  onMounted(() => {
    load();
    if (intervalMs) timer = setInterval(load, intervalMs);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { data, refresh: load };
}
