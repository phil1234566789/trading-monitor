import { ref, computed, watch } from "vue";
import { useLocalStorageRef } from "./useLocalStorageRef.js";
import { berlinDateStrFor } from "../backtestExport.js";
import { fetchClaudeAnnotations, addClaudeAnnotationDrawing, removeClaudeAnnotationDrawing } from "../claudeAnnotationsStore.js";

// Modul-weiter Singleton (wie useStatusBar.js) — geteilt zwischen App.vue (Toggle-Button +
// Import-Modal, global in der Status-Leiste neben "Backtest-Daten") und Dashboard.vue/
// PriceChart.vue (rendert die Annotationen). Seit Chat 2026-07-28 in Supabase persistiert
// (claude_annotations, siehe claudeAnnotationsStore.js) statt nur In-Memory — vorher ging beim
// erneuten Öffnen des Modals die zuletzt gepastete Zeichnung "verloren" (leeres Textfeld), und ein
// neuer Paste ERSETZTE die vorherige Zeichnung komplett, statt über einen Chat-Verlauf hinweg
// mehrere Zeichnungen desselben Tages zu akkumulieren.
//
// instrument/dateStr sind bewusst hier zentralisiert (nicht mehr separat in Dashboard.vue
// berechnet) — dieselben Keys/Defaults wie Dashboard.vue (currentSymbol/replayTime/replayActive),
// damit Store-Fetch, Rendering (claudeAnnotationsDate-Prop) und die Anzeige im Modal garantiert
// denselben Tag/Instrument meinen. "Der aktuelle Chart-Zeitpunkt, oder der Backtest-Tag, falls
// Replay/Backtest aktiv ist" (Philip 2026-07-28) — exakt dieselbe Herleitung wie
// BacktestExportModal.vue's dateStr-Vorbelegung.
const currentSymbol = useLocalStorageRef("currentSymbol", "GBPUSD");
const replayTime = useLocalStorageRef("replayTime", 1783011600);
const replayActive = useLocalStorageRef("replayActive", false);

const instrument = computed(() => currentSymbol.value);
const dateStr = computed(() => (replayActive.value ? berlinDateStrFor(replayTime.value) : berlinDateStrFor(Math.floor(Date.now() / 1000))));

const drawings = ref([]); // [{id, instrument, date, annotations, created_at}, ...] für instrument+dateStr
const visible = ref(true);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    drawings.value = await fetchClaudeAnnotations(instrument.value, dateStr.value);
  } finally {
    loading.value = false;
  }
}
// Instrument-/Tageswechsel (Symbol-Switch, Replay-Zeitpunkt geändert, Replay an/aus) lädt die
// Liste automatisch neu — Philip sieht beim Umschalten immer die zu diesem Tag gehörenden
// Zeichnungen, nicht die vom vorher betrachteten Tag.
watch([instrument, dateStr], load, { immediate: true });

// Jeder Klick auf "Zeichnen" legt eine NEUE Zeile an (fügt hinzu), statt die Liste zu ersetzen.
async function add(annotationsList) {
  const row = await addClaudeAnnotationDrawing(instrument.value, dateStr.value, annotationsList);
  if (row) {
    drawings.value.push(row);
    visible.value = true; // frisch gezeichnet -> direkt sichtbar, kein zusätzlicher Klick nötig
  }
  return row;
}

async function remove(id) {
  const ok = await removeClaudeAnnotationDrawing(id);
  if (ok) drawings.value = drawings.value.filter((d) => d.id !== id);
  return ok;
}

// Für PriceChart.vue: alle Zeichnungen des aktuellen Tages zu einer flachen Liste zusammengefasst
// (die Primitives kennen keine "Zeichnung", nur einzelne Annotationen).
const flatAnnotations = computed(() => drawings.value.flatMap((d) => d.annotations));

export function useClaudeAnnotations() {
  return { instrument, dateStr, drawings, visible, loading, flatAnnotations, load, add, remove };
}
