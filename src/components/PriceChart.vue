<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import { detectLiquidityLevels, filterRelevantLevels, renderLiquidityLevels, LiquidityLinePrimitive } from "../liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
import { renderZigzag } from "../trendZigzag";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot, renderMarketStructureAnalysis } from "../marketStructureAnalysis";
import { computeCockpitState, renderTradeSetupCockpit } from "../tradeSetupCockpit";
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
  // Long/Short einzeln de-/aktivierbar (siehe Chat 2026-07-19: "hilft für die Übersicht") — siehe
  // computeTradeSetups, wirkt auch aufs TSC (currentTradeSetups enthält die deaktivierte Richtung
  // dann gar nicht erst).
  showTradeSetupsLong: { type: Boolean, default: true },
  showTradeSetupsShort: { type: Boolean, default: true },
  rangesPeriod: { type: Number, default: 5 },
  rangesLookbackHours: { type: Number, default: 7 * 24 },
  showRanges: { type: Boolean, default: false },
  showRangesMetadata: { type: Boolean, default: false },
  // Zweiter, eingebetteter Fraktal-Lauf mit eigener Periode/Lookback (siehe Chat 2026-07-19:
  // "wir brauchen nen zweiten state ... mit periode 2" — schnellere Uptrend-Erkennung). Läuft auf
  // denselben H1-Kerzen wie die Periode-5-Ranges (siehe loadRangesCandles: EIN Fetch für beide,
  // kein zweiter cTrader-Connect), aber komplett eigene Pivot-Liste/Cutoff/Debug-Marker — fließt
  // aktuell NICHT in marketStructureAnalysis.ts/applyMarketStructurePivot ein (nur Rohdaten zum Beobachten/TDD).
  ranges2Period: { type: Number, default: 2 },
  ranges2LookbackHours: { type: Number, default: 7 * 24 },
  showEma: { type: Boolean, default: false },
  // Replay-Modus (siehe Chat 2026-07-19): unix Sekunden, ab denen alles nach "Zeit X" ausgeblendet
  // wird — null = live (kein Clipping). Zum visuellen Prüfen des Ranges-Algos, ohne Zukunft zu
  // sehen, während er noch entsteht.
  replayUntil: { type: Number, default: null },
  // Trade-Setup-Cockpit (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
  // zusammenstöpseln") — bündelt H1-Range-Analyse + M5-Trade-Setups in einer Karte im Chart.
  // showTradeSetupCockpit: an/aus. tradeSetupCockpitAtCandle: Positions-Toggle — false (Default)
  // = fester Platz rechts/mittig (links von der Preis-Skala), true = neben der letzten Kerze.
  showTradeSetupCockpit: { type: Boolean, default: true },
  tradeSetupCockpitAtCandle: { type: Boolean, default: false },
  // Abstand (CSS-Pixel) zur letzten Kerze im 'candle'-Modus — konfigurierbar seit Chat
  // 2026-07-19 ("etwas zu eng, am besten Abstand konfigurabel machen"), siehe tradeSetupCockpit.ts.
  tradeSetupCockpitCandleOffset: { type: Number, default: 24 },
});
const emit = defineEmits(["close-ranges-metadata", "toggle-tsc-position"]);

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

// EMA (siehe unten) braucht mehr M5-Historie als tradeSetupM5Candles (300 = ~25h) — eigener
// Fetch, nur solange der EMA-Toggle an ist (jeder Fetch ist ein frischer cTrader-TLS-Connect,
// siehe loadTradeSetupCandles). fetchTrendAnalysisM5History paginiert automatisch nach, falls
// TREND_ANALYSIS_CANDLE_COUNT über dem Edge-Function-Limit pro Request (1000) liegt.
const TREND_ANALYSIS_CANDLE_COUNT = 1000;

// "Ranges" — erster Baustein des neuen PA-Analyse-Konzepts (siehe Chat 2026-07-18): H1-Fraktale
// im konfigurierbaren Lookback-Fenster (rangesLookbackHours), noch ohne weak/protected/sweep-
// Klassifizierung. Periode ist jetzt konfigurierbar (props.rangesPeriod, Default 5, wie
// liqM5Period-Analogon auf H1) — seit Chat 2026-07-19 läuft zusätzlich ein zweiter, eingebetteter
// Lauf mit eigener Periode/Lookback (props.ranges2Period/ranges2LookbackHours, Default 2) für eine
// schnellere Uptrend-Erkennung, siehe computeRangesPivotsFor. Eigener Fetch, bewusst unabhängig
// von tradeSetupH1Candles (Periode 10, feste 300er-Historie) — die Konzepte sollen sich nicht
// querbeeinflussen, siehe Chat.
// Puffer vor/nach dem Lookback-Fenster: ein Fraktal braucht period+4 Kerzen davor und period
// danach, um überhaupt erkannt zu werden (siehe isUpFractal/isDownFractal in liquidity.js) — ohne
// Puffer würden Fraktale am Rand des konfigurierten Fensters unter den Tisch fallen. 20 ist für
// BEIDE Perioden (5 und 2) großzügig genug, kein separater Puffer je Periode nötig.
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
// pivotTime ist nur intern fürs Rendern der Zigzag-/Ranges-Linien nötig, taucht in den
// Metadaten-Panels bewusst nicht auf (Philips Pivot-Typ hat kein Pflichtfeld dafür, nur das
// menschenlesbare pivotAt).
function pivotForDisplay(p) {
  if (!p) return null;
  const { pivotTime, ...rest } = p;
  return rest;
}

// Ergebnis-State des "1h-Range"-Marktstruktur-Algorithmus selbst (nicht nur die rohen Pivot-Listen
// oben) — zum Gegenprüfen im Replay-Modus gegen die hand-hergeleiteten rangeStateN in
// gbp_h1_uptrend_LQ_sweep_long_setup.ts (siehe Chat 2026-07-19: "brauch noch das json vom state").
function summarizeMarketStructureState(state) {
  if (!state) return null;
  return {
    trend: state.trend,
    currRange: { high: pivotForDisplay(state.currRange.high), low: pivotForDisplay(state.currRange.low) },
    structurePivots: state.structurePivots.map(pivotForDisplay),
    innerStructurePivots: state.innerStructurePivots.map(pivotForDisplay),
    appliedPivots: state.appliedPivots.map(pivotForDisplay),
  };
}
const marketStructureState = ref(null);
const marketStructureTree = computed(() => summarizeMarketStructureState(marketStructureState.value));

// Copy-Button neben den Metadaten-Überschriften (siehe Chat 2026-07-19) — kopiert den jeweiligen
// Abschnitt als JSON, z.B. zum 1:1-Abgleich gegen die hand-hergeleiteten rangeStateN in
// gbp_h1_uptrend_LQ_sweep_long_setup.ts. copiedSection zeigt kurz "✓ kopiert" statt "Kopieren",
// bevor es sich nach COPIED_FEEDBACK_MS von selbst zurücksetzt.
const COPIED_FEEDBACK_MS = 1200;
const copiedSection = ref(null);
let copiedSectionTimer = null;
async function copyJson(section, value) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    copiedSection.value = section;
    clearTimeout(copiedSectionTimer);
    copiedSectionTimer = setTimeout(() => {
      copiedSection.value = null;
    }, COPIED_FEEDBACK_MS);
  } catch (err) {
    console.error("Kopieren fehlgeschlagen:", err);
  }
}

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
let rangesMarkerPrimitives = [];
let rangesMarkerPrimitives2 = []; // eingebettete Periode-2-Debug-Marker, siehe refreshRangesMarkersInternal
let marketStructurePrimitives = [];
let cockpitPrimitives = [];
let tradePrimitives = [];
let tradeSetupPrimitives = [];
let allCandles = [];
let allCvdDeltas = [];
let tradeSetupM5Candles = [];
let tradeSetupH1Candles = [];
let currentTradeSetups = [];
let trendAnalysisM5Candles = [];
let rangesH1Candles = [];
let rangesPivots = null; // roh (mit pivotTime), Periode 5 — siehe computeRangesPivotsFor/refreshRangesMarkersInternal
let rangesPivots2 = null; // roh (mit pivotTime), eingebettete Periode 2 (siehe Chat 2026-07-19)
// Out-of-Order-Guards für loadRangesCandles/loadTradeSetupCandles, siehe dort (Chat 2026-07-20:
// "im Replay-Modus hängt der Trend-Algorithmus").
let rangesFetchSeq = 0;
let tradeSetupFetchSeq = 0;
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
let pollTimer = null;
let tradeSetupPollTimer = null;
let rangesPollTimer = null;
let windowGaugeTimer = null;
let dailyGaugeTimer = null;
const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
const rangesMetadata2 = ref(null); // dito für die eingebettete Periode-2-Erkennung — siehe Chat 2026-07-19:
// EIN gemeinsames Metadaten-Panel für beide Perioden reicht ("wenn es zu schwer ist zwei Modals
// gleichzeitig offen zu haben"), daher kein zweiter showRangesMetadata2-Toggle.
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
// toMs (optional): Startpunkt für die erste Seite statt "jetzt" — siehe replayToMs()/loadInitial,
// sonst reicht ein fester count im Replay-Modus bei TF-Wechsel ggf. nicht bis replayUntil zurück
// (siehe Chat 2026-07-19: "1h auf M5 gewechselt und sehe keinen Chart").
async function fetchInitialCandles(bar, count, toMs) {
  let all = [];
  let after = toMs ? String(toMs) : undefined;
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

// Replay-Modus: alle Fetches (loadInitial/pollRecent/loadRangesCandles/loadTradeSetupCandles)
// laufen unverändert weiter — geclippt wird ausschließlich hier, an jeder Stelle, wo Kerzen
// tatsächlich gerendert oder für eine Erkennung (Pivots/OBs/EMA/Setups) genutzt werden. So bleibt
// z.B. der Lazy-Load-Cursor (allCandles[0].time) unangetastet, und ein Verschieben von
// replayUntil braucht keinen Refetch, nur ein erneutes refreshChart().
function clipReplay(rows) {
  return props.replayUntil == null ? rows : rows.filter((r) => r.time <= props.replayUntil);
}

// Gegenstück zu clipReplay für die FETCH-Seite: ein fester count/Lookback endet sonst immer bei
// der echten aktuellen Zeit (siehe ctraderCandles.js: toMs ohne Wert = "jetzt"), unabhängig von
// replayUntil — bei einem Replay-Zeitpunkt, der weiter zurückliegt als count reicht, deckt das
// geladene Fenster den gewünschten Bereich dann gar nicht ab (siehe Chat: "Ranges-Pivots gehen bei
// 12 Tagen Lookback + Replay nicht weit genug zurück"). loadRangesCandles/loadTradeSetupCandles
// übergeben das hier an fetchInitialForexCandles, damit der Fetch selbst schon bis replayUntil
// zurückreicht statt erst hinterher (zu kurz) geclippt zu werden.
function replayToMs() {
  return props.replayUntil == null ? undefined : props.replayUntil * 1000;
}

function refreshTradeMarkersInternal() {
  const trades = TRADE_MARKER_BARS.has(props.currentBar) ? props.trades : [];
  renderTradeMarkers(candleSeries, trades, tradePrimitives, clipReplay(allCandles));
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
  const candles = clipReplay(allCandles);
  if (isForex) {
    const zones = detectOrderBlocks(candles)
      .filter((z) => !z.invalidated)
      .map((z) => ({ ...z, timeframe: props.currentBar.toUpperCase() }));
    renderPersistedZones(candleSeries, filterHistorical(zones), orderBlockPrimitives, candles);
  } else {
    // BTC-Zonen kommen fertig vom poi-watcher-Backend (props.poiZones) statt lokal erkannt —
    // im Replay-Modus trotzdem auf Zonen bis replayUntil beschränken, damit nicht schon
    // Zonen auftauchen, die "in der Zukunft" (relativ zu X) erst entdeckt wurden.
    const zones = props.replayUntil == null ? props.poiZones : props.poiZones.filter((z) => z.startTime <= props.replayUntil);
    renderPersistedZones(candleSeries, filterHistorical(zones), orderBlockPrimitives, candles);
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
  const candles = clipReplay(allCandles);
  if (!props.showLiquidity) {
    renderLiquidityLevels(candleSeries, [], liquidityPrimitives, candles);
    return;
  }
  const { highs, lows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const relevant = props.showSweptLiquidity
    ? [...highs, ...lows]
    : [...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true), ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true)];
  const precision = pricePrecisionForInstrument(props.symbol);
  renderLiquidityLevels(candleSeries, relevant, liquidityPrimitives, candles, {
    debugPrices: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
  });
}

// H1-Fraktale im konfigurierten Lookback-Fenster — reine Pivot-Liste, noch keine weak/protected/
// sweep-Klassifizierung (kommt als nächster Schritt im PA-Analyse-Konzept). Generalisiert auf
// (period, lookbackHours), damit dieselbe Logik für die Periode-5- UND die eingebettete
// Periode-2-Erkennung läuft (siehe Chat 2026-07-19), statt sie zu duplizieren. cutoff statt
// einfach "alle erkannten Pivots", weil RANGES_CANDLE_BUFFER zusätzliche Kerzen VOR dem
// eigentlichen Lookback-Fenster lädt (siehe loadRangesCandles) — die dort möglicherweise
// erkannten Fraktale sollen nicht mitgezählt werden. pivotTime bleibt (roh) erhalten, weil
// refreshRangesMarkersInternal die Koordinaten braucht — erst pivotForDisplay (siehe oben, schon
// für den Zigzag-State genutzt) entfernt es fürs Metadaten-Panel.
function computeRangesPivotsFor(period, lookbackHours) {
  // Im Replay-Modus zählt das Lookback-Fenster ab replayUntil, nicht ab der echten aktuellen
  // Zeit — sonst wäre das Fenster (7 Tage vor "jetzt") komplett am geclippten Kerzen-Ende
  // vorbei, sobald replayUntil mehr als lookbackHours in der Vergangenheit liegt.
  const now = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const cutoff = now - lookbackHours * 3600;
  const { highs, lows } = detectLiquidityLevels(clipReplay(rangesH1Candles), period);
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
// wird. Periode-2-Marker (rangesMarkerPrimitives2) laufen als eigene Primitive-Liste in derselben
// Pane mit — kleinerer dotRadius + eigene, transparentere Farbe (rangesMarker2), damit man beide
// Periode-Ebenen optisch auseinanderhält (siehe Chat: "Transparenz auf 50%").
function refreshRangesMarkersInternal() {
  const candles = clipReplay(allCandles);
  const precision = pricePrecisionForInstrument(props.symbol);
  const showMarkers = props.showRanges && props.showLiquidityDebug;

  if (!showMarkers || !rangesPivots) {
    renderZigzag(candleSeries, [], rangesMarkerPrimitives, candles);
  } else {
    const segments = rangesPivots.map((p) => ({ points: [p], color: cssColor("rangesMarker") }));
    renderZigzag(candleSeries, segments, rangesMarkerPrimitives, candles, {
      showLabels: true,
      formatPrice: (price) => fmtPrice(price, precision),
    });
  }

  if (!showMarkers || !rangesPivots2) {
    renderZigzag(candleSeries, [], rangesMarkerPrimitives2, candles);
  } else {
    const segments2 = rangesPivots2.map((p) => ({ points: [p], color: cssColor("rangesMarker2") }));
    renderZigzag(candleSeries, segments2, rangesMarkerPrimitives2, candles, {
      showLabels: true,
      formatPrice: (price) => fmtPrice(price, precision),
      dotRadius: 1.5,
    });
  }
}

function refreshRangesInternal() {
  rangesPivots = rangesH1Candles.length > 0 ? computeRangesPivotsFor(props.rangesPeriod, props.rangesLookbackHours) : null;
  rangesPivots2 = rangesH1Candles.length > 0 ? computeRangesPivotsFor(props.ranges2Period, props.ranges2LookbackHours) : null;
  rangesMetadata.value = rangesPivots ? rangesPivots.map(pivotForDisplay) : null;
  rangesMetadata2.value = rangesPivots2 ? rangesPivots2.map(pivotForDisplay) : null;
  refreshRangesMarkersInternal();
  refreshMarketStructureInternal();
}

// Neuer "1h-Range"-Marktstruktur-Trendalgorithmus (siehe marketStructureAnalysis.ts,
// test/tdd_mit_claude.ts) — läuft über dieselben H1-Pivots wie die Debug-Punktmarker oben, aber
// unabhängig vom Debug-Toggle: das ist das eigentliche Analyse-Ergebnis der Ranges-Funktion, nicht
// nur eine Debug-Hilfe. Erster gelesener 'low'/'high' bilden die Start-Range, der Rest läuft über
// applyMarketStructurePivot.
// Ein Pivot ist erst NACH `period` weiteren Kerzen überhaupt als Fraktal erkennbar (siehe
// isUpFractal/isDownFractal in liquidity.js: braucht period strikt schwächere Kerzen danach) —
// pivotTime ist die Zeit der Extremkerze selbst, nicht die Erkennungszeit. Näherung über
// Kalenderstunden (period*3600) statt echter Kerzen-Indizes — bei einer Wochenend-Lücke direkt
// nach dem Pivot wäre die ECHTE Erkennungszeit etwas später als hier berechnet; für die
// Größenordnung, um die es beim Mischen der beiden Perioden geht (2h vs. 5h Differenz), reicht
// das (siehe Chat 2026-07-19).
function confirmationTime(pivot, period) {
  return pivot.pivotTime + period * 3600;
}

// Übergeordnete (rangesPivots, props.rangesPeriod) und eingebettete Pivots (rangesPivots2,
// props.ranges2Period) laufen auf demselben Kerzen-Fenster, aber mit unterschiedlicher
// Bestätigungsverzögerung — deshalb NICHT stur nach rohem pivotTime mischen, sondern nach
// confirmationTime: ein Periode-2-Pivot mit späterem pivotTime kann trotzdem VOR einem Periode-5-
// Pivot mit früherem pivotTime erkannt werden (siehe Chat 2026-07-19, gbp_h1_uptrend_LQ_sweep_
// long_setup.ts: p2Pivot4 entsteht erst um 04:00, aber pivot3 -von 23:00- ist zu dem Zeitpunkt
// schon längst bestätigt). applyMarketStructurePivot/applyInnerMarketStructurePivot übernehmen
// den Rest (u.a. das Leeren von innerStructurePivots bei jedem neuen übergeordneten Pivot).
function computeMarketStructureState() {
  if (!rangesPivots || rangesPivots.length < 2) return null;
  const originLow = rangesPivots.find((p) => p.type === "low");
  const originHigh = rangesPivots.find((p) => p.type === "high");
  if (!originLow || !originHigh) return null;

  const [first, second] = originLow.pivotTime <= originHigh.pivotTime ? [originLow, originHigh] : [originHigh, originLow];
  let state = initMarketStructureState(first, second);

  const originCutoff = Math.max(first.pivotTime, second.pivotTime);
  const outerRest = rangesPivots
    .filter((p) => p !== originLow && p !== originHigh)
    .map((pivot) => ({ pivot, outer: true, at: confirmationTime(pivot, props.rangesPeriod) }));
  const innerRest = (rangesPivots2 ?? [])
    .filter((p) => p.pivotTime > originCutoff)
    .map((pivot) => ({ pivot, outer: false, at: confirmationTime(pivot, props.ranges2Period) }));

  const merged = [...outerRest, ...innerRest].sort((a, b) => a.at - b.at);
  // Für applyInnerMarketStructurePivot Kerzen-Close-Prüfung (closesAboveOldHigh, siehe
  // marketStructureAnalysis.ts): dieselben H1-Kerzen wie die Pivot-Erkennung selbst
  // (rangesH1Candles), nicht allCandles — das wäre je nach gewähltem Chart-Timeframe eine andere
  // Auflösung.
  const rangesCandles = clipReplay(rangesH1Candles);
  for (const entry of merged) {
    state = entry.outer
      ? applyMarketStructurePivot(state, entry.pivot)
      : applyInnerMarketStructurePivot(state, entry.pivot, { candles: rangesCandles });
  }
  return state;
}

// Roter Pfeil+Linie an range.high, grüner an range.low, ggf. "1h protected low"-Linie +
// Trend-Label rechts/mittig (siehe Chat) — sichtbar, sobald showRanges an ist, unabhängig vom
// Debug-Toggle (im Gegensatz zu den rohen Punktmarkern oben).
function refreshMarketStructureInternal() {
  if (!chart) return; // async loadRangesCandles kann nach unmount noch abschließen, siehe onUnmounted
  const state = computeMarketStructureState();
  marketStructureState.value = state; // fürs Metadaten-Panel + TSC, unabhängig von showRanges (Zeichnen)
  const candles = clipReplay(allCandles);
  renderMarketStructureAnalysis(candleSeries, props.showRanges ? state : null, marketStructurePrimitives, candles);
  // Sofort weiterreichen statt auf den nächsten refreshChart()/POLL_MS (12s) zu warten (siehe Chat
  // 2026-07-19: "TSC scheint zu hängen, dauert ne Weile bis da was drin steht") — marketStructureState
  // ist eine der beiden TSC-Datenquellen (siehe refreshCockpitInternal), die andere ist
  // currentTradeSetups (siehe loadTradeSetupCandles).
  refreshCockpitInternal();
}

// Trade-Setup-Cockpit (siehe Chat 2026-07-19) — reine Zusammenfassung, liest marketStructureState.value
// und currentTradeSetups direkt aus der Closure (dieselbe Liste, die renderTradeSetupsInternal schon
// positioniert) — kein eigener Fetch/eigene Erkennung. Nur für Forex (wie Ranges/Trade-Setups
// selbst). Wird sowohl von refreshMarketStructureInternal als auch von loadTradeSetupCandles direkt
// aufgerufen (siehe dort), nicht erst über den nächsten refreshChart() — sonst hinkt die Karte bis
// zu POLL_MS (12s) hinter den eigentlich schon fertigen Daten her.
function refreshCockpitInternal() {
  if (!isForex || !chart) return; // async loadTradeSetupCandles kann nach unmount noch abschließen
  const candles = clipReplay(allCandles);
  if (!props.showTradeSetupCockpit || candles.length === 0) {
    renderTradeSetupCockpit(candleSeries, null, cockpitPrimitives, candles);
    return;
  }
  const state = computeCockpitState(marketStructureState.value, currentTradeSetups);
  const precision = pricePrecisionForInstrument(props.symbol);
  renderTradeSetupCockpit(candleSeries, state, cockpitPrimitives, candles, {
    mode: props.tradeSetupCockpitAtCandle ? "candle" : "fixed",
    formatPrice: (price) => fmtPrice(price, precision),
    candleOffset: props.tradeSetupCockpitCandleOffset,
  });
}

// Eigener H1-Fetch fürs Ranges-Metadaten-Panel, unabhängig von tradeSetupH1Candles (siehe oben) —
// lädt genug Historie für das GRÖSSERE der beiden Lookback-Fenster (Periode 5 + eingebettete
// Periode 2, siehe Chat 2026-07-19) + Erkennungspuffer. EIN Fetch für beide Perioden (nicht zwei
// separate cTrader-Connects) — computeRangesPivotsFor schneidet sich aus rangesH1Candles selbst
// den für die jeweilige Periode passenden, ggf. kürzeren Ausschnitt raus.
async function loadRangesCandles() {
  if (!isForex) return;
  // rangesFetchSeq schützt gegen Out-of-Order-Antworten (siehe Chat 2026-07-20: "im Replay-Modus
  // hängt der Trend-Algorithmus" — schneller mehrfacher Replay-Step feuert mehrfach diesen fetch;
  // ohne Guard kann eine ÄLTERE, aber langsamere Antwort eine NEUERE überschreiben und der Chart
  // bleibt auf einem veralteten Replay-Stand hängen, bis zufällig wieder die richtige Antwort
  // zuletzt eintrifft). Jeder Aufruf zieht seine eigene Sequenznummer; nur die zuletzt GESTARTETE
  // gilt noch als aktuell, ältere Ergebnisse werden beim Eintreffen verworfen.
  const seq = ++rangesFetchSeq;
  try {
    const hours = Math.max(props.rangesLookbackHours, props.ranges2LookbackHours);
    const count = hours + RANGES_CANDLE_BUFFER;
    const candles = await fetchInitialForexCandles(props.symbol, "1h", count, replayToMs());
    if (seq !== rangesFetchSeq) return; // inzwischen überholt, siehe oben
    rangesH1Candles = candles;
    refreshRangesInternal();
  } catch (err) {
    console.error("Ranges-Kerzen fehlgeschlagen:", err);
  }
}

// showRanges (Marker im Chart) und showRangesMetadata (JSON-Panel) sind getrennte Toggles, teilen
// sich aber dieselben H1-Kerzen/Pivots. showTradeSetupCockpit zählt seit Chat 2026-07-19 ebenfalls
// mit ("TSC soll den aktuellsten und wahren Stand anzeigen, selbst wenn Trend im Chart gerade zur
// Übersicht ausgetoggelt ist") — sonst würde marketStructureState (siehe refreshMarketStructureInternal)
// beim Wegtoggeln von Ranges/Metadaten stumpf auf dem letzten Stand einfrieren statt weiter mit-
// zulaufen. Laden läuft also, solange MINDESTENS einer der drei an ist, kein unnötiger
// cTrader-Connect (RANGES_POLL_MS), solange wirklich niemand (auch nicht die TSC-Karte) hinschaut.
function rangesNeedsData() {
  return props.showRanges || props.showRangesMetadata || props.showTradeSetupCockpit;
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
  const m5Candles = clipReplay(tradeSetupM5Candles);
  const h1Candles = clipReplay(tradeSetupH1Candles);
  if (m5Candles.length === 0 || h1Candles.length === 0) {
    currentTradeSetups = [];
    return;
  }
  const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(m5Candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
  const { highs: h1Highs, lows: h1Lows } = detectLiquidityLevels(h1Candles, TRADE_SETUP_H1_FRACTAL_PERIOD);
  const setupObs = detectSetupObs(m5Candles);
  const params = {
    graceSec: TRADE_SETUP_GRACE_SEC,
    lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
    lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
    maxDistanceM5: TRADE_SETUP_LS_MAX_DISTANCE_M5,
    maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
    obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
    nowTime: m5Candles[m5Candles.length - 1].time,
  };
  // Anders als tradeSetupHistoryCountShort/Long im Original (dort "zusätzlich zum aktuell
  // aktiven", 0 = nur das aktive) zählt n hier die GESAMTE Anzahl gezeigter Setups je
  // Richtung — wir zeichnen kein separates "Live"-Setup, siehe detectTradeSetups. n=0 zeigt
  // also nichts (slice(-0) wäre sonst das GANZE Array, daher der Sonderfall).
  const n = Math.max(0, props.tradeSetupHistoryCount);
  const takeLast = (arr) => (n === 0 ? [] : arr.slice(-n));
  // IMMER beide Richtungen berechnen (unabhängig von showTradeSetupsLong/-Short) — siehe Chat
  // 2026-07-19: "TSC soll den aktuellsten und wahren Stand anzeigen", auch wenn im Chart gerade
  // eine Richtung zur Übersicht ausgetoggelt ist. Die Long/Short-Toggles filtern erst beim
  // ZEICHNEN (renderTradeSetupsInternal), currentTradeSetups selbst (und damit die TSC-Karte,
  // siehe refreshCockpitInternal) bleibt immer vollständig.
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
  const candles = clipReplay(allCandles);

  for (const setup of currentTradeSetups) {
    if (props.replayUntil != null && setup.fractal.pivotTime > props.replayUntil) continue;
    // Long/Short-Toggle filtert NUR das Zeichnen (siehe computeTradeSetups: currentTradeSetups
    // selbst bleibt immer vollständig, fürs TSC).
    if (setup.dir === 1 && !props.showTradeSetupsShort) continue;
    if (setup.dir === -1 && !props.showTradeSetupsLong) continue;
    const key = setup.dir === 1 ? "tradeSetupShort" : "tradeSetupLong";
    const lsColor = cssColor(key);
    const { top, bottom } = tradeSetupObBoxBounds(setup);

    const fractalLine = new LiquidityLinePrimitive(
      setup.fractal,
      { color: cssColor("tradeSetupProtected"), lineWidth: TRADE_SETUP_LINE_WIDTH },
      candles,
    );
    const lsLine = new LiquidityLinePrimitive(setup.ls, { color: lsColor, lineWidth: TRADE_SETUP_LINE_WIDTH }, candles);
    const obBox = new OrderBlockPrimitive(
      { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        textColor: "rgba(255, 255, 255, 0.9)",
        label: setup.label,
      },
      candles,
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
  const candles = clipReplay(trendAnalysisM5Candles);
  ema50Series?.setData(computeEma(candles, EMA_PERIOD_FAST));
  ema200Series?.setData(computeEma(candles, EMA_PERIOD_SLOW));
}

// TREND_ANALYSIS_CANDLE_COUNT (2000) liegt über dem Edge-Function-Limit pro Request (1000,
// siehe ctraderCandles.js) -> seitenweise rückwärts nachladen, analog zu fetchAllSince im
// fetch-trend-fixture.mjs-Script.
async function fetchTrendAnalysisM5History(symbol, targetCount, toMs) {
  let all = await fetchInitialForexCandles(symbol, "5m", Math.min(targetCount, 1000), toMs);
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
// Holt bei aktivem EMA-Toggle zusätzlich die größere M5-Historie für die EMA-Berechnung (siehe
// TREND_ANALYSIS_CANDLE_COUNT) — nur dann, um unnötige cTrader-Connects zu vermeiden, solange
// niemand hinschaut.
async function loadTradeSetupCandles() {
  if (!isForex) return;
  // tradeSetupFetchSeq: derselbe Out-of-Order-Guard wie in loadRangesCandles, siehe dort.
  const seq = ++tradeSetupFetchSeq;
  try {
    const toMs = replayToMs();
    const fetches = [
      fetchInitialForexCandles(props.symbol, "5m", TRADE_SETUP_CANDLE_COUNT, toMs),
      fetchInitialForexCandles(props.symbol, "1h", TRADE_SETUP_CANDLE_COUNT, toMs),
    ];
    if (props.showEma) {
      fetches.push(fetchTrendAnalysisM5History(props.symbol, TREND_ANALYSIS_CANDLE_COUNT, toMs));
    }
    const [m5, h1, trendM5] = await Promise.all(fetches);
    if (seq !== tradeSetupFetchSeq) return; // inzwischen überholt, siehe loadRangesCandles
    tradeSetupM5Candles = m5;
    tradeSetupH1Candles = h1;
    if (trendM5) trendAnalysisM5Candles = trendM5;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshEmaInternal();
    // Sofort weiterreichen statt auf den nächsten refreshChart()/POLL_MS zu warten — siehe
    // refreshCockpitInternal/refreshMarketStructureInternal (Chat 2026-07-19: "TSC hängt").
    refreshCockpitInternal();
  } catch (err) {
    console.error("Trade-Setup-Kerzen fehlgeschlagen:", err);
  }
}

function refreshChart() {
  // Async loads (loadInitial/pollRecent/lazy-load) koennen noch laufen, wenn die
  // Komponente schon unmounted wurde (z.B. schnelle Navigation zu /protokoll) — chart
  // ist dann bereits disposed, ohne Guard wirft lightweight-charts "Object is disposed".
  if (!chart) return;
  candleSeries.setData(clipReplay(allCandles));
  refreshPoiZonesInternal();
  refreshLiquidityInternal();
  refreshTradeMarkersInternal();
  renderTradeSetupsInternal();
  refreshRangesMarkersInternal();
  refreshMarketStructureInternal(); // ruft refreshCockpitInternal() selbst mit auf, siehe dort
  refreshEmaInternal();
  cvdSeries?.setData(cumulativeFromDeltas(clipReplay(allCvdDeltas)));
  positionGauges();
}

async function loadInitial() {
  try {
    let candles, deltas;
    // Fester count (INITIAL_CANDLE_COUNT) reicht "bis jetzt" gerechnet nicht bei jedem Timeframe
    // gleich weit zurück (1000 M5-Kerzen ~3,5 Tage, 1000 H1-Kerzen ~41 Tage) — ohne replayToMs()
    // würde ein TF-Wechsel während eines weit zurückliegenden Replays (z.B. 1h -> M5) einen leeren
    // Kerzenbereich laden, der nach clipReplay komplett verschwindet (siehe Chat 2026-07-19: "1h
    // auf M5 gewechselt und sehe keinen Chart").
    const toMs = replayToMs();
    if (isForex) {
      candles = await fetchInitialForexCandles(props.symbol, props.currentBar, INITIAL_CANDLE_COUNT, toMs);
      deltas = [];
    } else {
      const binanceInterval = binanceIntervalFor(props.currentBar);
      [candles, deltas] = await Promise.all([
        fetchInitialCandles(okxBarFor(props.currentBar), INITIAL_CANDLE_COUNT, toMs),
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

  // Positions-Toggle-Badge auf der TSC-Karte (siehe tradeSetupCockpit.ts: CockpitRenderer/
  // TradeSetupCockpitPrimitive.hitTestToggle) — param.point liegt in CSS-Pixeln, genau wie die dort
  // gespeicherte hitBox. Zusätzlich zum Toolbar-Dropdown (Dashboard.vue), nicht als Ersatz.
  chart.subscribeClick((param) => {
    if (!param.point) return;
    if (cockpitPrimitives.some((p) => p.hitTestToggle(param.point))) {
      emit("toggle-tsc-position");
    }
  });

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
  clearTimeout(replayFetchDebounceTimer);
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
  refreshRangesMarkersInternal();
});
watch(() => props.showTradeSetups, renderTradeSetupsInternal);
watch(() => props.tradeSetupHistoryCount, () => {
  computeTradeSetups();
  renderTradeSetupsInternal();
});
// Nur Re-Render, kein computeTradeSetups() — currentTradeSetups bleibt unabhängig von diesem
// Toggle vollständig (siehe computeTradeSetups), die TSC-Karte bekommt also KEIN eigenes
// Refresh hier (sie ignoriert diesen Toggle bewusst, siehe Chat 2026-07-19).
watch([() => props.showTradeSetupsLong, () => props.showTradeSetupsShort], renderTradeSetupsInternal);
watch(() => props.showRanges, () => {
  refreshRangesPollingState();
  refreshRangesMarkersInternal(); // sofort reagieren, nicht erst beim nächsten refreshChart()
  refreshMarketStructureInternal();
});
watch(() => props.showRangesMetadata, refreshRangesPollingState);
// Lookback-Änderung braucht mehr/weniger H1-Historie -> neu fetchen, aber nur solange mindestens
// einer der beiden Ranges-Toggles überhaupt an ist (sonst reicht es, beim nächsten Einschalten
// frisch zu laden).
watch(() => props.rangesLookbackHours, () => {
  if (rangesNeedsData()) loadRangesCandles();
});
// Eingebettete Periode-2-Erkennung (siehe Chat 2026-07-19): Lookback-Änderung kann das gemeinsame
// Fetch-Fenster (Math.max in loadRangesCandles) vergrößern -> neu fetchen wie bei Periode 5 oben.
// Periode-Änderung selbst braucht dagegen KEINEN Refetch (rangesH1Candles ist schon da) — nur neu
// berechnen, wenn Daten vorhanden sind.
watch(() => props.ranges2LookbackHours, () => {
  if (rangesNeedsData()) loadRangesCandles();
});
watch([() => props.rangesPeriod, () => props.ranges2Period], () => {
  if (rangesH1Candles.length > 0) refreshRangesInternal();
});
// Braucht trendAnalysisM5Candles (siehe loadTradeSetupCandles) -> beim Einschalten fehlt sie
// evtl. noch, dann einmal nachladen; beim Ausschalten reicht refreshEmaInternal (blendet aus,
// kein Neu-Fetch nötig).
watch(() => props.showEma, (on) => {
  if (on && trendAnalysisM5Candles.length === 0) loadTradeSetupCandles();
  else refreshEmaInternal();
});
watch(() => props.showTradeSetupCockpit, () => {
  // showTradeSetupCockpit zählt seit Chat 2026-07-19 mit in rangesNeedsData() (TSC braucht den
  // H1-Range-State immer, auch ohne Trend-Toggle) -> Polling-Zustand neu bewerten, genau wie beim
  // showRanges/showRangesMetadata-Watcher oben.
  refreshRangesPollingState();
  refreshCockpitInternal();
});
watch(() => [props.tradeSetupCockpitAtCandle, props.tradeSetupCockpitCandleOffset], refreshCockpitInternal);
// Hauptkerzen (allCandles) selbst brauchen keinen Refetch (siehe clipReplay, oben schon geladen) —
// refreshChart() reicht dafür sofort. Trade-Setups/Ranges dagegen SCHON: ihr fester count/Lookback
// hängt ohne replayToMs() am alten Anker (vorheriger replayUntil bzw. "jetzt") fest und deckt den
// neuen Replay-Zeitpunkt ggf. gar nicht mehr ab (siehe Chat: "Ranges-Pivots gehen bei 12 Tagen
// Lookback + Replay nicht weit genug zurück") -> echtes Neu-Fetchen mit replayToMs().
let replayFetchDebounceTimer = null;
const REPLAY_FETCH_DEBOUNCE_MS = 400; // siehe Chat 2026-07-20: "im Replay-Modus hängt der Algo"
watch(() => props.replayUntil, () => {
  refreshChart();
  // Debounced statt bei JEDEM einzelnen "+1 Kerze"-Klick sofort zu fetchen — jeder Fetch ist ein
  // frischer, spürbar langsamer cTrader-TLS-Connect (siehe loadTradeSetupCandles/loadRangesCandles);
  // schnelles mehrfaches Klicken hat sonst mehrere überlappende Fetches gleichzeitig laufen, die
  // (ohne den *FetchSeq-Guard dort) in falscher Reihenfolge zurückkommen können und den Chart auf
  // einem veralteten Replay-Stand hängen lassen. Bei einem einzelnen Klick spürt man die 400ms nicht.
  clearTimeout(replayFetchDebounceTimer);
  replayFetchDebounceTimer = setTimeout(() => {
    if (isForex) loadTradeSetupCandles();
    if (rangesNeedsData()) loadRangesCandles();
  }, REPLAY_FETCH_DEBOUNCE_MS);
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

// Für den "+1 Kerze"-Button in Dashboard.vue: replayUntil lebt dort (fließt nur als Prop rein),
// daher kein direktes Setzen von hier aus möglich — stattdessen den Zeitpunkt der nächsten
// geladenen Kerze im AKTUELLEN Timeframe (allCandles, unclipped) zurückgeben, den Dashboard.vue
// dann als neuen replayUntil-Wert übernimmt. `after == null` (noch kein Replay aktiv) liefert die
// älteste geladene Kerze, damit der Button auch aus Live heraus sofort funktioniert.
defineExpose({
  nextReplayTime(after) {
    for (const c of allCandles) {
      if (after == null || c.time > after) return c.time;
    }
    return null;
  },
});
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
    <MetadataPanel v-if="showRangesMetadata" title="Structure-Metadaten" @close="emit('close-ranges-metadata')">
      <div class="metadata-subheading-row">
        <h4 class="metadata-subheading">Structure-State</h4>
        <button class="metadata-copy-btn" :disabled="!marketStructureTree" @click="copyJson('structureState', marketStructureTree)">
          {{ copiedSection === 'structureState' ? '✓ kopiert' : '📋 kopieren' }}
        </button>
      </div>
      <JsonTree v-if="marketStructureTree" :value="marketStructureTree" />
      <p v-else class="metadata-empty">Kein Structure-State (mind. 2 Pivots nötig).</p>

      <div class="metadata-subheading-row">
        <h4 class="metadata-subheading">Periode {{ rangesPeriod }} (Rohdaten)</h4>
        <button class="metadata-copy-btn" :disabled="!rangesMetadata" @click="copyJson('period5', rangesMetadata)">
          {{ copiedSection === 'period5' ? '✓ kopiert' : '📋 kopieren' }}
        </button>
      </div>
      <JsonTree v-if="rangesMetadata" :value="rangesMetadata" />
      <p v-else class="metadata-empty">Keine Ranges-Daten geladen.</p>

      <div class="metadata-subheading-row">
        <h4 class="metadata-subheading">Periode {{ ranges2Period }} (eingebettet, Rohdaten)</h4>
        <button class="metadata-copy-btn" :disabled="!rangesMetadata2" @click="copyJson('period2', rangesMetadata2)">
          {{ copiedSection === 'period2' ? '✓ kopiert' : '📋 kopieren' }}
        </button>
      </div>
      <JsonTree v-if="rangesMetadata2" :value="rangesMetadata2" />
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

.metadata-subheading {
  margin: 12px 0 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.metadata-subheading-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.metadata-subheading-row:first-child .metadata-subheading {
  margin-top: 0;
}

.metadata-copy-btn {
  flex: none;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #787b86;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.metadata-copy-btn:hover:not(:disabled) {
  border-color: #2962ff;
  color: #d1d4dc;
}

.metadata-copy-btn:disabled {
  opacity: 0.4;
  cursor: default;
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
