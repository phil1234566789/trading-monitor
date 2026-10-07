<script setup>
import { ref } from "vue";
import { useAlgoWatcher } from "../composables/useAlgoWatcher.js";
import { watcherTime, testPushover } from "../algoWatcher.js";
const { report, error, health, refresh } = useAlgoWatcher();
const password = ref("");
const sending = ref(false);
const testResult = ref("");
async function sendTest() {
  if (sending.value || !password.value) return;
  sending.value = true;
  testResult.value = "Test wird gesendet …";
  try {
    await testPushover(password.value);
    testResult.value = "Pushover hat den Test angenommen. Empfang auf dem Handy bitte prüfen.";
  } catch (err) { testResult.value = err.message; }
  finally { password.value = ""; sending.value = false; }
}
</script>

<template>
  <main class="watcher-page">
    <h1>Algo Watcher <span class="health" :class="health.state">{{ health.label }}</span></h1>
    <p>{{ health.reason }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p>Unabhängige Serverprüfung: {{ watcherTime(report?.checkedAt) }} · gültig bis {{ watcherTime(report?.validUntil) }} (Europe/Berlin)</p>
    <button type="button" @click="refresh">Status aktualisieren</button>
    <section v-for="item in report?.instruments ?? []" :key="item.instrument" class="instrument">
      <h2>{{ item.instrument }} · {{ item.enabled ? item.phase : 'Aus' }}</h2>
      <p v-if="item.error" role="alert" class="error">{{ item.error }}</p>
      <dl>
        <dt>Prozess-Ping</dt><dd>{{ watcherTime(item.lastProcessAt) }}</dd>
        <dt>Letzter erfolgreicher Algorithmusschritt</dt><dd>{{ watcherTime(item.lastSuccessAt) }}</dd>
        <dt>Zuletzt ausgeführt</dt><dd>{{ item.lastStep ?? item.phase ?? '–' }}</dd>
        <dt>Letzte verarbeitete geschlossene M5-Kerze</dt><dd>{{ watcherTime(item.lastM5Time) }}</dd>
        <dt>Letzte verarbeitete geschlossene M1-Kerze</dt><dd>{{ watcherTime(item.lastM1Time) }}</dd>
        <dt>Nächste erwartete Prüfung</dt><dd>{{ watcherTime(item.nextExpectedCheck) }}</dd>
      </dl>
      <template v-if="item.suspendedRanges?.length">
        <h3>Suspendierte Dealing Ranges ({{ item.suspendedRanges.length }})</h3>
        <p>Lifecycle konnte wegen fehlender oder lückenhafter Historie nicht ermittelt werden. Keine Entry-Freigabe.</p>
        <p v-for="range in item.suspendedRanges" :key="range.setupKey">{{ range.setupKey }} · {{ range.direction === 'long' ? 'Long' : 'Short' }}</p>
      </template>
      <h3>Aktive Dealing Ranges ({{ item.activeRanges?.length ?? 0 }})</h3>
      <p v-if="!item.activeRanges?.length">Keine aktive DR. Setup 1.0 wird weiter beobachtet.</p>
      <div class="range" v-for="range in item.activeRanges ?? []" :key="range.setupKey">
        <strong>{{ range.setupKey }} · {{ range.direction === 'long' ? 'Long' : 'Short' }}</strong>
        <p>{{ range.structureReady ? 'BOS + M1-Pivot erfüllt · wartet auf Retest / FVG / Entry' : 'Wartet auf BOS + M1-Pivot' }}</p>
        <p>Letzte geschlossene M1-Kerze: {{ watcherTime(range.lastM1Time) }}</p>
      </div>
    </section>
    <section class="instrument">
      <h2>Versand</h2>
      <p>Status: {{ report?.delivery?.status ?? '–' }}</p>
      <p>Zuletzt vom Anbieter angenommen: {{ watcherTime(report?.delivery?.lastAcceptedAt) }}</p>
      <p v-if="report?.delivery?.error" role="alert" class="error">{{ report.delivery.error }}</p>
      <RouterLink to="/protokoll">Alarm-Protokoll öffnen</RouterLink>
    </section>
    <section class="instrument">
      <h2>Pushover testen</h2>
      <form @submit.prevent="sendTest">
        <label for="pushover-password">Test-Passwort</label>
        <input id="pushover-password" v-model="password" type="password" autocomplete="off" :disabled="sending" required />
        <button type="submit" :disabled="sending || !password">{{ sending ? 'Sendet …' : 'Pushover testen' }}</button>
      </form>
      <p role="status" aria-live="polite">{{ testResult }}</p>
    </section>
  </main>
</template>

<style scoped>
.watcher-page { max-width: 1050px; margin: 0 auto; padding: 24px; color: #d1d4dc; }
.health { font-size: 16px; padding: 4px 10px; border-radius: 6px; background: #2a2e39; }
.live { color: #26a69a; } .waiting { color: #ffb300; } .error { color: #ef5350; } .off { color: #787b86; }
.instrument { background: #1e222d; border: 1px solid #2a2e39; border-radius: 8px; padding: 18px; margin-top: 18px; }
dl { display: grid; grid-template-columns: minmax(180px, 1fr) 1fr; gap: 10px; } dd { margin: 0; }
.range { border-top: 1px solid #2a2e39; padding: 12px 0; }
form { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
input, button { padding: 8px 12px; border: 1px solid #787b86; border-radius: 4px; background: #131722; color: #d1d4dc; }
button { cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
@media (max-width: 600px) { .watcher-page { padding: 16px; } dl { grid-template-columns: 1fr; } dd { margin-bottom: 8px; } }
</style>
