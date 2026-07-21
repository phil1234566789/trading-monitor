<script setup>
import { sessions, addSession, removeSession } from "../sessions.js";
import MetadataPanel from "./MetadataPanel.vue";

const emit = defineEmits(["close"]);

// <input type="time" step="1800"> liefert/erwartet "HH:MM" (Browser-Lokalzeit-Anzeige, aber reiner
// Text ohne Zeitzone) — Speicherformat ist Minuten seit Mitternacht (siehe sessions.js:
// sessionOccurrences), daher der Roundtrip hier.
function minutesToTimeInput(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeInputToMinutes(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
</script>

<template>
  <MetadataPanel title="🕒 Sessions" @close="emit('close')">
    <button class="sessions-add" @click="addSession">+ Session hinzufügen</button>
    <p v-if="sessions.length === 0" class="sessions-empty">
      Noch keine Sessions angelegt — "+ Session hinzufügen" für die erste.
    </p>
    <section v-for="session in sessions" :key="session.id" class="sessions-item">
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
      <label class="sessions-highlow-field" title="Aus: reines Entry-Zeitfenster, High/Low dieser Session ist für die Analyse nicht entscheidend">
        <input v-model="session.highLowRelevant" type="checkbox" />
        High/Low entscheidend
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
</style>
