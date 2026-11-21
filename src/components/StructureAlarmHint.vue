<script setup>
// Chart-Struktur ≠ Alarm-Struktur: dann sieht Philip andere H1-Sweeps als poi-watcher alarmiert.
// Werte kommen aus SETUP1_STRUCTURE_SETTINGS, derselben Quelle, die der Alarm nutzt.
import { computed } from "vue";
import ActionButton from "./ui/ActionButton.vue";
import { structureDeviatesFromAlarm, SETUP1_H1_STRUCTURE as A } from "../setup1Detection.js";

const props = defineProps({ settings: { type: Object, required: true } });
defineEmits(["reset"]);
const deviates = computed(() => structureDeviatesFromAlarm(props.settings));
const title = `Chart-Struktur weicht von der Einstellung der Alarme ab (Start ab 1D-Pivot, Periode ${A.periodOuter}/${A.periodInner}, `
  + `${A.lookbackHours / 24} Tage ohne Pivot). Klick setzt den Chart darauf zurück.`;
</script>

<template>
  <ActionButton
    v-if="deviates"
    tone="danger"
    class="structure-alarm-hint"
    :title="title"
    @click="$emit('reset')"
  >
    ⚠ Struktur weicht vom Alarm ab · zurücksetzen
  </ActionButton>
</template>

<style scoped>
.structure-alarm-hint {
  padding: 4px 8px;
  font-size: 12px;
  white-space: nowrap;
}
</style>
