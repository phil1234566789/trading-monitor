import { reactive, watch, nextTick } from "vue";
import { supabase } from "./supabaseClient.js";

// Handelszeiten pro Instrument (neue "Handelszeiten"-Seite, siehe Chat 2026-07-25: Philip bekam
// einen Telegram-Alarm an einem Samstag, weil poi-watcher bisher nur die Uhrzeit prüfte, nie den
// Wochentag). Diese Datei ist der Frontend-Store für `trading_schedules` (Migration
// 20260725120000) — analog zu chartColors.js: fester Key-Satz (Instrumente statt Farb-Keys),
// localStorage-first + Supabase-Sync. Der poi-watcher (Deno) liest dieselbe Tabelle direkt,
// dieser Store ist nur für die Anzeige/Bearbeitung im Dashboard.
const STORAGE_KEY = "trading-monitor:tradingSchedules";

// Bewusst nur Mo-Fr/Samstag/Sonntag statt 7 einzelner Wochentage (siehe Migrations-Kommentar) —
// jedes bisher genannte Beispiel folgt diesem Schema, eine volle 7-Tage-Matrix wäre YAGNI.
export const WEEKDAY_GROUPS = [
  { key: "weekday", label: "Mo–Fr" },
  { key: "saturday", label: "Samstag" },
  { key: "sunday", label: "Sonntag" },
];

const EMPTY_WINDOWS = { weekday: [], saturday: [], sunday: [] };

export const DEFAULT_SCHEDULES = {
  GBPUSD: { tradingWindows: EMPTY_WINDOWS, alarmWindows: EMPTY_WINDOWS, notes: "" },
  EURUSD: { tradingWindows: EMPTY_WINDOWS, alarmWindows: EMPTY_WINDOWS, notes: "" },
  XAUUSD: { tradingWindows: EMPTY_WINDOWS, alarmWindows: EMPTY_WINDOWS, notes: "" },
};

function cloneWindows(w) {
  return {
    weekday: (w?.weekday ?? []).map((pair) => [...pair]),
    saturday: (w?.saturday ?? []).map((pair) => [...pair]),
    sunday: (w?.sunday ?? []).map((pair) => [...pair]),
  };
}

function loadInitial() {
  let saved = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {}; // korrupter/fremder Wert unter dem Key -> ignorieren, Defaults nutzen
  }
  const result = {};
  for (const [instrument, def] of Object.entries(DEFAULT_SCHEDULES)) {
    const s = saved[instrument];
    result[instrument] = {
      tradingWindows: cloneWindows(s?.tradingWindows ?? def.tradingWindows),
      alarmWindows: cloneWindows(s?.alarmWindows ?? def.alarmWindows),
      notes: typeof s?.notes === "string" ? s.notes : def.notes,
    };
  }
  return result;
}

export const tradingSchedules = reactive(loadInitial());

let suppressSave = false;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

watch(
  tradingSchedules,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — gilt dann nur für die Session.
    }
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToRemote, SAVE_DEBOUNCE_MS);
  },
  { deep: true },
);

async function saveToRemote() {
  const rows = Object.entries(tradingSchedules).map(([instrument, s]) => ({
    instrument,
    trading_windows: s.tradingWindows,
    alarm_windows: s.alarmWindows,
    notes: s.notes,
  }));
  const { error } = await supabase.from("trading_schedules").upsert(rows, { onConflict: "instrument" });
  if (error) console.error("Handelszeiten in DB speichern fehlgeschlagen:", error);
}

async function syncFromRemote() {
  try {
    const { data, error } = await supabase
      .from("trading_schedules")
      .select("instrument, trading_windows, alarm_windows, notes");
    if (error) throw error;
    if (!data || data.length === 0) return;
    suppressSave = true;
    for (const row of data) {
      if (!DEFAULT_SCHEDULES[row.instrument]) continue; // unbekanntes Instrument -> ignorieren statt zu crashen
      tradingSchedules[row.instrument] = {
        tradingWindows: cloneWindows(row.trading_windows),
        alarmWindows: cloneWindows(row.alarm_windows),
        notes: row.notes ?? "",
      };
    }
    nextTick(() => {
      suppressSave = false;
    });
  } catch (err) {
    console.error("Handelszeiten aus DB laden fehlgeschlagen:", err);
  }
}
syncFromRemote();

export function addWindow(instrument, kind, groupKey) {
  tradingSchedules[instrument][kind][groupKey].push([8 * 60, 16 * 60]); // 08:00-16:00 Default
}

export function removeWindow(instrument, kind, groupKey, index) {
  tradingSchedules[instrument][kind][groupKey].splice(index, 1);
}
