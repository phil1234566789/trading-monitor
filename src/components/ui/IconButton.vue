<script setup>
// 34x34-Icon-Button, vorher dreimal Zeichen für Zeichen kopiert (CrudListSection,
// TradeSetupCockpit, TradeEditModal) — scoped CSS lässt sich nur über eine eigene Komponente
// teilen, nicht per Klassen-Import.
defineProps({
  armed: { type: Boolean, default: false },
});
</script>

<template>
  <button type="button" class="ui-icon-btn" :class="{ armed }">
    <slot />
  </button>
</template>

<style scoped>
/* Icon-only statt Text-Button (Chat 2026-07-31: "Buttons ticken größer, nur mit Icon, Text als
   Hover") — title trägt den früheren Button-Text als nativen Tooltip. */
.ui-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.ui-icon-btn:hover:not(:disabled) {
  border-color: #2962ff;
  color: #d1d4dc;
}

.ui-icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Gleiches Amber wie der scharfgestellte Modus-Umschalter in App.vue — ein scharfer Chart-Klick
   sieht überall gleich aus, egal an welchem Button er hängt. */
.ui-icon-btn.armed,
.ui-icon-btn.armed:hover {
  background: rgba(255, 179, 0, 0.9);
  border-color: rgba(255, 179, 0, 0.9);
  color: #131722;
}
</style>
