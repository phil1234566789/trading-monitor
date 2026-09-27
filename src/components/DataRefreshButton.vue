<script setup>
import { ref } from "vue";
import ToggleButton from "./ui/ToggleButton.vue";

const props = defineProps({ refresh: { type: Function, required: true } });
const busy = ref(false);
const message = ref("");
async function refreshData() {
  if (busy.value) return;
  busy.value = true;
  message.value = "";
  try {
    message.value = await props.refresh() ? "Daten aktualisiert" : "Nicht alle Daten konnten aktualisiert werden. Bitte erneut versuchen.";
  } catch {
    message.value = "Aktualisieren fehlgeschlagen. Bitte erneut versuchen.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="data-refresh">
    <ToggleButton :disabled="busy" :aria-busy="busy" title="Journal, TSC und Chart-Daten neu laden; Chart-Ausschnitt und Historie behalten" @click="refreshData">
      {{ busy ? "↻ Aktualisiere…" : "↻ Daten aktualisieren" }}
    </ToggleButton>
    <span role="status">{{ message }}</span>
  </div>
</template>

<style scoped>
.data-refresh { position: relative; }
.data-refresh span {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 30;
  width: max-content;
  max-width: min(340px, 80vw);
  padding: 6px 8px;
  background: #1e222d;
  border-radius: 4px;
  font-size: 0.8rem;
}
.data-refresh span:empty { display: none; }
</style>
