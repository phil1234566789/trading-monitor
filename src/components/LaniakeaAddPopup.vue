<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { cssColor } from "../chartColors.js";

// Winziges Popup direkt an der Cursor-Position nach "Laniakea zeigen" im Kontextmenü (Chat
// 2026-08-01, siehe ContextMenu.vue) — kein Browser-prompt(), damit sich das optionale
// Notiz-Feld stylistisch ins App-UI einfügt. Kein Eintrag ohne explizites Bestätigen (Escape/
// Klick außerhalb bricht komplett ab, auch mit bereits getipptem Text).
const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  label: { type: String, default: "" },
  // Chat 2026-08-01 (OB-Zonen-Erweiterung) — z.B. wenn resolveObZoneId() keine passende DB-Zeile
  // findet (poi-watcher hat die Zone noch nicht gespeichert). Popup bleibt dann offen statt sich
  // wie bei "confirm" zu schließen, siehe Dashboard.vue: onLaniakeaAddConfirm.
  error: { type: String, default: null },
});
const emit = defineEmits(["confirm", "cancel"]);

const note = ref("");
const textareaRef = ref(null);

function onWindowMousedown(e) {
  if (!e.target.closest?.(".laniakea-add-popup")) emit("cancel");
}
function onKeydown(e) {
  if (e.key === "Escape") emit("cancel");
  else if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    confirm();
  }
}
function confirm() {
  emit("confirm", note.value.trim());
}

onMounted(() => {
  textareaRef.value?.focus();
  requestAnimationFrame(() => window.addEventListener("mousedown", onWindowMousedown, true));
});
onUnmounted(() => window.removeEventListener("mousedown", onWindowMousedown, true));

const ESTIMATED_WIDTH = 260;
const ESTIMATED_HEIGHT = 140;
const clampedX = Math.min(props.x, window.innerWidth - ESTIMATED_WIDTH - 8);
const clampedY = Math.min(props.y, window.innerHeight - ESTIMATED_HEIGHT - 8);
</script>

<template>
  <div class="laniakea-add-popup" :style="{ top: clampedY + 'px', left: clampedX + 'px' }" @keydown="onKeydown">
    <div class="laniakea-add-popup-title">🌌 Laniakea zeigen{{ label ? ` — ${label}` : "" }}</div>
    <textarea ref="textareaRef" v-model="note" class="laniakea-add-popup-textarea" placeholder="Notiz (optional)" rows="3" />
    <div v-if="error" class="laniakea-add-popup-error">{{ error }}</div>
    <div class="laniakea-add-popup-actions">
      <button class="laniakea-add-popup-cancel" @click="emit('cancel')">Abbrechen</button>
      <button class="laniakea-add-popup-confirm" :style="{ background: cssColor('laniakea') }" @click="confirm">Hinzufügen</button>
    </div>
  </div>
</template>

<style scoped>
.laniakea-add-popup {
  position: fixed;
  width: 260px;
  background: #1e222d;
  border: 1px solid #2a2e39;
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  z-index: 100;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.laniakea-add-popup-title {
  color: #d1d4dc;
  font-size: 12px;
  font-weight: 600;
}

.laniakea-add-popup-error {
  color: #ef5350;
  font-size: 11px;
}

.laniakea-add-popup-textarea {
  resize: vertical;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  padding: 6px 8px;
  font-family: inherit;
}

.laniakea-add-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.laniakea-add-popup-actions button {
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.laniakea-add-popup-cancel {
  background: transparent;
  color: #787b86;
}
.laniakea-add-popup-cancel:hover {
  color: #d1d4dc;
}

.laniakea-add-popup-confirm {
  color: #fff;
  font-weight: 600;
}
.laniakea-add-popup-confirm:hover {
  filter: brightness(1.1);
}
</style>
