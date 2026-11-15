<template>
  <button type="button" class="ui-copy-button"><slot /></button>
</template>

<style scoped>
/* Aus dem bestehenden Metadaten-Button: Pin-IDs teilen die Optik, nicht dessen Speicheraktion. */
.ui-copy-button {
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
.ui-copy-button:hover:not(:disabled) {
  border-color: #2962ff;
  color: #d1d4dc;
}
.ui-copy-button:disabled {
  opacity: 0.4;
  cursor: default;
}
.ui-copy-button:focus-visible { outline:2px solid #91b8ff;outline-offset:2px; }
@media(max-width:540px),(pointer:coarse) { .ui-copy-button { min-width:44px;min-height:44px; } }
</style>
