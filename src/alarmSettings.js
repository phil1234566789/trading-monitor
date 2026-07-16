import { supabase } from "./supabaseClient.js";

// Statische Beschreibungen der bekannten Alarm-Typen — die DB (alarm_settings) speichert nur
// den enabled-Zustand je `key`, nicht den Anzeigetext. Neue Alarme hier ergänzen, sobald sie
// im poi-watcher dazukommen (siehe ALARM_TYPES-Kommentar dort).
export const ALARM_TYPES = [
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
    key: "liquidity_1h",
    label: "1H Liquiditäts-Level geswept",
    description: "Ein 1H-Fraktal-Level (Hoch/Tief) wird angetestet/durchbrochen (GBPUSD/EURUSD).",
  },
  {
    key: "trade_setup",
    label: "Trade-Setup erkannt",
    description: "Liquidity Sweep + Protected M5-Fraktal + bestätigendes M5-OB, in dieser Reihenfolge (GBPUSD/EURUSD).",
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
