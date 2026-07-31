import { ref } from "vue";

// Modul-weiter Singleton (wie useStatusBar.js/useClaudeAnnotations.js) — geteilt zwischen
// DataExportModal.vue (App.vue, global) und PriceChart.vue (Debug-Metadaten-Panel), damit der
// zuletzt generierte Daten-Export auch im Frontend-Debug-Panel sichtbar ist, nicht nur in
// .debug/metadata.json (Philip 2026-07-28: "für die Nachvollziehbarkeit wäre es im Frontend auch
// nicht schlecht"). Bewusst nicht persistiert — nur der zuletzt generierte Export dieser Session.
const lastDataExport = ref(null);

export function useLastDataExport() {
  function set(value) {
    lastDataExport.value = value;
  }
  return { lastDataExport, set };
}
