import { ref, watch } from "vue";

const STORAGE_PREFIX = "trading-monitor:";

// Hybrid aus useLocalStorageRef.js (geräteweit geteilt) und useSessionStorageRef.js (pro Tab
// isoliert) — Chat 2026-07-30, Philip zur Chart-/Trades-Panel-Höhe: "wenn pro Tab getrennt: dann
// immernoch möglich allgemein zu speichern? Also wenn ich den PC neu starte und den Browser das
// erste Mal öffne?" Zwei offene Tabs sollen unabhängig voneinander in der Höhe verstellbar sein
// (wie currentBar/sessionStorage), aber ein FRISCHER Tab (oder ein frisch gestarteter Browser nach
// PC-Neustart, ganz ohne sessionStorage-Historie) soll trotzdem beim zuletzt IRGENDWO benutzten
// Wert starten, statt bei einem hart einprogrammierten Default — jede Änderung schreibt deshalb
// sowohl in sessionStorage (dieser Tab, live) als auch in localStorage (der "zuletzt benutzt"-Wert
// für künftige neue Tabs/Sessions).
export function useTabScopedRef(key, defaultValue) {
  const sessionKey = STORAGE_PREFIX + key;
  const lastUsedKey = STORAGE_PREFIX + key + ":lastUsed";

  function readLastUsed() {
    try {
      const raw = localStorage.getItem(lastUsedKey);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue; // korrupter/fremder Wert -> Default nutzen
    }
  }

  let initial;
  try {
    const raw = sessionStorage.getItem(sessionKey);
    initial = raw !== null ? JSON.parse(raw) : readLastUsed();
  } catch {
    initial = readLastUsed();
  }

  const value = ref(initial);
  watch(value, (v) => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(v));
    } catch {
      // sessionStorage kann fehlschlagen (privater Modus, Quota) — dann gilt der Wert nur im
      // Speicher dieses Tabs, kein Show-Stopper.
    }
    try {
      localStorage.setItem(lastUsedKey, JSON.stringify(v));
    } catch {
      // localStorage kann ebenfalls fehlschlagen — der "zuletzt benutzt"-Fallback für künftige
      // Tabs/Sessions fehlt dann einfach, aktueller Tab bleibt trotzdem funktionsfähig.
    }
  });

  return value;
}
