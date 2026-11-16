<script setup>
import { tradingSchedules, WEEKDAY_GROUPS, addWindow, removeWindow } from "../tradingSchedules.js";
import { minutesToTimeInput, timeInputToMinutes } from "../chartTimeUtils.js";

// Ein Fensterblock (Handels- oder Alarmfenster) eines Instruments aus trading_schedules; Handelszeiten- und Alarme-Seite
// bearbeiten so dieselben Daten mit demselben Editor.
defineProps({
  instrument: { type: String, required: true },
  kind: { type: String, required: true },
  title: { type: String, required: true },
  emptyText: { type: String, required: true },
});
</script>

<template>
  <div class="windows-block">
    <div class="windows-block-title">{{ title }}</div>
    <div v-for="group in WEEKDAY_GROUPS" :key="group.key" class="weekday-row">
      <span class="weekday-label">{{ group.label }}</span>
      <div class="windows-list">
        <span v-if="tradingSchedules[instrument][kind][group.key].length === 0" class="windows-empty">{{ emptyText }}</span>
        <span v-for="(win, idx) in tradingSchedules[instrument][kind][group.key]" :key="idx" class="window-chip">
          <input
            :value="minutesToTimeInput(win[0])"
            type="time"
            step="1800"
            class="window-time-input"
            @input="win[0] = timeInputToMinutes($event.target.value)"
          />
          <span class="window-sep">–</span>
          <input
            :value="minutesToTimeInput(win[1])"
            type="time"
            step="1800"
            class="window-time-input"
            @input="win[1] = timeInputToMinutes($event.target.value)"
          />
          <button class="window-remove" title="Fenster entfernen" @click="removeWindow(instrument, kind, group.key, idx)">×</button>
        </span>
        <button class="window-add" @click="addWindow(instrument, kind, group.key)">+ Fenster</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.windows-block {
  margin-bottom: 10px;
}

.windows-block-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #565a64;
  margin-bottom: 6px;
}

.weekday-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.weekday-label {
  flex-shrink: 0;
  width: 60px;
  font-size: 12px;
  color: #9aa0ac;
}

.windows-list {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.windows-empty {
  font-size: 12px;
  color: #565a64;
  font-style: italic;
}

.window-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  padding: 2px 4px;
}

.window-time-input {
  background: transparent;
  border: none;
  color: #d1d4dc;
  font-size: 12px;
  color-scheme: dark;
  width: 74px;
}

.window-sep {
  color: #565a64;
  font-size: 12px;
}

.window-remove {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.window-remove:hover {
  color: #ef5350;
}

.window-add {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
}

.window-add:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}
</style>
