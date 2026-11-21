import { supabase } from "./supabaseClient.js";

// Statische Beschreibungen der bekannten Alarm-Typen — die DB (alarm_settings) speichert nur
// den enabled-Zustand je `key`, nicht den Anzeigetext. Neue Alarme hier ergänzen, sobald sie
// im poi-watcher oder dob-watcher dazukommen. windowInstrument: dessen trading_schedules.alarm_windows
// steuern den Versand dieses Alarms und sind auf der Alarme-Seite direkt editierbar.
export const ALARM_TYPES = [
  {
    key: "dob_setup",
    label: "DOB-Setup XAUUSD",
    description: "Doppelter Orderblock mit POI (v2): Alarm beim OB2-Retest und beim Entry (dob-watcher). Erkennung und Protokoll laufen 02:00–22:00 weiter, gesendet wird nur im Alarmfenster.",
    windowInstrument: "XAUUSD",
  },
  {
    key: "ob_zone_4h",
    label: "4H Order-Block erreicht",
    description: "Preis erreicht eine erkannte 4H-Order-Block-Zone (GBPUSD/EURUSD).",
  },
  {
    key: "ob_zone_1h",
    label: "1H Order-Block erreicht",
    description: "Preis erreicht eine erkannte 1H-Order-Block-Zone (GBPUSD/EURUSD).",
  },
  {
    key: "ob_zone_15m",
    label: "15M Order-Block erreicht",
    description: "Preis erreicht eine erkannte 15M-Order-Block-Zone (GBPUSD/EURUSD). Startet ausgeschaltet.",
  },
  {
    key: "liquidity_1h",
    label: "1H Liquiditäts-Level geswept",
    description: "Ein 1H-Fraktal-Level (Hoch/Tief) wird angetestet/durchbrochen (GBPUSD/EURUSD).",
  },
  {
    key: "liquidity_4h",
    label: "4H Liquiditäts-Level geswept",
    description: "Ein 4H-Fraktal-Level (Hoch/Tief) wird angetestet/durchbrochen (GBPUSD/EURUSD).",
  },
  {
    key: "pin_context",
    label: "Gepinnte Stelle erreicht",
    description: "Preis erreicht eine per Rechtsklick 'Anpinnen' (oder von Lana per MCP) markierte Chart-Stelle — OB-Zone/1H-Liquiditäts-Level/Trade-Setup/M5-OB/M5-Liquiditäts-Level (GBPUSD/EURUSD).",
  },
];

export async function fetchAlarmSettings() {
  const { data, error } = await supabase.from("alarm_settings").select("key, enabled");
  if (error) throw error;
  const enabledByKey = new Map(data.map((row) => [row.key, row.enabled]));
  // Fail-open (fehlende Zeile = an) — konsistent mit dem Fallback im poi-watcher, damit
  // Dashboard-Anzeige und tatsächliches Alarm-Verhalten nie auseinanderlaufen.
  return ALARM_TYPES.map((type) => ({ ...type, enabled: enabledByKey.get(type.key) ?? true }));
}

export async function setAlarmEnabled(key, enabled) {
  const { error } = await supabase.from("alarm_settings").update({ enabled }).eq("key", key);
  if (error) throw error;
}
