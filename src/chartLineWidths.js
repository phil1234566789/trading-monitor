import { reactive, watch, nextTick } from "vue";
import { supabase } from "./supabaseClient.js";

// Analog zu chartColors.js (siehe dort für die ausführliche Begründung des Musters:
// localStorage-first + debounced Supabase-Sync, geräteübergreifend) — eigene Datei statt
// chartColors.js um ein zweites Feld zu erweitern, weil Linienstärke ein Zahlenwert ohne Alpha/Hex
// ist und sonst jede Stelle, die chartColors liest, mit einem irrelevanten dritten Feld
// durchgereicht würde (Chat 2026-07-25: "Linienstärke ... in Chart-Style konfigurierbar machen").
//
// Seit der zweiten Runde ("bei jeder Linie, wo man schon die Farbe individuell anpassen kann")
// EIN Wert PRO FARB-KEY aus DEFAULT_CHART_COLORS (chartColors.js), nicht mehr gebündelt pro
// zeichnerischem Konzept — dieselben Keys wie dort, damit StyleModal.vue direkt `field.key` für
// beide Stores wiederverwenden kann. Ausgenommen sind Keys, zu denen es im Code keine echte LINIE
// gibt: `candleUp`/`candleDown` (Kerzenkörper, keine Linienbreite im Code) und
// `rangesMarker`/`rangesMarker2` (reine Punkt-Marker in pivotMarkers.ts, nur ein `dotRadius`, kein
// Stroke — siehe PivotMarkerRenderer.draw).
const STORAGE_KEY = "trading-monitor:chartLineWidths";

export const DEFAULT_CHART_LINE_WIDTHS = {
  cvdLine: 2,
  emaFast: 2,
  emaSlow: 2,
  rsi: 2,
  divergenceBearish: 1.5,
  divergenceBullish: 1.5,
  liquidityHighM5: 1,
  liquidityLowM5: 1,
  liquiditySweepM5: 1,
  liquidityHigh1h: 1,
  liquidityLow1h: 1,
  liquiditySweep1h: 1,
  liquidityHigh4h: 1,
  liquidityLow4h: 1,
  liquiditySweep4h: 1,
  obBullM5: 1,
  obBearM5: 1,
  obInactiveM5: 1,
  obBull1h: 1,
  obBear1h: 1,
  obInactive1h: 1,
  obBull4h: 1,
  obBear4h: 1,
  obInactive4h: 1,
  tradeSetupShort: 2, // LS-Linie + Order-Block-Rand, wenn Short (siehe PriceChart.vue: key=tradeSetupShort/-Long, dieselbe Farbe für beides)
  tradeSetupLong: 2,
  tradeSetupProtected: 2, // Fractal-Linie im Trade-Setup.
  rangeHigh: 2,
  rangeLow: 2,
  rangeProtectedLow: 2,
  rangeLqSweep: 1, // dünner als die übrigen Range-Linien (Chat 2026-07-24).
  rangeBreakOfStructure: 2,
  rangeLiveUptrend: 2, // laufende Uptrend-Range (Chat 2026-07-31, siehe chartColors.js).
  rangeLiveDowntrend: 1, // laufende Downtrend-Range.
  rangeClosed: 2, // Verbindungslinie der abgeschlossenen (archivierten) Uptrend-Range.
  rangeClosedDowntrend: 1, // abgeschlossene (archivierte) Downtrend-Range.
  rangeChoch: 1, // Nested-Verbindungslinie UND CHoCH-Label teilen sich diese eine Farbe/Breite.
  rangeFib: 1, // Tick + gestrichelte Protected-Fib-Zickzack-Linie (Chat 2026-07-30).
  tradeWin: 1.5, // Entry/Exit-Preis-Strich, je nach Trade-Ausgang (siehe tradeMarkers.js: outcomeKey).
  tradeLoss: 1.5,
  tradeInvalid: 1.5, // Fallback für Exit ohne win/loss-Outcome, siehe chartColors.js.
  tradeConnector: 2, // gestrichelte Entry->Exit-Verbindungslinie.
  // Basis-Breite für Target-Linien (Chat 2026-07-28) — wird in PriceChart.vue zusätzlich mit einem
  // Alters-Tier-Faktor multipliziert (minor/medium/major, siehe ageTier.ts), diese Zahl hier ist
  // nur der Nutzer-einstellbare Grundwert (wie bei jeder anderen Farbe/Linie im Style-Modal).
  tradeTarget: 1.5,
  tradeConfirmation: 1.5, // gleiches Tier-Skalierungsmuster wie tradeTarget, siehe PriceChart.vue.
  tradeInvalidation: 1.5, // keine Alters-Tier-Skalierung (siehe PriceChart.vue: refreshInvalidationLinesInternal).
};

function loadInitial() {
  let saved = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {};
  }
  const result = {};
  for (const [key, def] of Object.entries(DEFAULT_CHART_LINE_WIDTHS)) {
    const s = saved[key];
    result[key] = typeof s === "number" && s > 0 ? s : def;
  }
  return result;
}

export const chartLineWidths = reactive(loadInitial());

let suppressSave = false;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

watch(
  chartLineWidths,
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
  const rows = Object.entries(chartLineWidths).map(([key, width]) => ({ key, width }));
  const { error } = await supabase.from("chart_line_widths").upsert(rows, { onConflict: "key" });
  if (error) console.error("Chart-Linienstärken in DB speichern fehlgeschlagen:", error);
}

async function syncFromRemote() {
  try {
    const { data, error } = await supabase.from("chart_line_widths").select("key, width");
    if (error) throw error;
    if (!data || data.length === 0) return;
    suppressSave = true;
    for (const row of data) {
      if (DEFAULT_CHART_LINE_WIDTHS[row.key] != null && typeof row.width === "number" && row.width > 0) {
        chartLineWidths[row.key] = row.width;
      }
    }
    nextTick(() => {
      suppressSave = false;
    });
  } catch (err) {
    console.error("Chart-Linienstärken aus DB laden fehlgeschlagen:", err);
  }
}
syncFromRemote();

export function resetChartLineWidths() {
  for (const key of Object.keys(DEFAULT_CHART_LINE_WIDTHS)) {
    chartLineWidths[key] = DEFAULT_CHART_LINE_WIDTHS[key];
  }
}

// Hauptweg für Render-Module: chartLineWidths[key] direkt lesen ist genauso gültig (reaktiv), diese
// Funktion existiert nur als Analogon zu cssColor() für einheitlichen Importstil.
export function lineWidth(key) {
  return chartLineWidths[key];
}
