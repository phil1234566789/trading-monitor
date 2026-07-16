<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import { detectLiquidityLevels, filterRelevantLevels, renderLiquidityLevels, LiquidityLinePrimitive } from "../liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
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
  showLiquidity: { type: Boolean, default: true },
  showTradeSetups: { type: Boolean, default: true },
  tradeSetupHistoryCount: { type: Number, default: 5 },
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
const LIQUIDITY_FRACTAL_PERIOD = 5; // Williams-Fractal-Periode, siehe fractals.pine
const LIQUIDITY_MAX_RELEVANT = 10; // je Richtung, siehe liqMaxRelevant in inputs.pine
const LIQUIDITY_ONLY_RELEVANT = true; // blendet alte, längst geswepte Level aus

// Trade-Setup (Liquidity Sweep + Protected M5-Fraktal + M5-OB, siehe tv-indikator/src/
// tradesetup.pine) — nur für Forex (braucht M5-Kerzen zusätzlich zum aktuell angezeigten
// Chart-Timeframe). Werte 1:1 aus den getunten Defaults in tv-indikator/src/inputs.pine
// übernommen (TRADE-SETUP-Gruppen), nicht neu geraten — siehe auch poi-watcher/index.ts,
// das dieselben Werte serverseitig für die Telegram-Alarme nutzt.
const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
const TRADE_SETUP_H1_FRACTAL_PERIOD = 10; // liqH1Period
const TRADE_SETUP_CANDLE_COUNT = 300; // ~25h M5-Historie, mehr als der Lookback unten
const TRADE_SETUP_GRACE_SEC = 5 * 60; // eine M5-Kerzenlänge
const TRADE_SETUP_LS_MAX_LEAD_SEC = 30 * 60; // lsMaxLeadMinutes
const TRADE_SETUP_OB_MAX_DELAY_SEC = 60 * 60; // obMaxDelayMinutes
const TRADE_SETUP_LOOKBACK_SEC = 6 * 60 * 60; // protectedHighLookbackHours
const TRADE_SETUP_OB_WIDTH_SEC = 10 * TRADE_SETUP_GRACE_SEC; // obBoxWidthM5Candles=10, rein optisch
const TRADE_SETUP_POLL_MS = 60_000; // eigener, langsamerer Poll als POLL_MS — M5/H1 brauchen keine 12s-Frische und jeder Poll ist ein frischer cTrader-TLS-Connect
const TRADE_SETUP_GOLD = "rgba(255, 215, 0, 0.9)";
const TRADE_SETUP_BLUE = "rgba(33, 150, 243, 0.9)";
const TRADE_SETUP_PROTECTED_COLOR = "rgba(255, 255, 255, 0.95)";
const TRADE_SETUP_LINE_WIDTH = 2;
const TRADE_SETUP_OB_BEAR = { fillColor: "rgba(255, 215, 0, 0.22)", borderColor: "rgba(255, 215, 0, 0.7)" };
const TRADE_SETUP_OB_BULL = { fillColor: "rgba(33, 150, 243, 0.22)", borderColor: "rgba(33, 150, 243, 0.7)" };

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
let liquidityPrimitives = [];
let tradePrimitives = [];
let tradeSetupPrimitives = [];
let allCandles = [];
let allCvdDeltas = [];
let tradeSetupM5Candles = [];
let tradeSetupH1Candles = [];
let currentTradeSetups = [];
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
let pollTimer = null;
let tradeSetupPollTimer = null;
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

// Liquiditäts-Level (Fractal-Pivots, siehe tv-indikator/src/liquidity.pine) gibt es
// bisher für kein Symbol aus dem Backend — anders als die BTC-OB-Zonen (`ob_zones`)
// deshalb hier für beide (BTC + Forex) direkt aus den geladenen Kerzen des aktuellen
// Chart-Timeframes neu erkannt, analog zur Forex-OB-Erkennung oben.
function refreshLiquidityInternal() {
  if (!props.showLiquidity) {
    renderLiquidityLevels(candleSeries, [], liquidityPrimitives, allCandles);
    return;
  }
  const { highs, lows } = detectLiquidityLevels(allCandles, LIQUIDITY_FRACTAL_PERIOD);
  const relevant = [
    ...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, LIQUIDITY_ONLY_RELEVANT),
    ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, LIQUIDITY_ONLY_RELEVANT),
  ];
  renderLiquidityLevels(candleSeries, relevant, liquidityPrimitives, allCandles);
}

// Erkennung läuft nur, wenn sich die M5/H1-Kerzen geändert haben (siehe loadTradeSetupCandles)
// — das Ergebnis (currentTradeSetups) bleibt über Timeframe-Wechsel/refreshChart-Aufrufe
// hinweg stehen, nur renderTradeSetupsInternal() (Positionierung) läuft bei jedem Refresh neu.
// Zeigt die letzten `tradeSetupHistoryCount` Setups JE Richtung (analog zu
// tradeSetupHistoryCountShort/Long + lastTradeSetups im Original) — nicht nur das gerade
// aktive. Nummerierung (1..n, chronologisch) nur für die angezeigte Auswahl, nicht global über
// die gesamte Historie — wir haben keinen fortlaufenden Zähler wie das Pine-Original, das bei
// jedem neuen Live-Setup hochzählt.
function computeTradeSetups() {
  if (tradeSetupM5Candles.length === 0 || tradeSetupH1Candles.length === 0) {
    currentTradeSetups = [];
    return;
  }
  const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(tradeSetupM5Candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
  const { highs: h1Highs, lows: h1Lows } = detectLiquidityLevels(tradeSetupH1Candles, TRADE_SETUP_H1_FRACTAL_PERIOD);
  const setupObs = detectSetupObs(tradeSetupM5Candles);
  const params = {
    graceSec: TRADE_SETUP_GRACE_SEC,
    lsMaxLeadSec: TRADE_SETUP_LS_MAX_LEAD_SEC,
    maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
    obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
    nowTime: tradeSetupM5Candles[tradeSetupM5Candles.length - 1].time,
  };
  // Anders als tradeSetupHistoryCountShort/Long im Original (dort "zusätzlich zum aktuell
  // aktiven", 0 = nur das aktive) zählt n hier die GESAMTE Anzahl gezeigter Setups je
  // Richtung — wir zeichnen kein separates "Live"-Setup, siehe detectTradeSetups. n=0 zeigt
  // also nichts (slice(-0) wäre sonst das GANZE Array, daher der Sonderfall).
  const n = Math.max(0, props.tradeSetupHistoryCount);
  const takeLast = (arr) => (n === 0 ? [] : arr.slice(-n));
  const shorts = takeLast(detectTradeSetups(1, m5Highs, h1Highs, m5Highs, setupObs, params));
  const longs = takeLast(detectTradeSetups(-1, m5Lows, h1Lows, m5Lows, setupObs, params));
  currentTradeSetups = [
    ...shorts.map((s, i) => ({ ...s, label: n > 1 ? `Short-Setup (${i + 1})` : "Short-Setup" })),
    ...longs.map((s, i) => ({ ...s, label: n > 1 ? `Long-Setup (${i + 1})` : "Long-Setup" })),
  ];
}

// OB (Order Block) ≠ FVG — siehe obBoxBounds in tradesetup.pine: die gezeichnete Box reicht
// vom Fraktal bis zur ihm am nächsten liegenden Kante der FVG, nicht die FVG selbst.
function tradeSetupObBoxBounds(setup) {
  return setup.dir === 1
    ? { top: setup.fractal.price, bottom: setup.obTop }
    : { top: setup.obBottom, bottom: setup.fractal.price };
}

// Positioniert die aktuell erkannten Setups (currentTradeSetups) gegen `allCandles` (den
// gerade angezeigten Chart-Timeframe) — analog zu renderPersistedZones für die 4H/1H-OB-
// Zonen: das Setup selbst lebt auf M5/H1, gerendert wird aber immer gegen das sichtbare
// Timeframe, damit die Koordinaten-Snappings (snapToBarTime) einen gültigen Bezugspunkt haben.
function renderTradeSetupsInternal() {
  // Async-Fetch (loadTradeSetupCandles) kann noch laufen, wenn die Komponente schon
  // unmounted wurde — siehe gleicher Guard in refreshChart().
  if (!chart) return;
  for (const p of tradeSetupPrimitives) candleSeries.detachPrimitive(p);
  tradeSetupPrimitives.length = 0;
  if (!isForex || !props.showTradeSetups) return;

  for (const setup of currentTradeSetups) {
    const lsColor = setup.dir === 1 ? TRADE_SETUP_GOLD : TRADE_SETUP_BLUE;
    const obColors = setup.dir === 1 ? TRADE_SETUP_OB_BEAR : TRADE_SETUP_OB_BULL;
    const { top, bottom } = tradeSetupObBoxBounds(setup);

    const fractalLine = new LiquidityLinePrimitive(
      setup.fractal,
      { color: TRADE_SETUP_PROTECTED_COLOR, lineWidth: TRADE_SETUP_LINE_WIDTH },
      allCandles,
    );
    const lsLine = new LiquidityLinePrimitive(setup.ls, { color: lsColor, lineWidth: TRADE_SETUP_LINE_WIDTH }, allCandles);
    const obBox = new OrderBlockPrimitive(
      { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC },
      { ...obColors, textColor: "rgba(255, 255, 255, 0.9)", label: setup.label },
      allCandles,
    );

    for (const primitive of [fractalLine, lsLine, obBox]) {
      candleSeries.attachPrimitive(primitive);
      tradeSetupPrimitives.push(primitive);
    }
  }
}

// M5/H1-Kerzen für die Trade-Setup-Erkennung — unabhängig vom aktuell gewählten Chart-
// Timeframe (props.currentBar), da ein Setup immer auf M5-Fraktal + H1/M5-Sweep basiert,
// egal ob der Nutzer gerade den 1h- oder den 15m-Chart anschaut. Eigener, langsamerer Poll
// (TRADE_SETUP_POLL_MS) statt am 12s-POLL_MS der Haupt-Kerzen zu hängen — jeder Aufruf ist
// ein frischer cTrader-TLS-Connect (siehe ctraderCandles.js), 12s wäre unnötig teuer.
async function loadTradeSetupCandles() {
  if (!isForex) return;
  try {
    const [m5, h1] = await Promise.all([
      fetchInitialForexCandles(props.symbol, "5m", TRADE_SETUP_CANDLE_COUNT),
      fetchInitialForexCandles(props.symbol, "1h", TRADE_SETUP_CANDLE_COUNT),
    ]);
    tradeSetupM5Candles = m5;
    tradeSetupH1Candles = h1;
    computeTradeSetups();
    renderTradeSetupsInternal();
  } catch (err) {
    console.error("Trade-Setup-Kerzen fehlgeschlagen:", err);
  }
}

function refreshChart() {
  // Async loads (loadInitial/pollRecent/lazy-load) koennen noch laufen, wenn die
  // Komponente schon unmounted wurde (z.B. schnelle Navigation zu /protokoll) — chart
  // ist dann bereits disposed, ohne Guard wirft lightweight-charts "Object is disposed".
  if (!chart) return;
  candleSeries.setData(allCandles);
  refreshPoiZonesInternal();
  refreshLiquidityInternal();
  refreshTradeMarkersInternal();
  renderTradeSetupsInternal();
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
  if (isForex) {
    loadTradeSetupCandles();
    tradeSetupPollTimer = setInterval(loadTradeSetupCandles, TRADE_SETUP_POLL_MS);
  }
  if (!isForex) {
    updateWindowGauge();
    updateDailyGauge();
    windowGaugeTimer = setInterval(updateWindowGauge, POLL_MS);
    dailyGaugeTimer = setInterval(updateDailyGauge, POLL_MS);
  }
});

onUnmounted(() => {
  clearInterval(pollTimer);
  clearInterval(tradeSetupPollTimer);
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
watch(() => props.showLiquidity, refreshLiquidityInternal);
watch(() => props.showTradeSetups, renderTradeSetupsInternal);
watch(() => props.tradeSetupHistoryCount, () => {
  computeTradeSetups();
  renderTradeSetupsInternal();
});
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
