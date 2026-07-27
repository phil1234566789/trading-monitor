<script setup>
// Claude-Antwort-Import (siehe claudeAnnotations.js, trading/backtest-instructions.md) — Philip
// pastet das JSON, das ihm der Claude-Project-Chat als Antwort auf einen Backtest/Tagesablauf-
// Review geschickt hat, hier rein, damit er visuell nachvollziehen kann, was gemeint ist, statt
// nur Text zu lesen. Modal-Look wie NewsModal/SessionsModal (MetadataPanel-Wrapper).
import { ref } from "vue";
import MetadataPanel from "./MetadataPanel.vue";
import { parseAnnotations } from "../claudeAnnotations.js";

defineProps({
  count: { type: Number, default: 0 },
});
const emit = defineEmits(["close", "apply", "clear"]);

const text = ref("");
const error = ref(null);

function applyText() {
  try {
    const annotations = parseAnnotations(text.value);
    error.value = null;
    emit("apply", annotations);
  } catch (err) {
    error.value = err.message;
  }
}

function clearAll() {
  text.value = "";
  error.value = null;
  emit("clear");
}
</script>

<template>
  <MetadataPanel title="🖍 Claude-Notizen" @close="emit('close')">
    <p class="claude-annotations-hint">
      JSON aus dem Claude-Project-Chat hier einfügen (siehe trading/backtest-instructions.md) und
      "Zeichnen" klicken. Zeiten beziehen sich auf den aktuellen Replay-Tag (bzw. heute, falls
      Replay aus ist).
    </p>
    <textarea
      v-model="text"
      class="claude-annotations-textarea"
      placeholder='[{"type":"marker","time":"09:15","price":1.33120,"text":"..."}]'
    ></textarea>
    <div class="claude-annotations-actions">
      <button class="claude-annotations-btn" @click="applyText">Zeichnen</button>
      <button class="claude-annotations-btn" @click="clearAll">Löschen</button>
      <span v-if="count > 0" class="claude-annotations-count">{{ count }} im Chart</span>
    </div>
    <p v-if="error" class="claude-annotations-error">{{ error }}</p>
  </MetadataPanel>
</template>

<style scoped>
.claude-annotations-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #787b86;
}

.claude-annotations-textarea {
  width: 100%;
  min-height: 160px;
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

.claude-annotations-btn:hover {
  border-color: #2962ff;
}

.claude-annotations-count {
  font-size: 12px;
  color: #787b86;
}

.claude-annotations-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #ef5350;
}
</style>
