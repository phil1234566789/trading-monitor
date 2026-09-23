<script setup>
// Claude-Antwort-Import (siehe annotations.js, trading/chart-daten.md) — Philip
// pastet das JSON, das ihm der Claude-Project-Chat als Antwort auf einen Backtest/Tagesablauf-
// Review geschickt hat, hier rein, damit er visuell nachvollziehen kann, was gemeint ist, statt
// nur Text zu lesen. Modal-Look wie NewsModal/SessionsModal (MetadataPanel-Wrapper).
//
// Seit Chat 2026-07-28 in Supabase persistiert (siehe useDrawings.js/
// drawingsStore.js) — jeder Klick auf "Zeichnen" legt eine NEUE Zeichnung für den
// aktuellen Tag an (akkumuliert über einen Chat-Verlauf hinweg), statt die vorherige zu
// überschreiben. Liste unten zeigt alle Zeichnungen des aktuellen Tages mit Lösch-Button — kein
// Editieren (Philip: "brauch ich nicht, da es ja von Claude kommt").
import { ref } from "vue";
import MetadataPanel from "./MetadataPanel.vue";
import { parseAnnotations } from "../annotations.js";
import { useDrawings } from "../composables/useDrawings.js";
import { fmtDateTime } from "../format.js";

const emit = defineEmits(["close"]);

const { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } = useDrawings();

const text = ref("");
const error = ref(null);
const saving = ref(false);
const removingId = ref(null);
const togglingId = ref(null);

// parseAnnotations gibt seit 2026-07-30 immer eine Liste von Gruppen zurück (auch fürs alte,
// flache Format — dann genau eine Gruppe mit title: null). Jede Gruppe wird eine eigene Zeile;
// title: null (altes Format, kein "drawings"-Objekt) bekommt hier einen Default-Titel mit dem
// aktuellen Zeitstempel, bewusst EIN gemeinsamer Zeitstempel für den ganzen Paste statt pro Gruppe.
async function applyText() {
  let groups;
  try {
    groups = parseAnnotations(text.value);
  } catch (err) {
    error.value = err.message;
    return;
  }
  error.value = null;
  saving.value = true;
  const defaultTitle = `Zeichnungen [${fmtDateTime(Math.floor(Date.now() / 1000))}]`;
  try {
    let allOk = true;
    for (const group of groups) {
      const row = await add(group.annotations, group.title ?? defaultTitle);
      if (!row) allOk = false;
    }
    if (allOk) {
      text.value = ""; // bereit für die nächste Zeichnung aus demselben Chat-Verlauf
    } else {
      error.value = "Speichern fehlgeschlagen — siehe Konsole.";
    }
  } finally {
    saving.value = false;
  }
}

async function removeDrawing(id) {
  removingId.value = id;
  try {
    await remove(id);
  } finally {
    removingId.value = null;
  }
}

async function toggleDrawingVisible(d) {
  togglingId.value = d.id;
  try {
    await setDrawingVisible(d.id, !d.visible);
  } finally {
    togglingId.value = null;
  }
}
</script>

<template>
  <MetadataPanel title="🖍 Zeichnungen" @close="emit('close')">
    <p class="drawings-hint">
      {{ instrument }} — {{ dateStr }}. JSON aus dem Claude-Project-Chat hier einfügen (siehe
      trading/chart-daten.md) und "Zeichnen" klicken — jeder Klick fügt eine weitere
      Zeichnung hinzu, ersetzt keine vorherige. Ein Paste mit mehreren
      <code>{"drawings":[{"title":...,"annotations":[...]},...]}</code>-Gruppen legt jede Gruppe
      als eigene, einzeln aus-/einblendbare Zeichnung an.
    </p>
    <textarea
      v-model="text"
      class="drawings-textarea"
      placeholder='[{"type":"marker","time":"09:15","price":1.33120,"text":"..."}]'
    ></textarea>
    <div class="drawings-actions">
      <button class="drawings-btn" :disabled="saving" @click="applyText">
        {{ saving ? "Speichert…" : "Zeichnen" }}
      </button>
    </div>
    <p v-if="error" class="drawings-error">{{ error }}</p>

    <div class="drawings-list-header">
      <h4 class="drawings-subheading">Zeichnungen dieses Tages</h4>
      <span v-if="loading" class="drawings-hint-inline">lädt…</span>
    </div>
    <p v-if="!loading && drawings.length === 0" class="drawings-hint-inline">Noch keine.</p>
    <ul v-else class="drawings-list">
      <li v-for="d in drawings" :key="d.id" class="drawings-list-item">
        <label class="drawings-list-toggle" :title="d.visible ? 'Zeichnung ausblenden' : 'Zeichnung einblenden'">
          <input
            type="checkbox"
            :checked="d.visible"
            :disabled="togglingId === d.id"
            @change="toggleDrawingVisible(d)"
          />
          <span class="drawings-list-meta">
            {{ d.title }}
            <span class="drawings-list-submeta">
              · {{ fmtDateTime(d.created_at) }} · {{ d.annotations.length }} {{ d.annotations.length === 1 ? "Element" : "Elemente" }}
            </span>
          </span>
        </label>
        <button
          class="drawings-remove-btn"
          :disabled="removingId === d.id"
          title="Diese Zeichnung löschen"
          @click="removeDrawing(d.id)"
        >
          🗑
        </button>
      </li>
    </ul>
  </MetadataPanel>
</template>

<style scoped>
.drawings-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #787b86;
}

.drawings-hint-inline {
  font-size: 12px;
  color: #787b86;
}

.drawings-textarea {
  width: 100%;
  min-height: 140px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  font-family: monospace;
  padding: 8px;
  resize: vertical;
  box-sizing: border-box;
}

.drawings-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.drawings-btn {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #d1d4dc;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.drawings-btn:hover:not(:disabled) {
  border-color: #2962ff;
}

.drawings-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.drawings-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #ef5350;
}

.drawings-list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 14px 0 6px;
}

.drawings-subheading {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.drawings-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawings-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  font-size: 12px;
}

.drawings-list-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  min-width: 0;
}

.drawings-list-toggle input {
  flex: none;
  cursor: pointer;
}

.drawings-list-meta {
  color: #d1d4dc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawings-list-submeta {
  color: #787b86;
}

.drawings-remove-btn {
  flex: none;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #787b86;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.drawings-remove-btn:hover:not(:disabled) {
  border-color: #ef5350;
  color: #ef5350;
}

.drawings-remove-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
