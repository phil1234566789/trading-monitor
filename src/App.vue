<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useStatusBar } from "./composables/useStatusBar.js";
import { useHttpActivity } from "./composables/useHttpActivity.js";
import { useDrawings } from "./composables/useDrawings.js";
import HttpErrorBanners from "./components/HttpErrorBanners.vue";
import DrawingsModal from "./components/DrawingsModal.vue";
import ToggleButton from "./components/ui/ToggleButton.vue";
import { CHART_MODES, chartMode, chartHint } from "./chartModes.js";

const showDrawingsModal = ref(false);
// Persistiert in Supabase (siehe useDrawings.js/drawingsStore.js) — hier nur der
// Sichtbarkeits-Toggle nötig, die Liste selbst verwaltet DrawingsModal.vue direkt über
// dieselbe Composable.
const { visible: drawingsVisible } = useDrawings();

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
// Was der nächste Chart-Klick tut: der Hinweis des laufenden Modus, überschrieben von einem
// scharf gemachten Klick aus dem Dashboard (Target/Bestätigung/… an einem bestimmten Trade).
const activeHint = computed(() => chartHint.value ?? CHART_MODES.find((m) => m.id === chartMode.value)?.hint ?? null);
const lastUpdateText = computed(() =>
  lastSuccessAt.value == null ? "" : `Letztes Update: ${new Date(lastSuccessAt.value).toLocaleTimeString("de-DE")}`,
);
</script>

<template>
  <div class="app-shell">
    <header class="status-bar">
      <nav class="page-nav">
        <!-- exact-active-class statt active-class: "/" ist Praefix jeder Route, mit dem
             normalen (nicht-exakten) active-Matching waere "Dashboard" immer aktiv. -->
        <RouterLink to="/" exact-active-class="active">Dashboard</RouterLink>
        <RouterLink to="/protokoll" exact-active-class="active">Protokoll</RouterLink>
        <RouterLink to="/alarme" exact-active-class="active">Alarme</RouterLink>
        <RouterLink to="/handelszeiten" exact-active-class="active">Handelszeiten</RouterLink>
        <RouterLink to="/konten" exact-active-class="active">Konten</RouterLink>
        <RouterLink to="/loop-status" exact-active-class="active">Loop-Status</RouterLink>
        <RouterLink to="/trading-flow" exact-active-class="active">Ablauf</RouterLink>
      </nav>
      <!-- Verbindungsstatus mittig: page-nav und bar-right teilen sich den Rest je zur Hälfte
           (beide flex:1), damit die Mitte wirklich die Mitte ist und nicht bloß der Rest. -->
      <div class="bar-center">
        <span :class="statusDotClass"></span>
        <span>{{ statusText }}</span>
        <span v-if="isActive" class="http-activity" :title="activeLabels.join(', ')">
          <span class="http-spinner"></span>
          {{ activeLabels.join(", ") }}
        </span>
      </div>
      <div class="bar-right">
        <span class="last-update">{{ lastUpdateText }}</span>
        <span v-if="activeHint" class="chart-hint" :title="activeHint">{{ activeHint }}</span>
        <div class="mode-switcher" :class="{ armed: chartMode !== 'navigate' }">
          <ToggleButton
            v-for="mode in CHART_MODES"
            :key="mode.id"
            variant="bordered"
            :class="{ active: chartMode === mode.id }"
            :title="mode.title"
            @click="chartMode = mode.id"
          >
            {{ mode.label }}
          </ToggleButton>
        </div>
        <div class="toggle-group">
          <ToggleButton
            variant="bordered"
            class="drawings-btn"
            :class="{ active: drawingsVisible }"
            title="Zeichnungen im Chart an/aus"
            @click="drawingsVisible = !drawingsVisible"
          >
            🖍 Zeichnungen
          </ToggleButton>
          <ToggleButton variant="bordered" class="drawings-caret-btn" title="Zeichnungen importieren/bearbeiten" @click="showDrawingsModal = true">
            ⚙
          </ToggleButton>
        </div>
      </div>
    </header>
    <HttpErrorBanners />
    <DrawingsModal v-if="showDrawingsModal" @close="showDrawingsModal = false" />
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

.bar-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.last-update {
  color: #787b86;
}

/* Amber wie bisher im Chart-Toolbar-Rahmen: ein aktiver Klick-Modus ändert, was ein Chart-Klick
   tut, und soll deshalb auffallen statt wie ein normaler Anzeige-Toggle auszusehen. */
.chart-hint {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 179, 0, 0.9);
}

.mode-switcher {
  flex: none;
  display: flex;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px;
}

.mode-switcher.armed {
  border-color: rgba(255, 179, 0, 0.6);
}

.mode-switcher.armed button.active {
  background: rgba(255, 179, 0, 0.9);
  border-color: rgba(255, 179, 0, 0.9);
  color: #131722;
}

.toggle-group {
  display: flex;
}

/* Die beiden bilden optisch EINEN Schalter (an/aus + Zahnrad), deshalb nur außen gerundet und
   ohne Trennkante in der Mitte. */
.bar-right .toggle-group .drawings-btn {
  border-radius: 4px 0 0 4px;
  border-right: none;
}

.bar-right .toggle-group .drawings-caret-btn {
  border-radius: 0 4px 4px 0;
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
  flex: 1;
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
