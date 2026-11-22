<script setup>
import { WEEKDAY_LABELS } from "../sessions.js";
import { daysOrAll } from "../sessionOccurrences.js";

// Wochentage an/aus, gemeinsam für Sessions-Modal und DOB-Entry-Fenster. days intern 0=So..6=Sa (Date#getDay), angezeigt Mo..So;
// fehlende/leere days heißen „jeder Tag“, beim ersten Abwählen wird deshalb erst auf alle Tage aufgefüllt.
const props = defineProps({ days: { type: Array, default: null } });
const emit = defineEmits(["update:days"]);
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const active = (day) => daysOrAll(props.days).includes(day);
function toggle(day) {
  const days = [...daysOrAll(props.days)], idx = days.indexOf(day);
  if (idx === -1) days.push(day);
  else days.splice(idx, 1);
  emit("update:days", days);
}
</script>

<template>
  <span class="weekday-toggles">
    <button v-for="day in DISPLAY_ORDER" :key="day" type="button" class="weekday-toggle" :class="{ active: active(day) }"
      :aria-pressed="active(day)" @click="toggle(day)">{{ WEEKDAY_LABELS[day] }}</button>
  </span>
</template>

<style scoped>
.weekday-toggles { display: flex; gap: 4px; }
.weekday-toggle {
  flex: 1;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #565a64;
  font-size: 11px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease;
}
.weekday-toggle.active { background: #1f2937; border-color: #2962ff; color: #d1d4dc; }
.weekday-toggle:focus-visible { outline: 2px solid #91b8ff; outline-offset: 2px; }
</style>
