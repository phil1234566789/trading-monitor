<script setup>
import { onMounted, onUnmounted, ref } from "vue";

// Generisches schwebendes Panel: verschiebbar (per Header-Drag), größenveränderbar (natives
// CSS `resize: both` — kein JS nötig) und scrollbar (Body hat eigenes overflow:auto, damit der
// Header beim Scrollen fix bleibt). Genutzt vom "Metadaten"-Toggle, TakeTradeModal.vue und
// TradeEditModal.vue — width/height/position sind Props (statt fix), weil TradeEditModal seit
// Chat 2026-07-31 spürbar mehr Inhalt hat (Targets/Bestätigungen mit Manuell-Formularen) und
// deshalb größer + unten rechts starten soll, ohne die anderen beiden Nutzer zu verändern.
const props = defineProps({
  title: { type: String, default: "" },
  width: { type: Number, default: 440 },
  height: { type: Number, default: 500 },
  position: { type: String, default: "top-right" }, // "top-right" | "bottom-right"
});
const emit = defineEmits(["close"]);

const PANEL_MARGIN = 20;
const top = ref(props.position === "bottom-right" ? Math.max(PANEL_MARGIN, window.innerHeight - props.height - PANEL_MARGIN) : 72);
const left = ref(Math.max(PANEL_MARGIN, window.innerWidth - props.width - PANEL_MARGIN));
// width/height als eigene refs (statt direkt props.width/height im Style-Binding), weil sonst
// jedes Re-Render (z.B. Datenänderung im Slot-Inhalt) die per natives `resize: both` vom Nutzer
// gezogene Größe wieder auf den Prop-Default zurückschreibt.
const width = ref(props.width);
const height = ref(props.height);
const panelEl = ref(null);
let resizeObserver = null;

let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e) {
  dragOffsetX = e.clientX - left.value;
  dragOffsetY = e.clientY - top.value;
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDrag);
}
function onDrag(e) {
  left.value = Math.max(0, e.clientX - dragOffsetX);
  top.value = Math.max(0, e.clientY - dragOffsetY);
}
function stopDrag() {
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDrag);
}

onMounted(() => {
  if (!panelEl.value) return;
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    width.value = entry.contentRect.width;
    height.value = entry.contentRect.height;
  });
  resizeObserver.observe(panelEl.value);
});
onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="panelEl" class="metadata-panel" :style="{ top: top + 'px', left: left + 'px', width: width + 'px', height: height + 'px' }">
    <div class="metadata-panel-header" @mousedown="startDrag">
      <span>{{ props.title }}</span>
      <button type="button" class="metadata-panel-close" @click="emit('close')">×</button>
    </div>
    <div class="metadata-panel-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.metadata-panel {
  position: fixed;
  min-width: 260px;
  min-height: 160px;
  max-width: 95vw;
  max-height: 90vh;
  background: #1e222d;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  z-index: 50;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: hidden;
}

.metadata-panel-header {
  cursor: move;
  padding: 8px 10px;
  background: #131722;
  border-bottom: 1px solid #2a2e39;
  color: #d1d4dc;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  flex-shrink: 0;
  border-radius: 8px 8px 0 0;
}

.metadata-panel-close {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
}

.metadata-panel-close:hover {
  color: #fff;
}

.metadata-panel-body {
  flex: 1;
  overflow: auto;
  padding: 10px 12px;
}
</style>
