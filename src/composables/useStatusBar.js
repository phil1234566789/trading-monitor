import { ref } from "vue";

// Modul-weiter Singleton-Ref, geteilt von allen Importern (Chart-Polls, Trades-/POI-Polls,
// Protokoll-Poll) — ersetzt die frueher pro Seite duplizierte Status-Leisten-Logik.
const lastSuccessAt = ref(null);

export function useStatusBar() {
  function markSuccess() {
    lastSuccessAt.value = Date.now();
  }

  return { lastSuccessAt, markSuccess };
}
