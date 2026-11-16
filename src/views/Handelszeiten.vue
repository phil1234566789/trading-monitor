<script setup>
import { tradingSchedules } from "../tradingSchedules.js";
import ScheduleWindowsEditor from "../components/ScheduleWindowsEditor.vue";

const INSTRUMENTS = ["GBPUSD", "EURUSD", "XAUUSD"];
</script>

<template>
  <div class="handelszeiten-wrapper">
    <h2 class="handelszeiten-title">Handelszeiten</h2>
    <p class="handelszeiten-hint">
      Referenz-Zeiten je Instrument (Europe/Berlin, wie überall sonst im Dashboard) — "Handelsfenster" ist,
      wann ein Trade eröffnet werden darf, "Alarmfenster" steuert, wann der poi-watcher (XAUUSD: der dob-watcher) dafür tatsächlich
      Telegram-Nachrichten verschickt (bewusst oft breiter, für Vorbereitungszeit). Vorsicht-/Sperr-Zeitfenster
      innerhalb eines Handelsfensters (z.B. MMM-Session) werden als Chart-Session mit "Gefahr"-Flag gepflegt,
      nicht hier.
    </p>

    <section v-for="instrument in INSTRUMENTS" :key="instrument" class="instrument-card">
      <h3 class="instrument-title">{{ instrument }}</h3>

      <ScheduleWindowsEditor :instrument="instrument" kind="tradingWindows" title="Handelsfenster" empty-text="kein Handel" />
      <ScheduleWindowsEditor :instrument="instrument" kind="alarmWindows" title="Alarmfenster" empty-text="keine Alarme" />

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
