<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import { detectLiquidityLevels, filterRelevantLevels, renderLiquidityLevels, LiquidityLinePrimitive } from "../liquidity.js";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
import { renderPivotMarkers } from "../pivotMarkers";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot, renderMarketStructureAnalysis } from "../marketStructureAnalysis";
import { computeCockpitState, renderTradeSetupCockpit } from "../tradeSetupCockpit";
import { computeEma } from "../ema.js";
import { chartColors, cssColor, cssColorScaled } from "../chartColors.js";
import { selectActiveMetadataSections, earliestRelevantTime } from "../debugMetadata.js";
import { renderTradeMarkers } from "../tradeMarkers.js";
import {
  binanceIntervalFor,
  fetchInitialDeltas,
  fetchDailyDeltas,
  fetchOlderDeltas,
  mergeRecentDeltas,
  cumulativeFromDeltas,
} from "../cvd.js";
import { okxBarFor, barSecondsFor } from "../timeframes.js";
import {
  fetchInitialCandles as fetchInitialForexCandles,
  fetchRecentCandles as fetchRecentForexCandles,
  fetchOlderCandles as fetchOlderForexCandles,
} from "../ctraderCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
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
  // Fixer Startzeitpunkt statt rollierendem "letzte X Stunden"-Fenster (Chat 2026-07-21: "im
  // Replaymodus wird das ja immer dynamisch angepasst ... für Testszenarien bräuchte ich einen
  // fixen Punkt") — gilt für BEIDE Perioden gemeinsam (siehe computeRangesPivotsFor/loadRangesCandles).
  rangesFixedStartActive: { type: Boolean, default: false },
  rangesFixedStartTime: { type: Number, default: null },
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
  // Debug-Metadaten-Sammel-Panel (siehe Chat 2026-07-20: "damit ich dir nicht ständig die Daten
  // von dem was ich in TradingView sehe hier schreiben muss") — Toolbar-Unterpunkt bei "Debug".
  showDebugMetadata: { type: Boolean, default: false },
});
const emit = defineEmits(["close-ranges-metadata", "toggle-tsc-position", "close-debug-metadata"]);

// CVD (Binance-Futures-Orderflow) gibt es nur für BTC-USDT — für Forex-Symbole (cTrader)
// bleiben Gauges/CVD-Pane komplett weg statt leer. Der Wert steht bei onMounted fest:
// Dashboard.vue rendert <PriceChart :key="symbol">, ein Symbolwechsel montiert die
// Komponente also neu, statt dieses Flag zur Laufzeit umzuschalten.
const isForex = props.symbol !== "BTC-USDT";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
const POLL_MS = 12_000; // nur noch für die BTC-CVD-Gauges (windowGaugeTimer/dailyGaugeTimer) — die
// Haupt-Kerzen pollen seit Chat 2026-07-20 nicht mehr fest im 12s-Takt, siehe scheduleNextPoll.
const RECENT_PAGE_SIZE = 300; // OKX max per call on /market/candles
// Forex-Pendant zu RECENT_PAGE_SIZE, aber bewusst viel kleiner (siehe Chat 2026-07-20: "unnötige
// cTrader Aufrufe") — RECENT_PAGE_SIZE ist ein OKX-Seitenlimit, kein Forex-Bedarf: pollRecent
// braucht pro Tick nur die 1-2 Kerzen, die sich seit dem letzten Poll geändert haben können,
// mergeRecent() ersetzt ohnehin nur den Schwanz von allCandles. 10 als Puffer für einen verpassten
// Poll (z.B. Tab im Hintergrund gedrosselt) — pro cTrader-Connect trotzdem 30x weniger Daten.
const RECENT_PAGE_SIZE_FOREX = 10;
// An den Kerzenschluss ausgerichtetes Polling statt fester Intervall-Taktung (siehe Chat
// 2026-07-20: "die wackelt immer in die falsche Richtung ... mir reicht pro M1 Kerzenschluss ...
// wichtig ist bloß, dass M1 Kerzen sofort da sind, wenn sie schließen, nicht 30s zu spät"). Kleiner
// Puffer nach der erwarteten Schlusszeit, bis die frisch geschlossene Kerze beim Broker/Backend
// ankommt (siehe scheduleNextPoll) — lieber knapp nach dem Schluss pollen als knapp davor.
const CLOSE_POLL_BUFFER_MS = 2_000;
const HISTORY_PAGE_SIZE = 100; // OKX max per call on /market/history-candles
const INITIAL_CANDLE_COUNT = 1000; // depth loaded on startup / timeframe switch
// Wunsch Philip 2026-07-20: "ich werd bei Replay öfter auf +1 klicken, fetch doch gleich die
// nächsten 4h" — an alle Replay-Fetches (fetchCandlesCached lookaheadSec-Parameter) durchgereicht,
// damit wiederholtes "+1 Kerze"-Klicken innerhalb dieses Fensters ohne neuen Roundtrip auskommt
// (siehe candleCache.js: der Hit-Check bleibt dabei strikt am WAHREN replayUntil, nur der
// tatsächliche Fetch/completeUpTo reicht weiter).
const REPLAY_LOOKAHEAD_SEC = 4 * 3600;
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
const TRADE_SETUP_LINE_WIDTH = 2;
// tradeSetupShort/-Long dienen sowohl der LS-Linie (chartColors[key].alpha, Default 0.9 = "Haupt"-
// Transparenz) als auch der OB-Box, deren Fill/Border proportional dazu skalieren (Original-
// Design-Verhältnis 0.22/0.9 bzw. 0.7/0.9), siehe cssColorScaled in chartColors.js.
const TRADE_SETUP_OB_FILL_RATIO = 0.22 / 0.9;
const TRADE_SETUP_OB_BORDER_RATIO = 0.7 / 0.9;

// EMA (siehe unten) braucht mehr M5-Historie als tradeSetupM5Candles (300 = ~25h) — eigener
// Fetch, nur solange der EMA-Toggle an ist (jeder Fetch ist ein frischer cTrader-TLS-Connect,
// siehe loadTradeSetupM5). fetchTrendAnalysisM5History paginiert automatisch nach, falls
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

// EMA 50/200 auf M5 (siehe Chat: Philips "Trend über EMA + Anzahl protected highs/lows"-Idee) —
// läuft auf trendAnalysisM5Candles (dieselbe M5-Historie wie der Zigzag-Algo), kein eigener Fetch
// nötig, siehe loadTradeSetupM5.
const EMA_PERIOD_FAST = 50;
const EMA_PERIOD_SLOW = 200;

const { markSuccess } = useStatusBar();

const chartContainerRef = ref(null);
const gaugesBottom = ref(12);
const windowDelta = ref(0);
const dailyDelta = ref(0);
// pivotTime/touched.touchedTime sind nur intern nötig (Rendern der Zigzag-/Ranges-Linien bzw.
// zeitbewusste Pullback-Auswahl in tryConfirmUptrend, siehe marketStructureAnalysis.ts), tauchen in
// den Metadaten-Panels bewusst nicht auf (Philips Pivot-Typ hat kein Pflichtfeld dafür, nur die
// menschenlesbaren pivotAt/touchedAt).
function pivotForDisplay(p) {
  if (!p) return null;
  const { pivotTime, ...rest } = p;
  if (rest.touched && typeof rest.touched === "object") {
    const { touchedTime, ...touchedRest } = rest.touched;
    rest.touched = touchedRest;
  }
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

// Zusätzlich lokal in .debug/metadata.json ablegen (siehe vite.config.js: debugMetadataWriter) —
// nur für den "alles kopieren"-Button im Debug-Metadaten-Panel, Chat 2026-07-21: "du siehst nicht
// alle daten, weil mein Text abgeschnitten wird" (sehr lange Kerzen-Arrays sprengen das Prompt-
// Fenster beim Einfügen). Bewusst ZUSÄTZLICH zum Clipboard-Copy, nicht als Ersatz. Nur im
// `vite dev`-Server erreichbar — schlägt der POST fehl (z.B. weil kein Dev-Server läuft), still
// ignorieren, das Clipboard-Copy allein bleibt trotzdem nützlich.
async function copyJsonAndSaveLocally(section, value) {
  await copyJson(section, value);
  try {
    await fetch("/__debug-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value, null, 2),
    });
  } catch (err) {
    console.error("Debug-Metadaten lokal speichern fehlgeschlagen:", err);
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
// Out-of-Order-Guards für loadInitial/loadRangesCandles/loadTradeSetupM5/loadTradeSetupH1, siehe
// dort (Chat 2026-07-20: "im Replay-Modus hängt der Trend-Algorithmus"). loadInitialFetchSeq wird
// zusätzlich von pollRecent() als Bar-Mismatch-Guard gelesen (siehe dort, Bug-Report Philip
// 2026-07-19: "1h -> M5 -> wieder 1h, Chart zeigt nur noch M5-Kerzen") — jeder echte Neu-Load von
// allCandles (TF-/Symbol-Wechsel, Replay-Schritt) zählt hoch, ein noch laufender pollRecent()-Fetch
// von VOR diesem Wechsel erkennt daran, dass er überholt ist.
let loadInitialFetchSeq = 0;
let rangesFetchSeq = 0;
let tradeSetupM5FetchSeq = 0;
let tradeSetupH1FetchSeq = 0;
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
let pollTimer = null;
let tradeSetupM5PollTimer = null;
let tradeSetupH1PollTimer = null;
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

// Fürs Debug-Metadaten-Sammel-Panel (buildActiveMetadataSnapshot unten) — dieselben Werte, die auch
// fürs Zeichnen berechnet werden, hier zusätzlich in Refs gespiegelt statt aus den Primitives
// zurückzulesen (die kennen nur Pixel-Koordinaten, keine Rohdaten mehr). poiZonesMetadata hat
// bewusst kein eigenes Toggle-Gate (siehe buildActiveMetadataSnapshot) — POI-/OB-Zonen haben anders
// als Liquidität/Trade-Setups/Structure keinen eigenen An/Aus-Schalter in der Toolbar, sie werden
// immer gezeichnet. liquidityEarliestTime/structureEarliestTime halten den frühesten ROHEN
// pivotTime der jeweils zuletzt berechneten Levels/Pivots (die *Metadata-Refs selbst sind schon
// pivotForDisplay-bereinigt, siehe pivotForDisplay oben) — nur für die Kerzen-Relevanz unten,
// tauchen selbst nicht im kopierten JSON auf.
const poiZonesMetadata = ref(null);
const liquidityMetadata = ref(null);
const liquidityEarliestTime = ref(null);
const tradeSetupsMetadata = ref([]);
const cockpitMetadata = ref(null);
const structureEarliestTime = ref(null);

// Nur die Abschnitte der gerade angetoggelten Features (siehe Chat 2026-07-20: "nur metadaten von
// den features im Menü, wenn sie angetoggelt sind") — damit bleibt der kopierte JSON-Blob fokussiert
// auf das, was gerade im Chart tatsächlich zu sehen ist, statt jedes Mal alles (inkl. ausgeblendeter
// Sachen) mitzuschleppen. orderBlocks bewusst ungated, siehe poiZonesMetadata oben. context (Symbol/
// TF/Replay) läuft IMMER mit, unabhängig von Toggles — ohne das lässt sich ein kopiertes OB
// (z.B. "startTime": 1782709200) gar nicht einordnen (Chat 2026-07-20: "fehlt ... replaymodus
// inputs, TF, Währungspaar").
//
// candles: die "Option A" aus demselben Chat ("du suchst selbst aus den Metadaten, welche Uhrzeit
// noch relevant ist") — ab dem FRÜHESTEN Zeitpunkt, auf den irgendeine aktive Sektion verweist
// (OB-Zone startTime, Liquiditäts-/Structure-Pivot pivotTime, Trade-Setup fractal/ls/obStartTime),
// bis zum aktuellen (bzw. im Replay: replayUntil) Kerzenende. Bewusst ein Filter auf das ohnehin
// schon geladene allCandles-Fenster statt eines eigenen Fetches — bleibt der gewählte
// Zeitpunkt VOR der ältesten geladenen Kerze, fehlt entsprechend der Anfang (kein Nachladen bisher,
// siehe Chat: "falls kompliziert, lass uns das gemeinsam refinen").
//
// Bewusst eine imperativ befüllte Ref statt eines computed() — allCandles ist absichtlich KEIN
// reaktiver State (siehe Kommentar bei den Closure-Variablen oben), ein computed() würde also nie
// neu laufen, wenn sich NUR allCandles ändert. buildActiveMetadataSnapshot() wird deshalb explizit
// am Ende von refreshChart() aufgerufen (derselbe Zyklus, der auch alle anderen *Metadata-Refs
// aktuell hält) sowie beim Öffnen des Panels selbst.
const activeMetadataSnapshot = ref({ context: {}, orderBlocks: [] });
function buildActiveMetadataSnapshot() {
  const toggles = {
    showLiquidity: props.showLiquidity,
    showTradeSetups: props.showTradeSetups,
    showTradeSetupCockpit: props.showTradeSetupCockpit,
    showRanges: props.showRanges,
  };
  const tradeSetupTimes = (tradeSetupsMetadata.value ?? [])
    .flatMap((s) => [s.fractal?.pivotTime, s.ls?.pivotTime, s.obStartTime])
    .filter((t) => t != null);

  const sections = selectActiveMetadataSections(toggles, {
    context: {
      symbol: props.symbol,
      timeframe: props.currentBar,
      replay: props.replayUntil == null ? { active: false } : { active: true, until: props.replayUntil, untilAt: fmtDateTime(props.replayUntil) },
    },
    orderBlocks: poiZonesMetadata.value ?? [],
    liquidity: liquidityMetadata.value ?? [],
    tradeSetups: tradeSetupsMetadata.value,
    tradeSetupCockpit: cockpitMetadata.value,
    structure: {
      state: marketStructureTree.value,
      window:
        props.rangesFixedStartActive && props.rangesFixedStartTime != null
          ? { mode: "fixed", since: props.rangesFixedStartTime, sinceAt: fmtDateTime(props.rangesFixedStartTime) }
          : { mode: "lookback" },
      period5: { period: props.rangesPeriod, lookbackHours: props.rangesLookbackHours, pivots: rangesMetadata.value ?? [] },
      period2Embedded: { period: props.ranges2Period, lookbackHours: props.ranges2LookbackHours, pivots: rangesMetadata2.value ?? [] },
    },
  });

  const since = earliestRelevantTime(toggles, {
    orderBlocks: (poiZonesMetadata.value ?? []).map((z) => z.startTime).filter((t) => t != null),
    liquidity: liquidityEarliestTime.value != null ? [liquidityEarliestTime.value] : [],
    tradeSetups: tradeSetupTimes,
    structure: structureEarliestTime.value != null ? [structureEarliestTime.value] : [],
  });
  if (since != null) {
    const candles = clipReplay(allCandles).filter((c) => c.time >= since);
    sections.candles = { since, sinceAt: fmtDateTime(since), timeframe: props.currentBar, count: candles.length, data: candles };
  }
  return sections;
}
const hasActiveMetadata = computed(
  () =>
    activeMetadataSnapshot.value.orderBlocks.length > 0 ||
    props.showLiquidity ||
    props.showTradeSetups ||
    props.showTradeSetupCockpit ||
    props.showRanges,
);

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

// Replay-Modus: alle Fetches (loadInitial/pollRecent/loadRangesCandles/loadTradeSetupM5/-H1)
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
// 12 Tagen Lookback + Replay nicht weit genug zurück"). loadRangesCandles/loadTradeSetupM5/-H1
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
  let zones;
  if (isForex) {
    zones = detectOrderBlocks(candles)
      .filter((z) => !z.invalidated)
      .map((z) => ({ ...z, timeframe: props.currentBar.toUpperCase() }));
  } else {
    // BTC-Zonen kommen fertig vom poi-watcher-Backend (props.poiZones) statt lokal erkannt —
    // im Replay-Modus trotzdem auf Zonen bis replayUntil beschränken, damit nicht schon
    // Zonen auftauchen, die "in der Zukunft" (relativ zu X) erst entdeckt wurden.
    zones = props.replayUntil == null ? props.poiZones : props.poiZones.filter((z) => z.startTime <= props.replayUntil);
  }
  const visibleZones = filterHistorical(zones);
  renderPersistedZones(candleSeries, visibleZones, orderBlockPrimitives, candles);
  poiZonesMetadata.value = visibleZones;
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
    liquidityMetadata.value = null;
    liquidityEarliestTime.value = null;
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
  liquidityMetadata.value = relevant.map(pivotForDisplay);
  liquidityEarliestTime.value = relevant.length > 0 ? Math.min(...relevant.map((lvl) => lvl.pivotTime)) : null;
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
  // rangesFixedStartActive (siehe Chat 2026-07-21: "im Replaymodus wird das ja immer dynamisch
  // angepasst ... für Testszenarien bräuchte ich einen fixen Punkt") ersetzt den ROLLIERENDEN
  // Cutoff durch einen ABSOLUTEN — bleibt beim Scrubben durch den Replay-Modus stabil, statt sich
  // mit replayUntil mitzuverschieben. lookbackHours wird in dem Fall komplett ignoriert.
  const now = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const cutoff = props.rangesFixedStartActive && props.rangesFixedStartTime != null ? props.rangesFixedStartTime : now - lookbackHours * 3600;
  const { highs, lows } = detectLiquidityLevels(clipReplay(rangesH1Candles), period);
  return [...highs, ...lows]
    .filter((p) => p.pivotTime >= cutoff)
    .sort((a, b) => a.pivotTime - b.pivotTime)
    .map((p) => ({
      type: p.dir === 1 ? "high" : "low",
      price: p.price,
      pivotTime: p.pivotTime,
      pivotAt: fmtDateTime(p.pivotTime),
      touched: p.touched ? { price: p.price, touchedAt: fmtDateTime(p.touchedTime), touchedTime: p.touchedTime } : false,
    }));
}

// Punkt-Marker für die H1-Ranges-Pivots — nur sichtbar, wenn sowohl das Ranges-Metadaten-Panel
// als auch der Debug-Modus an sind (siehe Chat: "wenn ranges angetoggelt ist und debug modus").
// Nutzt renderPivotMarkers aus pivotMarkers.ts (Punkt + entzertes Preis-Label ist dort schon
// fertig) — ALLE Pivots EINER Periode in EINER Gruppe (nicht mehr eine Gruppe pro Pivot wie
// früher), damit sich ihre Preis-Labels gegenseitig entzerren können, statt bei eng
// beieinanderliegenden Pivots übereinander zu fallen (Bug-Report Philip 2026-07-19: im
// M5-Replay mit Debug-Modus lagen alle H1-Pivot-Labels eng übereinander). Periode-2-Marker
// (rangesMarkerPrimitives2) laufen als eigene Primitive-Liste in derselben Pane mit — kleinerer
// dotRadius + eigene, transparentere Farbe (rangesMarker2), damit man beide Periode-Ebenen
// optisch auseinanderhält (siehe Chat: "Transparenz auf 50%").
function refreshRangesMarkersInternal() {
  const candles = clipReplay(allCandles);
  const precision = pricePrecisionForInstrument(props.symbol);
  const showMarkers = props.showRanges && props.showLiquidityDebug;

  if (!showMarkers || !rangesPivots) {
    renderPivotMarkers(candleSeries, [], rangesMarkerPrimitives, candles);
  } else {
    const groups = [{ points: rangesPivots, color: cssColor("rangesMarker") }];
    renderPivotMarkers(candleSeries, groups, rangesMarkerPrimitives, candles, {
      showLabels: true,
      formatPrice: (price) => fmtPrice(price, precision),
    });
  }

  if (!showMarkers || !rangesPivots2) {
    renderPivotMarkers(candleSeries, [], rangesMarkerPrimitives2, candles);
  } else {
    const groups2 = [{ points: rangesPivots2, color: cssColor("rangesMarker2") }];
    renderPivotMarkers(candleSeries, groups2, rangesMarkerPrimitives2, candles, {
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
  const allPivotTimes = [...(rangesPivots ?? []), ...(rangesPivots2 ?? [])].map((p) => p.pivotTime);
  structureEarliestTime.value = allPivotTimes.length > 0 ? Math.min(...allPivotTimes) : null;
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
  // Sofort weiterreichen statt auf den nächsten refreshChart()/Poll zu warten (siehe Chat
  // 2026-07-19: "TSC scheint zu hängen, dauert ne Weile bis da was drin steht") — marketStructureState
  // ist eine der beiden TSC-Datenquellen (siehe refreshCockpitInternal), die andere ist
  // currentTradeSetups (siehe loadTradeSetupM5/-H1).
  refreshCockpitInternal();
}

// Trade-Setup-Cockpit (siehe Chat 2026-07-19) — reine Zusammenfassung, liest marketStructureState.value
// und currentTradeSetups direkt aus der Closure (dieselbe Liste, die renderTradeSetupsInternal schon
// positioniert) — kein eigener Fetch/eigene Erkennung. Nur für Forex (wie Ranges/Trade-Setups
// selbst). Wird sowohl von refreshMarketStructureInternal als auch von loadTradeSetupM5/-H1 direkt
// aufgerufen (siehe dort), nicht erst über den nächsten refreshChart() — sonst hinkt die Karte den
// eigentlich schon fertigen Daten hinterher.
function refreshCockpitInternal() {
  if (!isForex || !chart) return; // async loadTradeSetupM5/-H1 können nach unmount noch abschließen
  const candles = clipReplay(allCandles);
  if (!props.showTradeSetupCockpit || candles.length === 0) {
    renderTradeSetupCockpit(candleSeries, null, cockpitPrimitives, candles);
    cockpitMetadata.value = null;
    return;
  }
  const state = computeCockpitState(marketStructureState.value, currentTradeSetups);
  const precision = pricePrecisionForInstrument(props.symbol);
  renderTradeSetupCockpit(candleSeries, state, cockpitPrimitives, candles, {
    mode: props.tradeSetupCockpitAtCandle ? "candle" : "fixed",
    formatPrice: (price) => fmtPrice(price, precision),
    candleOffset: props.tradeSetupCockpitCandleOffset,
  });
  cockpitMetadata.value = { h1Trend: state.h1Trend, h1LqSweep: pivotForDisplay(state.h1LqSweep), m5Setup: state.m5Setup };
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
    // rangesFixedStartActive: genug Historie ab dem fixen Startzeitpunkt laden (bis zur echten
    // aktuellen/Replay-Zeit) statt der rollierenden lookbackHours — sonst reicht der Fetch bei
    // einem weit zurückliegenden fixen Start nicht aus (siehe cutoff in computeRangesPivotsFor).
    // Math.ceil zwingend (Bug-Report Philip 2026-07-21: "+1 Kerze hängt") — (nowSec-fixedStart)/3600
    // ist so gut wie NIE eine glatte Stundenzahl, das nicht-ganzzahlige `hours` lief ungeprüft bis in
    // `count` und von dort als Feld in den cTrader-Edge-Function-Request (letztlich ein Protobuf-
    // Feld Richtung Broker) — ein Bruchteil-count dort ist vermutlich der Auslöser des Hängers.
    const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
    const hours =
      props.rangesFixedStartActive && props.rangesFixedStartTime != null
        ? Math.max(1, Math.ceil((nowSec - props.rangesFixedStartTime) / 3600))
        : Math.max(props.rangesLookbackHours, props.ranges2LookbackHours);
    const count = hours + RANGES_CANDLE_BUFFER;
    // Teilt sich den H1-Cache-Eintrag mit loadInitial (falls currentBar "1h" ist) und
    // loadTradeSetupH1 (siehe Chat 2026-07-20: "unnötige cTrader Aufrufe") — statt unabhängig
    // komplett neu zu fetchen, nur der fehlende/neue Teil.
    const candles = await fetchCandlesCached(fetchInitialForexCandles, props.symbol, "1h", count, replayToMs(), REPLAY_LOOKAHEAD_SEC);
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
// cTrader-Connect, solange wirklich niemand (auch nicht die TSC-Karte) hinschaut.
function rangesNeedsData() {
  return props.showRanges || props.showRangesMetadata || props.showTradeSetupCockpit;
}
// An den H1-Kerzenschluss ausgerichtet statt festem Intervall (siehe scheduleNextTradeSetupH1Poll,
// Chat 2026-07-20) — H1-Kerzen ändern sich nur stündlich, ein häufigerer Poll bringt nichts außer
// zusätzlichen cTrader-Connects.
function scheduleNextRangesPoll() {
  clearTimeout(rangesPollTimer);
  const barMs = barSecondsFor("1h") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  rangesPollTimer = setTimeout(async () => {
    await loadRangesCandles();
    if (chart) scheduleNextRangesPoll();
  }, delay);
}
function startRangesPolling() {
  loadRangesCandles();
  scheduleNextRangesPoll();
}
function stopRangesPolling() {
  clearTimeout(rangesPollTimer);
  rangesPollTimer = null;
}
function refreshRangesPollingState() {
  if (rangesNeedsData()) startRangesPolling();
  else stopRangesPolling();
}

// Erkennung läuft nur, wenn sich die M5/H1-Kerzen geändert haben (siehe loadTradeSetupM5/-H1)
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
    tradeSetupsMetadata.value = currentTradeSetups;
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
  tradeSetupsMetadata.value = currentTradeSetups;
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
  // Async-Fetch (loadTradeSetupM5/-H1) kann noch laufen, wenn die Komponente schon
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
// TF-Wechsel über refreshChart() aufgerufen, nicht mehr nur bei loadTradeSetupM5/watch(showEma).
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

// M5/H1-Kerzen für die Trade-Setup-Erkennung — unabhängig vom aktuell gewählten Chart-Timeframe
// (props.currentBar), da ein Setup immer auf M5-Fraktal + H1/M5-Sweep basiert, egal ob der Nutzer
// gerade den 1h- oder den 15m-Chart anschaut. Seit Chat 2026-07-20 ("unnötige cTrader Aufrufe")
// in zwei unabhängige Funktionen mit je eigener, an den jeweiligen Kerzenschluss ausgerichteter
// Poll-Taktung gesplittet (siehe scheduleNextTradeSetupM5Poll/-H1Poll) — vorher hing H1 am
// selben festen 60s-Takt wie M5, obwohl sich H1-Kerzen nur stündlich wirklich ändern; jeder Poll
// ist ein frischer cTrader-TLS-Connect, das war unnötig teuer. computeTradeSetups() braucht
// zwar beide Candle-Sets, wird aber bewusst nach JEDER der beiden Teil-Fetches neu aufgerufen
// (reine lokale Berechnung, kein Netzwerk) statt auf ein gemeinsames "beide fertig" zu warten.
async function loadTradeSetupM5() {
  if (!isForex) return;
  const seq = ++tradeSetupM5FetchSeq; // Out-of-Order-Guard, siehe loadRangesCandles
  try {
    const toMs = replayToMs();
    // Holt bei aktivem EMA-Toggle zusätzlich die größere M5-Historie für die EMA-Berechnung
    // (siehe TREND_ANALYSIS_CANDLE_COUNT) — nur dann, um unnötige cTrader-Connects zu vermeiden.
    // Hängt hier dran (nicht an einem dritten eigenen Poller), weil EMA ohnehin M5-Kerzen braucht
    // und dieser Poll schon läuft — inhaltlich hat EMA nichts mit Trade-Setups zu tun, siehe Chat.
    const fetches = [
      fetchCandlesCached(fetchInitialForexCandles, props.symbol, "5m", TRADE_SETUP_CANDLE_COUNT, toMs, REPLAY_LOOKAHEAD_SEC),
    ];
    if (props.showEma) {
      fetches.push(
        fetchCandlesCached(
          (symbol, bar, count, ms) => fetchTrendAnalysisM5History(symbol, count, ms),
          props.symbol,
          "5m",
          TREND_ANALYSIS_CANDLE_COUNT,
          toMs,
          REPLAY_LOOKAHEAD_SEC,
        ),
      );
    }
    const [m5, trendM5] = await Promise.all(fetches);
    if (seq !== tradeSetupM5FetchSeq) return; // inzwischen überholt
    tradeSetupM5Candles = m5;
    if (trendM5) trendAnalysisM5Candles = trendM5;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshEmaInternal();
    refreshCockpitInternal(); // sofort weiterreichen statt auf den nächsten refreshChart() zu warten
  } catch (err) {
    console.error("Trade-Setup-M5-Kerzen fehlgeschlagen:", err);
  }
}

async function loadTradeSetupH1() {
  if (!isForex) return;
  const seq = ++tradeSetupH1FetchSeq; // Out-of-Order-Guard, siehe loadRangesCandles
  try {
    const toMs = replayToMs();
    // Teilt sich den Cache-Eintrag mit loadInitial (falls currentBar "1h" ist) und
    // loadRangesCandles — beide bleiben trotzdem bewusst eigene Aufrufe/Poller (siehe Chat
    // 2026-07-20: "Konzepte sollen sich nicht querbeeinflussen"), der Cache macht das billig.
    const h1 = await fetchCandlesCached(fetchInitialForexCandles, props.symbol, "1h", TRADE_SETUP_CANDLE_COUNT, toMs, REPLAY_LOOKAHEAD_SEC);
    if (seq !== tradeSetupH1FetchSeq) return; // inzwischen überholt
    tradeSetupH1Candles = h1;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshCockpitInternal();
  } catch (err) {
    console.error("Trade-Setup-H1-Kerzen fehlgeschlagen:", err);
  }
}

function scheduleNextTradeSetupM5Poll() {
  clearTimeout(tradeSetupM5PollTimer);
  const barMs = barSecondsFor("5m") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  tradeSetupM5PollTimer = setTimeout(async () => {
    await loadTradeSetupM5();
    if (chart) scheduleNextTradeSetupM5Poll(); // Komponente könnte während des awaits unmounted worden sein
  }, delay);
}

function scheduleNextTradeSetupH1Poll() {
  clearTimeout(tradeSetupH1PollTimer);
  const barMs = barSecondsFor("1h") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  tradeSetupH1PollTimer = setTimeout(async () => {
    await loadTradeSetupH1();
    if (chart) scheduleNextTradeSetupH1Poll();
  }, delay);
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
  activeMetadataSnapshot.value = buildActiveMetadataSnapshot();
}

async function loadInitial() {
  // Out-of-Order-Guard (siehe rangesFetchSeq/loadRangesCandles) — seit Bug-Report Philip
  // 2026-07-19 ("+1 Kerze"-Button tat nichts) läuft loadInitial() nicht mehr nur einmal bei
  // Mount/TF-Wechsel, sondern auch gedebounced bei jedem Replay-Schritt (siehe replayUntil-
  // Watcher unten) — schnell aufeinanderfolgende Schritte können also mehrere echte Fetches
  // gleichzeitig laufen haben, die out-of-order zurückkommen.
  const seq = ++loadInitialFetchSeq;
  try {
    let candles, deltas;
    // Fester count (INITIAL_CANDLE_COUNT) reicht "bis jetzt" gerechnet nicht bei jedem Timeframe
    // gleich weit zurück (1000 M5-Kerzen ~3,5 Tage, 1000 H1-Kerzen ~41 Tage) — ohne replayToMs()
    // würde ein TF-Wechsel während eines weit zurückliegenden Replays (z.B. 1h -> M5) einen leeren
    // Kerzenbereich laden, der nach clipReplay komplett verschwindet (siehe Chat 2026-07-19: "1h
    // auf M5 gewechselt und sehe keinen Chart").
    const toMs = replayToMs();
    if (isForex) {
      candles = await fetchCandlesCached(
        fetchInitialForexCandles,
        props.symbol,
        props.currentBar,
        INITIAL_CANDLE_COUNT,
        toMs,
        REPLAY_LOOKAHEAD_SEC,
      );
      deltas = [];
    } else {
      const binanceInterval = binanceIntervalFor(props.currentBar);
      [candles, deltas] = await Promise.all([
        fetchCandlesCached(
          (symbol, bar, count, ms) => fetchInitialCandles(okxBarFor(bar), count, ms),
          props.symbol,
          props.currentBar,
          INITIAL_CANDLE_COUNT,
          toMs,
          REPLAY_LOOKAHEAD_SEC,
        ),
        fetchInitialDeltas(binanceInterval, INITIAL_CANDLE_COUNT).catch((err) => {
          console.error("CVD-Historie fehlgeschlagen:", err);
          return [];
        }),
      ]);
    }
    if (seq !== loadInitialFetchSeq) return; // inzwischen überholt, siehe oben
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
  // Bar-Mismatch-Guard (Bug-Report Philip 2026-07-19: "1h -> M5 -> wieder 1h, Chart zeigt nur noch
  // M5-Kerzen"): pollRecent() läuft über einen eigenen setTimeout-Timer (scheduleNextPoll) und
  // liest props.currentBar/props.symbol nur EINMAL beim Start der Fetches oben — läuft der Timer
  // kurz vor einem TF-Wechsel an (oder ist der Fetch selbst schon unterwegs), kommt die Antwort
  // ggf. erst NACH dem Wechsel zurück und würde sonst ungeprüft Kerzen des ALTEN Timeframes per
  // mergeRecent() in das inzwischen schon auf den neuen TF umgestellte allCandles mischen.
  // loadInitialFetchSeq wird bei jedem echten Neu-Laden von allCandles hochgezählt (TF-Wechsel,
  // Symbol-Wechsel, Replay-Schritt, siehe loadInitial) — hat sich der Zähler seit Start dieses
  // Polls verändert, ist die Antwort für einen inzwischen überholten Stand und wird verworfen.
  const seq = loadInitialFetchSeq;
  try {
    let recent, freshDeltas;
    if (isForex) {
      recent = await fetchRecentForexCandles(props.symbol, props.currentBar, RECENT_PAGE_SIZE_FOREX);
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
    if (seq !== loadInitialFetchSeq) return; // inzwischen überholt, siehe oben
    allCandles = mergeRecent(allCandles, recent);
    if (freshDeltas) allCvdDeltas = mergeRecentDeltas(allCvdDeltas, freshDeltas);
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

// Plant den nächsten pollRecent()-Aufruf CLOSE_POLL_BUFFER_MS NACH dem nächsten erwarteten
// Kerzenschluss des aktuellen Timeframes (siehe CLOSE_POLL_BUFFER_MS) statt fest alle POLL_MS —
// dadurch wird die noch offene Kerze zwischen zwei Schlüssen gar nicht mehr angefasst (kein
// Wackeln) und die frisch geschlossene erscheint kurz NACH ihrem echten Schluss, nicht irgendwann
// im nächsten Intervall-Tick. Kerzen sind (bei allen hier genutzten Timeframes) auf UTC-Epoch
// ausgerichtet, daher reicht Date.now() % barMs zur Bestimmung von "wie weit sind wir in die
// aktuelle Kerze rein".
function scheduleNextPoll() {
  clearTimeout(pollTimer);
  const barMs = barSecondsFor(props.currentBar) * 1000;
  const msIntoBar = Date.now() % barMs;
  const delay = barMs - msIntoBar + CLOSE_POLL_BUFFER_MS;
  pollTimer = setTimeout(async () => {
    await pollRecent();
    if (chart) scheduleNextPoll(); // Komponente könnte während des awaits unmounted worden sein
  }, delay);
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
  scheduleNextPoll();
  if (isForex) {
    loadTradeSetupM5();
    loadTradeSetupH1();
    scheduleNextTradeSetupM5Poll();
    scheduleNextTradeSetupH1Poll();
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
  // scheduleNextPoll/-TradeSetupM5Poll/-TradeSetupH1Poll/-RangesPoll nutzen setTimeout statt
  // setInterval (Kerzenschluss-Ausrichtung, siehe dort) -> clearTimeout statt clearInterval.
  clearTimeout(pollTimer);
  clearTimeout(tradeSetupM5PollTimer);
  clearTimeout(tradeSetupH1PollTimer);
  clearTimeout(rangesPollTimer);
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

watch(() => props.currentBar, () => {
  loadInitial();
  scheduleNextPoll(); // neuer Timeframe -> neue Kerzenschluss-Taktung, siehe dort
});
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
// Fixer Startzeitpunkt (siehe computeRangesPivotsFor/loadRangesCandles) — Umschalten des Modus oder
// Ändern des Zeitpunkts braucht denselben Refetch wie eine Lookback-Änderung, aus demselben Grund.
watch([() => props.rangesFixedStartActive, () => props.rangesFixedStartTime], () => {
  if (rangesNeedsData()) loadRangesCandles();
});
watch([() => props.rangesPeriod, () => props.ranges2Period], () => {
  if (rangesH1Candles.length > 0) refreshRangesInternal();
});
// Braucht trendAnalysisM5Candles (siehe loadTradeSetupM5) -> beim Einschalten fehlt sie evtl. noch,
// dann einmal nachladen; beim Ausschalten reicht refreshEmaInternal (blendet aus, kein Neu-Fetch
// nötig). Nur der M5-Poller, H1 hat mit EMA nichts zu tun.
watch(() => props.showEma, (on) => {
  if (on && trendAnalysisM5Candles.length === 0) loadTradeSetupM5();
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
// Debug-Metadaten-Panel: activeMetadataSnapshot ist bewusst KEIN computed() (siehe dort) und muss
// deshalb explizit nachgezogen werden — nicht nur am Ende von refreshChart() (das läuft nicht bei
// jedem einzelnen Toggle-Klick, siehe die spezifischeren Watcher oben), sondern auch direkt beim
// Toggeln einer der hier relevanten Features/beim Öffnen des Panels selbst, damit man nicht erst
// auf den nächsten Poll warten muss. NACH den spezifischeren Watchern oben registriert (Vue führt
// Watcher in Registrierungsreihenfolge aus), damit liquidityMetadata/tradeSetupsMetadata/etc. zu
// diesem Zeitpunkt schon aktualisiert sind.
watch(
  [() => props.showLiquidity, () => props.showTradeSetups, () => props.showTradeSetupCockpit, () => props.showRanges, () => props.showDebugMetadata],
  () => {
    activeMetadataSnapshot.value = buildActiveMetadataSnapshot();
  },
);
// Hauptkerzen (allCandles) BRAUCHEN hier einen Refetch (Bug-Report Philip 2026-07-19: "+1
// Kerze"-Button tat einfach nichts) — loadInitial() bindet den Fetch selbst an replayToMs()
// (siehe dort: "1h auf M5 gewechselt und sehe keinen Chart"), allCandles endet also IMMER exakt
// an dem Replay-Zeitpunkt, zu dem es zuletzt geladen wurde, nie später. Ohne Neu-Laden hier bleibt
// es für immer auf diesem alten Stand hängen, sobald replayUntil weiterrückt (z.B. per "+1
// Kerze") — refreshChart() allein rendert dann nur denselben, schon geclippten Datenstand neu.
// Trade-Setups/Ranges brauchen aus demselben Grund ebenfalls ein echtes Neu-Fetchen: ihr fester
// count/Lookback hängt ohne replayToMs() am alten Anker (vorheriger replayUntil bzw. "jetzt")
// fest und deckt den neuen Replay-Zeitpunkt ggf. gar nicht mehr ab (siehe Chat: "Ranges-Pivots
// gehen bei 12 Tagen Lookback + Replay nicht weit genug zurück").
let replayFetchDebounceTimer = null;
const REPLAY_FETCH_DEBOUNCE_MS = 400; // siehe Chat 2026-07-20: "im Replay-Modus hängt der Algo"
watch(() => props.replayUntil, () => {
  refreshChart();
  // Debounced statt bei JEDEM einzelnen "+1 Kerze"-Klick sofort zu fetchen — jeder Fetch ist ein
  // frischer, spürbar langsamer cTrader-TLS-Connect (siehe loadTradeSetupM5/-H1/loadRangesCandles);
  // schnelles mehrfaches Klicken hat sonst mehrere überlappende Fetches gleichzeitig laufen, die
  // (ohne die *FetchSeq-Guards dort, inkl. loadInitialFetchSeq) in falscher Reihenfolge
  // zurückkommen können und den Chart auf einem veralteten Replay-Stand hängen lassen. Bei einem
  // einzelnen Klick spürt man die 400ms nicht.
  clearTimeout(replayFetchDebounceTimer);
  replayFetchDebounceTimer = setTimeout(() => {
    loadInitial();
    if (isForex) {
      loadTradeSetupM5();
      loadTradeSetupH1();
    }
    if (rangesNeedsData()) loadRangesCandles();
  }, REPLAY_FETCH_DEBOUNCE_MS);
});
// StyleModal (Dashboard.vue) schreibt direkt in den chartColors-Singleton — Serien-OPTIONEN
// (Candles/CVD/EMA) werden von refreshChart() nicht angefasst (das setzt nur setData), deshalb
// hier explizit; alle Primitive-basierten Farben (Liquidität/OB/Ranges/Trade-Setups/
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
// daher kein direktes Setzen von hier aus möglich — stattdessen den Zeitpunkt der nächsten Kerze
// im AKTUELLEN Timeframe zurückgeben, den Dashboard.vue dann als neuen replayUntil-Wert übernimmt.
// `after == null` (noch kein Replay aktiv) liefert die älteste geladene Kerze, damit der Button
// auch aus Live heraus sofort funktioniert.
// BEWUSST arithmetisch (after + eine Kerzenlänge) statt in allCandles nach der nächsten
// tatsächlich geladenen Kerze zu suchen (Bug-Report Philip 2026-07-19: Button tat einfach nichts)
// — allCandles ist während eines aktiven Replays IMMER exakt bis replayUntil geladen, nie weiter
// (siehe loadInitial: der Fetch selbst ist an replayToMs() gebunden), enthält also strukturell nie
// eine Kerze NACH dem aktuellen Replay-Stand. Der arithmetische Sprung braucht dieses Datum nicht
// — der replayUntil-Watcher unten lädt die dadurch neu sichtbare Kerze nach.
defineExpose({
  nextReplayTime(after) {
    if (after == null) return allCandles[0]?.time ?? null;
    return after + barSecondsFor(props.currentBar);
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

    <MetadataPanel v-if="showDebugMetadata" title="Debug-Metadaten" @close="emit('close-debug-metadata')">
      <div class="metadata-subheading-row">
        <h4 class="metadata-subheading">Aktive Features</h4>
        <button
          class="metadata-copy-btn"
          :disabled="!hasActiveMetadata"
          title="Kopiert ins Clipboard UND speichert zusätzlich lokal in .debug/metadata.json (nur im Dev-Server) — für sehr lange Daten, die im Chat-Fenster abgeschnitten würden"
          @click="copyJsonAndSaveLocally('debugMetadata', activeMetadataSnapshot)"
        >
          {{ copiedSection === 'debugMetadata' ? '✓ kopiert + gespeichert' : '📋 kopieren + lokal speichern' }}
        </button>
      </div>
      <p v-if="!hasActiveMetadata" class="metadata-empty">
        Keine der erfassten Features (Liquidität/Trade-Setups/TSC/Structure) ist gerade angetoggelt.
      </p>
      <JsonTree v-else :value="activeMetadataSnapshot" />
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
