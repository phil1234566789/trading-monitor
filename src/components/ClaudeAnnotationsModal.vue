<script setup>
// Claude-Antwort-Import (siehe claudeAnnotations.js, trading/backtest-instructions.md) — Philip
// pastet das JSON, das ihm der Claude-Project-Chat als Antwort auf einen Backtest/Tagesablauf-
// Review geschickt hat, hier rein, damit er visuell nachvollziehen kann, was gemeint ist, statt
// nur Text zu lesen. Modal-Look wie NewsModal/SessionsModal (MetadataPanel-Wrapper).
//
// Seit Chat 2026-07-28 in Supabase persistiert (siehe useClaudeAnnotations.js/
// claudeAnnotationsStore.js) — jeder Klick auf "Zeichnen" legt eine NEUE Zeichnung für den
// aktuellen Tag an (akkumuliert über einen Chat-Verlauf hinweg), statt die vorherige zu
// überschreiben. Liste unten zeigt alle Zeichnungen des aktuellen Tages mit Lösch-Button — kein
// Editieren (Philip: "brauch ich nicht, da es ja von Claude kommt").
import { ref } from "vue";
import MetadataPanel from "./MetadataPanel.vue";
import { parseAnnotations } from "../claudeAnnotations.js";
import { useClaudeAnnotations } from "../composables/useClaudeAnnotations.js";
import { fmtDateTime } from "../format.js";

const emit = defineEmits(["close"]);

const { instrument, dateStr, drawings, loading, add, remove } = useClaudeAnnotations();

const text = ref("");
const error = ref(null);
const saving = ref(false);
const removingId = ref(null);

async function applyText() {
  let parsed;
  try {
    parsed = parseAnnotations(text.value);
  } catch (err) {
    error.value = err.message;
    return;
  }
  error.value = null;
  saving.value = true;
  try {
    const row = await add(parsed);
    if (row) {
      text.value = ""; // bereit für die nächste Zeichnung aus demselben Chat-Verlauf
    } else {
      error.value = "Speichern fehlgeschlagen — siehe Konsole.";
    }
  } finally {
    saving.value = false;
  }
}

async function removeDrawing(id) {
  removingId.value = id;
  try {
    await remove(id);
  } finally {
    removingId.value = null;
  }
}
</script>

<template>
  <MetadataPanel title="🖍 Claude-Notizen" @close="emit('close')">
    <p class="claude-annotations-hint">
      {{ instrument }} — {{ dateStr }}. JSON aus dem Claude-Project-Chat hier einfügen (siehe
      trading/backtest-instructions.md) und "Zeichnen" klicken — jeder Klick fügt eine weitere
      Zeichnung hinzu, ersetzt keine vorherige.
    </p>
    <textarea
      v-model="text"
      class="claude-annotations-textarea"
      placeholder='[{"type":"marker","time":"09:15","price":1.33120,"text":"..."}]'
    ></textarea>
    <div class="claude-annotations-actions">
      <button class="claude-annotations-btn" :disabled="saving" @click="applyText">
        {{ saving ? "Speichert…" : "Zeichnen" }}
      </button>
    </div>
    <p v-if="error" class="claude-annotations-error">{{ error }}</p>

    <div class="claude-annotations-list-header">
      <h4 class="claude-annotations-subheading">Zeichnungen dieses Tages</h4>
      <span v-if="loading" class="claude-annotations-hint-inline">lädt…</span>
    </div>
    <p v-if="!loading && drawings.length === 0" class="claude-annotations-hint-inline">Noch keine.</p>
    <ul v-else class="claude-annotations-list">
      <li v-for="d in drawings" :key="d.id" class="claude-annotations-list-item">
        <span class="claude-annotations-list-meta">
          {{ fmtDateTime(d.created_at) }} · {{ d.annotations.length }} {{ d.annotations.length === 1 ? "Element" : "Elemente" }}
        </span>
        <button
          class="claude-annotations-remove-btn"
          :disabled="removingId === d.id"
          title="Diese Zeichnung löschen"
          @click="removeDrawing(d.id)"
        >
          🗑
        </button>
      </li>
    </ul>
  </MetadataPanel>
</template>

<style scoped>
.claude-annotations-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #787b86;
}

.claude-annotations-hint-inline {
  font-size: 12px;
  color: #787b86;
}

.claude-annotations-textarea {
  width: 100%;
  min-height: 140px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  font-family: monospace;
  padding: 8px;
  resize: vertical;
  box-sizing: border-box;
}

.claude-annotations-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.claude-annotations-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #d1d4dc;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.claude-annotations-btn:hover:not(:disabled) {
  border-color: #2962ff;
}

.claude-annotations-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.claude-annotations-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #ef5350;
}

.claude-annotations-list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 14px 0 6px;
}

.claude-annotations-subheading {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.claude-annotations-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.claude-annotations-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  font-size: 12px;
}

.claude-annotations-list-meta {
  color: #d1d4dc;
}

.claude-annotations-remove-btn {
  flex: none;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #787b86;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.claude-annotations-remove-btn:hover:not(:disabled) {
  border-color: #ef5350;
  color: #ef5350;
}

.claude-annotations-remove-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
