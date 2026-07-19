<script setup>
import { ref } from "vue";
import { useHttpActivity, dismissHttpError } from "../composables/useHttpActivity.js";

// Bug-Report Philip 2026-07-19: cTrader-Request blieb beim M5-TF-Wechsel minutenlang hängen, ohne
// dass im UI irgendwas davon zu sehen war. Zeigt JEDEN fehlgeschlagenen HTTP-Request (siehe
// useHttpActivity.js: window.fetch-Patch deckt automatisch alles ab, auch supabase-js) als Banner
// — bleibt bewusst stehen, bis der Nutzer es per "×" wegklickt (KEIN Auto-Timeout), damit Zeit
// bleibt, den Fehlertext rauszukopieren.
const { errors } = useHttpActivity();
const copiedId = ref(null);

async function copyError(err) {
  const text = `${err.label} (${err.status ?? "kein HTTP-Status, z.B. Netzwerkfehler/Timeout"}): ${err.message}`;
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = err.id;
    setTimeout(() => {
      if (copiedId.value === err.id) copiedId.value = null;
    }, 2000);
  } catch (e) {
    console.error("Kopieren fehlgeschlagen:", e);
  }
}
</script>

<template>
  <div v-if="errors.length > 0" class="http-error-banners">
    <div v-for="err in errors" :key="err.id" class="http-error-banner">
      <div class="http-error-main">
        <span class="http-error-label">{{ err.label }}</span>
        <span v-if="err.status" class="http-error-status">HTTP {{ err.status }}</span>
        <span class="http-error-time">{{ new Date(err.at).toLocaleTimeString("de-DE") }}</span>
        <span v-if="err.count > 1" class="http-error-count">×{{ err.count }}</span>
      </div>
      <div class="http-error-message">{{ err.message }}</div>
      <div class="http-error-actions">
        <button class="http-error-copy" @click="copyError(err)">
          {{ copiedId === err.id ? "Kopiert!" : "Kopieren" }}
        </button>
        <button class="http-error-dismiss" title="Wegklicken" @click="dismissHttpError(err.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.http-error-banners {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #2a2e39;
  border-bottom: 1px solid #2a2e39;
}

.http-error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #3a1f22;
  font-size: 13px;
  color: #f0d0d0;
}

.http-error-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: none;
}

.http-error-label {
  font-weight: 600;
  color: #ef5350;
}

.http-error-status {
  color: #d1a3a3;
  font-size: 12px;
}

.http-error-time {
  color: #a08585;
  font-size: 12px;
}

.http-error-count {
  color: #ef5350;
  font-size: 12px;
  font-weight: 600;
}

.http-error-message {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: monospace;
  color: #f0d0d0;
}

.http-error-actions {
  display: flex;
  gap: 6px;
  flex: none;
}

.http-error-copy {
  background: #4a2529;
  border: 1px solid #6a3539;
  color: #f0d0d0;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}

.http-error-copy:hover {
  background: #5a2f34;
}

.http-error-dismiss {
  background: transparent;
  border: none;
  color: #f0d0d0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.http-error-dismiss:hover {
  color: #fff;
}
</style>
