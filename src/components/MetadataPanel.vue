<script setup>
import { ref } from "vue";

// Generisches schwebendes Panel: verschiebbar (per Header-Drag), größenveränderbar (natives
// CSS `resize: both` — kein JS nötig) und scrollbar (Body hat eigenes overflow:auto, damit der
// Header beim Scrollen fix bleibt). Aktuell nur für den "Metadaten"-Toggle genutzt, aber bewusst
// ohne Trend-Analyse-spezifischen Inhalt, falls später weitere Debug-Panels dazukommen.
const props = defineProps({
  title: { type: String, default: "" },
});
const emit = defineEmits(["close"]);

const top = ref(72);
const left = ref(Math.max(20, window.innerWidth - 460));

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
</script>

<template>
  <div class="metadata-panel" :style="{ top: top + 'px', left: left + 'px' }">
    <div class="metadata-panel-header" @mousedown="startDrag">
      <span>{{ props.title }}</span>
      <button class="metadata-panel-close" @click="emit('close')">×</button>
    </div>
    <div class="metadata-panel-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.metadata-panel {
  position: fixed;
  width: 440px;
  height: 500px;
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
