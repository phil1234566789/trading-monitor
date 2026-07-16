<script setup>
import { ref, onMounted } from "vue";
import { fetchAlarmSettings, setAlarmEnabled } from "../alarmSettings.js";

const alarms = ref([]);
const loading = ref(true);
const errorText = ref("");

onMounted(async () => {
  try {
    alarms.value = await fetchAlarmSettings();
  } catch (err) {
    errorText.value = "Alarme konnten nicht geladen werden: " + err.message;
  } finally {
    loading.value = false;
  }
});

async function toggle(alarm) {
  const previous = alarm.enabled;
  alarm.enabled = !previous; // optimistisch — poi-watcher-Cron läuft jede Minute, kein Grund auf den Roundtrip zu warten
  try {
    await setAlarmEnabled(alarm.key, alarm.enabled);
  } catch (err) {
    alarm.enabled = previous; // zurückrollen, wenn der Write fehlschlägt
    errorText.value = "Umschalten fehlgeschlagen: " + err.message;
  }
}
</script>

<template>
  <div class="alarme-wrapper">
    <h2 class="alarme-title">Alarme</h2>
    <p class="alarme-hint">
      Steuert nur den Telegram-Versand — Erkennung/Speicherung läuft für alle Typen immer weiter, auch wenn der
      Alarm hier ausgeschaltet ist.
    </p>

    <p v-if="errorText" class="alarme-error">{{ errorText }}</p>
    <p v-else-if="loading" class="alarme-hint">Lade...</p>

    <div v-else class="alarme-list">
      <div v-for="alarm in alarms" :key="alarm.key" class="alarme-row">
        <div class="alarme-info">
          <div class="alarme-label">{{ alarm.label }}</div>
          <div class="alarme-description">{{ alarm.description }}</div>
        </div>
        <button
          class="alarme-switch"
          :class="{ on: alarm.enabled }"
          role="switch"
          :aria-checked="alarm.enabled"
          @click="toggle(alarm)"
        >
          <span class="alarme-switch-knob"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alarme-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.alarme-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.alarme-hint {
  font-size: 12px;
  color: #787b86;
  margin: 0 0 20px;
}

.alarme-error {
  font-size: 13px;
  color: #ef5350;
}

.alarme-list {
  display: flex;
  flex-direction: column;
  max-width: 640px;
}

.alarme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #2a2e39;
}

.alarme-label {
  font-size: 14px;
  color: #d1d4dc;
  font-weight: 500;
}

.alarme-description {
  font-size: 12px;
  color: #787b86;
  margin-top: 2px;
}

.alarme-switch {
  flex-shrink: 0;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: #2a2e39;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s ease;
}

.alarme-switch.on {
  background: #2962ff;
}

.alarme-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.alarme-switch.on .alarme-switch-knob {
  transform: translateX(18px);
}
</style>
