<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones } from "../orderBlocks.js";
import { renderTradeMarkers } from "../tradeMarkers.js";
import {
  binanceIntervalFor,
  fetchInitialDeltas,
  fetchDailyDeltas,
  fetchOlderDeltas,
  mergeRecentDeltas,
  cumulativeFromDeltas,
} from "../cvd.js";
import { okxBarFor } from "../timeframes.js";
import {
  fetchInitialCandles as fetchInitialForexCandles,
  fetchRecentCandles as fetchRecentForexCandles,
  fetchOlderCandles as fetchOlderForexCandles,
} from "../ctraderCandles.js";
import { useStatusBar } from "../composables/useStatusBar.js";
import Gauge from "./Gauge.vue";

const props = defineProps({
  symbol: { type: String, required: true },
  currentBar: { type: String, required: true },
  trades: { type: Array, default: () => [] },
  poiZones: { type: Array, default: () => [] },
  showHistoricalObs: { type: Boolean, default: false },
});

// CVD (Binance-Futures-Orderflow) gibt es nur für BTC-USDT — für Forex-Symbole (cTrader)
// bleiben Gauges/CVD-Pane komplett weg statt leer. Der Wert steht bei onMounted fest:
// Dashboard.vue rendert <PriceChart :key="symbol">, ein Symbolwechsel montiert die
// Komponente also neu, statt dieses Flag zur Laufzeit umzuschalten.
const isForex = props.symbol !== "BTC-USDT";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
const POLL_MS = 12_000;
const RECENT_PAGE_SIZE = 300; // OKX max per call on /market/candles
const HISTORY_PAGE_SIZE = 100; // OKX max per call on /market/history-candles
const INITIAL_CANDLE_COUNT = 1000; // depth loaded on startup / timeframe switch
const LAZY_LOAD_LOGICAL_THRESHOLD = 20; // fetch older data once this close to the left edge
const WINDOW_BARS = 15; // letzte 15 Binance-1m-Kerzen für das rollierende Gauge-Fenster
const TRADE_MARKER_BARS = new Set(["1m", "5m", "15m", "1h"]); // 4h/1D würden zu unübersichtlich

const { markSuccess } = useStatusBar();

const chartContainerRef = ref(null);
const gaugesBottom = ref(12);
const windowDelta = ref(0);
const dailyDelta = ref(0);

// lightweight-charts ist inhärent imperativ (Canvas-API) — Chart/Series/Primitives und ihr
// Zustand bleiben deshalb bewusst reine Closure-Variablen statt reaktiver refs. Sie steuern
// nie ein Template, nur Chart-Methodenaufrufe.
let chart;
let candleSeries;
let cvdSeries;
let resizeObserver;
let orderBlockPrimitives = [];
let tradePrimitives = [];
let allCandles = [];
let allCvdDeltas = [];
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
let pollTimer = null;
let windowGaugeTimer = null;
let dailyGaugeTimer = null;

// lightweight-charts formatiert Zeit standardmäßig in UTC (unabhängig von der
// Browser-Zeitzone) — hier auf lokale Zeit umgestellt, damit die Achse/der Crosshair
// mit der Systemuhr des Nutzers übereinstimmt. Die zugrundeliegenden Zeitstempel
// (UTC-Sekunden) bleiben unverändert, es wird nur die Anzeige angepasst.
function pad2(n) {
  return String(n).padStart(2, "0");
}

function tickMarkFormatter(time, tickMarkType) {
  const d = new Date(time * 1000);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return `${d.getFullYear()}`;
    case TickMarkType.Month:
      return d.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    case TickMarkType.DayOfMonth:
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
    case TickMarkType.TimeWithSeconds:
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    default:
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}

function crosshairTimeFormatter(time) {
  const d = new Date(time * 1000);
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Gauges an die untere rechte Ecke der Kerzen-Pane pinnen, direkt oberhalb der CVD-Pane —
// sonst überlappen sie deren Preisskala/Legende.
function positionGauges() {
  const cvdPane = chart.panes()[1];
  if (cvdPane) gaugesBottom.value = cvdPane.getHeight() + 12;
}

// OKX-Pagination: "after" liefert Kerzen VOR diesem Timestamp (ms) — für ältere Daten.
async function fetchCandlePage(endpoint, bar, { after, limit } = {}) {
  const params = new URLSearchParams({ instId: INST_ID, bar, limit: String(limit) });
  if (after) params.set("after", after);
  const res = await fetch(`${OKX_BASE_URL}${endpoint}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX error ${json.code}: ${json.msg}`);
  return json.data.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  })); // neueste zuerst
}

// Holt die letzten `count` Kerzen über mehrere Seiten von /market/candles (recent-Fenster).
async function fetchInitialCandles(bar, count) {
  let all = [];
  let after;
  while (all.length < count) {
    const page = await fetchCandlePage("/api/v5/market/candles", bar, { after, limit: RECENT_PAGE_SIZE });
    if (page.length === 0) break;
    all = all.concat(page);
    after = String(page[page.length - 1].time * 1000);
    if (page.length < RECENT_PAGE_SIZE) break;
  }
  return all.reverse(); // älteste zuerst
}

// Für Scroll-Back über das recent-Fenster hinaus: /market/history-candles.
async function fetchOlderCandles(bar, oldestLoadedTime) {
  const page = await fetchCandlePage("/api/v5/market/history-candles", bar, {
    after: String(oldestLoadedTime * 1000),
    limit: HISTORY_PAGE_SIZE,
  });
  return page.filter((c) => c.time < oldestLoadedTime).reverse(); // älteste zuerst
}

function mergeRecent(existing, freshRecent) {
  if (existing.length === 0 || freshRecent.length === 0) return freshRecent;
  const freshStart = freshRecent[0].time;
  const olderPrefix = existing.filter((c) => c.time < freshStart);
  return olderPrefix.concat(freshRecent);
}

function refreshTradeMarkersInternal() {
  const trades = TRADE_MARKER_BARS.has(props.currentBar) ? props.trades : [];
  renderTradeMarkers(candleSeries, trades, tradePrimitives, allCandles);
}

// POI-Zonen kommen vom poi-watcher-Backend (4H+1H, aus `ob_zones`) statt lokal aus den
// gerade angezeigten Kerzen neu berechnet — so zeigt der Chart immer exakt das, was der
// Bot auch tatsächlich beobachtet/alarmiert, unabhängig vom gewählten Chart-Timeframe.
// "Historische OBs"-Toggle (Dashboard-Toolbar) blendet bereits angetestete, aber noch nicht
// invalidierte Zonen aus (analog zum tv-indikator-Toggle, siehe PLAN-notifications.md) —
// invalidierte Zonen bleiben unabhängig davon immer ausgeblendet (eigene, ältere Regel).
function filterHistorical(zones) {
  return props.showHistoricalObs ? zones : zones.filter((z) => !z.touched);
}

// Für Forex (GBPUSD) gibt es noch kein Backend, das Zonen vorberechnet (siehe PLAN-
// notifications.md) — hier deshalb direkt aus den geladenen Kerzen des aktuellen
// Timeframes neu erkannt, statt wie bei BTC aus `ob_zones` (Supabase) gerendert.
function refreshPoiZonesInternal() {
  if (isForex) {
    const zones = detectOrderBlocks(allCandles)
      .filter((z) => !z.invalidated)
      .map((z) => ({ ...z, timeframe: props.currentBar.toUpperCase() }));
    renderPersistedZones(candleSeries, filterHistorical(zones), orderBlockPrimitives, allCandles);
  } else {
    renderPersistedZones(candleSeries, filterHistorical(props.poiZones), orderBlockPrimitives, allCandles);
  }
}

function refreshChart() {
  // Async loads (loadInitial/pollRecent/lazy-load) koennen noch laufen, wenn die
  // Komponente schon unmounted wurde (z.B. schnelle Navigation zu /protokoll) — chart
  // ist dann bereits disposed, ohne Guard wirft lightweight-charts "Object is disposed".
  if (!chart) return;
  candleSeries.setData(allCandles);
  refreshPoiZonesInternal();
  refreshTradeMarkersInternal();
  cvdSeries?.setData(cumulativeFromDeltas(allCvdDeltas));
  positionGauges();
}

async function loadInitial() {
  try {
    let candles, deltas;
    if (isForex) {
      candles = await fetchInitialForexCandles(props.symbol, props.currentBar, INITIAL_CANDLE_COUNT);
      deltas = [];
    } else {
      const binanceInterval = binanceIntervalFor(props.currentBar);
      [candles, deltas] = await Promise.all([
        fetchInitialCandles(okxBarFor(props.currentBar), INITIAL_CANDLE_COUNT),
        fetchInitialDeltas(binanceInterval, INITIAL_CANDLE_COUNT).catch((err) => {
          console.error("CVD-Historie fehlgeschlagen:", err);
          return [];
        }),
      ]);
    }
    allCandles = candles;
    allCvdDeltas = deltas;
    reachedHistoryStart = false;
    reachedCvdHistoryStart = isForex; // keine CVD-Historie zum Nachladen bei Forex
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

async function pollRecent() {
  try {
    let recent, freshDeltas;
    if (isForex) {
      recent = await fetchRecentForexCandles(props.symbol, props.currentBar, RECENT_PAGE_SIZE);
      freshDeltas = null;
    } else {
      const binanceInterval = binanceIntervalFor(props.currentBar);
      [recent, freshDeltas] = await Promise.all([
        fetchCandlePage("/api/v5/market/candles", okxBarFor(props.currentBar), { limit: RECENT_PAGE_SIZE }).then((rows) =>
          rows.reverse(),
        ),
        fetchInitialDeltas(binanceInterval, RECENT_PAGE_SIZE).catch((err) => {
          console.error("CVD-Update fehlgeschlagen:", err);
          return null;
        }),
      ]);
    }
    allCandles = mergeRecent(allCandles, recent);
    if (freshDeltas) allCvdDeltas = mergeRecentDeltas(allCvdDeltas, freshDeltas);
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

async function updateWindowGauge() {
  try {
    const deltas = await fetchInitialDeltas("1m", WINDOW_BARS);
    windowDelta.value = deltas.reduce((sum, d) => sum + d.delta, 0);
  } catch (err) {
    console.error("Gauge (15m) fehlgeschlagen:", err);
  }
}

async function updateDailyGauge() {
  try {
    const deltas = await fetchDailyDeltas();
    dailyDelta.value = deltas.reduce((sum, d) => sum + d.delta, 0);
  } catch (err) {
    console.error("Gauge (Tag) fehlgeschlagen:", err);
  }
}

onMounted(() => {
  chart = createChart(chartContainerRef.value, {
    layout: {
      background: { color: "#131722" },
      textColor: "#d1d4dc",
    },
    grid: {
      vertLines: { color: "#1e222d" },
      horzLines: { color: "#1e222d" },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter,
    },
    localization: {
      timeFormatter: crosshairTimeFormatter,
    },
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: false,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
    // Default (precision 2 / minMove 0.01) passt für BTC-USD, macht Forex-Kurse (GBPUSD
    // z.B. 1.33941) aber auf 1.34 gerundet fast nutzlos — 5 Nachkommastellen (Pipette).
    priceFormat: isForex
      ? { type: "price", precision: 5, minMove: 0.00001 }
      : { type: "price", precision: 2, minMove: 0.01 },
  });

  if (!isForex) {
    cvdSeries = chart.addSeries(
      LineSeries,
      {
        color: "#f0b90b",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "CVD (Binance Futures)",
      },
      1, // eigene Pane unterhalb des Candlestick-Charts
    );
    chart.panes()[1]?.setStretchFactor(0.25);
  }

  resizeObserver = new ResizeObserver((entries) => {
    if (!chart) return; // Resize-Callback kann nach chart.remove() noch nachfeuern
    const { width, height } = entries[0].contentRect;
    chart.resize(width, height);
    positionGauges();
  });
  resizeObserver.observe(chartContainerRef.value);
  positionGauges();

  chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
    if (!chart || !range || loadingOlder || allCandles.length === 0) return;
    if (range.from > LAZY_LOAD_LOGICAL_THRESHOLD) return;
    if (reachedHistoryStart && reachedCvdHistoryStart) return;

    loadingOlder = true;
    try {
      const tasks = [];
      if (!reachedHistoryStart) {
        const olderPromise = isForex
          ? fetchOlderForexCandles(props.symbol, props.currentBar, allCandles[0].time, HISTORY_PAGE_SIZE)
          : fetchOlderCandles(okxBarFor(props.currentBar), allCandles[0].time);
        tasks.push(
          olderPromise.then((older) => {
            if (older.length === 0) reachedHistoryStart = true;
            else allCandles = older.concat(allCandles);
          }),
        );
      }
      if (!reachedCvdHistoryStart && allCvdDeltas.length > 0) {
        tasks.push(
          fetchOlderDeltas(binanceIntervalFor(props.currentBar), allCvdDeltas[0].time).then((older) => {
            if (older.length === 0) reachedCvdHistoryStart = true;
            else allCvdDeltas = older.concat(allCvdDeltas);
          }),
        );
      }
      await Promise.all(tasks);
      refreshChart();
    } catch (err) {
      console.error("Ältere Daten laden fehlgeschlagen:", err);
    } finally {
      loadingOlder = false;
    }
  });

  loadInitial();
  pollTimer = setInterval(pollRecent, POLL_MS);
  if (!isForex) {
    updateWindowGauge();
    updateDailyGauge();
    windowGaugeTimer = setInterval(updateWindowGauge, POLL_MS);
    dailyGaugeTimer = setInterval(updateDailyGauge, POLL_MS);
  }
});

onUnmounted(() => {
  clearInterval(pollTimer);
  clearInterval(windowGaugeTimer);
  clearInterval(dailyGaugeTimer);
  resizeObserver?.disconnect();
  chart?.remove();
  // Nullen, damit noch laufende Async-Loads (loadInitial/pollRecent) beim Abschluss
  // per Guard erkennen, dass der Chart schon disposed ist, statt lightweight-charts'
  // "Object is disposed" auszulösen.
  chart = null;
  candleSeries = null;
  cvdSeries = null;
});

watch(() => props.currentBar, loadInitial);
watch(() => props.trades, refreshTradeMarkersInternal);
watch(() => props.poiZones, refreshPoiZonesInternal);
watch(() => props.showHistoricalObs, refreshPoiZonesInternal);
</script>

<template>
  <div class="chart-wrapper">
    <div ref="chartContainerRef" class="chart-container"></div>
    <div v-if="!isForex" class="cvd-gauges" :style="{ bottom: gaugesBottom + 'px' }">
      <Gauge id="window" :value="windowDelta" label="Δ 15m" />
      <Gauge id="daily" :value="dailyDelta" label="Δ Tag (UTC)" />
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.chart-container {
  flex: 1;
  min-height: 0;
}

.cvd-gauges {
  position: absolute;
  z-index: 5;
  right: 12px;
  display: flex;
  gap: 8px;
  pointer-events: none;
}
</style>
