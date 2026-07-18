<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useStatusBar } from "./composables/useStatusBar.js";
import { useHttpActivity } from "./composables/useHttpActivity.js";

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
      </nav>
      <span class="last-update">{{ lastUpdateText }}</span>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
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
