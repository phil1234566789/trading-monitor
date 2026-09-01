<script setup>
import { computed, ref } from "vue";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { LOOP_INSTRUMENTS, fetchActiveLoopStates, fetchLoopStateHistory } from "../loopState.js";
import { fetchStateMachineLog } from "../stateMachineLog.js";

// state-machine-v1-ui (siehe docs/state-machine.md#reporting-trading-runsmd-verliert-seinen-zweck)
// — reines Lese-Panel für trading_loop_state, kein neues Dashboard: TSC/Journal haben bereits
// eigene Ansichten (TradeSetupCockpit.vue/TradesTable.vue), hier geht's nur um den bisher gar
// nicht sichtbaren Loop-State (Status/Fall/Watch-Level/Targets) + heartbeat_log als Timeline.
// usePolledFetch (bestehende Composable, siehe main.js/protokoll.js) statt eines eigenen
// setInterval-Loops — hängt außerdem an dieselbe useStatusBar-Freshness-Anzeige im Header wie der
// Rest des Dashboards.
const REFRESH_MS = 8000; // die Loop-Zeilen werden von Lana (separate Claude-Code-Session) geschrieben, kein Push moeglich -> Polling

async function loadAll() {
  const [active, histories, decisionLogs] = await Promise.all([
    fetchActiveLoopStates(),
    Promise.all(LOOP_INSTRUMENTS.map((instrument) => fetchLoopStateHistory(instrument))),
    Promise.all(LOOP_INSTRUMENTS.map((instrument) => fetchStateMachineLog(instrument))),
  ]);
  const historyMap = {};
  const decisionLogMap = {};
  LOOP_INSTRUMENTS.forEach((instrument, i) => {
    // Historie = alles AUSSER der aktuell aktiven Zeile (die steht schon oben in der Karte).
    historyMap[instrument] = histories[i].filter((row) => row.status !== "active");
    decisionLogMap[instrument] = decisionLogs[i];
  });
  return { active, historyMap, decisionLogMap };
}

const errorText = ref("");
const { data } = usePolledFetch(loadAll, {
  intervalMs: REFRESH_MS,
  onError: (err) => {
    errorText.value = "Loop-Status konnte nicht geladen werden: " + err.message;
  },
});

// usePolledFetch initialisiert data mit [] (Array) — nach dem ersten erfolgreichen Load steht dort
// immer {active, historyMap} (Objekt), Array-Check reicht also als simpler "noch nicht geladen"-Indikator.
const loading = computed(() => Array.isArray(data.value));
const activeByInstrument = computed(() => data.value?.active ?? new Map());
const historyByInstrument = computed(() => data.value?.historyMap ?? {});
const decisionLogByInstrument = computed(() => data.value?.decisionLogMap ?? {});
const expandedHistory = ref({});

// state-machine-decision-log (feinere Ebene UNTER dem Heartbeat-Log, siehe docs/state-machine.md)
// — eigener Ausklapp-Zustand + Tag-Filter (leeres Set = alle Tags sichtbar) pro Instrument.
const expandedDecisionLog = ref({});
const decisionTagFilter = ref({});

function toggleDecisionLog(instrument) {
  expandedDecisionLog.value = { ...expandedDecisionLog.value, [instrument]: !expandedDecisionLog.value[instrument] };
}

function availableDecisionTags(instrument) {
  const tags = new Set((decisionLogByInstrument.value[instrument] || []).map((entry) => entry.decision));
  return [...tags].sort();
}

function isTagActive(instrument, tag) {
  const selected = decisionTagFilter.value[instrument];
  return !selected || selected.size === 0 || selected.has(tag);
}

function toggleDecisionTag(instrument, tag) {
  const current = decisionTagFilter.value[instrument] ?? new Set();
  const next = new Set(current);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  decisionTagFilter.value = { ...decisionTagFilter.value, [instrument]: next };
}

function filteredDecisionLog(instrument) {
  const entries = decisionLogByInstrument.value[instrument] || [];
  const selected = decisionTagFilter.value[instrument];
  if (!selected || selected.size === 0) return entries;
  return entries.filter((entry) => selected.has(entry.decision));
}

const STATUS_LABELS = {
  active: "Aktiv",
  fall1_handoff: "Fall 1 (alt, nicht mehr automatisch gesetzt)",
  fall4_pending_bias: "Fall 4 — Bias-Neudurchlauf nötig",
  stopped_market_close: "Gestoppt (Handelsschluss)",
  stopped_news_pause: "Gestoppt (News-Pause)",
  superseded: "Ersetzt (neuer Bias-Durchlauf)",
  completed: "Abgeschlossen",
};
const STATUS_CLASS = {
  active: "status-active",
  fall1_handoff: "status-warn",
  fall4_pending_bias: "status-warn",
  stopped_market_close: "status-idle",
  stopped_news_pause: "status-idle",
  superseded: "status-idle",
  completed: "status-done",
};

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}
function statusClass(status) {
  return STATUS_CLASS[status] ?? "status-idle";
}

function formatLevel(level) {
  if (!level) return "—";
  const parts = [String(level.price)];
  const meta = [level.kind, level.timeframe].filter(Boolean).join(", ");
  if (meta) parts.push(`(${meta})`);
  if (level.context) parts.push(`— ${level.context}`);
  return parts.join(" ");
}

function formatBerlin(value) {
  if (value == null) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toggleHistory(instrument) {
  expandedHistory.value = { ...expandedHistory.value, [instrument]: !expandedHistory.value[instrument] };
}
</script>

<template>
  <div class="loop-status-wrapper">
    <h2 class="loop-status-title">Loop-Status</h2>
    <p class="loop-status-hint">
      Live-Ansicht von <code>trading_loop_state</code> (state-machine-v1) — die Zeilen schreiben
      Lanas <code>run_bias_check</code>/<code>run_dealing_range_loop</code>-Tool-Aufrufe, nicht
      dieses Dashboard. Aktualisiert alle {{ REFRESH_MS / 1000 }}s automatisch.
    </p>

    <p v-if="errorText" class="loop-status-error">{{ errorText }}</p>
    <p v-else-if="loading" class="loop-status-hint">Lade...</p>

    <div v-else class="instrument-grid">
      <section v-for="instrument in LOOP_INSTRUMENTS" :key="instrument" class="instrument-card">
        <h3 class="instrument-title">{{ instrument }}</h3>

        <template v-if="activeByInstrument.get(instrument)">
          <div class="loop-card">
            <div class="loop-card-header">
              <span class="status-badge" :class="statusClass(activeByInstrument.get(instrument).status)">
                {{ statusLabel(activeByInstrument.get(instrument).status) }}
              </span>
              <span class="loop-direction" :class="activeByInstrument.get(instrument).direction">
                {{ activeByInstrument.get(instrument).direction === "long" ? "Long" : "Short" }}
              </span>
              <span class="loop-step">Schritt {{ activeByInstrument.get(instrument).currentStep }}</span>
            </div>

            <dl class="loop-fields">
              <div class="loop-field">
                <dt>Trend-Target</dt>
                <dd>{{ formatLevel(activeByInstrument.get(instrument).trendTarget) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Countertrend-Target</dt>
                <dd>{{ formatLevel(activeByInstrument.get(instrument).countertrendTarget) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Zwischen-Level</dt>
                <dd>{{ formatLevel(activeByInstrument.get(instrument).intermediateLevel) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Invalidierung</dt>
                <dd>{{ activeByInstrument.get(instrument).invalidation ?? "—" }}</dd>
              </div>
              <div class="loop-field">
                <dt>Watch-Level oben</dt>
                <dd>{{ formatLevel(activeByInstrument.get(instrument).watchLevelAbove) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Watch-Level unten</dt>
                <dd>{{ formatLevel(activeByInstrument.get(instrument).watchLevelBelow) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Bias berechnet</dt>
                <dd>{{ formatBerlin(activeByInstrument.get(instrument).biasComputedAt) }}</dd>
              </div>
              <div class="loop-field">
                <dt>Letzter Analyse-Zeitpunkt</dt>
                <dd>
                  {{ formatBerlin(activeByInstrument.get(instrument).lastAnalysisTimeSec) }}
                  <span v-if="activeByInstrument.get(instrument).replayUntilSec != null" class="replay-flag">(Backtest)</span>
                </dd>
              </div>
            </dl>

            <div class="heartbeat-block">
              <div class="heartbeat-title">Heartbeat-Log ({{ activeByInstrument.get(instrument).heartbeatLog.length }})</div>
              <ul v-if="activeByInstrument.get(instrument).heartbeatLog.length > 0" class="heartbeat-list">
                <li v-for="(entry, idx) in [...activeByInstrument.get(instrument).heartbeatLog].reverse()" :key="idx" class="heartbeat-entry">
                  <span class="heartbeat-time">{{ entry.at }}</span>
                  <span class="heartbeat-message">{{ entry.message }}</span>
                </li>
              </ul>
              <span v-else class="heartbeat-empty">Noch kein Eintrag.</span>
            </div>
          </div>
        </template>
        <p v-else class="no-loop">Kein aktiver Loop.</p>

        <div class="history-block">
          <button class="history-toggle" @click="toggleHistory(instrument)">
            {{ expandedHistory[instrument] ? "▾" : "▸" }} Historie ({{ (historyByInstrument[instrument] || []).length }})
          </button>
          <ul v-if="expandedHistory[instrument]" class="history-list">
            <li v-if="(historyByInstrument[instrument] || []).length === 0" class="history-empty">Keine vorherigen Loops.</li>
            <li v-for="row in historyByInstrument[instrument]" :key="row.id" class="history-row">
              <span class="status-badge small" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
              <span class="history-direction">{{ row.direction === "long" ? "Long" : "Short" }}</span>
              <span class="history-date">{{ row.dateStr }}</span>
              <span class="history-updated">{{ formatBerlin(row.updatedAt) }}</span>
            </li>
          </ul>
        </div>

        <div class="decision-log-block">
          <button type="button" class="history-toggle" @click="toggleDecisionLog(instrument)">
            {{ expandedDecisionLog[instrument] ? "▾" : "▸" }} Entscheidungs-Log ({{ (decisionLogByInstrument[instrument] || []).length }})
          </button>
          <template v-if="expandedDecisionLog[instrument]">
            <div v-if="availableDecisionTags(instrument).length > 0" class="tag-filter">
              <button
                v-for="tag in availableDecisionTags(instrument)"
                :key="tag"
                type="button"
                class="tag-chip"
                :class="{ active: isTagActive(instrument, tag) }"
                @click="toggleDecisionTag(instrument, tag)"
              >
                {{ tag }}
              </button>
            </div>
            <ul v-if="filteredDecisionLog(instrument).length > 0" class="decision-log-list">
              <li v-for="entry in filteredDecisionLog(instrument)" :key="entry.id" class="decision-log-entry">
                <span class="decision-log-time">{{ formatBerlin(entry.sec) }}</span>
                <span class="decision-log-step">S{{ entry.step }}</span>
                <span class="decision-log-tag">{{ entry.decision }}</span>
                <span class="decision-log-message">{{ entry.message || "—" }}</span>
                <span v-if="entry.loopStateId == null" class="decision-log-unassigned">ohne Loop</span>
              </li>
            </ul>
            <span v-else class="heartbeat-empty">Keine Einträge.</span>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.loop-status-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.loop-status-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.loop-status-hint {
  font-size: 12px;
  color: #787b86;
  margin: 0 0 20px;
  max-width: 720px;
}

.loop-status-hint code {
  color: #9aa0ac;
}

.loop-status-error {
  font-size: 13px;
  color: #ef5350;
}

.instrument-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  max-width: 1200px;
}

.instrument-card {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 14px 16px;
}

.instrument-title {
  font-size: 14px;
  font-weight: 600;
  color: #d1d4dc;
  margin: 0 0 10px;
}

.loop-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.status-badge.small {
  font-size: 10px;
  padding: 1px 6px;
}
.status-badge.status-active {
  background: rgba(38, 166, 154, 0.18);
  color: #26a69a;
}
.status-badge.status-warn {
  background: rgba(255, 152, 0, 0.18);
  color: #ff9800;
}
.status-badge.status-idle {
  background: rgba(120, 123, 134, 0.18);
  color: #9aa0ac;
}
.status-badge.status-done {
  background: rgba(41, 98, 255, 0.18);
  color: #5b8dff;
}

.loop-direction {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.loop-direction.long {
  color: #26a69a;
  background: rgba(38, 166, 154, 0.1);
}
.loop-direction.short {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
}

.loop-step {
  font-size: 11px;
  color: #787b86;
}

.loop-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px 12px;
  margin: 0 0 12px;
}

.loop-field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  border-bottom: 1px solid #22262f;
  padding-bottom: 4px;
}

.loop-field dt {
  color: #787b86;
  flex-shrink: 0;
}

.loop-field dd {
  margin: 0;
  color: #d1d4dc;
  text-align: right;
}

.replay-flag {
  color: #ff9800;
  font-size: 10px;
}

.heartbeat-block {
  border-top: 1px solid #2a2e39;
  padding-top: 8px;
}

.heartbeat-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #565a64;
  margin-bottom: 6px;
}

.heartbeat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heartbeat-entry {
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  padding: 3px 0;
}

.heartbeat-time {
  flex-shrink: 0;
  color: #565a64;
  white-space: nowrap;
}

.heartbeat-message {
  color: #9aa0ac;
}

.heartbeat-empty {
  font-size: 12px;
  color: #565a64;
  font-style: italic;
}

.no-loop {
  font-size: 12px;
  color: #565a64;
  font-style: italic;
  margin: 0 0 12px;
}

.history-block {
  margin-top: 12px;
  border-top: 1px solid #2a2e39;
  padding-top: 8px;
}

.history-toggle {
  background: transparent;
  border: none;
  color: #9aa0ac;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
.history-toggle:hover {
  color: #d1d4dc;
}

.history-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #9aa0ac;
}

.history-direction {
  color: #787b86;
}

.history-date {
  color: #565a64;
}

.history-updated {
  margin-left: auto;
  color: #565a64;
}

.history-empty {
  font-size: 12px;
  color: #565a64;
  font-style: italic;
}

.decision-log-block {
  margin-top: 12px;
  border-top: 1px solid #2a2e39;
  padding-top: 8px;
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0;
}

.tag-chip {
  background: #22262f;
  border: 1px solid #2a2e39;
  color: #565a64;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 9px;
  cursor: pointer;
}
.tag-chip.active {
  color: #d1d4dc;
  border-color: #5b8dff;
  background: rgba(91, 141, 255, 0.12);
}

.decision-log-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.decision-log-entry {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11.5px;
  padding: 3px 0;
  border-bottom: 1px solid #22262f;
}

.decision-log-time {
  flex-shrink: 0;
  color: #565a64;
  white-space: nowrap;
}

.decision-log-step {
  flex-shrink: 0;
  color: #787b86;
  font-size: 10px;
}

.decision-log-tag {
  flex-shrink: 0;
  color: #5b8dff;
  font-size: 10.5px;
}

.decision-log-message {
  color: #9aa0ac;
}

.decision-log-unassigned {
  margin-left: auto;
  color: #ff9800;
  font-size: 10px;
  flex-shrink: 0;
}
</style>
