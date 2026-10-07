import { ref, computed, onMounted, onUnmounted } from "vue";
import { fetchAlgoWatcher, watcherHealth, watcherTooltip } from "../algoWatcher.js";

const report = ref(null);
const error = ref("");
const now = ref(Date.now());
let users = 0;
let pollTimer;
let clockTimer;
let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  try { report.value = await fetchAlgoWatcher(); error.value = ""; }
  catch (err) { error.value = err.message; }
  finally { loading = false; now.value = Date.now(); }
}
export function useAlgoWatcher() {
  onMounted(() => {
    if (users++ === 0) {
      void refresh();
      pollTimer = setInterval(refresh, 15000);
      clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
    }
  });
  onUnmounted(() => {
    if (--users === 0) { clearInterval(pollTimer); clearInterval(clockTimer); }
  });
  const health = computed(() => watcherHealth(report.value, now.value));
  const tooltip = computed(() => watcherTooltip(report.value, health.value));
  return { report, error, health, tooltip, refresh };
}
