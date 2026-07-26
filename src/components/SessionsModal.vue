<script setup>
import { computed } from "vue";
import { sessions, addSession, removeSession, DANGER_LEVELS, WEEKDAY_LABELS } from "../sessions.js";
import { minutesToTimeInput, timeInputToMinutes } from "../chartTimeUtils.js";
import MetadataPanel from "./MetadataPanel.vue";

const props = defineProps({ instrument: { type: String, required: true } });
const emit = defineEmits(["close"]);

// Sessions sind seit Chat 2026-07-25 pro Asset getrennt (siehe sessions.js) — dieses Modal
// zeigt/editiert nur die Sessions des gerade offenen Charts, nicht die anderer Instrumente.
const instrumentSessions = computed(() => sessions.filter((s) => s.instrument === props.instrument));

// Anzeige Mo..So (deutsche Konvention), WEEKDAY_LABELS/session.days sind intern 0=So..6=Sa (wie
// Date#getDay(), siehe sessions.js) — nur eine Anzeige-Reihenfolge, keine Werteänderung.
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Feature-Wunsch Philip 2026-07-26: "Session Indikatoren am WE weglassen" — session.days kann bei
// alten, vor diesem Feature angelegten Sessions noch fehlen (siehe daysOrAll in sessions.js), hier
// beim ersten Toggle einer solchen Session einmal auf "alle Tage" auffüllen, damit Abwählen
// überhaupt etwas zu entfernen hat.
function toggleDay(session, day) {
  const days = session.days && session.days.length > 0 ? [...session.days] : [0, 1, 2, 3, 4, 5, 6];
  const idx = days.indexOf(day);
  if (idx === -1) days.push(day);
  else days.splice(idx, 1);
  session.days = days;
}
function isDayActive(session, day) {
  return !session.days || session.days.length === 0 || session.days.includes(day);
}
</script>

<template>
  <MetadataPanel :title="`🕒 Sessions (${instrument})`" @close="emit('close')">
    <button class="sessions-add" @click="addSession(instrument)">+ Session hinzufügen</button>
    <p v-if="instrumentSessions.length === 0" class="sessions-empty">
      Noch keine Sessions für {{ instrument }} angelegt — "+ Session hinzufügen" für die erste.
    </p>
    <section v-for="session in instrumentSessions" :key="session.id" class="sessions-item">
      <div class="sessions-item-top">
        <input v-model="session.label" type="text" class="sessions-label-input" placeholder="Label" />
        <span class="sessions-swatch-wrap">
          <input v-model="session.hex" type="color" class="sessions-swatch" />
          <span class="sessions-hex">{{ session.hex }}</span>
        </span>
        <button class="sessions-remove" title="Session löschen" @click="removeSession(session.id)">×</button>
      </div>
      <div class="sessions-item-times">
        <label class="sessions-time-field">
          von
          <input
            :value="minutesToTimeInput(session.fromMinutes)"
            type="time"
            step="1800"
            class="sessions-time-input"
            @input="session.fromMinutes = timeInputToMinutes($event.target.value)"
          />
        </label>
        <label class="sessions-time-field">
          bis
          <input
            :value="minutesToTimeInput(session.toMinutes)"
            type="time"
            step="1800"
            class="sessions-time-input"
            @input="session.toMinutes = timeInputToMinutes($event.target.value)"
          />
        </label>
      </div>
      <div class="sessions-item-alpha">
        <input v-model.number="session.alpha" type="range" min="0.02" max="0.5" step="0.01" class="sessions-alpha-slider" />
        <span class="sessions-alpha-value">{{ Math.round(session.alpha * 100) }}%</span>
      </div>
      <div class="sessions-days-field">
        <button
          v-for="day in WEEKDAY_DISPLAY_ORDER"
          :key="day"
          type="button"
          class="sessions-day-toggle"
          :class="{ active: isDayActive(session, day) }"
          @click="toggleDay(session, day)"
        >
          {{ WEEKDAY_LABELS[day] }}
        </button>
      </div>
      <label class="sessions-highlow-field" title="Aus: reines Entry-Zeitfenster, High/Low dieser Session ist für die Analyse nicht entscheidend">
        <input v-model="session.highLowRelevant" type="checkbox" />
        High/Low entscheidend
      </label>
      <label class="sessions-danger-field">
        Gefahr
        <select v-model="session.danger" class="sessions-danger-select">
          <option v-for="level in DANGER_LEVELS" :key="level.value" :value="level.value">{{ level.label }}</option>
        </select>
      </label>
    </section>
  </MetadataPanel>
</template>

<style scoped>
.sessions-add {
  display: block;
  width: 100%;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 12px;
}

.sessions-add:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.sessions-empty {
  margin: 0;
  font-size: 13px;
  color: #787b86;
}

.sessions-item {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.sessions-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sessions-label-input {
  flex: 1;
  min-width: 0;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
}

.sessions-swatch-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sessions-swatch {
  appearance: none;
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #2a2e39;
  padding: 0;
  cursor: pointer;
  background: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease, border-color 0.1s ease;
  flex-shrink: 0;
}

.sessions-swatch:hover {
  transform: scale(1.12);
  border-color: #2962ff;
}

.sessions-swatch::-webkit-color-swatch-wrapper {
  padding: 0;
  border-radius: 50%;
}

.sessions-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.sessions-hex {
  font-family: "Courier New", monospace;
  font-size: 11px;
  color: #565a64;
  min-width: 54px;
  text-align: right;
}

.sessions-remove {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
  flex-shrink: 0;
}

.sessions-remove:hover {
  color: #ef5350;
}

.sessions-item-times {
  display: flex;
  gap: 14px;
  margin-top: 8px;
}

.sessions-time-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #787b86;
}

.sessions-time-input {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
  color-scheme: dark;
}

.sessions-item-alpha {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-left: 2px;
}

.sessions-alpha-slider {
  flex: 1;
  height: 3px;
  appearance: none;
  -webkit-appearance: none;
  background: #2a2e39;
  border-radius: 2px;
  cursor: pointer;
}

.sessions-alpha-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #7ea6ff;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.sessions-alpha-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.sessions-alpha-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  background: #7ea6ff;
  cursor: pointer;
}

.sessions-alpha-value {
  font-family: "Courier New", monospace;
  font-size: 10px;
  color: #565a64;
  min-width: 32px;
  text-align: right;
}

.sessions-days-field {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-left: 2px;
}

.sessions-day-toggle {
  flex: 1;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #565a64;
  font-size: 11px;
  padding: 4px 0;
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease;
}

.sessions-day-toggle.active {
  background: #1f2937;
  border-color: #2962ff;
  color: #d1d4dc;
}

.sessions-highlow-field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-left: 2px;
  font-size: 12px;
  color: #9aa0ac;
  cursor: pointer;
}

.sessions-highlow-field input[type="checkbox"] {
  accent-color: #2962ff;
  cursor: pointer;
}

.sessions-danger-field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-left: 2px;
  font-size: 12px;
  color: #9aa0ac;
}

.sessions-danger-select {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  padding: 3px 6px;
  color-scheme: dark;
}
</style>
