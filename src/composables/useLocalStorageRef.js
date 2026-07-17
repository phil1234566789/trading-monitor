import { ref, watch } from "vue";

const STORAGE_PREFIX = "trading-monitor:";

// Persistiert einen ref-Wert in localStorage (JSON-serialisiert) — für die Dashboard-Toggles
// (Historische OBs, Liquidität, Trendanalyse, ...), die ihren Zustand über Reloads hinweg
// behalten sollen, statt bei jedem Neuladen auf die Default-Werte zurückzuspringen.
export function useLocalStorageRef(key, defaultValue) {
  const storageKey = STORAGE_PREFIX + key;

  let initial = defaultValue;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) initial = JSON.parse(raw);
  } catch {
    initial = defaultValue; // korrupter/fremder Wert unter dem Key -> ignorieren, Default nutzen
  }

  const value = ref(initial);
  watch(value, (v) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — dann gilt der Toggle halt nur
      // für die aktuelle Session, kein Show-Stopper.
    }
  });

  return value;
}
