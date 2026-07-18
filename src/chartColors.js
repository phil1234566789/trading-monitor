import { reactive, watch } from "vue";

// Zentraler, reaktiver Farb-Store für sämtliche Chart-Indikatoren (Kerzen, CVD, EMA, Liquidität,
// Order-Blocks, Trade-Setups, Zigzag, Ranges, Trade-Marker) — als ES-Modul-Singleton (nicht an
// eine Vue-Komponente gebunden), damit jedes Render-Modul (liquidity.js, orderBlocks.js,
// trendZigzag.ts, rangeAnalysis.ts, tradeMarkers.js) und das StyleModal dieselbe Instanz lesen/
// schreiben, ohne Farben durch PriceChart.vue durchreichen zu müssen (siehe Chat: "Style"-Button
// + Modal, "alle Farben einstellen"). Persistiert komplett in localStorage, analog zu
// useLocalStorageRef, aber für ein ganzes Farb-Objekt statt eines einzelnen Werts.
const STORAGE_KEY = "trading-monitor:chartColors";

export const DEFAULT_CHART_COLORS = {
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  cvdLine: "#f0b90b",
  emaFast: "#42a5f5",
  emaSlow: "#ffb74d",
  liquidityHigh: "#00e676",
  liquidityLow: "#ff9800",
  liquiditySweep: "#ffd700",
  obBull: "#26a69a",
  obBear: "#ef5350",
  obInactive: "#787b86",
  tradeSetupShort: "#ffd700",
  tradeSetupLong: "#2196f3",
  tradeSetupProtected: "#ffffff",
  zigzagStructure: "#ef5350",
  zigzagTail: "#787b86",
  rangeHigh: "#ef5350",
  rangeLow: "#00e676",
  rangeProtectedLow: "#ffffff",
  rangesMarker: "#00bcd4",
  tradeWin: "#26a69a",
  tradeLoss: "#ef5350",
  tradeOpen: "#f0b90b",
  tradeInvalid: "#787b86",
  tradeConnector: "#2962ff",
};

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // { ...DEFAULT, ...gespeichert } statt nur gespeichert -> neu hinzugekommene Farben (z.B.
    // nach einem künftigen Feature) bekommen einen Default statt undefined zu bleiben.
    if (raw) return { ...DEFAULT_CHART_COLORS, ...JSON.parse(raw) };
  } catch {
    // korrupter/fremder Wert unter dem Key -> ignorieren, Defaults nutzen
  }
  return { ...DEFAULT_CHART_COLORS };
}

export const chartColors = reactive(loadInitial());

watch(
  chartColors,
  (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) — Farben gelten dann nur
      // für die aktuelle Session, kein Show-Stopper.
    }
  },
  { deep: true },
);

export function resetChartColors() {
  Object.assign(chartColors, DEFAULT_CHART_COLORS);
}

// Hex-Farbe (#rrggbb, aus <input type="color">) + Alpha -> rgba(...) für halbtransparente
// Linien/Flächen — so pflegt man im StyleModal nur EINE Basisfarbe pro Konzept statt jeder
// Alpha-Variante (Fill/Border/Weak/...) einzeln.
export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
