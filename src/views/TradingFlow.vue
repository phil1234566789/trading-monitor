<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import mermaid from "mermaid";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { LOOP_INSTRUMENTS, fetchLoopStatesForDate } from "../loopState.js";
import { buildMermaidSource, getNextActionHint } from "../tradingMachineGraph.js";
import { berlinDateStrFor } from "../dataExport.js";

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

// Datumsauswahl (06.09.2026, Philip: "dann muss ich in der UI den Tag einstellen") — ein
// Replay-/Backtest-Lauf (check_pretrade_gates/run_bias_check mit replayUntilSec) schreibt auf das
// Replay-Datum, nicht auf heute; ohne Auswahl sieht man diese Zeile hier nie. Polling bleibt auch
// für vergangene Tage aktiv (einfacher als ein Sonderfall, Kosten sind eine kleine Query alle 8s).
// Geteilter localStorage-Key mit LoopStatus.vue (Philip 08.09.2026: "bei page reload nicht
// verlieren") — useLocalStorageRef cached pro Key eine gemeinsame reaktive ref, das gewählte Datum
// bleibt dadurch zwischen beiden Ansichten UND über Reloads hinweg synchron.
const todayStr = berlinDateStrFor(Math.floor(Date.now() / 1000));
const selectedDateStr = useLocalStorageRef("selectedDateStr", todayStr);
const isToday = computed(() => selectedDateStr.value === todayStr);

const { data, refresh } = usePolledFetch(() => fetchLoopStatesForDate(selectedDateStr.value), { intervalMs: REFRESH_MS });
watch(selectedDateStr, refresh);
const activeByInstrument = computed(() => (data.value instanceof Map ? data.value : new Map()));
const currentLoop = computed(() => activeByInstrument.value.get(selectedInstrument.value) ?? null);
const currentNode = computed(() => currentLoop.value?.currentNode ?? null);

// Live-Uhr (Berlin) zum Vergleich mit last_analysis_time_sec — Philip, 06.09.2026: "im Live Fall
// kann man jetzt die state-machine zeit ... mit der echten Uhrzeit vergleichen, so wie bei einem
// Timer". Sekunden-Genauigkeit unnötig fürs bloße Vergleichen, 1x/Minute reicht.
const berlinTimeFormatter = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const nowMs = ref(Date.now());
let nowTimer = null;
onMounted(() => { nowTimer = setInterval(() => { nowMs.value = Date.now(); }, 60000); });
onUnmounted(() => { if (nowTimer) clearInterval(nowTimer); });

const nowLabel = computed(() => berlinTimeFormatter.format(nowMs.value));
const lastAnalysisLabel = computed(() => {
  const sec = currentLoop.value?.lastAnalysisTimeSec;
  return sec ? berlinTimeFormatter.format(sec * 1000) : null;
});

// Wegweiser (06.09.2026, Philip: "wenn ich die State-Machine 'bedienen' kann ... dann wird Lana
// das wohl auch können") — Backend-Pendant get_next_action-Tool (dieselben hint-Texte, siehe
// tradingMachineGraph.js-Kopfkommentar). Testkriterium fürs Feature selbst: Philip soll allein aus
// dieser Anzeige den nächsten MCP-Aufruf ablesen können, ohne Code/Doku nachzuschlagen.
const nextAction = computed(() => getNextActionHint(currentNode.value));

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
      <input v-model="selectedDateStr" type="date" class="date-picker" />
      <button v-if="!isToday" type="button" class="instrument-tab" @click="selectedDateStr = todayStr">Heute</button>
    </div>

    <p v-if="!currentLoop" class="trading-flow-hint no-loop">Für {{ selectedInstrument }} an {{ selectedDateStr }} noch nichts initialisiert (check_pretrade_gates/run_bias_check).</p>
    <p v-else-if="!currentNode" class="trading-flow-hint no-loop">
      Zeile ohne Maschinen-Snapshot (vor State-Machine V2 angelegt) — einmalig
      run_bias_check erneut aufrufen.
    </p>
    <p v-else class="current-node-line">
      Aktueller Knoten: <code>{{ currentNode }}</code>
      <span v-if="lastAnalysisLabel" class="clock-compare">
        · Stand: <strong>{{ lastAnalysisLabel }}</strong> · Jetzt: <strong>{{ nowLabel }}</strong>
      </span>
    </p>

    <div v-if="nextAction" class="next-action-box" :class="{ judgment: nextAction.judgment }">
      <span class="next-action-label">{{ nextAction.judgment ? "Dein Urteil gefragt" : "Nächster Schritt" }}</span>
      <p class="next-action-hint">{{ nextAction.hint }}</p>
      <code v-if="nextAction.tool" class="next-action-tool">{{ nextAction.tool }}</code>
    </div>

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

.date-picker {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  color: #d1d4dc;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  margin-left: auto;
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
.clock-compare {
  color: #787b86;
}
.clock-compare strong {
  color: #d1d4dc;
  font-weight: 600;
}

.next-action-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 720px;
  padding: 10px 14px;
  margin: 0 0 16px;
  border-radius: 6px;
  background: rgba(41, 98, 255, 0.08);
  border: 1px solid rgba(91, 141, 255, 0.35);
}
.next-action-box.judgment {
  background: rgba(201, 122, 43, 0.1);
  border-color: rgba(201, 122, 43, 0.4);
}
.next-action-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5b8dff;
}
.next-action-box.judgment .next-action-label {
  color: #c97a2b;
}
.next-action-hint {
  font-size: 13px;
  color: #d1d4dc;
  margin: 0;
}
.next-action-tool {
  align-self: flex-start;
  font-size: 12px;
  color: #9aa0ac;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
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
.graph-container :deep(.node-tool) {
  font-size: 10px;
  opacity: 0.65;
}
</style>
