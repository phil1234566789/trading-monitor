<script setup>
import { computed, ref, watch } from "vue";
import PriceChart from "../components/PriceChart.vue";
import TradesTable from "../components/TradesTable.vue";
import TradeStats from "../components/TradeStats.vue";
import { TIMEFRAMES } from "../timeframes.js";
import { fetchTrades } from "../trades.js";
import { fetchPoiZones } from "../poiZones.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";

// Trades/POI-Zonen (ob_zones) gibt es aktuell nur für BTC-USDT — die Forex-OB-Erkennung
// läuft (noch) nicht über diese Codebase, sondern soll später per TradingView-Webhook
// kommen (siehe PLAN-notifications.md). Für GBPUSD/EURUSD bleiben beide Listen also leer.
const SYMBOLS = ["GBPUSD", "EURUSD", "BTC-USDT"];
const POLL_MS = 12_000;

const currentSymbol = ref("GBPUSD");
const currentBar = ref("5m");
// Historische (bereits angetestete) OB-Zonen standardmäßig ausgeblendet, um den Chart
// übersichtlich zu halten — analog zum "Historische OBs"-Toggle im tv-indikator-Projekt
// (dort default auch aus). Ein einzelner Schalter statt pro-Timeframe (4H/1H getrennt wie
// dort), weil hier ohnehin nur "schon getestet ja/nein" existiert, kein Nearest-3-Ranking.
const showHistoricalObs = ref(false);
const showLiquidity = ref(true);
// Debug-Hilfsmittel für die Trend-Indikator-Entwicklung: Preise an den Pivot-Linien
// einblenden und die aktuell ausgeblendeten (bereits gesweepten) Liquiditäts-Level
// mitanzeigen. Beide default aus, um den Chart im Normalbetrieb nicht zuzumüllen.
const showLiquidityDebug = ref(false);
const showSweptLiquidity = ref(false);
const showTradeSetups = ref(true);
// Marktstruktur-Trendanalyse (Swing High/Low, Protected High/Low, CHoCH — siehe
// trendStructure.js), default aus wie die anderen Debug/Analyse-Hilfsmittel.
const showTrendAnalysis = ref(false);
// Popup mit den rohen Trend-State-Daten (Swing/Protected-Level, CHoCH, gesammelte Pivots,
// previous-Kette) zum Nachvollziehen der Trendanalyse gegen den Chart — siehe MetadataPanel.vue.
const showMetadata = ref(false);
// Anzahl vergangener Setups je Richtung, analog zu tradeSetupHistoryCountShort/Long im
// tv-indikator (dort default 5, 0-50) — 0 zeigt nur das gerade aktive/letzte Setup.
const tradeSetupHistoryCount = ref(5);
const isBtc = computed(() => currentSymbol.value === "BTC-USDT");
const { data: trades, refresh: refreshTrades } = usePolledFetch(
  () => (isBtc.value ? fetchTrades(currentSymbol.value) : []),
  { intervalMs: POLL_MS },
);
const { data: poiZones, refresh: refreshPoiZones } = usePolledFetch(
  () => (isBtc.value ? fetchPoiZones(currentSymbol.value) : []),
  { intervalMs: POLL_MS },
);
// Symbolwechsel soll sofort auf "leer" (bzw. zurück auf BTC-Daten) springen, statt bis zu
// POLL_MS lang die Trades/Zonen des vorherigen Symbols über dem neuen Chart hängen zu lassen.
watch(currentSymbol, () => {
  refreshTrades();
  refreshPoiZones();
});
</script>

<template>
  <div class="toolbar">
    <div class="symbol-switcher">
      <button
        v-for="sym in SYMBOLS"
        :key="sym"
        :class="{ active: sym === currentSymbol }"
        @click="currentSymbol = sym"
      >
        {{ sym }}
      </button>
    </div>
    <div class="timeframe-switcher">
      <button
        v-for="tf in TIMEFRAMES"
        :key="tf.label"
        :class="{ active: tf.label === currentBar }"
        @click="currentBar = tf.label"
      >
        {{ tf.label }}
      </button>
    </div>
    <div class="drawing-toggles">
      <button :class="{ active: showHistoricalObs }" @click="showHistoricalObs = !showHistoricalObs">
        Historische OBs
      </button>
      <button :class="{ active: showLiquidity }" @click="showLiquidity = !showLiquidity">
        Liquidität
      </button>
      <button :class="{ active: showSweptLiquidity }" @click="showSweptLiquidity = !showSweptLiquidity">
        Gesweepte Liquidität
      </button>
      <button :class="{ active: showTradeSetups }" @click="showTradeSetups = !showTradeSetups">
        Trade-Setups
      </button>
      <button :class="{ active: showTrendAnalysis }" @click="showTrendAnalysis = !showTrendAnalysis">
        Trendanalyse
      </button>
      <input
        v-if="showTradeSetups"
        v-model.number="tradeSetupHistoryCount"
        type="number"
        min="0"
        max="50"
        class="trade-setup-history-count"
        title="Anzahl vergangener Trade-Setups je Richtung"
      />
      <button :class="{ active: showLiquidityDebug }" @click="showLiquidityDebug = !showLiquidityDebug">
        Debug
      </button>
      <button :class="{ active: showMetadata }" @click="showMetadata = !showMetadata">
        Metadaten
      </button>
    </div>
  </div>

  <PriceChart
    :key="currentSymbol"
    :symbol="currentSymbol"
    :current-bar="currentBar"
    :trades="trades"
    :poi-zones="poiZones"
    :show-historical-obs="showHistoricalObs"
    :show-liquidity="showLiquidity"
    :show-swept-liquidity="showSweptLiquidity"
    :show-liquidity-debug="showLiquidityDebug"
    :show-trade-setups="showTradeSetups"
    :trade-setup-history-count="tradeSetupHistoryCount"
    :show-trend-analysis="showTrendAnalysis"
    :show-metadata="showMetadata"
    @close-metadata="showMetadata = false"
  />

  <aside class="trades-panel">
    <h2 class="trades-panel-title">Trades</h2>
    <div class="trades-list">
      <TradesTable :trades="trades" />
    </div>
    <TradeStats :trades="trades" />
  </aside>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #131722;
  border-bottom: 1px solid #2a2e39;
}

.symbol-switcher,
.timeframe-switcher,
.drawing-toggles {
  display: flex;
  gap: 4px;
}

.drawing-toggles {
  padding-left: 12px;
  border-left: 1px solid #2a2e39;
}

.symbol-switcher button {
  font-weight: 600;
}

.symbol-switcher button,
.timeframe-switcher button,
.drawing-toggles button {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.symbol-switcher button:hover,
.timeframe-switcher button:hover,
.drawing-toggles button:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.symbol-switcher button.active,
.timeframe-switcher button.active,
.drawing-toggles button.active {
  background: #2962ff;
  color: #fff;
}

.trade-setup-history-count {
  width: 40px;
  margin-left: 4px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
}

.trades-panel {
  flex-shrink: 0;
  max-height: 320px;
  background: #1e222d;
  border-top: 1px solid #2a2e39;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}

.trades-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.trades-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
</style>
