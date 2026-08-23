<script setup>
import { reactive, watch } from "vue";
import { chartColors, resetChartColors } from "../chartColors.js";
import { chartLineWidths, resetChartLineWidths } from "../chartLineWidths.js";
import MetadataPanel from "./MetadataPanel.vue";

const emit = defineEmits(["close"]);

// Gruppiert nach Feature statt alphabetisch — so findet man "die Farbe von X" genauso, wie man
// auch die Toolbar liest (Kerzen/CVD/EMA/Liquidität/Order-Blocks/Trade-Setups/Ranges/
// Trade-Marker). Keys müssen exakt den Feldern in chartColors.js (DEFAULT_CHART_COLORS)
// entsprechen. Linienstärke (Chat 2026-07-25, zweite Runde: "bei jeder Linie, wo man schon die
// Farbe individuell anpassen kann") wird PRO FELD unten aus chartLineWidths.js dazugerendert,
// wenn ein Eintrag mit demselben Key existiert (siehe Template: v-if="field.key in
// chartLineWidths") — kein separates widths-Array mehr nötig, da beide Stores dieselben Keys
// benutzen. candleUp/candleDown/rangesMarker/rangesMarker2 haben bewusst KEINEN Eintrag in
// chartLineWidths.js (Kerzenkörper bzw. reine Punkt-Marker ohne Stroke, siehe dort) und bekommen
// dadurch automatisch keinen Linienstärke-Regler.
const GROUPS = [
  {
    title: "Kerzen",
    fields: [
      { key: "candleUp", label: "Bullish" },
      { key: "candleDown", label: "Bearish" },
    ],
  },
  {
    title: "CVD",
    fields: [{ key: "cvdLine", label: "Linie" }],
  },
  {
    title: "EMA",
    fields: [
      { key: "emaFast", label: "EMA 50" },
      { key: "emaSlow", label: "EMA 200" },
    ],
  },
  {
    title: "RSI",
    fields: [
      { key: "rsi", label: "Linie" },
      { key: "divergenceBearish", label: "Divergenz (bearish)" },
      { key: "divergenceBullish", label: "Divergenz (bullish)" },
    ],
  },
  {
    title: "Liquidität",
    fields: [
      { key: "liquidityHigh", label: "High-Level" },
      { key: "liquidityLow", label: "Low-Level" },
      { key: "liquiditySweep", label: "Gesweept" },
    ],
  },
  // Getrennt von der Gruppe oben (Chat 2026-08-23, Philip: "4h LQ-Levels dicker machen") — die
  // Gruppe oben bleibt für den live auf dem gerade angezeigten Chart-Timeframe erkannten Satz,
  // diese beiden hier nur für die zusätzlich eingeblendeten, TF-unabhängig relevanten HTF-Level
  // (siehe liquidity.js: liquidityStyleKey).
  {
    title: "Liquidität — 1H",
    fields: [
      { key: "liquidityHigh1h", label: "High-Level" },
      { key: "liquidityLow1h", label: "Low-Level" },
      { key: "liquiditySweep1h", label: "Gesweept" },
    ],
  },
  {
    title: "Liquidität — 4H",
    fields: [
      { key: "liquidityHigh4h", label: "High-Level" },
      { key: "liquidityLow4h", label: "Low-Level" },
      { key: "liquiditySweep4h", label: "Gesweept" },
    ],
  },
  // Aufgeteilt nach Timeframe (Chat 2026-07-30, Bug-Report Philip: "die ganzen OBs lassen sich
  // schwierig unterscheiden") — vorher eine gemeinsame Gruppe für alle drei Timeframes, siehe
  // chartColors.js für die Default-Abstufung (4H kräftigsten, M5 am dezentesten).
  // Umrandung (Chat 2026-07-30, Philip: "diese Boxumrandung stylebar machen") als eigene Farbe,
  // nicht mehr fest an die Füllfarbe gekoppelt — kein eigener Breiten-Regler dafür (siehe
  // Template: v-if="field.key in chartLineWidths"), der Fill-Feld-Regler direkt darüber steuert
  // bereits die Umrandungs-STRICHBREITE (es gibt nur einen Stroke, siehe orderBlocks.js: zoneOptions).
  {
    title: "Order-Blocks — M5",
    fields: [
      { key: "obBullM5", label: "Bullish" },
      { key: "obBearM5", label: "Bearish" },
      { key: "obInactiveM5", label: "Inaktiv" },
      { key: "obBullM5Border", label: "Umrandung (Bullish)" },
      { key: "obBearM5Border", label: "Umrandung (Bearish)" },
      { key: "obInactiveM5Border", label: "Umrandung (Inaktiv)" },
    ],
  },
  {
    title: "Order-Blocks — 1H",
    fields: [
      { key: "obBull1h", label: "Bullish" },
      { key: "obBear1h", label: "Bearish" },
      { key: "obInactive1h", label: "Inaktiv" },
      { key: "obBull1hBorder", label: "Umrandung (Bullish)" },
      { key: "obBear1hBorder", label: "Umrandung (Bearish)" },
      { key: "obInactive1hBorder", label: "Umrandung (Inaktiv)" },
    ],
  },
  {
    title: "Order-Blocks — 4H",
    fields: [
      { key: "obBull4h", label: "Bullish" },
      { key: "obBear4h", label: "Bearish" },
      { key: "obInactive4h", label: "Inaktiv" },
      { key: "obBull4hBorder", label: "Umrandung (Bullish)" },
      { key: "obBear4hBorder", label: "Umrandung (Bearish)" },
      { key: "obInactive4hBorder", label: "Umrandung (Inaktiv)" },
    ],
  },
  {
    title: "Trade-Setups",
    fields: [
      { key: "tradeSetupShort", label: "Short" },
      { key: "tradeSetupLong", label: "Long" },
      { key: "tradeSetupProtected", label: "Protected Level" },
    ],
  },
  {
    title: "Market Structure",
    fields: [
      { key: "rangeHigh", label: "Range-High" },
      { key: "rangeLow", label: "Range-Low" },
      { key: "rangeProtectedLow", label: "Protected Low" },
      { key: "rangeLqSweep", label: "LQ-Sweep" },
      { key: "rangeBreakOfStructure", label: "Break of Structure" },
      { key: "rangeLiveUptrend", label: "Laufende Range (Uptrend)" },
      { key: "rangeLiveDowntrend", label: "Laufende Range (Downtrend)" },
      { key: "rangeClosed", label: "Abgeschlossene Range (Uptrend)" },
      { key: "rangeClosedDowntrend", label: "Abgeschlossene Range (Downtrend)" },
      { key: "rangeChoch", label: "CHoCH" },
      { key: "rangeFib", label: "Fibonacci 50%" },
      { key: "rangesMarker", label: "Debug-Marker (Periode 5)" },
      { key: "rangesMarker2", label: "Debug-Marker (Periode 2)" },
    ],
  },
  {
    title: "Trade-Marker",
    fields: [
      { key: "tradeWin", label: "Gewinn" },
      { key: "tradeLoss", label: "Verlust" },
      { key: "tradeInvalid", label: "Kein Ergebnis (Fallback)" },
      { key: "tradeConnector", label: "Verbindung" },
      { key: "tradeTarget", label: "Target" },
      { key: "tradeConfirmation", label: "Bestätigung" },
      { key: "tradeInvalidation", label: "Invalidierungs-Linie" },
      { key: "tradeHover", label: "Hover-Hervorhebung" },
    ],
  },
  {
    title: "News",
    fields: [{ key: "newsEvent", label: "Termin-Marker" }],
  },
  {
    title: "Pin",
    fields: [{ key: "pin", label: "Akzentfarbe" }],
  },
];

function resetAll() {
  resetChartColors();
  resetChartLineWidths();
}

// Zu viele Gruppen für einen Blick geworden (Chat 2026-07-27: "so viele configs, dass man bissl
// suchen muss") — Gruppen sind daher standardmäßig eingeklappt, man öffnet nur die, die man
// gerade sucht. Zustand persistiert wie chartColors/chartLineWidths (localStorage, deep watch),
// damit einmal geöffnete Gruppen nicht bei jedem Modal-Öffnen wieder zuklappen.
const COLLAPSE_STORAGE_KEY = "trading-monitor:styleModalCollapsed";

function loadCollapsedInitial() {
  const result = {};
  let saved = {};
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {}; // korrupter/fremder Wert -> alle Gruppen zugeklappt starten
  }
  for (const group of GROUPS) {
    result[group.title] = typeof saved[group.title] === "boolean" ? saved[group.title] : true;
  }
  return result;
}

const collapsed = reactive(loadCollapsedInitial());

watch(
  collapsed,
  (v) => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(v));
    } catch {
      // localStorage kann fehlschlagen (privater Modus, Quota) -> Zustand gilt nur für die Session.
    }
  },
  { deep: true },
);

function toggleGroup(title) {
  collapsed[title] = !collapsed[title];
}
</script>

<template>
  <MetadataPanel title="🎨 Chart-Style" @close="emit('close')">
    <button class="style-reset" @click="resetAll">Alle zurücksetzen</button>
    <section v-for="group in GROUPS" :key="group.title" class="style-group">
      <h3 class="style-group-title" @click="toggleGroup(group.title)">
        <span class="style-group-chevron" :class="{ collapsed: collapsed[group.title] }">▾</span>
        {{ group.title }}
      </h3>
      <div v-show="!collapsed[group.title]">
        <div v-for="field in group.fields" :key="field.key" class="style-field">
          <div class="style-field-top">
            <span class="style-field-label">{{ field.label }}</span>
            <span class="style-swatch-wrap">
              <input v-model="chartColors[field.key].hex" type="color" class="style-swatch" />
              <span class="style-hex">{{ chartColors[field.key].hex }}</span>
            </span>
          </div>
          <div class="style-field-alpha">
            <input v-model.number="chartColors[field.key].alpha" type="range" min="0" max="1" step="0.01" class="style-alpha-slider" />
            <span class="style-alpha-value">{{ Math.round(chartColors[field.key].alpha * 100) }}%</span>
          </div>
          <div v-if="field.key in chartLineWidths" class="style-field-alpha">
            <input v-model.number="chartLineWidths[field.key]" type="range" min="0.5" max="5" step="0.5" class="style-alpha-slider" />
            <span class="style-alpha-value">{{ chartLineWidths[field.key] }}px</span>
          </div>
        </div>
      </div>
    </section>
  </MetadataPanel>
</template>

<style scoped>
.style-reset {
  display: block;
  width: 100%;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 12px;
}

.style-reset:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.style-group {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.style-group-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #565a64;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.style-group-title:hover {
  color: #9aa0ac;
}

.style-group-chevron {
  display: inline-block;
  transition: transform 0.1s ease;
}

.style-group-chevron.collapsed {
  transform: rotate(-90deg);
}

.style-field {
  padding: 6px 0;
}

.style-field-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.style-field-label {
  font-size: 13px;
  color: #d1d4dc;
}

.style-field-alpha {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  padding-left: 2px;
}

.style-alpha-slider {
  flex: 1;
  height: 3px;
  appearance: none;
  -webkit-appearance: none;
  background: #2a2e39;
  border-radius: 2px;
  cursor: pointer;
}

.style-alpha-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #7ea6ff;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.style-alpha-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.style-alpha-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  background: #7ea6ff;
  cursor: pointer;
}

.style-alpha-value {
  font-family: "Courier New", monospace;
  font-size: 10px;
  color: #565a64;
  min-width: 32px;
  text-align: right;
}

.style-swatch-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-swatch {
  appearance: none;
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #2a2e39;
  padding: 0;
  cursor: pointer;
  background: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease, border-color 0.1s ease;
  flex-shrink: 0;
}

.style-swatch:hover {
  transform: scale(1.12);
  border-color: #2962ff;
}

.style-swatch::-webkit-color-swatch-wrapper {
  padding: 0;
  border-radius: 50%;
}

.style-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.style-swatch::-moz-color-swatch {
  border: none;
  border-radius: 50%;
}

.style-hex {
  font-family: "Courier New", monospace;
  font-size: 11px;
  color: #565a64;
  min-width: 54px;
  text-align: right;
}
</style>
