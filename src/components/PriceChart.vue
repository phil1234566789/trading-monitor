<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import { detectLiquidityLevels, filterRelevantLevels, renderLiquidityLevels, LiquidityLinePrimitive } from "../liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
import { initTrendState, applyPivot, zigzagSegments, renderZigzag } from "../trendZigzag";
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
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";
import Gauge from "./Gauge.vue";
import MetadataPanel from "./MetadataPanel.vue";
import JsonTree from "./JsonTree.vue";

const props = defineProps({
  symbol: { type: String, required: true },
  currentBar: { type: String, required: true },
  trades: { type: Array, default: () => [] },
  poiZones: { type: Array, default: () => [] },
  showHistoricalObs: { type: Boolean, default: false },
  showLiquidity: { type: Boolean, default: true },
  showSweptLiquidity: { type: Boolean, default: false },
  showLiquidityDebug: { type: Boolean, default: false },
  showTradeSetups: { type: Boolean, default: true },
  tradeSetupHistoryCount: { type: Number, default: 5 },
  showMetadata: { type: Boolean, default: false },
  showPivots: { type: Boolean, default: false },
  showZigzag: { type: Boolean, default: false },
});
const emit = defineEmits(["close-metadata"]);

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
const LIQUIDITY_FRACTAL_PERIOD = 5; // Williams-Fractal-Periode, siehe fractals.pine — NICHT anfassen (LQ-Sweeps), siehe Chat
const LIQUIDITY_MAX_RELEVANT = 10; // je Richtung, siehe liqMaxRelevant in inputs.pine
// Eigenständiger "Pivots"-Toggle für die Trendanalyse-Diskussion — bewusst eine eigene Periode
// (10 statt 5) UND eine eigene Erkennung/Primitives-Liste, damit die LQ-Sweep-Linien (Periode 5,
// oben) davon unberührt bleiben (siehe Chat: "die LQ-Sweeps dürfen nicht verändert werden").
const PIVOTS_FRACTAL_PERIOD = 10;

// Trade-Setup (Liquidity Sweep + Protected M5-Fraktal + M5-OB, siehe tv-indikator/src/
// tradesetup.pine) — nur für Forex (braucht M5-Kerzen zusätzlich zum aktuell angezeigten
// Chart-Timeframe). Werte 1:1 aus den getunten Defaults in tv-indikator/src/inputs.pine
// übernommen (TRADE-SETUP-Gruppen), nicht neu geraten — siehe auch poi-watcher/index.ts,
// das dieselben Werte serverseitig für die Telegram-Alarme nutzt.
const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
const TRADE_SETUP_H1_FRACTAL_PERIOD = 10; // liqH1Period
const TRADE_SETUP_CANDLE_COUNT = 300; // ~25h M5-Historie, mehr als der Lookback unten
const TRADE_SETUP_GRACE_SEC = 5 * 60; // eine M5-Kerzenlänge
const TRADE_SETUP_LS_MAX_LEAD_SEC_H1 = 120 * 60; // lsMaxLeadMinutesH1 — eigenes, größeres Fenster
// als M5 (H1-Sweep liegt typischerweise deutlich länger vor dem Fraktal), siehe poi-watcher/index.ts
const TRADE_SETUP_LS_MAX_LEAD_SEC_M5 = 45 * 60; // lsMaxLeadMinutesM5
const TRADE_SETUP_PIP_SIZE = 0.0001; // pipSize im Indikator — gilt für beide FX-Paare (GBPUSD/EURUSD)
const TRADE_SETUP_LS_MAX_DISTANCE_M5 = 5.0 * TRADE_SETUP_PIP_SIZE; // lsMaxDistancePipsM5=5, nur für M5-LS
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

// Zigzag/Metadaten (siehe trendZigzag.js) brauchen mehr M5-Historie als tradeSetupM5Candles
// (300 = ~25h) — eigener Fetch, nur solange einer der beiden Toggles an ist (jeder Fetch ist ein
// frischer cTrader-TLS-Connect, siehe loadTradeSetupCandles). fetchTrendAnalysisM5History
// paginiert automatisch nach, falls der Anker (siehe unten) irgendwann weiter als ~83h (1000
// Kerzen, Edge-Function-Limit pro Request) zurückliegt.
const TREND_ANALYSIS_CANDLE_COUNT = 1000;
// Fester Anker für den Zigzag-Algo statt automatischer Herleitung — siehe Chat: der Trend soll
// exakt am Ursprung des Pivots starten, den man als Referenz nehmen will (hier: der Swing High
// 1.35578 vom 15.07). 19:20 statt 20:20 (Pivot-Kerze selbst), damit die Fraktal-Erkennung
// (braucht period=5 Kerzen davor) den Pivot bei 1.35578 überhaupt als solchen erkennt.
const TREND_ANALYSIS_ANCHOR_TIME = Math.floor(new Date("2026-07-15T19:20:00+02:00").getTime() / 1000);

const { markSuccess } = useStatusBar();

const chartContainerRef = ref(null);
const gaugesBottom = ref(12);
const windowDelta = ref(0);
const dailyDelta = ref(0);
const trendMetadata = ref(null); // Rohkopie des Zigzag-States fürs Metadaten-Panel, siehe refreshZigzagInternal

// Menschenlesbare Zusammenfassung fürs Metadaten-Panel — jetzt der ZIGZAG-State (siehe
// trendZigzag.js / test/trendanalyse_vorschlag.ts), NICHT mehr buildNestedTrendStructure: Philip
// hat das explizit so spezifiziert (trendOrdnung statt chartLabel "Rahmen (übergeordnet)", siehe
// Chat). pivotTime ist nur intern fürs Rendern der Zigzag-Linien nötig, taucht hier bewusst
// nicht auf (Philips Pivot-Typ hat kein Pflichtfeld dafür, nur das menschenlesbare pivotAt).
function pivotForDisplay(p) {
  if (!p) return null;
  const { pivotTime, ...rest } = p;
  return rest;
}
function summarizeZigzagState(state) {
  if (!state) return null;
  return {
    trendOrdnung: state.trendOrdnung,
    direction: state.direction,
    trendState: state.trendState,
    range: { high: pivotForDisplay(state.range.high), low: pivotForDisplay(state.range.low) },
    struktur: state.struktur.map(pivotForDisplay),
    unterStruktur: state.unterStruktur,
    gelesenePivots: state.gelesenePivots.map(pivotForDisplay),
  };
}
// Rohes Objekt statt fertigem JSON-Text — JsonTree.vue rendert es einklappbar, damit man
// große Arrays (gelesenePivots) schneller überfliegen kann.
const metadataTree = computed(() => (trendMetadata.value ? summarizeZigzagState(trendMetadata.value) : null));

// lightweight-charts ist inhärent imperativ (Canvas-API) — Chart/Series/Primitives und ihr
// Zustand bleiben deshalb bewusst reine Closure-Variablen statt reaktiver refs. Sie steuern
// nie ein Template, nur Chart-Methodenaufrufe.
let chart;
let candleSeries;
let cvdSeries;
let resizeObserver;
let orderBlockPrimitives = [];
let liquidityPrimitives = [];
let pivotPrimitives = [];
let zigzagPrimitives = [];
let tradePrimitives = [];
let tradeSetupPrimitives = [];
let allCandles = [];
let allCvdDeltas = [];
let tradeSetupM5Candles = [];
let tradeSetupH1Candles = [];
let currentTradeSetups = [];
let trendAnalysisM5Candles = [];
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
// `showSweptLiquidity` zeigt ALLE erkannten M5-Pivots ungefiltert (kein filterRelevantLevels,
// keine maxRelevant-Deckelung) — auch längst berührte. Für die Trendanalyse-Diskussion mit
// Philip: er braucht wirklich jeden Pivot sichtbar, nicht nur die 10 neuesten je Richtung, die
// filterRelevantLevels selbst mit onlyRelevant=false noch abschneiden würde.
function refreshLiquidityInternal() {
  if (!props.showLiquidity) {
    renderLiquidityLevels(candleSeries, [], liquidityPrimitives, allCandles);
    return;
  }
  const { highs, lows } = detectLiquidityLevels(allCandles, LIQUIDITY_FRACTAL_PERIOD);
  const relevant = props.showSweptLiquidity
    ? [...highs, ...lows]
    : [...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true), ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true)];
  const precision = pricePrecisionForInstrument(props.symbol);
  renderLiquidityLevels(candleSeries, relevant, liquidityPrimitives, allCandles, {
    debugPrices: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
  });
}

// "Pivots"-Toggle: exakt dieselbe Erkennung/Zeichnung wie die LQ-Sweep-Linien oben, aber mit
// eigener Periode (10) und eigener Primitives-Liste — komplett unabhängig von
// refreshLiquidityInternal, damit die LQ-Sweep-Linien (Periode 5) davon niemals beeinflusst
// werden. Zeigt immer ALLE erkannten Pivots (kein Relevanz-Filter), genau wie
// "Gesweepte Liquidität" — das war hier ja gerade der Punkt.
function refreshPivotsInternal() {
  if (!props.showPivots) {
    renderLiquidityLevels(candleSeries, [], pivotPrimitives, allCandles);
    return;
  }
  const { highs, lows } = detectLiquidityLevels(allCandles, PIVOTS_FRACTAL_PERIOD);
  const precision = pricePrecisionForInstrument(props.symbol);
  renderLiquidityLevels(candleSeries, [...highs, ...lows], pivotPrimitives, allCandles, {
    debugPrices: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
  });
}

// "Zigzag"-Toggle: Philips eigener Marktstruktur-Entwurf (siehe test/trendanalyse_vorschlag.ts
// und trendZigzag.js) — verbindet die M5-Periode-10-Pivots seit dem Trend-Ursprung
// (TREND_ANALYSIS_ANCHOR_TIME) der Reihe nach mit Linien, statt horizontale Level zu zeichnen.
// Nutzt trendAnalysisM5Candles (nicht allCandles!), weil der Ursprung mehrere Tage zurückliegt —
// gerendert wird aber gegen allCandles (das sichtbare Timeframe), aus demselben Grund wie bei
// renderTrendState.
function computeZigzagState() {
  const { highs, lows } = detectLiquidityLevels(trendAnalysisM5Candles, PIVOTS_FRACTAL_PERIOD);
  const pivots = [...highs, ...lows]
    .filter((p) => p.pivotTime >= TREND_ANALYSIS_ANCHOR_TIME)
    .sort((a, b) => a.pivotTime - b.pivotTime)
    .map((p) => ({
      price: p.price,
      pivotTime: p.pivotTime,
      type: p.dir === 1 ? "high" : "low",
      touched: p.touched ? { price: p.price, touchedAt: fmtDateTime(p.touchedTime) } : false,
      pivotAt: fmtDateTime(p.pivotTime),
    }));

  const originHigh = pivots.find((p) => p.type === "high");
  const originLow = pivots.find((p) => p.type === "low");
  if (!originHigh || !originLow) return null;

  let state = initTrendState({ trendOrdnung: 1, direction: "down", high: originHigh, low: originLow });
  for (const pivot of pivots) {
    if (pivot === originHigh || pivot === originLow) continue;
    state = applyPivot(state, pivot, { candles: trendAnalysisM5Candles, fractalPeriod: PIVOTS_FRACTAL_PERIOD });
  }
  return state;
}

// Berechnet den Zigzag-State IMMER (sobald trendAnalysisM5Candles da sind) und füllt damit
// trendMetadata fürs Metadaten-Panel — unabhängig von showZigzag, sonst hätte "nur Metadaten an,
// Zigzag aus" keine Daten zum Anzeigen. Nur das tatsächliche ZEICHNEN der Linien hängt an
// showZigzag.
function refreshZigzagInternal() {
  const state = trendAnalysisM5Candles.length > 0 ? computeZigzagState() : null;
  trendMetadata.value = state;

  if (!props.showZigzag || !state) {
    renderZigzag(candleSeries, [], zigzagPrimitives, allCandles);
    return;
  }
  const precision = pricePrecisionForInstrument(props.symbol);
  renderZigzag(candleSeries, zigzagSegments(state), zigzagPrimitives, allCandles, {
    showLabels: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
  });
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
    lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
    lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
    maxDistanceM5: TRADE_SETUP_LS_MAX_DISTANCE_M5,
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
    ...shorts.map((s, i) => ({ ...s, label: n > 1 ? `Short (${i + 1})` : "Short" })),
    ...longs.map((s, i) => ({ ...s, label: n > 1 ? `Long (${i + 1})` : "Long" })),
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

// TREND_ANALYSIS_CANDLE_COUNT (2000) liegt über dem Edge-Function-Limit pro Request (1000,
// siehe ctraderCandles.js) -> seitenweise rückwärts nachladen, analog zu fetchAllSince im
// fetch-trend-fixture.mjs-Script.
async function fetchTrendAnalysisM5History(symbol, targetCount) {
  let all = await fetchInitialForexCandles(symbol, "5m", Math.min(targetCount, 1000));
  while (all.length < targetCount && all.length > 0) {
    const older = await fetchOlderForexCandles(symbol, "5m", all[0].time, 1000);
    if (older.length === 0) break;
    all = older.concat(all);
  }
  return all;
}

// M5/H1-Kerzen für die Trade-Setup-Erkennung — unabhängig vom aktuell gewählten Chart-
// Timeframe (props.currentBar), da ein Setup immer auf M5-Fraktal + H1/M5-Sweep basiert,
// egal ob der Nutzer gerade den 1h- oder den 15m-Chart anschaut. Eigener, langsamerer Poll
// (TRADE_SETUP_POLL_MS) statt am 12s-POLL_MS der Haupt-Kerzen zu hängen — jeder Aufruf ist
// ein frischer cTrader-TLS-Connect (siehe ctraderCandles.js), 12s wäre unnötig teuer.
// Holt bei aktivem Zigzag/Metadaten-Toggle zusätzlich die größere M5-Historie für den
// Zigzag-Algo (siehe TREND_ANALYSIS_CANDLE_COUNT) — nur dann, um unnötige cTrader-Connects zu
// vermeiden, solange niemand hinschaut.
async function loadTradeSetupCandles() {
  if (!isForex) return;
  try {
    const fetches = [
      fetchInitialForexCandles(props.symbol, "5m", TRADE_SETUP_CANDLE_COUNT),
      fetchInitialForexCandles(props.symbol, "1h", TRADE_SETUP_CANDLE_COUNT),
    ];
    if (props.showZigzag || props.showMetadata) {
      fetches.push(fetchTrendAnalysisM5History(props.symbol, TREND_ANALYSIS_CANDLE_COUNT));
    }
    const [m5, h1, trendM5] = await Promise.all(fetches);
    tradeSetupM5Candles = m5;
    tradeSetupH1Candles = h1;
    if (trendM5) trendAnalysisM5Candles = trendM5;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshZigzagInternal();
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
  refreshPivotsInternal();
  refreshTradeMarkersInternal();
  renderTradeSetupsInternal();
  refreshZigzagInternal();
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
watch(() => props.showSweptLiquidity, refreshLiquidityInternal);
watch(() => props.showLiquidityDebug, () => {
  refreshLiquidityInternal();
  refreshPivotsInternal();
  refreshZigzagInternal();
});
watch(() => props.showPivots, refreshPivotsInternal);
watch(() => props.showTradeSetups, renderTradeSetupsInternal);
watch(() => props.tradeSetupHistoryCount, () => {
  computeTradeSetups();
  renderTradeSetupsInternal();
});
// Beim Einschalten fehlt die größere M5-Historie evtl. noch (siehe loadTradeSetupCandles) ->
// einmal frisch nachladen; beim Ausschalten reicht ein reines Re-Render (blendet aus).
watch(() => props.showZigzag, (on) => {
  if (on) loadTradeSetupCandles();
  else refreshZigzagInternal();
});
// Metadaten-Panel zeigt den Zigzag-State (siehe refreshZigzagInternal) — beim Einschalten ohne
// Zigzag fehlt trendAnalysisM5Candles evtl. noch, daher genau wie dort einmal nachladen.
watch(() => props.showMetadata, (on) => {
  if (on && trendAnalysisM5Candles.length === 0) loadTradeSetupCandles();
});
</script>

<template>
  <div class="chart-wrapper">
    <div ref="chartContainerRef" class="chart-container"></div>
    <div v-if="!isForex" class="cvd-gauges" :style="{ bottom: gaugesBottom + 'px' }">
      <Gauge id="window" :value="windowDelta" label="Δ 15m" />
      <Gauge id="daily" :value="dailyDelta" label="Δ Tag (UTC)" />
    </div>
    <MetadataPanel v-if="showMetadata" title="Trend-Metadaten" @close="emit('close-metadata')">
      <JsonTree v-if="metadataTree" :value="metadataTree" />
      <p v-else class="metadata-empty">Keine Trend-Daten geladen (Zigzag-Toggle einschalten).</p>
    </MetadataPanel>
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

.metadata-empty {
  margin: 0;
  font-size: 13px;
  color: #787b86;
}
</style>
