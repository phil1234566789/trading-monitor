<script setup>
import { tradingSchedules, WEEKDAY_GROUPS, addWindow, removeWindow } from "../tradingSchedules.js";
import { minutesToTimeInput, timeInputToMinutes } from "../chartTimeUtils.js";

const INSTRUMENTS = ["BTC-USDT", "GBPUSD", "EURUSD", "XAUUSD"];
</script>

<template>
  <div class="handelszeiten-wrapper">
    <h2 class="handelszeiten-title">Handelszeiten</h2>
    <p class="handelszeiten-hint">
      Referenz-Zeiten je Instrument (Europe/Berlin, wie überall sonst im Dashboard) — "Handelsfenster" ist,
      wann ein Trade eröffnet werden darf, "Alarmfenster" steuert, wann der poi-watcher dafür tatsächlich
      Telegram-Nachrichten verschickt (bewusst oft breiter, für Vorbereitungszeit). Vorsicht-/Sperr-Zeitfenster
      innerhalb eines Handelsfensters (z.B. MMM-Session) werden als Chart-Session mit "Gefahr"-Flag gepflegt,
      nicht hier.
    </p>

    <section v-for="instrument in INSTRUMENTS" :key="instrument" class="instrument-card">
      <h3 class="instrument-title">{{ instrument }}</h3>

      <div class="windows-block">
        <div class="windows-block-title">Handelsfenster</div>
        <div v-for="group in WEEKDAY_GROUPS" :key="group.key" class="weekday-row">
          <span class="weekday-label">{{ group.label }}</span>
          <div class="windows-list">
            <span v-if="tradingSchedules[instrument].tradingWindows[group.key].length === 0" class="windows-empty">
              kein Handel
            </span>
            <span
              v-for="(win, idx) in tradingSchedules[instrument].tradingWindows[group.key]"
              :key="idx"
              class="window-chip"
            >
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
              <button class="window-remove" title="Fenster entfernen" @click="removeWindow(instrument, 'tradingWindows', group.key, idx)">×</button>
            </span>
            <button class="window-add" @click="addWindow(instrument, 'tradingWindows', group.key)">+ Fenster</button>
          </div>
        </div>
      </div>

      <div class="windows-block">
        <div class="windows-block-title">Alarmfenster</div>
        <div v-for="group in WEEKDAY_GROUPS" :key="group.key" class="weekday-row">
          <span class="weekday-label">{{ group.label }}</span>
          <div class="windows-list">
            <span v-if="tradingSchedules[instrument].alarmWindows[group.key].length === 0" class="windows-empty">
              keine Alarme
            </span>
            <span
              v-for="(win, idx) in tradingSchedules[instrument].alarmWindows[group.key]"
              :key="idx"
              class="window-chip"
            >
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
              <button class="window-remove" title="Fenster entfernen" @click="removeWindow(instrument, 'alarmWindows', group.key, idx)">×</button>
            </span>
            <button class="window-add" @click="addWindow(instrument, 'alarmWindows', group.key)">+ Fenster</button>
          </div>
        </div>
      </div>

      <label class="notes-field">
        Notizen
        <textarea v-model="tradingSchedules[instrument].notes" class="notes-textarea" rows="2" />
      </label>
    </section>
  </div>
</template>

<style scoped>
.handelszeiten-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.handelszeiten-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.handelszeiten-hint {
  font-size: 12px;
  color: #787b86;
  margin: 0 0 20px;
  max-width: 720px;
}

.instrument-card {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
  max-width: 720px;
}

.instrument-title {
  font-size: 14px;
  font-weight: 600;
  color: #d1d4dc;
  margin: 0 0 10px;
}

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

.notes-field {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #565a64;
  margin-top: 12px;
}

.notes-textarea {
  display: block;
  width: 100%;
  margin-top: 6px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 8px;
  resize: vertical;
  text-transform: none;
  letter-spacing: normal;
}
</style>
