<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useStatusBar } from "./composables/useStatusBar.js";
import { useHttpActivity } from "./composables/useHttpActivity.js";
import { useClaudeAnnotations } from "./composables/useClaudeAnnotations.js";
import HttpErrorBanners from "./components/HttpErrorBanners.vue";
import DataExportModal from "./components/DataExportModal.vue";
import ClaudeAnnotationsModal from "./components/ClaudeAnnotationsModal.vue";

const showDataExport = ref(false);
const showClaudeAnnotationsModal = ref(false);
// Persistiert in Supabase (siehe useClaudeAnnotations.js/claudeAnnotationsStore.js) — hier nur der
// Sichtbarkeits-Toggle nötig, die Liste selbst verwaltet ClaudeAnnotationsModal.vue direkt über
// dieselbe Composable.
const { visible: claudeAnnotationsVisible } = useClaudeAnnotations();

const FRESH_MS = 30_000;

const { lastSuccessAt } = useStatusBar();
const { activeLabels, isActive } = useHttpActivity();
const now = ref(Date.now());

let timer = null;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));

const isFresh = computed(() => lastSuccessAt.value != null && now.value - lastSuccessAt.value < FRESH_MS);
const statusDotClass = computed(() => (lastSuccessAt.value == null ? "status-dot" : `status-dot ${isFresh.value ? "ok" : "dead"}`));
const statusText = computed(() => {
  if (lastSuccessAt.value == null) return "Verbinde...";
  return isFresh.value ? "Live" : "Verbindung tot";
});
const lastUpdateText = computed(() =>
  lastSuccessAt.value == null ? "" : `Letztes Update: ${new Date(lastSuccessAt.value).toLocaleTimeString("de-DE")}`,
);
</script>

<template>
  <div class="app-shell">
    <header class="status-bar">
      <span :class="statusDotClass"></span>
      <span>{{ statusText }}</span>
      <span v-if="isActive" class="http-activity" :title="activeLabels.join(', ')">
        <span class="http-spinner"></span>
        {{ activeLabels.join(", ") }}
      </span>
      <nav class="page-nav">
        <!-- exact-active-class statt active-class: "/" ist Praefix jeder Route, mit dem
             normalen (nicht-exakten) active-Matching waere "Dashboard" immer aktiv. -->
        <RouterLink to="/" exact-active-class="active">Dashboard</RouterLink>
        <RouterLink to="/protokoll" exact-active-class="active">Protokoll</RouterLink>
        <RouterLink to="/alarme" exact-active-class="active">Alarme</RouterLink>
        <RouterLink to="/handelszeiten" exact-active-class="active">Handelszeiten</RouterLink>
        <RouterLink to="/konten" exact-active-class="active">Konten</RouterLink>
      </nav>
      <span class="last-update">{{ lastUpdateText }}</span>
      <button class="data-export-btn" @click="showDataExport = true">📊 Daten-Export</button>
      <div class="toggle-group">
        <button
          class="claude-annotations-btn"
          :class="{ active: claudeAnnotationsVisible }"
          title="Claude-Notizen im Chart an/aus"
          @click="claudeAnnotationsVisible = !claudeAnnotationsVisible"
        >
          🖍 Claude-Notizen
        </button>
        <button class="claude-annotations-caret-btn" title="Claude-Notizen importieren/bearbeiten" @click="showClaudeAnnotationsModal = true">
          ⚙
        </button>
      </div>
    </header>
    <HttpErrorBanners />
    <DataExportModal v-if="showDataExport" @close="showDataExport = false" />
    <ClaudeAnnotationsModal v-if="showClaudeAnnotationsModal" @close="showClaudeAnnotationsModal = false" />
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  /* min-height statt height (Chat 2026-07-30, Bug-Report Philip: "je mehr Trades in der Liste,
     desto kleiner wird der Chart") — der Chart teilte sich mit dem Trades-Panel die exakt
     Viewport-hohe (100vh), nie scrollende Seite, siehe PriceChart.vue: .chart-wrapper hat jetzt
     eine eigene, feste Höhe statt flex:1. min-height lässt die Seite trotzdem wachsen und
     scrollen, sobald Chart + Trades-Panel zusammen mehr Platz brauchen als der Viewport hergibt —
     genau das wollte Philip ("die ganze Seite einfach nach unten hin scrollable machen"). */
  min-height: 100vh;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1e222d;
  border-bottom: 1px solid #2a2e39;
  font-size: 13px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #787b86;
  transition: background-color 0.2s ease;
}

.status-dot.ok {
  background: #26a69a;
}

.status-dot.dead {
  background: #ef5350;
}

.last-update {
  margin-left: auto;
  color: #787b86;
}

.data-export-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #787b86;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.data-export-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.toggle-group {
  display: flex;
}

.claude-annotations-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  border-radius: 4px 0 0 4px;
  border-right: none;
  color: #787b86;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
}

.claude-annotations-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.claude-annotations-btn.active {
  background: #2962ff;
  border-color: #2962ff;
  color: #fff;
}

.claude-annotations-caret-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  border-radius: 0 4px 4px 0;
  color: #787b86;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
}

.claude-annotations-caret-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.http-activity {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #787b86;
  max-width: 40vw;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.http-spinner {
  flex: none;
  width: 10px;
  height: 10px;
  border: 2px solid rgba(120, 123, 134, 0.35);
  border-top-color: #787b86;
  border-radius: 50%;
  animation: http-spin 0.8s linear infinite;
}

@keyframes http-spin {
  to {
    transform: rotate(360deg);
  }
}

.page-nav {
  display: flex;
  gap: 4px;
}

.page-nav a {
  color: #787b86;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.page-nav a:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.page-nav a.active {
  background: #2962ff;
  color: #fff;
}
</style>
