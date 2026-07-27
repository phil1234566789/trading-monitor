<script setup>
// Copy/Paste-Brücke für den Claude-Project-Backtest (siehe trading/backtest-instructions.md) —
// Asset+Tag wählen, Rohkerzen generieren, ins Clipboard kopieren. Modal-Look bewusst wie
// MetadataPanel/JsonTree (PriceChart.vue) gehalten, aber als eigenständiges globales Panel (App.vue),
// nicht an den aktuell im Chart gewählten Symbol/Timeframe gekoppelt — der Asset+Tag hier ist
// unabhängig davon, was gerade im Dashboard offen ist.
import { ref } from "vue";
import MetadataPanel from "./MetadataPanel.vue";
import JsonTree from "./JsonTree.vue";
import { buildBacktestExport, BACKTEST_ASSETS } from "../backtestExport.js";

defineEmits(["close"]);

const asset = ref(BACKTEST_ASSETS[0]);
const dateStr = ref(new Date().toISOString().slice(0, 10));
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
    result.value = await buildBacktestExport({ asset: asset.value, dateStr: dateStr.value });
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
