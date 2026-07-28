<script setup>
// Copy/Paste-Brücke für den Claude-Project-Backtest (siehe trading/backtest-instructions.md) —
// Asset+Tag wählen, Rohkerzen generieren, ins Clipboard kopieren. Modal-Look bewusst wie
// MetadataPanel/JsonTree (PriceChart.vue) gehalten, aber als eigenständiges globales Panel (App.vue),
// nicht an den aktuell im Chart gewählten Symbol/Timeframe gekoppelt — der Asset+Tag hier ist
// unabhängig davon, was gerade im Dashboard offen ist.
import { ref } from "vue";
import MetadataPanel from "./MetadataPanel.vue";
import JsonTree from "./JsonTree.vue";
import { buildBacktestExport, BACKTEST_ASSETS, berlinDateStrFor } from "../backtestExport.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { useLastBacktestExport } from "../composables/useLastBacktestExport.js";
import { saveDebugMetadataSection } from "../debugMetadata.js";
import { fmtDateTime } from "../format.js";

const { set: setLastBacktestExport } = useLastBacktestExport();

defineEmits(["close"]);

// Gleiche Keys/Defaults wie Dashboard.vue (replayTime/replayActive) — kein eigener State, liest
// nur den bestehenden Replay-Zustand des Charts, damit "Backtest-Daten generieren" bei aktivem
// Replay automatisch nur bis zu diesem Zeitpunkt aufdeckt (Philip: "wir tun ja so, als wüssten wir
// nicht, wie der Tag noch verläuft"). Modal wird bei jedem Öffnen neu gemountet (v-if in App.vue),
// liest also immer den aktuellen Stand.
const replayTime = useLocalStorageRef("replayTime", 1783011600);
const replayActive = useLocalStorageRef("replayActive", false);
// Dieselben Keys/Defaults wie Dashboard.vue (rangesPeriod/ranges2Period/.../rangesFixedStart*) —
// Bug-Report Philip 2026-07-27: der Export nutzte bisher hart die rollierenden Defaults, egal was
// im "Structure"-Toggle tatsächlich eingestellt war (insbesondere ein aktiver fixer Start wurde
// ignoriert, wodurch der Export keinen nestedTrend fand, obwohl der Chart selbst einen zeigte).
const rangesPeriod = useLocalStorageRef("rangesPeriod", 5);
const ranges2Period = useLocalStorageRef("ranges2Period", 2);
const rangesLookbackHours = useLocalStorageRef("rangesLookbackHours", 7 * 24);
const ranges2LookbackHours = useLocalStorageRef("ranges2LookbackHours", 7 * 24);
const rangesFixedStartActive = useLocalStorageRef("rangesFixedStartActive", false);
const rangesFixedStartTime = useLocalStorageRef("rangesFixedStartTime", 1783011600);

const asset = ref(BACKTEST_ASSETS[0]);
const dateStr = ref(replayActive.value ? berlinDateStrFor(replayTime.value) : new Date().toISOString().slice(0, 10));
const loading = ref(false);
const error = ref(null);
const result = ref(null);
const copied = ref(false);
let copiedTimer = null;

async function generate() {
  loading.value = true;
  error.value = null;
  result.value = null;
  try {
    result.value = await buildBacktestExport({
      asset: asset.value,
      dateStr: dateStr.value,
      replayUntilSec: replayActive.value ? replayTime.value : null,
      structureConfig: {
        periodOuter: rangesPeriod.value,
        periodInner: ranges2Period.value,
        lookbackHoursOuter: rangesLookbackHours.value,
        lookbackHoursInner: ranges2LookbackHours.value,
        fixedStartActive: rangesFixedStartActive.value,
        fixedStartTime: rangesFixedStartTime.value,
      },
    });
    // Dev-only (siehe debugMetadata.js/vite.config.js) — damit sich der Export bei einer
    // Diskrepanz zum Chart-State direkt in .debug/metadata.json nachlesen lässt, ohne dass Philip
    // ihn manuell in den Chat pasten muss (Philip 2026-07-27).
    saveDebugMetadataSection("backtestExport", result.value);
    // Zusätzlich im Frontend-Debug-Metadaten-Panel sichtbar (Philip 2026-07-28: "für die
    // Nachvollziehbarkeit wäre es im Frontend auch nicht schlecht") — siehe PriceChart.vue:
    // buildActiveMetadataSnapshot liest denselben Singleton.
    setLastBacktestExport(result.value);
  } catch (err) {
    error.value = err.message || String(err);
  } finally {
    loading.value = false;
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(result.value, null, 2));
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.value = false), 1200);
  } catch (err) {
    console.error("Kopieren fehlgeschlagen:", err);
  }
}
</script>

<template>
  <MetadataPanel title="Backtest-Daten" @close="$emit('close')">
    <div class="backtest-form">
      <select v-model="asset" class="backtest-select">
        <option v-for="a in BACKTEST_ASSETS" :key="a" :value="a">{{ a }}</option>
      </select>
      <input v-model="dateStr" type="date" class="backtest-date" />
      <button class="backtest-generate-btn" :disabled="loading" @click="generate">
        {{ loading ? "Lädt…" : "Generieren" }}
      </button>
    </div>

    <p v-if="replayActive" class="backtest-empty backtest-replay-hint">
      ✂️ Replay aktiv: Daten werden nur bis {{ fmtDateTime(replayTime) }} aufgedeckt.
    </p>

    <p v-if="error" class="backtest-empty backtest-error">{{ error }}</p>

    <template v-if="result">
      <div class="backtest-result-header">
        <h4 class="backtest-result-title">{{ result.asset }} — {{ result.date }}</h4>
        <button class="backtest-copy-btn" @click="copyResult">
          {{ copied ? "✓ kopiert" : "📋 kopieren" }}
        </button>
      </div>
      <JsonTree :value="result" />
    </template>
    <p v-else-if="!loading && !error" class="backtest-empty">Asset + Tag wählen, dann "Generieren".</p>
  </MetadataPanel>
</template>

<style scoped>
.backtest-form {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.backtest-select,
.backtest-date {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  padding: 4px 6px;
  color-scheme: dark;
}

.backtest-generate-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #d1d4dc;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.backtest-generate-btn:hover:not(:disabled) {
  border-color: #2962ff;
}

.backtest-generate-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.backtest-empty {
  margin: 0;
  font-size: 13px;
  color: #787b86;
}

.backtest-error {
  color: #ef5350;
}

.backtest-replay-hint {
  color: #ffb74d;
  margin-bottom: 10px;
}

.backtest-result-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.backtest-result-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.backtest-copy-btn {
  flex: none;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #787b86;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.backtest-copy-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}
</style>
