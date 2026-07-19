import { ref, watch } from "vue";

const STORAGE_PREFIX = "trading-monitor:";

// Wie useLocalStorageRef, aber sessionStorage statt localStorage — sessionStorage ist PRO TAB
// isoliert (auch bei gleichem Origin), localStorage dagegen tab-übergreifend geteilt. Für Werte,
// die sich zwei gleichzeitig offene Tabs bewusst NICHT teilen sollen (siehe Chat 2026-07-19:
// "ich hab zwei Tabs offen, eins im M5 und eins im 1h" — currentBar).
export function useSessionStorageRef(key, defaultValue) {
  const storageKey = STORAGE_PREFIX + key;

  let initial = defaultValue;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw !== null) initial = JSON.parse(raw);
  } catch {
    initial = defaultValue; // korrupter/fremder Wert unter dem Key -> ignorieren, Default nutzen
  }

  const value = ref(initial);
  watch(value, (v) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(v));
    } catch {
      // sessionStorage kann fehlschlagen (privater Modus, Quota) — dann gilt der Wert halt nur
      // im Speicher, kein Show-Stopper.
    }
  });

  return value;
}
