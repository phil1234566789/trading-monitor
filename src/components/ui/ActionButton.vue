<script setup>
// Rahmen-Button für eine echte Aktion (Speichern/Anlegen/Löschen) — im Gegensatz zu ToggleButton
// hat er keinen An/Aus-Zustand.
defineProps({
  // primary = blau (Speichern/Anlegen), danger = rot (Löschen)
  tone: { type: String, default: "primary" },
});
</script>

<template>
  <button type="button" class="ui-action-btn" :data-tone="tone">
    <slot />
  </button>
</template>

<style scoped>
.ui-action-btn {
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.ui-action-btn:hover:not(:disabled) {
  background: rgba(41, 98, 255, 0.12);
}

.ui-action-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ui-action-btn[data-tone="danger"] {
  border-color: rgba(239, 83, 80, 0.4);
  color: #ef5350;
}

.ui-action-btn[data-tone="danger"]:hover:not(:disabled) {
  background: rgba(239, 83, 80, 0.12);
}
</style>
