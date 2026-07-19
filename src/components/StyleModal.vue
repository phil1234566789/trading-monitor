<script setup>
import { chartColors, resetChartColors } from "../chartColors.js";
import MetadataPanel from "./MetadataPanel.vue";

const emit = defineEmits(["close"]);

// Gruppiert nach Feature statt alphabetisch — so findet man "die Farbe von X" genauso, wie man
// auch die Toolbar liest (Kerzen/CVD/EMA/Liquidität/Order-Blocks/Trade-Setups/Zigzag/Ranges/
// Trade-Marker). Keys müssen exakt den Feldern in chartColors.js (DEFAULT_CHART_COLORS) entsprechen.
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
    title: "Liquidität",
    fields: [
      { key: "liquidityHigh", label: "High-Level" },
      { key: "liquidityLow", label: "Low-Level" },
      { key: "liquiditySweep", label: "Gesweept" },
    ],
  },
  {
    title: "Order-Blocks",
    fields: [
      { key: "obBull", label: "Bullish" },
      { key: "obBear", label: "Bearish" },
      { key: "obInactive", label: "Inaktiv" },
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
    title: "Zigzag",
    fields: [
      { key: "zigzagStructure", label: "Struktur" },
      { key: "zigzagTail", label: "Unklassifiziert" },
    ],
  },
  {
    title: "Ranges",
    fields: [
      { key: "rangeHigh", label: "Range-High" },
      { key: "rangeLow", label: "Range-Low" },
      { key: "rangeProtectedLow", label: "Protected Low" },
      { key: "rangeLqSweep", label: "LQ-Sweep" },
      { key: "rangesMarker", label: "Debug-Marker (Periode 5)" },
      { key: "rangesMarker2", label: "Debug-Marker (Periode 2)" },
    ],
  },
  {
    title: "Trade-Marker",
    fields: [
      { key: "tradeWin", label: "Gewinn" },
      { key: "tradeLoss", label: "Verlust" },
      { key: "tradeOpen", label: "Offen" },
      { key: "tradeInvalid", label: "Invalidiert" },
      { key: "tradeConnector", label: "Verbindung" },
    ],
  },
];
</script>

<template>
  <MetadataPanel title="🎨 Chart-Style" @close="emit('close')">
    <button class="style-reset" @click="resetChartColors">Alle zurücksetzen</button>
    <section v-for="group in GROUPS" :key="group.title" class="style-group">
      <h3 class="style-group-title">{{ group.title }}</h3>
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
