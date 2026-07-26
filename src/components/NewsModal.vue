<script setup>
import { ref } from "vue";
import { newsEvents, addNewsEvent, removeNewsEvent } from "../newsEvents.js";
import MetadataPanel from "./MetadataPanel.vue";

// Manueller Fallback-Weg (Chat 2026-07-26: "wo kann ich manuell die News eintragen, wenn mir mal
// die claude tokens ausgehen o.ä.") — normalerweise trägt Claude High-Impact-Termine per
// ForexFactory-Screenshot + Daten-Migration ein (siehe CLAUDE.md "Trade-Setup-Cockpit: No-Gos and
// anti-confluences"), dieses Modal ist der direkte Weg aus dem Browser für den Fall, dass das mal
// nicht zur Verfügung steht.
const emit = defineEmits(["close"]);

const CURRENCIES = ["EUR", "GBP", "USD"];

const newDateTime = ref("");
const newCurrency = ref("EUR");
const newTitle = ref("");
const saving = ref(false);

// <input type="datetime-local"> liefert "YYYY-MM-DDTHH:mm" in Browser-Lokalzeit — new Date(v)
// parst das wieder als Lokalzeit (derselbe Roundtrip wie replayInputValue in Dashboard.vue), kein
// eigenes Zeitzonen-Handling nötig, solange der Rechner auf Europe/Berlin steht.
async function submit() {
  if (!newDateTime.value || !newTitle.value.trim()) return;
  saving.value = true;
  const ok = await addNewsEvent({
    eventTime: Math.floor(new Date(newDateTime.value).getTime() / 1000),
    currency: newCurrency.value,
    title: newTitle.value.trim(),
  });
  saving.value = false;
  if (ok) {
    newDateTime.value = "";
    newTitle.value = "";
  }
}

// Europe/Berlin, DST-aware (siehe CLAUDE.md "Trading-hours / timezone handling") — volles Datum
// hier (anders als die kompakte "Do 14:15"-Chart-Beschriftung in newsMarkers.js), weil dieselbe
// Wochentag+Uhrzeit-Kombination sich über mehrere Wochen wiederholt und in dieser Liste eindeutig
// bleiben muss.
const LIST_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
function formatListEntry(eventTimeSec) {
  return LIST_FORMATTER.format(new Date(eventTimeSec * 1000));
}
</script>

<template>
  <MetadataPanel title="📰 News verwalten" @close="emit('close')">
    <form class="news-add" @submit.prevent="submit">
      <input v-model="newDateTime" type="datetime-local" class="news-datetime-input" required />
      <select v-model="newCurrency" class="news-currency-select">
        <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
      </select>
      <input v-model="newTitle" type="text" class="news-title-input" placeholder="Titel (z.B. Main Refinancing Rate)" required />
      <button type="submit" class="news-add-btn" :disabled="saving">+ Hinzufügen</button>
    </form>
    <p v-if="newsEvents.length === 0" class="news-empty">Noch keine News-Termine eingetragen.</p>
    <section v-for="event in newsEvents" :key="event.id" class="news-item">
      <span class="news-item-time">{{ formatListEntry(event.eventTime) }}</span>
      <span class="news-item-currency">{{ event.currency }}</span>
      <span class="news-item-title">{{ event.title }}</span>
      <button class="news-remove" title="Termin löschen" @click="removeNewsEvent(event.id)">×</button>
    </section>
  </MetadataPanel>
</template>

<style scoped>
.news-add {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.news-datetime-input,
.news-currency-select,
.news-title-input {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
}

.news-title-input {
  flex: 1;
  min-width: 160px;
}

.news-add-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.news-add-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.news-empty {
  margin: 0;
  font-size: 13px;
  color: #787b86;
}

.news-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.news-item-time {
  font-family: "Courier New", monospace;
  font-size: 12px;
  color: #9aa0ac;
  flex-shrink: 0;
}

.news-item-currency {
  font-size: 12px;
  font-weight: 700;
  color: #ef5350;
  flex-shrink: 0;
}

.news-item-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #d1d4dc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.news-remove {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
  flex-shrink: 0;
}

.news-remove:hover {
  color: #ef5350;
}
</style>
