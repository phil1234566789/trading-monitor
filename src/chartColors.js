import { reactive, watch, nextTick } from "vue";
import { supabase } from "./supabaseClient.js";

// Zentraler, reaktiver Farb-Store für sämtliche Chart-Indikatoren (Kerzen, CVD, EMA, Liquidität,
// Order-Blocks, Trade-Setups, Zigzag, Ranges, Trade-Marker) — als ES-Modul-Singleton (nicht an
// eine Vue-Komponente gebunden), damit jedes Render-Modul (liquidity.js, orderBlocks.js,
// pivotMarkers.ts, marketStructureAnalysis.ts, tradeMarkers.js) und das StyleModal dieselbe Instanz lesen/
// schreiben, ohne Farben durch PriceChart.vue durchreichen zu müssen (siehe Chat: "Style"-Button
// + Modal, "alle Farben einstellen"). Persistiert komplett in localStorage, analog zu
// useLocalStorageRef, aber für ein ganzes Farb-Objekt statt eines einzelnen Werts.
//
// Jeder Eintrag ist { hex, alpha } statt nur hex (siehe Chat: "bei den Farben fehlt mir noch
// Transparenz") — <input type="color"> kann selbst kein Alpha, daher getrennt vom StyleModal
// per eigenem Regler gepflegt. alpha ist die "Haupt"-Transparenz des jeweiligen Konzepts (z.B.
// die Linie); Konzepte mit mehreren Alpha-Varianten (Order-Block Fill/Weak/Border) skalieren die
// übrigen Varianten proportional dazu, siehe cssColorScaled.
const STORAGE_KEY = "trading-monitor:chartColors";

export const DEFAULT_CHART_COLORS = {
  candleUp: { hex: "#26a69a", alpha: 1 },
  candleDown: { hex: "#ef5350", alpha: 1 },
  cvdLine: { hex: "#f0b90b", alpha: 1 },
  emaFast: { hex: "#42a5f5", alpha: 1 },
  emaSlow: { hex: "#ffb74d", alpha: 1 },
  liquidityHigh: { hex: "#00e676", alpha: 0.9 },
  liquidityLow: { hex: "#ff9800", alpha: 0.9 },
  liquiditySweep: { hex: "#ffd700", alpha: 0.9 },
  obBull: { hex: "#26a69a", alpha: 0.28 },
  obBear: { hex: "#ef5350", alpha: 0.28 },
  obInactive: { hex: "#787b86", alpha: 0.15 },
  tradeSetupShort: { hex: "#ffd700", alpha: 0.9 },
  tradeSetupLong: { hex: "#2196f3", alpha: 0.9 },
  tradeSetupProtected: { hex: "#ffffff", alpha: 0.95 },
  zigzagStructure: { hex: "#ef5350", alpha: 0.9 },
  zigzagTail: { hex: "#787b86", alpha: 0.9 },
  rangeHigh: { hex: "#ef5350", alpha: 0.95 },
  rangeLow: { hex: "#00e676", alpha: 0.95 },
  rangeProtectedLow: { hex: "#ffffff", alpha: 0.95 },
  rangeLqSweep: { hex: "#ffd700", alpha: 0.9 },
  rangesMarker: { hex: "#00bcd4", alpha: 0.9 },
  // Periode-2-Debug-Marker (siehe Chat 2026-07-19: "früherer Uptrend-Erkennung") — bewusst
  // dieselbe Grundfarbe wie rangesMarker (Periode 5), aber deutlich transparenter, damit man
  // beide auf einen Blick auseinanderhält, ohne extra eine zweite Farbe lernen zu müssen.
  rangesMarker2: { hex: "#00bcd4", alpha: 0.5 },
  tradeWin: { hex: "#26a69a", alpha: 1 },
  tradeLoss: { hex: "#ef5350", alpha: 1 },
  tradeOpen: { hex: "#f0b90b", alpha: 1 },
  tradeInvalid: { hex: "#787b86", alpha: 1 },
  tradeConnector: { hex: "#2962ff", alpha: 0.75 },
};

function loadInitial() {
  let saved = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {}; // korrupter/fremder Wert unter dem Key -> ignorieren, Defaults nutzen
  }
  const result = {};
  for (const [key, def] of Object.entries(DEFAULT_CHART_COLORS)) {
    const s = saved[key];
    if (s && typeof s === "object" && typeof s.hex === "string") {
      result[key] = { hex: s.hex, alpha: typeof s.alpha === "number" ? s.alpha : def.alpha };
    } else if (typeof s === "string") {
      // Altes Format von vor der Transparenz-Erweiterung (nur Hex-String) -> Farbton
      // übernehmen, Standard-Alpha behalten statt den gespeicherten Wert zu verwerfen.
      result[key] = { hex: s, alpha: def.alpha };
    } else {
      result[key] = { ...def };
    }
  }
  return result;
}

export const chartColors = reactive(loadInitial());

// true während ein DB-Fetch die Werte reinschreibt — verhindert, dass genau dieser Merge sofort
// wieder einen Save auslöst (würde die gerade gelesenen Werte unnötig zurückschreiben, siehe
// applyRemote unten). Per nextTick statt synchron zurückgesetzt, weil Vues watch-Callback erst
// im nächsten Flush läuft, nicht sofort bei der Mutation.
let suppressSave = false;
// DB-Schreiben debounced (Farb-/Alpha-Regler feuern viele Events beim Ziehen) — localStorage
// bleibt dagegen sofort synchron (billig, kein Netzwerk).
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

watch(
  chartColors,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — Farben gelten dann nur
      // für die aktuelle Session, kein Show-Stopper.
    }
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToRemote, SAVE_DEBOUNCE_MS);
  },
  { deep: true },
);

async function saveToRemote() {
  const rows = Object.entries(chartColors).map(([key, c]) => ({ key, hex: c.hex, alpha: c.alpha }));
  const { error } = await supabase.from("chart_colors").upsert(rows, { onConflict: "key" });
  if (error) console.error("Chart-Farben in DB speichern fehlgeschlagen:", error);
}

// Geräteübergreifender Sync (siehe Chat: "hab mehrere Geräte") — localStorage sorgt für den
// sofortigen ersten Render, bevor die Antwort da ist; kommt sie an, gewinnt die DB (letztes
// Gerät, das etwas geändert hat). Leere Tabelle (Migration noch nicht ausgerollt) -> lokale
// Werte unangetastet lassen statt auf nichts zurückzusetzen.
async function syncFromRemote() {
  try {
    const { data, error } = await supabase.from("chart_colors").select("key, hex, alpha");
    if (error) throw error;
    if (!data || data.length === 0) return;
    suppressSave = true;
    for (const row of data) {
      if (DEFAULT_CHART_COLORS[row.key]) {
        chartColors[row.key] = { hex: row.hex, alpha: row.alpha };
      }
    }
    nextTick(() => {
      suppressSave = false;
    });
  } catch (err) {
    console.error("Chart-Farben aus DB laden fehlgeschlagen:", err);
  }
}
syncFromRemote();

export function resetChartColors() {
  for (const key of Object.keys(DEFAULT_CHART_COLORS)) {
    chartColors[key] = { ...DEFAULT_CHART_COLORS[key] };
  }
}

// Hex-Farbe (#rrggbb) + Alpha -> rgba(...).
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

// Hauptweg für Render-Module: chartColors[key] (hex+alpha) -> fertiger rgba()-String.
export function cssColor(key) {
  const c = chartColors[key];
  return hexToRgba(c.hex, c.alpha);
}

// Für Konzepte mit mehreren Alpha-Varianten derselben Basisfarbe (Order-Block Fill/Weak/Border,
// Trade-Setup-LS-Linie vs. -OB-Box) — ratio ist das Verhältnis der Ziel-Alpha zur "Haupt"-Alpha
// im ursprünglichen Default-Design (z.B. Border war immer das 2.5-fache der Fill-Alpha), damit
// EIN Regler alle zusammengehörigen Varianten proportional mitskaliert statt sie unabhängig
// einstellbar (und damit potenziell inkonsistent zueinander) zu machen.
export function cssColorScaled(key, ratio) {
  const c = chartColors[key];
  return hexToRgba(c.hex, c.alpha * ratio);
}
