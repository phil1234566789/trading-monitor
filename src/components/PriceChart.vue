<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import { detectLiquidityLevels, filterRelevantLevels, renderLiquidityLevels, LiquidityLinePrimitive } from "../liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
import { initTrendState, applyPivot, zigzagSegments, renderZigzag } from "../trendZigzag";
import { initRangeState, applyRangePivot, renderRangeAnalysis } from "../rangeAnalysis";
import { computeEma } from "../ema.js";
import { chartColors, cssColor, cssColorScaled } from "../chartColors.js";
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
  rangesLookbackHours: { type: Number, default: 7 * 24 },
  showRanges: { type: Boolean, default: false },
  showRangesMetadata: { type: Boolean, default: false },
  showEma: { type: Boolean, default: false },
});
const emit = defineEmits(["close-metadata", "close-ranges-metadata"]);

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
const TRADE_SETUP_LINE_WIDTH = 2;
// tradeSetupShort/-Long dienen sowohl der LS-Linie (chartColors[key].alpha, Default 0.9 = "Haupt"-
// Transparenz) als auch der OB-Box, deren Fill/Border proportional dazu skalieren (Original-
// Design-Verhältnis 0.22/0.9 bzw. 0.7/0.9), siehe cssColorScaled in chartColors.js.
const TRADE_SETUP_OB_FILL_RATIO = 0.22 / 0.9;
const TRADE_SETUP_OB_BORDER_RATIO = 0.7 / 0.9;

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

// "Ranges" — erster Baustein des neuen PA-Analyse-Konzepts (siehe Chat 2026-07-18): H1-Periode-5-
// Fraktale im konfigurierbaren Lookback-Fenster (rangesLookbackHours), noch ohne weak/protected/
// sweep-Klassifizierung. Eigene Periode (5, wie liqM5Period-Analogon auf H1) und eigener Fetch,
// bewusst unabhängig von tradeSetupH1Candles (Periode 10, feste 300er-Historie) — die beiden
// Konzepte sollen sich nicht querbeeinflussen, siehe Chat.
const RANGES_FRACTAL_PERIOD = 5;
// Puffer vor/nach dem Lookback-Fenster: ein Fraktal braucht period+4 Kerzen davor und period
// danach, um überhaupt erkannt zu werden (siehe isUpFractal/isDownFractal in liquidity.js) — ohne
// Puffer würden Fraktale am Rand des konfigurierten Fensters unter den Tisch fallen.
const RANGES_CANDLE_BUFFER = 20;
const RANGES_POLL_MS = 60_000; // wie TRADE_SETUP_POLL_MS — H1-Kerzen brauchen keine schnellere Frische

// EMA 50/200 auf M5 (siehe Chat: Philips "Trend über EMA + Anzahl protected highs/lows"-Idee) —
// läuft auf trendAnalysisM5Candles (dieselbe M5-Historie wie der Zigzag-Algo), kein eigener Fetch
// nötig, siehe loadTradeSetupCandles.
const EMA_PERIOD_FAST = 50;
const EMA_PERIOD_SLOW = 200;

const { markSuccess } = useStatusBar();

const chartContainerRef = ref(null);
const gaugesBottom = ref(12);
const windowDelta = ref(0);
const dailyDelta = ref(0);
const trendMetadata = ref(null); // Rohkopie des Zigzag-States fürs Metadaten-Panel, siehe refreshZigzagInternal

// Menschenlesbare Zusammenfassung fürs Metadaten-Panel — jetzt der ZIGZAG-State (siehe
// src/trendZigzag.ts, src/range.type.ts / test/tdd_mit_claude.ts), NICHT mehr
// buildNestedTrendStructure: Philip hat das explizit so spezifiziert (trendOrdnung statt
// chartLabel "Rahmen (übergeordnet)", siehe Chat). pivotTime ist nur intern fürs Rendern der
// Zigzag-Linien nötig, taucht hier bewusst nicht auf (Philips Pivot-Typ hat kein Pflichtfeld
// dafür, nur das menschenlesbare pivotAt).
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
    confirmation: state.confirmation,
    range: { high: pivotForDisplay(state.range.high), low: pivotForDisplay(state.range.low) },
    structure: state.structure.map(pivotForDisplay),
    innerStructure: state.innerStructure,
    appliedPivots: state.appliedPivots.map(pivotForDisplay),
    trendInvalidatingPivot: pivotForDisplay(state.trendInvalidatingPivot),
  };
}
// Rohes Objekt statt fertigem JSON-Text — JsonTree.vue rendert es einklappbar, damit man
// große Arrays (appliedPivots) schneller überfliegen kann.
const metadataTree = computed(() => (trendMetadata.value ? summarizeZigzagState(trendMetadata.value) : null));

// lightweight-charts ist inhärent imperativ (Canvas-API) — Chart/Series/Primitives und ihr
// Zustand bleiben deshalb bewusst reine Closure-Variablen statt reaktiver refs. Sie steuern
// nie ein Template, nur Chart-Methodenaufrufe.
let chart;
let candleSeries;
let cvdSeries;
let ema50Series;
let ema200Series;
let resizeObserver;
let orderBlockPrimitives = [];
let liquidityPrimitives = [];
let pivotPrimitives = [];
let zigzagPrimitives = [];
let rangesMarkerPrimitives = [];
let rangeAnalysisPrimitives = [];
let tradePrimitives = [];
let tradeSetupPrimitives = [];
let allCandles = [];
let allCvdDeltas = [];
let tradeSetupM5Candles = [];
let tradeSetupH1Candles = [];
let currentTradeSetups = [];
let trendAnalysisM5Candles = [];
let rangesH1Candles = [];
let rangesPivots = null; // roh (mit pivotTime), siehe computeRangesPivots/refreshRangesMarkersInternal
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
let pollTimer = null;
let tradeSetupPollTimer = null;
let rangesPollTimer = null;
let windowGaugeTimer = null;
let dailyGaugeTimer = null;
const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
// Der erste H1-Fetch (loadRangesCandles) ist ein frischer cTrader-TLS-Connect+Auth-Handshake
// (siehe ctraderCandles.js/_shared/ctrader/client.ts) statt eines simplen DB-Reads — das kann
// spürbar dauern und lief bisher komplett unsichtbar (siehe Chat: "dauert echt lange bis es
// aufm Chart erscheint"). rangesMetadata bleibt null bis zum ersten erfolgreichen Fetch, danach
// nie wieder (auch nicht während der 60s-Hintergrund-Polls) — genau das späte "leer -> gefüllt"
// ist der Moment, der ohne Feedback wie ein Hänger wirkt.
const rangesLoading = computed(() => (props.showRanges || props.showRangesMetadata) && rangesMetadata.value === null);

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

// "Zigzag"-Toggle: Philips eigener Marktstruktur-Entwurf (siehe test/tdd_mit_claude.ts
// und trendZigzag.ts) — verbindet die M5-Periode-10-Pivots seit dem Trend-Ursprung
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

// H1-Periode-5-Fraktale im konfigurierten Lookback-Fenster (props.rangesLookbackHours) — reine
// Pivot-Liste, noch keine weak/protected/sweep-Klassifizierung (kommt als nächster Schritt im
// PA-Analyse-Konzept). cutoff statt einfach "alle erkannten Pivots", weil RANGES_CANDLE_BUFFER
// zusätzliche Kerzen VOR dem eigentlichen Lookback-Fenster lädt (siehe loadRangesCandles) — die
// dort möglicherweise erkannten Fraktale sollen nicht mitgezählt werden. pivotTime bleibt (roh)
// erhalten, weil refreshRangesMarkersInternal die Koordinaten braucht — erst pivotForDisplay
// (siehe oben, schon für den Zigzag-State genutzt) entfernt es fürs Metadaten-Panel.
function computeRangesPivots() {
  const cutoff = Math.floor(Date.now() / 1000) - props.rangesLookbackHours * 3600;
  const { highs, lows } = detectLiquidityLevels(rangesH1Candles, RANGES_FRACTAL_PERIOD);
  return [...highs, ...lows]
    .filter((p) => p.pivotTime >= cutoff)
    .sort((a, b) => a.pivotTime - b.pivotTime)
    .map((p) => ({
      type: p.dir === 1 ? "high" : "low",
      price: p.price,
      pivotTime: p.pivotTime,
      pivotAt: fmtDateTime(p.pivotTime),
      touched: p.touched ? { price: p.price, touchedAt: fmtDateTime(p.touchedTime) } : false,
    }));
}

// Punkt-Marker (KEINE Verbindungslinie) für die H1-Ranges-Pivots — nur sichtbar, wenn sowohl das
// Ranges-Metadaten-Panel als auch der Debug-Modus an sind (siehe Chat: "wenn ranges angetoggelt
// ist und debug modus"). Wiederverwendet ZigzagPrimitive/-Renderer aus trendZigzag.ts (Punkt +
// Preis-Label ist dort schon fertig) — je Pivot ein eigenes 1-Punkt-Segment, damit die dortige
// Verbindungslinie (entsteht nur bei pts.length > 1 INNERHALB eines Segments) nicht gezeichnet
// wird.
function refreshRangesMarkersInternal() {
  if (!props.showRanges || !props.showLiquidityDebug || !rangesPivots) {
    renderZigzag(candleSeries, [], rangesMarkerPrimitives, allCandles);
    return;
  }
  const precision = pricePrecisionForInstrument(props.symbol);
  const segments = rangesPivots.map((p) => ({ points: [p], color: cssColor("rangesMarker") }));
  renderZigzag(candleSeries, segments, rangesMarkerPrimitives, allCandles, {
    showLabels: true,
    formatPrice: (price) => fmtPrice(price, precision),
  });
}

function refreshRangesInternal() {
  rangesPivots = rangesH1Candles.length > 0 ? computeRangesPivots() : null;
  rangesMetadata.value = rangesPivots ? rangesPivots.map(pivotForDisplay) : null;
  refreshRangesMarkersInternal();
  refreshRangeAnalysisInternal();
}

// Neuer "1h-Range"-Trendalgorithmus (siehe rangeAnalysis.ts, test/tdd_mit_claude.ts) — läuft über
// dieselben H1-Pivots wie die Debug-Punktmarker oben, aber unabhängig vom Debug-Toggle: das ist
// das eigentliche Analyse-Ergebnis der Ranges-Funktion, nicht nur eine Debug-Hilfe. Erster
// gelesener 'low'/'high' bilden die Start-Range (analog zu computeZigzagState/originHigh/Low),
// der Rest läuft über applyRangePivot.
function computeRangeAnalysisState() {
  if (!rangesPivots || rangesPivots.length < 2) return null;
  const originLow = rangesPivots.find((p) => p.type === "low");
  const originHigh = rangesPivots.find((p) => p.type === "high");
  if (!originLow || !originHigh) return null;

  const [first, second] = originLow.pivotTime <= originHigh.pivotTime ? [originLow, originHigh] : [originHigh, originLow];
  let state = initRangeState(first, second);
  for (const pivot of rangesPivots) {
    if (pivot === originLow || pivot === originHigh) continue;
    state = applyRangePivot(state, pivot);
  }
  return state;
}

// Roter Pfeil+Linie an range.high, grüner an range.low, ggf. "1h protected low"-Linie +
// Trend-Label rechts/mittig (siehe Chat) — sichtbar, sobald showRanges an ist, unabhängig vom
// Debug-Toggle (im Gegensatz zu den rohen Punktmarkern oben).
function refreshRangeAnalysisInternal() {
  const state = computeRangeAnalysisState();
  if (!props.showRanges || !state) {
    renderRangeAnalysis(candleSeries, null, rangeAnalysisPrimitives, allCandles);
    return;
  }
  renderRangeAnalysis(candleSeries, state, rangeAnalysisPrimitives, allCandles);
}

// Eigener H1-Fetch fürs Ranges-Metadaten-Panel, unabhängig von tradeSetupH1Candles (siehe oben) —
// lädt genug Historie für das konfigurierte Lookback-Fenster + Erkennungspuffer.
async function loadRangesCandles() {
  if (!isForex) return;
  try {
    const count = props.rangesLookbackHours + RANGES_CANDLE_BUFFER;
    rangesH1Candles = await fetchInitialForexCandles(props.symbol, "1h", count);
    refreshRangesInternal();
  } catch (err) {
    console.error("Ranges-Kerzen fehlgeschlagen:", err);
  }
}

// showRanges (Marker im Chart) und showRangesMetadata (JSON-Panel) sind getrennte Toggles, teilen
// sich aber dieselben H1-Kerzen/Pivots — laden läuft also, solange MINDESTENS einer von beiden an
// ist, kein unnötiger cTrader-Connect (RANGES_POLL_MS), solange wirklich niemand hinschaut.
function rangesNeedsData() {
  return props.showRanges || props.showRangesMetadata;
}
function startRangesPolling() {
  loadRangesCandles();
  clearInterval(rangesPollTimer);
  rangesPollTimer = setInterval(loadRangesCandles, RANGES_POLL_MS);
}
function stopRangesPolling() {
  clearInterval(rangesPollTimer);
  rangesPollTimer = null;
}
function refreshRangesPollingState() {
  if (rangesNeedsData()) startRangesPolling();
  else stopRangesPolling();
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
    const key = setup.dir === 1 ? "tradeSetupShort" : "tradeSetupLong";
    const lsColor = cssColor(key);
    const { top, bottom } = tradeSetupObBoxBounds(setup);

    const fractalLine = new LiquidityLinePrimitive(
      setup.fractal,
      { color: cssColor("tradeSetupProtected"), lineWidth: TRADE_SETUP_LINE_WIDTH },
      allCandles,
    );
    const lsLine = new LiquidityLinePrimitive(setup.ls, { color: lsColor, lineWidth: TRADE_SETUP_LINE_WIDTH }, allCandles);
    const obBox = new OrderBlockPrimitive(
      { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        textColor: "rgba(255, 255, 255, 0.9)",
        label: setup.label,
      },
      allCandles,
    );

    for (const primitive of [fractalLine, lsLine, obBox]) {
      candleSeries.attachPrimitive(primitive);
      tradeSetupPrimitives.push(primitive);
    }
  }
}

// EMA 50/200 (M5) — läuft auf trendAnalysisM5Candles, M5-aufgelöst. Nur sichtbar, wenn der Chart
// selbst auch auf M5 steht: auf einem gröberen Timeframe (z.B. 1h) teilt sich die EMA-LineSeries
// die Zeitachse mit der 1h-Candlestick-Serie, und die viel dichteren M5-Zeitpunkte quetschen dort
// die Kerzen zusammen (siehe Chat: "candles werden ganz komisch dünn, wenn man den EMA anschaltet").
// Deshalb hier zusätzlich zum Toggle gegen props.currentBar geprüft — daher jetzt auch bei jedem
// TF-Wechsel über refreshChart() aufgerufen, nicht mehr nur bei loadTradeSetupCandles/watch(showEma).
function refreshEmaInternal() {
  if (!isForex) return;
  if (!props.showEma || props.currentBar !== "5m" || trendAnalysisM5Candles.length === 0) {
    ema50Series?.setData([]);
    ema200Series?.setData([]);
    return;
  }
  ema50Series?.setData(computeEma(trendAnalysisM5Candles, EMA_PERIOD_FAST));
  ema200Series?.setData(computeEma(trendAnalysisM5Candles, EMA_PERIOD_SLOW));
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
    if (props.showZigzag || props.showMetadata || props.showEma) {
      fetches.push(fetchTrendAnalysisM5History(props.symbol, TREND_ANALYSIS_CANDLE_COUNT));
    }
    const [m5, h1, trendM5] = await Promise.all(fetches);
    tradeSetupM5Candles = m5;
    tradeSetupH1Candles = h1;
    if (trendM5) trendAnalysisM5Candles = trendM5;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshZigzagInternal();
    refreshEmaInternal();
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
  refreshRangesMarkersInternal();
  refreshRangeAnalysisInternal();
  refreshEmaInternal();
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
    upColor: cssColor("candleUp"),
    downColor: cssColor("candleDown"),
    borderVisible: false,
    wickUpColor: cssColor("candleUp"),
    wickDownColor: cssColor("candleDown"),
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
        color: cssColor("cvdLine"),
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: "CVD (Binance Futures)",
      },
      1, // eigene Pane unterhalb des Candlestick-Charts
    );
    chart.panes()[1]?.setStretchFactor(0.25);
  }

  if (isForex) {
    // EMA 50/200 (M5) direkt in der Candlestick-Pane (keine eigene Pane, wie CVD) — sichtbar erst
    // sobald refreshEmaInternal Daten reinschreibt (siehe watch(showEma)).
    ema50Series = chart.addSeries(LineSeries, {
      color: cssColor("emaFast"),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 50 (M5)",
    });
    ema200Series = chart.addSeries(LineSeries, {
      color: cssColor("emaSlow"),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "EMA 200 (M5)",
    });
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
    if (rangesNeedsData()) startRangesPolling();
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
  clearInterval(rangesPollTimer);
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
  ema50Series = null;
  ema200Series = null;
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
  refreshRangesMarkersInternal();
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
watch(() => props.showRanges, () => {
  refreshRangesPollingState();
  refreshRangesMarkersInternal(); // sofort reagieren, nicht erst beim nächsten refreshChart()
  refreshRangeAnalysisInternal();
});
watch(() => props.showRangesMetadata, refreshRangesPollingState);
// Lookback-Änderung braucht mehr/weniger H1-Historie -> neu fetchen, aber nur solange mindestens
// einer der beiden Ranges-Toggles überhaupt an ist (sonst reicht es, beim nächsten Einschalten
// frisch zu laden).
watch(() => props.rangesLookbackHours, () => {
  if (rangesNeedsData()) loadRangesCandles();
});
// Braucht dieselbe trendAnalysisM5Candles-Historie wie Zigzag/Metadaten (siehe loadTradeSetupCandles)
// -> beim Einschalten ohne die beiden fehlt sie evtl. noch, dann einmal nachladen; beim
// Ausschalten reicht refreshEmaInternal (blendet aus, kein Neu-Fetch nötig).
watch(() => props.showEma, (on) => {
  if (on && trendAnalysisM5Candles.length === 0) loadTradeSetupCandles();
  else refreshEmaInternal();
});
// StyleModal (Dashboard.vue) schreibt direkt in den chartColors-Singleton — Serien-OPTIONEN
// (Candles/CVD/EMA) werden von refreshChart() nicht angefasst (das setzt nur setData), deshalb
// hier explizit; alle Primitive-basierten Farben (Liquidität/OB/Zigzag/Ranges/Trade-Setups/
// Trade-Marker) lesen chartColors ohnehin live bei jedem Render-Aufruf, ein refreshChart() reicht
// dafür.
watch(
  chartColors,
  () => {
    if (!chart) return;
    candleSeries?.applyOptions({
      upColor: cssColor("candleUp"),
      downColor: cssColor("candleDown"),
      wickUpColor: cssColor("candleUp"),
      wickDownColor: cssColor("candleDown"),
    });
    cvdSeries?.applyOptions({ color: cssColor("cvdLine") });
    ema50Series?.applyOptions({ color: cssColor("emaFast") });
    ema200Series?.applyOptions({ color: cssColor("emaSlow") });
    refreshChart();
  },
  { deep: true },
);
</script>

<template>
  <div class="chart-wrapper">
    <div ref="chartContainerRef" class="chart-container"></div>
    <div v-if="rangesLoading" class="ranges-loading">
      <span class="ranges-spinner"></span>
      Ranges laden…
    </div>
    <div v-if="!isForex" class="cvd-gauges" :style="{ bottom: gaugesBottom + 'px' }">
      <Gauge id="window" :value="windowDelta" label="Δ 15m" />
      <Gauge id="daily" :value="dailyDelta" label="Δ Tag (UTC)" />
    </div>
    <MetadataPanel v-if="showMetadata" title="Trend-Metadaten" @close="emit('close-metadata')">
      <JsonTree v-if="metadataTree" :value="metadataTree" />
      <p v-else class="metadata-empty">Keine Trend-Daten geladen (Zigzag-Toggle einschalten).</p>
    </MetadataPanel>
    <MetadataPanel v-if="showRangesMetadata" title="Ranges-Metadaten" @close="emit('close-ranges-metadata')">
      <JsonTree v-if="rangesMetadata" :value="rangesMetadata" />
      <p v-else class="metadata-empty">Keine Ranges-Daten geladen.</p>
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

.ranges-loading {
  position: absolute;
  z-index: 5;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(30, 34, 45, 0.85);
  color: #d1d4dc;
  font-size: 12px;
  pointer-events: none;
}

.ranges-spinner {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(209, 212, 220, 0.3);
  border-top-color: #d1d4dc;
  border-radius: 50%;
  animation: ranges-spin 0.8s linear infinite;
}

@keyframes ranges-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
