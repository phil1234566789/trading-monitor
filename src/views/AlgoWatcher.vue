<script setup>
import { computed, onMounted, ref } from "vue";
import { useAlgoWatcher } from "../composables/useAlgoWatcher.js";
import { watcherTime, testPushover, fetchWatcherProblemHistory } from "../algoWatcher.js";
const { report, error, health, refresh } = useAlgoWatcher();
import {isExpectedWatcherPause,isWatcherMarketGapWindow,watcherIssuePhase,watcherSuspensionGroups} from '../algoWatcherPresentation.js';
import {isRangeWarning} from '../../supabase/functions/_shared/setup2RangeWarnings.js';
import {DEALING_RANGE_LABELS} from '../tradeSetup2DealingRange.js';
const history = ref([]), historyError = ref('');
const historicalIssues = computed(() => history.value.filter(event => !isRangeWarning(event)).slice(0, 30));
const suspensions = computed(() => watcherSuspensionGroups(report.value?.instruments, report.value ? history.value : []));
async function loadHistory() {
  try { history.value = await fetchWatcherProblemHistory(); historyError.value = ''; }
  catch (cause) { historyError.value = cause.message; }
}
onMounted(loadHistory);
function refreshPage() {
  void refresh();
  void loadHistory();
}
const stageLabel = stage => stage === 'invalidated' ? 'Invalid · belegte DR-Entscheidung' : DEALING_RANGE_LABELS[stage] ?? DEALING_RANGE_LABELS.unknown;
const directionLabel = direction => ({long:'Long',short:'Short'})[direction] ?? 'Richtung unbekannt';
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
    <p v-if="health.actionRequired" role="alert" class="error">🔴 Du bist dran · Algo-Watcher: {{ health.action }}</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p>Unabhängige Serverprüfung: {{ watcherTime(report?.checkedAt) }} · gültig bis {{ watcherTime(report?.validUntil) }} (Europe/Berlin)</p>
    <p v-if="isWatcherMarketGapWindow(report?.checkedAt)">Erwartetes Marktlückenfenster · 23:00–00:00 Uhr (Berlin)</p>
    <button type="button" @click="refreshPage">Status aktualisieren</button>
    <section v-for="item in report?.instruments ?? []" :key="item.instrument" class="instrument">
      <h2>{{ item.instrument }} · {{ item.enabled ? item.phase : 'Aus' }}</h2>
      <p v-if="isExpectedWatcherPause(item.marketPause)">Zuletzt belegte erwartete Marktpause · {{ watcherTime(item.marketPause.from) }} bis {{ watcherTime(item.marketPause.until) }}</p>
      <section v-if="item.error" class="range" :role="item.actionRequired ? 'alert' : 'status'">
        <h3 :class="item.actionRequired ? 'error' : 'warning'">Technischer Zustand · {{ watcherIssuePhase(item.evaluationError, item.errorPhase) }}</h3>
        <p>{{ item.error }}</p>
        <p>Seit {{ watcherTime(item.errorSince) }} · Letzter Erfolg {{ watcherTime(item.lastSuccessAt) }}</p>
        <p>{{ item.actionRequired ? 'Marktbeobachtung derzeit nicht verlässlich.' : 'Der ausgewertete Marktstand kann verzögert sein.' }} Wiederherstellung noch nicht bestätigt.</p>
      </section>
      <dl>
        <dt>Ausgewerteter Marktstand</dt><dd>{{ watcherTime(item.marketWatermark) }}</dd>
        <dt>Verzögerung des Marktstands</dt><dd>{{ item.marketLagSeconds == null ? 'Unbekannt' : `${Math.ceil(item.marketLagSeconds)} Sekunden` }}</dd>
        <dt>Prozess-Ping</dt><dd>{{ watcherTime(item.lastProcessAt) }}</dd>
        <dt>Letzter erfolgreicher Algorithmusschritt</dt><dd>{{ watcherTime(item.lastSuccessAt) }}</dd>
        <dt>Zuletzt ausgeführt</dt><dd>{{ item.lastStep ?? item.phase ?? '–' }}</dd>
        <dt>Letzte verarbeitete geschlossene M5-Kerze</dt><dd>{{ watcherTime(item.lastM5Time) }}</dd>
        <dt>Letzte verarbeitete geschlossene M1-Kerze</dt><dd>{{ watcherTime(item.lastM1Time) }}</dd>
        <dt>Nächste erwartete Prüfung</dt><dd>{{ watcherTime(item.nextExpectedCheck) }}</dd>
      </dl>
      <h3>DR-Prüfungen</h3>
      <p v-if="!item.rangeChecks?.length">Keine DR-Einzelprüfung im Statusbericht gespeichert. {{ item.activeRanges?.length ?? 0 }} aktive DR.</p>
      <article v-for="range in item.rangeChecks ?? []" :key="range.setupKey" class="range">
        <strong>{{ range.setupKey }} · {{ directionLabel(range.direction) }} · {{ stageLabel(range.stage) }}</strong>
        <p>Prüfung {{ watcherTime(range.knownAt) }} · {{ range.step ?? 'Prüfschritt nicht belegt' }}</p>
        <p v-if="range.technical" class="warning">Auswertungsfehler · {{ watcherTime(range.technical.at) }} · {{ range.technical.details.join(" · ") || "Ursache nicht belegt" }}. Entry-Prüfung nicht verlässlich.</p>
        <p v-else-if="range.missing">Fehlende Bedingung · {{ range.missing }}</p>
        <p v-else-if="range.step === 'H · Entry finden' && !range.entry">Fehlende Bedingung nicht belegt.</p>
        <p v-if="range.lifecycle === 'ended'">DR beendet · {{ range.lifecycleReason ?? 'Grund unbekannt' }}</p>
        <p v-if="range.entry">Gespeicherter Entry · {{ range.entry.price ?? 'Preis unbekannt' }} · {{ watcherTime(range.entry.recognizedAt) }}</p>
        <p v-for="detail in range.details ?? []" :key="detail">{{ detail }}</p>
      </article>
      <article v-for="range in (item.activeRanges ?? []).filter(active => !item.rangeChecks?.some(check => check.setupKey === active.setupKey))" :key="range.setupKey" class="range">
        <strong>{{ range.setupKey }} · {{ directionLabel(range.direction) }} · DR-Stufe nicht gespeichert</strong>
        <p>Letzte geschlossene M1-Kerze · {{ watcherTime(range.lastM1Time) }}</p>
      </article>
    </section>
    <section class="instrument">
      <h2>Suspendierungen ({{ suspensions.current.length }} aktuell)</h2>
      <p v-if="!suspensions.current.length">Keine Suspendierung im zuletzt geladenen Status.</p>
      <details v-for="item in (report?.instruments ?? []).filter(item => item.suspendedRanges?.length)" :key="item.instrument">
        <summary>{{ item.instrument }} · {{ item.suspendedRanges.length }} aktuell suspendiert</summary>
        <p v-for="range in item.suspendedRanges" :key="range.setupKey">{{ range.setupKey }} · {{ directionLabel(range.direction) }} · {{ watcherTime(range.suspendedAt) }} · {{ range.reason }}</p>
      </details>
      <details v-if="suspensions.historical.length">
        <summary>Historische Protokollmeldungen ({{ suspensions.historical.length }})</summary>
        <p>Aus den letzten 100 Problemmeldungen. Diese Fälle stehen nicht in der Suspendierungsliste des zuletzt geladenen Status.</p>
        <p v-for="event in suspensions.historical" :key="event.id">{{ event.instrument }} · {{ watcherTime(event.signal_at) }} · {{ event.payload?.message ?? 'Ursache nicht belegt' }}</p>
      </details>
      <p v-if="historyError" role="status">{{ historyError }}</p>
      <RouterLink to="/protokoll">Vollständiges Protokoll</RouterLink>
    </section>
    <section v-if="report?.criticalReasons?.some(reason => reason.source !== 'runner')" class="instrument">
      <h2>Technische Störungen</h2>
      <p v-for="reason in report.criticalReasons.filter(reason => reason.source !== 'runner')" :key="reason.source">{{ reason.source === 'cron' ? 'Serverprüfung' : 'Versand' }} · {{ reason.reason }}</p>
    </section>
    <section v-if="historicalIssues.length" class="instrument">
      <details>
        <summary>Technische Protokollmeldungen ({{ historicalIssues.length }})</summary>
        <p v-for="event in historicalIssues" :key="event.id">
          {{ event.instrument }} · {{ watcherTime(event.signal_at) }} ·
          {{ watcherIssuePhase(event.payload?.message, event.payload?.errorPhase) }} ·
          {{ event.payload?.message ?? 'Ursache nicht belegt' }} ·
          Letzter belegter Erfolg zum Meldezeitpunkt {{ watcherTime(event.payload?.lastSuccessAt) }}
        </p>
      </details>
    </section>
    <section class="instrument">
      <h2>Versand</h2>
      <p>Status: {{ report?.delivery?.status ?? '–' }}</p>
      <p>Zuletzt vom Anbieter angenommen: {{ watcherTime(report?.delivery?.lastAcceptedAt) }}</p>
      <p v-if="report?.delivery?.error" role="status" class="error">Versandproblem · {{ watcherTime(report.delivery.issueAt) }} · {{ report.delivery.error }} · Zustellung nicht bestätigt.</p>
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
.live { color: #26a69a; } .waiting, .warning { color: #ffb300; } .error { color: #ef5350; } .off { color: #787b86; }
.instrument { background: #1e222d; border: 1px solid #2a2e39; border-radius: 8px; padding: 18px; margin-top: 18px; }
dl { display: grid; grid-template-columns: minmax(180px, 1fr) 1fr; gap: 10px; } dd { margin: 0; }
summary { cursor: pointer; margin: 8px 0; }
.range { overflow-wrap: anywhere; border-top: 1px solid #2a2e39; padding: 12px 0; }
form { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
input, button { padding: 8px 12px; border: 1px solid #787b86; border-radius: 4px; background: #131722; color: #d1d4dc; }
button { cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
@media (max-width: 600px) { .watcher-page { padding: 16px; } dl { grid-template-columns: 1fr; } dd { margin-bottom: 8px; } }
</style>
