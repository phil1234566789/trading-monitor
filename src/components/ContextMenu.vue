<script setup>
import { onMounted, onUnmounted } from "vue";

// Generisches Rechtsklick-Kontextmenü (Chat 2026-08-01, erster Nutzer: "Anpinnen" auf
// Trades-Zeilen/Chart-Marker, siehe TradesTable.vue/PriceChart.vue). Ersetzt bewusst NICHT das
// native Browser-Kontextmenü generell (kein globaler contextmenu-Override) — der Aufrufer ruft
// event.preventDefault() nur, wenn er tatsächlich etwas Eigenes anzubieten hat (siehe
// PriceChart.vue: nur bei Treffer auf einen Trade-Marker), sonst bleibt das Windows-Menü normal.
const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  items: { type: Array, required: true }, // [{ key, label }]
});
const emit = defineEmits(["select", "close"]);

function onWindowMousedown(e) {
  if (!e.target.closest?.(".context-menu")) emit("close");
}
function onKeydown(e) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  // capture:true + eigener Tick, damit der Rechtsklick, der das Menü überhaupt geöffnet hat,
  // nicht selbst sofort als "Klick außerhalb" gewertet wird (contextmenu feuert vor mousedown
  // nicht garantiert in jedem Browser gleich, daher ein Frame Verzögerung).
  requestAnimationFrame(() => {
    window.addEventListener("mousedown", onWindowMousedown, true);
    window.addEventListener("keydown", onKeydown);
  });
});
onUnmounted(() => {
  window.removeEventListener("mousedown", onWindowMousedown, true);
  window.removeEventListener("keydown", onKeydown);
});

// An den Viewport-Rand geklemmt, damit das Menü bei Rechtsklick nahe am rechten/unteren Rand
// nicht abgeschnitten wird — grobe Schätzbreite/-höhe reicht, exaktes Ausmessen (ResizeObserver)
// wäre für ein paar Textzeilen Overkill.
const ESTIMATED_WIDTH = 180;
const ESTIMATED_HEIGHT_PER_ITEM = 32;
const clampedX = Math.min(props.x, window.innerWidth - ESTIMATED_WIDTH - 8);
const clampedY = Math.min(props.y, window.innerHeight - props.items.length * ESTIMATED_HEIGHT_PER_ITEM - 8);
</script>

<template>
  <div class="context-menu" :style="{ top: clampedY + 'px', left: clampedX + 'px' }">
    <button v-for="item in items" :key="item.key" class="context-menu-item" @click="emit('select', item.key)">
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 160px;
  background: #1e222d;
  border: 1px solid #2a2e39;
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  z-index: 100;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.context-menu-item {
  background: transparent;
  border: none;
  color: #d1d4dc;
  text-align: left;
  padding: 7px 10px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
}

.context-menu-item:hover {
  background: #2a2e39;
}
</style>
