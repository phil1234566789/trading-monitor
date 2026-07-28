import { ref, watch } from "vue";

const STORAGE_PREFIX = "trading-monitor:";
// Cache je Key (Chat 2026-07-28) — ohne den erzeugte jeder Aufrufer eine EIGENE, unabhängige ref-
// Instanz auf demselben localStorage-Key: solange nur EIN Ort einen Key liest (die meisten
// Dashboard-Toggles), unsichtbar, aber sobald zwei Stellen denselben Key lesen (z.B. currentSymbol
// in Dashboard.vue UND useClaudeAnnotations.js), sah die zweite Stelle Änderungen der ersten nie —
// kein Storage-Event-Listener, nur Write-Through. Jetzt EINE geteilte reaktive ref pro Key,
// unabhängig davon, wie oft/wo useLocalStorageRef(key, ...) aufgerufen wird.
const cache = new Map();

// Persistiert einen ref-Wert in localStorage (JSON-serialisiert) — für die Dashboard-Toggles
// (Historische OBs, Liquidität, Trendanalyse, ...), die ihren Zustand über Reloads hinweg
// behalten sollen, statt bei jedem Neuladen auf die Default-Werte zurückzuspringen.
export function useLocalStorageRef(key, defaultValue) {
  const cached = cache.get(key);
  if (cached) return cached;

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

  cache.set(key, value);
  return value;
}
