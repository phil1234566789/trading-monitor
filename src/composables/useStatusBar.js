import { reactive, ref } from "vue";

// Modul-weiter Singleton-Ref, geteilt von allen Importern (Chart-Polls, Trades-/POI-Polls,
// Protokoll-Poll) — ersetzt die frueher pro Seite duplizierte Status-Leisten-Logik.
const lastSuccessAt = ref(null);
const pageStatuses = reactive(new Map());

export function useStatusBar() {
  function markSuccess() {
    lastSuccessAt.value = Date.now();
  }

  return { lastSuccessAt, markSuccess, pageStatuses,
    setPageStatus:(path,value)=>pageStatuses.set(path,value),
    clearPageStatus:path=>pageStatuses.delete(path) };
}
