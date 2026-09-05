<script setup>
import { computed, nextTick, ref, watch } from "vue";
import mermaid from "mermaid";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { LOOP_INSTRUMENTS, fetchActiveLoopStates } from "../loopState.js";
import { buildMermaidSource } from "../tradingMachineGraph.js";

// State-Machine V2 (docs/state-machine.md#state-machine-v2, Philip 05.09.2026: "dieser
// Entscheidungsbaum soll auch in der UI angezeigt werden") — live gerenderter Mermaid-Graph des
// kompletten Schritt-1-8-Baums (tradingMachineGraph.js, Hand-Duplikat der Backend-Maschine
// tradingMachine.ts, siehe dortigen Kopfkommentar), aktueller Knoten je Instrument hervorgehoben.
// Separates Panel von LoopStatus.vue (das bleibt die Feld-/Log-Ansicht) — hier geht's nur um "wo im
// Baum stehen wir gerade".
mermaid.initialize({ startOnLoad: false, theme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "default", securityLevel: "loose" });

const REFRESH_MS = 8000;
const selectedInstrument = ref(LOOP_INSTRUMENTS[0]);
const graphContainer = ref(null);
const renderError = ref("");

const { data } = usePolledFetch(fetchActiveLoopStates, { intervalMs: REFRESH_MS });
const activeByInstrument = computed(() => (data.value instanceof Map ? data.value : new Map()));
const currentLoop = computed(() => activeByInstrument.value.get(selectedInstrument.value) ?? null);
const currentNode = computed(() => currentLoop.value?.currentNode ?? null);

let renderToken = 0;
async function renderGraph() {
  const token = ++renderToken;
  const source = buildMermaidSource(currentNode.value);
  try {
    const { svg } = await mermaid.render("trading-flow-graph", source);
    if (token !== renderToken || !graphContainer.value) return; // veraltete Antwort, Instrument/Knoten hat sich inzwischen weitergedreht
    graphContainer.value.innerHTML = svg;
    renderError.value = "";
  } catch (err) {
    renderError.value = "Graph konnte nicht gerendert werden: " + err.message;
  }
}

watch([selectedInstrument, currentNode], () => nextTick(renderGraph), { immediate: true });
</script>

<template>
  <div class="trading-flow-wrapper">
    <h2 class="trading-flow-title">Ablauf</h2>
    <p class="trading-flow-hint">
      Live-Ansicht des kompletten Schritt-1-8-Entscheidungsbaums (State-Machine V2,
      <code>tradingMachine.ts</code>) — der aktuelle Knoten ist blau hervorgehoben, orange Knoten
      sind dauerhaft Lanas Urteil (kein mechanischer Übergang). Aktualisiert alle
      {{ REFRESH_MS / 1000 }}s automatisch.
    </p>

    <div class="instrument-tabs">
      <button
        v-for="instrument in LOOP_INSTRUMENTS"
        :key="instrument"
        type="button"
        class="instrument-tab"
        :class="{ active: selectedInstrument === instrument }"
        @click="selectedInstrument = instrument"
      >
        {{ instrument }}
      </button>
    </div>

    <p v-if="!currentLoop" class="trading-flow-hint no-loop">Kein aktiver Loop für {{ selectedInstrument }}.</p>
    <p v-else-if="!currentNode" class="trading-flow-hint no-loop">
      Aktiver Loop, aber ohne Maschinen-Snapshot (vor State-Machine V2 angelegt) — einmalig
      run_bias_check erneut aufrufen.
    </p>
    <p v-else class="current-node-line">Aktueller Knoten: <code>{{ currentNode }}</code></p>

    <p v-if="renderError" class="trading-flow-error">{{ renderError }}</p>
    <div ref="graphContainer" class="graph-container"></div>
  </div>
</template>

<style scoped>
.trading-flow-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 24px;
}

.trading-flow-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.trading-flow-hint {
  font-size: 12px;
  color: #787b86;
  margin: 0 0 16px;
  max-width: 720px;
}

.trading-flow-hint code {
  color: #9aa0ac;
}

.instrument-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}

.instrument-tab {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.instrument-tab.active {
  color: #d1d4dc;
  border-color: #5b8dff;
  background: rgba(91, 141, 255, 0.12);
}

.no-loop {
  font-style: italic;
}

.current-node-line {
  font-size: 12.5px;
  color: #9aa0ac;
  margin: 0 0 14px;
}
.current-node-line code {
  color: #5b8dff;
}

.trading-flow-error {
  font-size: 13px;
  color: #ef5350;
}

.graph-container {
  overflow-x: auto;
}
.graph-container :deep(svg) {
  max-width: none;
}
</style>
