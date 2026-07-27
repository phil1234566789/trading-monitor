import { ref } from "vue";

// Modul-weiter Singleton (wie useStatusBar.js) — geteilt zwischen App.vue (Toggle-Button +
// Import-Modal, global in der Status-Leiste neben "Backtest-Daten", nicht an den Chart gekoppelt)
// und Dashboard.vue/PriceChart.vue (rendert die Annotationen). Bewusst NICHT in localStorage:
// Ad-hoc-Kommentar für die laufende Review-Session, kein dauerhafter Chart-Zustand wie die
// übrigen Toggles.
const annotations = ref([]);
const visible = ref(true);

export function useClaudeAnnotations() {
  function apply(list) {
    annotations.value = list;
    visible.value = true; // frisch importiert -> direkt sichtbar, kein zusätzlicher Klick nötig
  }
  function clear() {
    annotations.value = [];
  }
  return { annotations, visible, apply, clear };
}
