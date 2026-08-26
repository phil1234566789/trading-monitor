<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, TickMarkType, CrosshairMode } from "lightweight-charts";
import { renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
import {
  firstCandleTouch,
  firstCandleTouchRange,
  obBoxTouchState,
  filterHistorical,
  currentPriceEstimate,
  collectObsZones,
  mergePinnedZones,
} from "../priceChartObZones.js";
import {
  matchTradeSetup,
  matchLiquidityLevel,
  matchOBZone,
  matchFibLevel,
  matchDivergence,
  findNearbyPinCandidates as findNearbyPinCandidatesPure,
  hasNearbyPinCandidate as hasNearbyPinCandidatePure,
} from "../priceChartHitTest.js";
import {
  detectLiquidityLevels,
  filterRelevantLevels,
  renderLiquidityLevels,
  LiquidityLinePrimitive,
  bullBearLabelSide,
  formatLsLabel,
  LIQUIDITY_FRACTAL_PERIOD,
  LIQUIDITY_MAX_RELEVANT,
} from "../liquidity.js";
import { mergePinnedLevels, computeHtfLiquidityLevels, mergeDbLiquidityLevels } from "../priceChartLiquidity.js";
import { sessions, isForbiddenAt } from "../sessions.js";
import { newsEvents } from "../newsEvents.js";
import { usePriceChartSessionsAndNews } from "../composables/usePriceChartSessionsAndNews.js";
import { detectSetupObs, detectTradeSetups, tradeSetupObBoxBounds } from "../tradeSetup.js";
import { renderPivotMarkers } from "../pivotMarkers";
import { computeRangesPivots, buildMarketStructureState, pivotForDisplay, summarizeMarketStructureState } from "../marketStructureAnalysis";
import { renderMarketStructureAnalysis, collectH1LqLevels, collectFibLevels } from "../marketStructureRendering";
import { DivergenceLinePrimitive } from "../rsiRendering.js";
import { usePriceChartRsi } from "../composables/usePriceChartRsi.js";
import { usePriceChartCockpit } from "../composables/usePriceChartCockpit.js";
import { chartColors, cssColor, cssColorScaled } from "../chartColors.js";
import { chartLineWidths, lineWidth } from "../chartLineWidths.js";
import { useTabScopedRef } from "../composables/useTabScopedRef.js";
import {
  RECENT_PAGE_SIZE,
  CLOSE_POLL_BUFFER_MS,
  FOREX_HISTORY_PAGE_SIZE,
  JUMP_TARGET_BUFFER_BARS,
  MAX_JUMP_FETCH_PAGES,
  INITIAL_CANDLE_COUNT,
  LAZY_LOAD_LOGICAL_THRESHOLD,
  TRADE_MARKER_BARS,
  TRADE_SETUP_M5_FRACTAL_PERIOD,
  TRADE_SETUP_M5_CANDLE_COUNT,
  TRADE_SETUP_GRACE_SEC,
  TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
  TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
  TRADE_SETUP_LS_MAX_DISTANCE_M5,
  TRADE_SETUP_OB_MAX_DELAY_SEC,
  TRADE_SETUP_LOOKBACK_SEC,
  TRADE_SETUP_OB_WIDTH_SEC,
  TRADE_SETUP_OB_FILL_RATIO,
  TRADE_SETUP_OB_BORDER_RATIO,
  TREND_ANALYSIS_CANDLE_COUNT,
  RANGES_CANDLE_BUFFER,
  COPIED_FEEDBACK_MS,
  DEBUG_AUTOSAVE_INTERVAL_MS,
  TARGET_TIER_WIDTH_RATIO,
  POLL_RETRY_DELAY_MS,
  POLL_MAX_RETRIES,
  REPLAY_FETCH_DEBOUNCE_MS,
  MAX_PLAUSIBLE_GAP_SEC,
} from "../priceChartConstants.js";
import { selectActiveMetadataSections, earliestRelevantTime, saveDebugMetadataSection } from "../debugMetadata.js";
import { useLastDataExport } from "../composables/useLastDataExport.js";
import { usePriceChartClaudeAnnotations } from "../composables/usePriceChartClaudeAnnotations.js";
import { renderTradeMarkers } from "../tradeMarkers.js";
import { barSecondsFor, REPLAY_LOOKAHEAD_SEC } from "../timeframes.js";
import {
  fetchInitialCandles as fetchInitialForexCandles,
  fetchRecentCandles as fetchRecentForexCandles,
  fetchOlderCandles as fetchOlderForexCandles,
} from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import {
  replayFetchToMs,
  businessSecondsBetween,
  mergeRecent,
  isTimeCovered,
  tradesVisibleForCandles,
  computeNextReplayTime,
} from "../chartTimeUtils.js";
import { loadCandlesAroundTrade, computeJumpViewport } from "../priceChartJumpToTime.js";
import { classifyAge } from "../ageTier";
import { kindLabel as targetKindLabel } from "../tradeTargets";
import { tradesVisible } from "../tradeVisibility.js";
import { kindLabel as confirmationKindLabel } from "../tradeConfirmations";
import { useStatusBar } from "../composables/useStatusBar.js";
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";
import MetadataPanel from "./MetadataPanel.vue";
import JsonTree from "./JsonTree.vue";
import RsiDivergenceStatsPanel from "./RsiDivergenceStatsPanel.vue";
import TradeSetupCockpit from "./TradeSetupCockpit.vue";

const props = defineProps({
  symbol: { type: String, required: true },
  currentBar: { type: String, required: true },
  trades: { type: Array, default: () => [] },
  // Hover-Hervorhebung (Chat 2026-08-01, Philips Wunsch für bessere Live-Kommunikation mit Lana):
  // trade_positions.id der gerade in TradesTable.vue ODER (seit Chat 2026-08-18) einer
  // PinPanel.vue-Zeile mit kind='trade_position' gehoverten Zeile, null wenn keine — siehe
  // renderTradeMarkers/tradeMarkers.js für die eigentliche Glow-Darstellung. Bewusst NUR eine Id
  // (kein ganzer Trade), analog zu selectedSetupId-artigen Props andernorts in diesem Repo.
  hoveredTradeId: { type: [String, Number], default: null },
  // Pin-Panel-Hover (Chat 2026-08-18, siehe PinPanel.vue: @mouseenter je Zeile) — zusätzlich zum
  // dauerhaften pinObZoneKeys/pinTradeSetupIds/…-Highlight EIN kurzzeitig hervorgehobenes Objekt,
  // damit Philip einer langen Pin-Liste die einzelnen Chart-Highlights zuordnen kann. Analog zu
  // hoveredTradeId, aber EIN Prop pro Pin-Art; kind='trade_position' läuft bewusst über das
  // bestehende hoveredTradeId statt eines eigenen Props (siehe Dashboard.vue: onPinHover).
  hoveredPinObZoneKey: { type: String, default: null },
  hoveredPinTradeSetupId: { type: [String, Number], default: null },
  hoveredPinTradeConfirmationId: { type: [String, Number], default: null },
  hoveredPinLiquidityLevelKey: { type: String, default: null },
  hoveredPinRsiDivergenceKey: { type: String, default: null },
  // Gepinnte Objekte, direkt aus ihren pin_context-Daten gebaut statt nur als Vergleichsschlüssel
  // gegen eine Live-Neuberechnung genutzt (Task "Pin-Kontext: gepinnte Objekte direkt rendern") —
  // ein Pin, dessen Zeitpunkt außerhalb des aktuell live erkannten Ergebnisses liegt, bekommt so
  // trotzdem ein Chart-Objekt zum Anheften (siehe mergePinnedZones/-Levels in refreshPoiZonesInternal/
  // refreshLiquidityInternal/refreshTradeSetupLinksInternal/refreshRsiDivergenceInternal).
  // touched===null (nur M5-ob_zones-Zeilen/m5_liquidity_level, reiner Snapshot ohne Live-Status,
  // siehe Dashboard.vue: pinnedObZones-Kommentar) wird anhand der geladenen Kerzen self-geheilt.
  pinnedObZones: { type: Array, default: () => [] },
  // Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7 — die von
  // poi-watcher persistierten 1H/4H-Zonen (src/obZones.js: fetchObZones, in Dashboard.vue gepollt),
  // ungefiltert über alle Instrumente, siehe filterDbObZones/collectObsZones unten für die
  // Instrument-/Replay-Filterung. Ersetzt dort den bisherigen Live-Recompute, der auf ein fest
  // begrenztes Kerzenfenster begrenzt war und ältere Zonen strukturell nie fand.
  dbObZones: { type: Array, default: () => [] },
  pinnedLiquidityLevels: { type: Array, default: () => [] },
  pinnedTradeSetups: { type: Array, default: () => [] },
  pinnedRsiDivergences: { type: Array, default: () => [] },
  // Pin-Kontext (Chat 2026-08-01, siehe pinContext.js) — Set von trade_positions.id,
  // die Philip per Rechtsklick dauerhaft "an Lana übergeben" hat, zeichnet einen permanenten
  // (nicht nur Hover-) Ring um deren Entry/Exit, siehe renderTradeMarkers/tradeMarkers.js.
  pinTradeIds: { type: Set, default: () => new Set() },
  // Pin-Kontext für OB-Zonen (Chat 2026-08-01) — Set von obZoneNaturalKey-Strings (siehe
  // orderBlocks.js), analog zu pinTradeIds oben, aber Natural-Key statt Id (Forex-OB-Boxen
  // haben keine eigene DB-id im live gezeichneten Zonen-Objekt, siehe collectObsZones).
  pinObZoneKeys: { type: Set, default: () => new Set() },
  // Pin-Kontext, dritte Art (Chat 2026-08-01, dritte Runde) — Set von trade_setups.id, siehe
  // refreshTradeSetupLinksInternal.
  pinTradeSetupIds: { type: Set, default: () => new Set() },
  // Pin-Kontext, vierte Art (Chat 2026-08-01, vierte Runde) — Set von trade_confirmations.id
  // (nur kind='ob'-Bestätigungen zeichnen überhaupt eine Box, siehe refreshTradeConfirmationLinksInternal).
  pinTradeConfirmationIds: { type: Set, default: () => new Set() },
  // Pin-Kontext für Liquiditäts-Level (Chat 2026-08-17) — Set von liquidityLevelNaturalKey-Strings
  // (siehe liquidity.js), analog zu pinObZoneKeys. Deckt kind='liquidity_level' (1H, echte DB-
  // Zeile) UND kind='m5_liquidity_level' (Nicht-1h-Snapshot) ab — Dashboard.vue mischt beide je
  // nach aktuellem Timeframe in dieselbe Menge, da hier immer nur EIN Timeframe sichtbar ist.
  pinLiquidityLevelKeys: { type: Set, default: () => new Set() },
  // Pin-Kontext für RSI-Divergenz-Konnektoren (Chat 2026-08-17) — Set von
  // "type|fromTime|toTime"-Strings (siehe rsi.js: rsiDivergenceEntryNaturalKey in pinContext.js),
  // siehe refreshRsiDivergenceInternal.
  pinRsiDivergenceKeys: { type: Set, default: () => new Set() },
  // Ein/Ausblenden der eigenen geloggten Trades (Chat 2026-07-27) — Untermenü-Toggle unter dem
  // übergeordneten "Trades"-Button (showTradeSetups); beide zusammen müssen an sein, damit Trades
  // gezeichnet werden (Bug-Report Philip 2026-07-28: "übergeordneter Trades-Toggle soll Trades
  // auch ausblenden, TSC ist einzige Ausnahme" — siehe refreshTradeMarkersInternal/
  // refreshTradeSetupLinksInternal/refreshTradeTargetLinksInternal).
  showTrades: { type: Boolean, default: true },
  // Ersetzt seit Chat 2026-07-30 den einzelnen showOrderBlocks-Schalter (Bug-Report Philip: "wenn
  // ich Indikatoren > OBs im M5 anhabe, werden mir ganz viele M5 OBs angezeigt" — showOrderBlocks
  // folgte bei Forex bisher IMMER dem gerade angezeigten Chart-Timeframe, nie mehrere gleichzeitig).
  // Jeder der drei Timeframes ist jetzt unabhängig an-/ausschaltbar, siehe refreshPoiZonesInternal.
  showObsM5: { type: Boolean, default: false },
  showObs1h: { type: Boolean, default: true },
  showObs4h: { type: Boolean, default: true },
  showHistoricalObs: { type: Boolean, default: false },
  showLiquidity: { type: Boolean, default: true },
  // Die von poi-watcher persistierten HTF-Level (1H+4H, siehe src/liquidityLevels.js:
  // fetchLiquidityLevelsHtf, in Dashboard.vue gepollt), unabhängig vom Chart-Timeframe. Seit
  // 2026-08-23 Teil von showLiquidity statt eigenem Toggle (kein zusätzlicher Klick nötig, siehe
  // computeHtfLiquidityLevels/refreshLiquidityInternal).
  dbLiquidityLevelsHtf: { type: Array, default: () => [] },
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
  // RSI(14)-Panel (Chat 2026-08-11) — anders als EMA (immer M5, siehe refreshEmaInternal) folgt
  // RSI bewusst dem gerade gewählten Chart-Timeframe (allCandles), wie ein klassisches
  // Oszillator-Panel unter dem Candlestick-Chart, siehe refreshRsiInternal.
  showRsi: { type: Boolean, default: false },
  // Divergenz-Konnektoren (Chat 2026-08-11, siehe rsi.js: detectRsiDivergence) — nur wirksam,
  // wenn showRsi auch an ist (siehe refreshRsiDivergenceInternal), da ohne RSI-Pane kein RSI-Bein
  // zum Zeichnen existiert.
  showRsiDivergence: { type: Boolean, default: false },
  // Zusätzlicher, unabhängiger Toggle für die komplette (nicht überlappende) Divergenz-Historie
  // statt nur der aktuell gültigen (Chat 2026-08-11, zweite Runde: "wie viel Aufwand wäre es
  // historische Divergenzen anzuzeigen") — siehe rsi.js: detectRsiDivergenceHistory. Läuft
  // zusätzlich zu showRsiDivergence, ersetzt es nicht.
  showRsiDivergenceHistory: { type: Boolean, default: false },
  rsiDivergenceHistoryCount: { type: Number, default: 5 },
  // Debug-Overlay für die Outcome-Klassifikation (Chat 2026-08-11, dritte Runde, Philip: "kannst du
  // debug mäßig die hits und misses im chart anzeigen") — zeichnet pro sichtbarer Divergenz die
  // Struktur-Marke (rsiDivergenceOutcome.js: classifyDivergenceOutcome), grün bis zum Bruch bei
  // "hit", rot bis zum Fensterende bei "miss". Bewusst EIGENER Toggle statt an showRsiDivergence/
  // -History gekoppelt — reine Debug-Ansicht, kein Feature für den Dauerbetrieb.
  showRsiDivergenceOutcomeDebug: { type: Boolean, default: false },
  // Statistik-Modal (Chat 2026-08-11, vierte Runde: "ich denke wir wären jetzt bereit für
  // statistik") — listet alle gerade im Chart sichtbaren Divergenzen (dieselbe Menge wie oben)
  // inkl. Outcome-Klassifikation in einer Tabelle, plus Aggregat-Werte. Löst dieselbe
  // classifyDivergenceOutcome-Berechnung wie showRsiDivergenceOutcomeDebug aus (siehe
  // refreshRsiDivergenceInternal: EINMAL berechnet, für beide Zwecke wiederverwendet).
  showRsiDivergenceStats: { type: Boolean, default: false },
  // Vertikale News-Marker auf dem Chart (Chat 2026-07-26: "ich würd die News gern visuell irgendwo
  // sehen") — die Event-Liste selbst kommt nicht als Prop, sondern direkt aus dem newsEvents.js-
  // Store (analog zu sessions/showSessions oben), nur die Sichtbarkeit ist ein Toggle.
  showNews: { type: Boolean, default: false },
  // Sessions-Indikator (Chat 2026-07-22) — Sichtbarkeit der Hintergrundbänder; die Session-Liste
  // selbst kommt nicht als Prop, sondern direkt aus dem sessions.js-Store (siehe deep watch unten,
  // analog zu chartColors: der Store ist die Quelle der Wahrheit, nicht Dashboard.vue).
  showSessions: { type: Boolean, default: true },
  // Replay-Modus (siehe Chat 2026-07-19): unix Sekunden, ab denen alles nach "Zeit X" ausgeblendet
  // wird — null = live (kein Clipping). Zum visuellen Prüfen des Ranges-Algos, ohne Zukunft zu
  // sehen, während er noch entsteht.
  replayUntil: { type: Number, default: null },
  // Trade-Setup-Cockpit (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
  // zusammenstöpseln") — bündelt H1-Range-Analyse + M5-Trade-Setups in einer Karte im Chart. Seit
  // Chat 2026-07-27 eine echte Vue-Komponente (TradeSetupCockpit.vue), fester Platz rechts/mittig —
  // der frühere "neben der letzten Kerze"-Modus ist entfallen (siehe tradeSetupCockpit.ts-Kopfkommentar).
  showTradeSetupCockpit: { type: Boolean, default: true },
  // Debug-Metadaten-Sammel-Panel (siehe Chat 2026-07-20: "damit ich dir nicht ständig die Daten
  // von dem was ich in TradingView sehe hier schreiben muss") — Toolbar-Unterpunkt bei "Debug".
  showDebugMetadata: { type: Boolean, default: false },
  // Claude-Antwort-Import (siehe claudeAnnotations.js) — Liste geparster Annotationen +
  // der Berlin-Kalendertag, gegen den ihre "HH:mm"-Zeitangaben aufgelöst werden (Dashboard.vue
  // leitet das aus dem Replay-Zeitpunkt ab, analog zu DataExportModal.vue).
  claudeAnnotations: { type: Array, default: () => [] },
  claudeAnnotationsDate: { type: String, default: null },
  // Trade-Modus (Chat 2026-07-27: "damit ich nicht versehentlich in den Chart reinklicke") — nur
  // wenn aktiv, wertet der Klick-Handler unten Klicks auf Trade-Setup-OB-Boxen aus. Sonst bleibt
  // ein Klick beim Pan/Zoom-Verhalten von lightweight-charts, wie bisher.
  tradeModeActive: { type: Boolean, default: false },
  // Ziel-Modus (Chat 2026-07-27: "einem Trade ein Target hinzufügen ... die Linien klickbar
  // machen") — nur innerhalb von tradeModeActive relevant, schaltet den Klick-Handler von
  // "Trade-Setup-OB anklicken" auf "Pivot/OB als Target anklicken" um (siehe Dashboard.vue: targetAddTrade).
  targetModeActive: { type: Boolean, default: false },
  // Bestätigungs-Modus (Chat 2026-07-30, siehe Dashboard.vue: confirmationAddTrade) — Teilmenge
  // von targetModeActive (beide setzen tradeModeActive), zusätzlich unterschieden, weil nur im
  // Bestätigungs-Modus auch Fib-Ticks anklickbar sein sollen (siehe findClickedFibLevel) — ein Fib
  // ist keine sinnvolle Preis-Erwartung wie ein normales Ziel.
  confirmationModeActive: { type: Boolean, default: false },
});
const emit = defineEmits([
  "close-ranges-metadata",
  "close-debug-metadata",
  "close-rsi-divergence-stats",
  "select-setup",
  "toggle-trade-mode",
  "select-target",
  "select-setup-confirmations",
  "pin-context-menu",
]);

const { markSuccess } = useStatusBar();
const { lastDataExport } = useLastDataExport();
const { refreshSessions, refreshNewsMarkers } = usePriceChartSessionsAndNews();
// EMA-/RSI-/Divergenz-Series-Lifecycle + Zeichenlogik (siehe usePriceChartRsi.js, Phase 6b) —
// priceChartRsi.create(chart, candleSeries) wird in onMounted aufgerufen, priceChartRsi.dispose()
// in onUnmounted.
const priceChartRsi = usePriceChartRsi();
// TSC-Zustandsberechnung (siehe usePriceChartCockpit.js, Phase 6c) — cockpitState/-Metadata/
// -NowSec werden direkt im Template gebunden (TradeSetupCockpit-Komponente), daher hier destructured
// statt hinter priceChartCockpit.* versteckt.
const { cockpitState, cockpitMetadata, cockpitNowSec, refreshCockpit } = usePriceChartCockpit();
// Claude-Notizen-Zeichnung + TSC-Zeiger-Callouts (siehe usePriceChartClaudeAnnotations.js,
// Phase 6d) — tscCardRef/claudeCallout*-Refs direkt im Template gebunden, daher destructured.
const {
  tscCardRef,
  claudeCalloutItems,
  claudeCalloutLines,
  claudeCalloutStackBottom,
  setCalloutChipEl,
  refresh: refreshClaudeAnnotations,
  create: createClaudeAnnotations,
  dispose: disposeClaudeAnnotations,
  startTick: startClaudeCalloutTick,
  stopTick: stopClaudeCalloutTick,
} = usePriceChartClaudeAnnotations();

const chartContainerRef = ref(null);
// Chart-Höhe (siehe Dashboard.vue: tradesPanelHeight, dieselbe Begründung) — useTabScopedRef statt
// useLocalStorageRef: pro Tab verstellbar, ein frischer Tab startet beim zuletzt benutzten Wert.
// Ein einziger Key (nicht pro Symbol) — Philip will EINE konsistente Höhe unabhängig vom Symbol-Tab.
const chartWrapperHeight = useTabScopedRef("chartWrapperHeight", 675);
// pivotForDisplay/summarizeMarketStructureState kommen seit Chat 2026-07-27 aus
// marketStructureAnalysis.ts (Daten-Export braucht dieselbe Aufbereitung, siehe
// dataExport.js) — hier nur noch der reaktive State drumherum.
const marketStructureState = ref(null);
const marketStructureTree = computed(() => summarizeMarketStructureState(marketStructureState.value));

// Copy-Button neben den Metadaten-Überschriften (siehe Chat 2026-07-19) — kopiert den jeweiligen
// Abschnitt als JSON, z.B. zum 1:1-Abgleich gegen die hand-hergeleiteten rangeStateN in
// gbp_h1_uptrend_LQ_sweep_long_setup.ts. copiedSection zeigt kurz "✓ kopiert" statt "Kopieren",
// bevor es sich nach COPIED_FEEDBACK_MS von selbst zurücksetzt.
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

// Für den "kopieren + lokal speichern"-Button im Debug-Metadaten-Panel — Clipboard-Copy UND
// Datei-Save (unter der "chart"-Sektion, siehe debugMetadata.js: saveDebugMetadataSection) zusammen,
// mit dem "✓ kopiert"-Feedback am Button (siehe copyJson).
async function copyJsonAndSaveLocally(section, value) {
  await copyJson(section, value);
  await saveDebugMetadataSection("chart", value);
}

// Auto-Save, nur im Dev-Server (import.meta.env.DEV, deckt sich mit "nur lokal" ohne Hostname-
// Sniffing — der Endpoint existiert im Production-Build ohnehin nicht) — damit .debug/metadata.json
// immer aktuell ist, ohne dass Philip vor jedem Bug-Report erst den Button klicken muss. 30s ist
// großzügig genug, um den PC nicht unnötig zu belasten (JSON bauen + lokaler POST sind billig).
let debugAutosaveTimer = null;
onMounted(() => {
  if (!import.meta.env.DEV) return;
  saveDebugMetadataSection("chart", activeMetadataSnapshot.value);
  debugAutosaveTimer = setInterval(() => {
    saveDebugMetadataSection("chart", activeMetadataSnapshot.value);
  }, DEBUG_AUTOSAVE_INTERVAL_MS);
});
onUnmounted(() => clearInterval(debugAutosaveTimer));

// lightweight-charts ist inhärent imperativ (Canvas-API) — Chart/Series/Primitives und ihr
// Zustand bleiben deshalb bewusst reine Closure-Variablen statt reaktiver refs. Sie steuern
// nie ein Template, nur Chart-Methodenaufrufe.
let chart;
let candleSeries;
let resizeObserver;
let orderBlockPrimitives = [];
let liquidityPrimitives = [];
// Aktuell gezeichnete Liquiditäts-Level (siehe refreshLiquidityInternal) — für den Zielmodus-
// Klick-Hittest (Chat 2026-07-27: "Können wir die Linien klickbar machen?") gebraucht, analog zu
// currentTradeSetups unten für die OB-Boxen.
let currentLiquidityLevels = [];
// Aktuell gezeichnete Fib-Level (Range-Fib + Protected-Fib, Haupt- + Nested-Trend, siehe
// collectFibLevels in marketStructureAnalysis.ts) — analog zu currentLiquidityLevels oben, für den
// Bestätigungs-Klick-Hittest (findClickedFibLevel), gefüllt in refreshMarketStructureInternal.
let currentFibLevels = [];
// Periode-5- UND Periode-2-Debug-Marker laufen seit Chat 2026-07-26 durch EIN gemeinsames
// renderPivotMarkers-Primitive (siehe refreshRangesMarkersInternal) statt zwei getrennte, damit
// deckungsgleiche Pivots aus beiden Perioden dieselbe Label-Entzerrung durchlaufen.
let rangesMarkerPrimitives = [];
let marketStructurePrimitives = [];
let tradePrimitives = [];
let pinContextMenuHandler = null; // Referenz für removeEventListener in onUnmounted, siehe dort
let pinCursorHandler = null; // dito
let tradeSetupLinkPrimitives = [];
let tradeTargetLinkPrimitives = [];
let tradeConfirmationLinkPrimitives = [];
let invalidationLinePrimitives = [];
// divergencePriceLinePrimitives (Preis-Bein der Divergenz-Konnektoren) lebt seit Phase 6b in
// priceChartRsi (usePriceChartRsi.js) — hier per priceChartRsi.divergencePriceLinePrimitives gelesen.
let tradeSetupPrimitives = [];
// claudeAnnotationPrimitives/-PriceLines leben seit Phase 6d in usePriceChartClaudeAnnotations.js.
let allCandles = [];
let tradeSetupM5Candles = [];
let currentTradeSetups = [];
// TSC-Fokus (Chat 2026-07-27: "TSC soll das anzeigen, was ich grad im Fokus hab") — überschreibt,
// solange gesetzt, computeCockpitState()'s Default ("das jüngste Live-Setup") mit genau EINEM
// bewusst ausgewählten Setup (Trade-Modus-Klick auf eine OB-Box, oder ein Trade aus der Liste mit
// verknüpftem trade_setups-Datensatz). null = normales Live-Verhalten. Siehe focusTradeSetup/
// clearTradeSetupFocus (defineExpose) und den watch auf props.tradeModeActive unten.
let focusedTradeSetup = null;
let trendAnalysisM5Candles = [];
let rangesH1Candles = [];
let rangesPivots = null; // roh (mit pivotTime), Periode 5 — siehe computeRangesPivotsFor/refreshRangesMarkersInternal
let rangesPivots2 = null; // roh (mit pivotTime), eingebettete Periode 2 (siehe Chat 2026-07-19)
// Out-of-Order-Guards für loadInitial/loadRangesCandles/loadTradeSetupM5, siehe dort.
// loadInitialFetchSeq wird zusätzlich von pollRecent() als Bar-Mismatch-Guard gelesen (Bug-Report
// Philip 2026-07-19: "1h -> M5 -> wieder 1h, Chart zeigt nur noch M5-Kerzen") — jeder echte Neu-Load
// zählt hoch, ein noch laufender Fetch von VOR dem Wechsel erkennt daran, dass er überholt ist.
let loadInitialFetchSeq = 0;
let rangesFetchSeq = 0;
let tradeSetupM5FetchSeq = 0;
let loadingOlder = false;
let reachedHistoryStart = false;
// Bug-Report Philip 2026-08-09: ein hängender Scroll-Back-Fetch (cTrader-Timeout) landet nur in der
// Konsole, der User sieht bloß leere Fläche links. showLoadOlderButton zeigt stattdessen einen
// expliziten Retry-Button, wenn die sichtbare Logical Range über den Datenanfang hinausragt UND
// wirklich noch mehr Historie zu holen wäre (siehe updateLoadOlderButtonVisibility).
const showLoadOlderButton = ref(false);
const loadOlderButtonBusy = ref(false);
// Bug-Report Philip 2026-08-23: weit auf 1H herauszoomen ließ die App einfrieren — das Archiv deckt
// nur GBPUSD/EURUSD ab 2026-01-01 ab, eine Kerze davor löst automatisch einen LIVE-cTrader-Fetch
// aus, und beim Herauszoomen feuert subscribeVisibleLogicalRangeChange wiederholt in kurzer Folge,
// was mehrere langsame Live-Fetches ungefragt aneinanderreiht. loadOlderCandlesNow versucht deshalb
// zuerst NUR das Archiv und zeigt bei einem Miss diesen Banner statt automatisch live nachzuladen.
// liveHistoryConfirmed bleibt an, bis Symbol/Timeframe wechselt (wie reachedHistoryStart).
const showLiveHistoryConfirm = ref(false);
const liveHistoryConfirmBusy = ref(false);
let liveHistoryConfirmed = false;
let pollTimer = null;
let tradeSetupM5PollTimer = null;
let rangesPollTimer = null;
// Für das RSI-Divergenz-Statistik-Panel (Chat 2026-08-11, vierte Runde) — { divergences (inkl.
// Outcome-Klassifikation), lookbackBars, lookforwardBars } oder null, wenn der Toggle aus ist
// bzw. gerade keine Divergenzen vorliegen. Befüllt in refreshRsiDivergenceInternal, analog zu
// rangesMetadata unten.
const rsiDivergenceStatsData = ref(null);
const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
// Dito für die eingebettete Periode-2-Erkennung — EIN gemeinsames Metadaten-Panel für beide
// Perioden reicht, daher kein zweiter showRangesMetadata2-Toggle.
const rangesMetadata2 = ref(null);
// Der erste H1-Fetch (loadRangesCandles) ist ein frischer cTrader-Connect+Auth-Handshake statt
// eines simplen DB-Reads, kann spürbar dauern und lief bisher komplett unsichtbar. rangesMetadata
// bleibt null bis zum ersten erfolgreichen Fetch, danach nie wieder — genau das späte
// "leer -> gefüllt" ist der Moment, der ohne Feedback wie ein Hänger wirkt.
const rangesLoading = computed(() => (props.showRanges || props.showRangesMetadata) && rangesMetadata.value === null);

// Fürs Debug-Metadaten-Sammel-Panel (buildActiveMetadataSnapshot unten) — dieselben Werte, die auch
// fürs Zeichnen berechnet werden, hier zusätzlich in Refs gespiegelt statt aus den Primitives
// zurückzulesen (die kennen nur Pixel-Koordinaten). poiZonesMetadata hat bewusst kein eigenes
// Toggle-Gate — POI-/OB-Zonen haben anders als Liquidität/Trade-Setups/Structure keinen eigenen
// An/Aus-Schalter, sie werden immer gezeichnet. liquidityEarliestTime/structureEarliestTime halten
// den frühesten ROHEN pivotTime nur für die Kerzen-Relevanz unten, tauchen nicht im JSON auf.
const poiZonesMetadata = ref(null);
const liquidityMetadata = ref(null);
const liquidityEarliestTime = ref(null);
const tradeSetupsMetadata = ref([]);
const structureEarliestTime = ref(null);

// TSC-Karte gerade sichtbar? (siehe TradeSetupCockpit.vue: v-if="state" innen — cockpitState wird
// von refreshCockpitInternal() bereits auf null gesetzt, wenn showTradeSetupCockpit aus ist, die
// Bedingung hier ist also strenggenommen redundant, aber explizit robuster gegen künftige
// Änderungen an refreshCockpitInternal.)
const tscCalloutModeActive = computed(() => props.showTradeSetupCockpit && cockpitState.value != null);

// Nur die Abschnitte der gerade angetoggelten Features — der kopierte JSON-Blob bleibt fokussiert
// auf das, was im Chart sichtbar ist, statt immer alles mitzuschleppen. orderBlocks bewusst
// ungated (siehe poiZonesMetadata oben). context (Symbol/TF/Replay) läuft IMMER mit, sonst lässt
// sich ein kopiertes OB nicht einordnen.
//
// candles: ab dem FRÜHESTEN Zeitpunkt, auf den irgendeine aktive Sektion verweist, bis zum
// aktuellen (bzw. Replay-)Kerzenende — ein Filter auf das ohnehin geladene allCandles-Fenster statt
// eines eigenen Fetches; liegt der Zeitpunkt vor der ältesten geladenen Kerze, fehlt der Anfang.
//
// Bewusst eine imperativ befüllte Ref statt eines computed() — allCandles ist KEIN reaktiver State,
// ein computed() würde also nie neu laufen, wenn sich NUR allCandles ändert. Deshalb explizit am
// Ende von refreshChart() sowie beim Öffnen des Panels aufgerufen.
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
  // Zuletzt generierter Daten-Export (siehe DataExportModal.vue/useLastDataExport.js,
  // Chat 2026-07-28: "für die Nachvollziehbarkeit wäre es im Frontend auch nicht schlecht") —
  // ungated, unabhängig vom Symbol/Timeframe des gerade offenen Charts, da der Export sein eigenes
  // Asset+Datum mitbringt. null, solange in dieser Session noch keiner generiert wurde.
  if (lastDataExport.value != null) {
    sections.dataExport = lastDataExport.value;
  }
  return sections;
}
const hasActiveMetadata = computed(
  () =>
    activeMetadataSnapshot.value.orderBlocks.length > 0 ||
    props.showLiquidity ||
    props.showTradeSetups ||
    props.showTradeSetupCockpit ||
    props.showRanges ||
    activeMetadataSnapshot.value.dataExport != null,
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

// Replay-Modus: alle Fetches (loadInitial/pollRecent/loadRangesCandles/loadTradeSetupM5/-H1)
// laufen unverändert weiter — geclippt wird ausschließlich hier, an jeder Stelle, wo Kerzen
// tatsächlich gerendert oder für eine Erkennung (Pivots/OBs/EMA/Setups) genutzt werden. So bleibt
// z.B. der Lazy-Load-Cursor (allCandles[0].time) unangetastet, und ein Verschieben von
// replayUntil braucht keinen Refetch, nur ein erneutes refreshChart().
function clipReplay(rows) {
  return props.replayUntil == null ? rows : rows.filter((r) => r.time <= props.replayUntil);
}

// Gegenstück zu clipReplay für die FETCH-Seite: ein fester count/Lookback endet sonst immer bei der
// echten aktuellen Zeit, unabhängig von replayUntil — bei einem weit zurückliegenden Replay-Zeitpunkt
// deckt das geladene Fenster den gewünschten Bereich dann nicht ab. loadRangesCandles/
// loadTradeSetupM5/-H1 übergeben das an fetchInitialForexCandles, damit der Fetch selbst schon bis
// replayUntil zurückreicht. bar: siehe replayFetchToMs (Bug-Report Philip 2026-07-21: "letzte Kerze
// nur 22:00 statt 23:00" — cTrader liefert die Kerze GENAU an replayUntil sonst strukturell nie mit).
function replayToMs(bar) {
  return replayFetchToMs(props.replayUntil, bar);
}

function refreshTradeMarkersInternal() {
  const visible = props.showTradeSetups && props.showTrades && TRADE_MARKER_BARS.has(props.currentBar);
  const candles = clipReplay(allCandles);
  const trades = visible ? tradesVisibleForCandles(props.trades, candles) : [];
  renderTradeMarkers(candleSeries, trades, tradePrimitives, candles, props.showLiquidityDebug, props.hoveredTradeId, props.pinTradeIds);
}

// Zeigt die M5-OB, mit der ein geloggter Trade verknüpft ist. Label "#<trade_setup_id>" matcht 1:1
// die "Setup"-Spalte in TradesTable.vue, damit sich Tabellenzeile und Chart-Box eindeutig zuordnen
// lassen. Bug-Report Philip 2026-07-28: "übergeordneter Trades-Toggle soll Trades auch ausblenden
// (TSC ist einzige Ausnahme)" — gekoppelt an BEIDE Toggles (showTradeSetups = der übergeordnete,
// showTrades = das Untermenü) statt nur an showTrades allein, wie ursprünglich am 07-27 gebaut.
function refreshTradeSetupLinksInternal() {
  for (const p of tradeSetupLinkPrimitives) candleSeries.detachPrimitive(p);
  tradeSetupLinkPrimitives.length = 0;
  if (!tradesVisible(props.showTradeSetups, props.showTrades)) return;
  const candles = clipReplay(allCandles);
  const drawnTradeSetupIds = new Set();
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    if (t.tradeSetupId == null || t.tradeSetupObStartTime == null || t.tradeSetupObTop == null || t.tradeSetupObBottom == null) continue;
    drawnTradeSetupIds.add(t.tradeSetupId);
    const top = t.tradeSetupObTop;
    const bottom = t.tradeSetupObBottom;
    const key = t.direction === "short" ? "tradeSetupShort" : "tradeSetupLong";
    // Pin-Kontext, dritte Art (Bug-Report Philip: Box "OB 1.15229#22" war bisher nie klickbar, weil
    // sie über einen eigenen Rendering-Pfad läuft statt über collectObsZones/orderBlockPrimitives).
    // tradeSetupId ist bereits die echte trade_setups.id — direction/instrument mitgegeben, damit
    // findNearbyPinCandidates ohne Zusatz-Fetch ein Label bauen kann.
    const inPinContext = props.pinTradeSetupIds?.has(t.tradeSetupId) ?? false;
    const isSelectedPin = props.hoveredPinTradeSetupId != null && props.hoveredPinTradeSetupId === t.tradeSetupId;
    const primitive = new OrderBlockPrimitive(
      // touched: true ist hier KEIN echter Touch-Status, sondern erzwingt (siehe orderBlocks.js:
      // ZonePaneView.update, Regression aus 7c2ea77), dass die feste, rein optische Box-Breite
      // (TRADE_SETUP_OB_WIDTH_SEC) tatsächlich respektiert wird, statt wie bei den Target-/
      // Bestätigungs-Boxen mangels touched-Flag bis zur letzten Kerze zu laufen — dieselbe
      // Regression, hier aber ohne echten Touch-Zustand zu tracken (der Box-Breite ist von Natur
      // aus fix, nicht "bis zum Touch").
      { top, bottom, startTime: t.tradeSetupObStartTime, endTime: t.tradeSetupObStartTime + TRADE_SETUP_OB_WIDTH_SEC, touched: true, tradeSetupId: t.tradeSetupId, direction: t.direction, instrument: t.instrument },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        borderWidth: lineWidth(key),
        textColor: "rgba(255, 255, 255, 0.9)",
        label: `#${t.tradeSetupId}`,
        inPinContext,
        pinColor: cssColor("pin"),
        isSelectedPin,
        hoverColor: cssColor("tradeHover"),
      },
      candles,
    );
    candleSeries.attachPrimitive(primitive);
    tradeSetupLinkPrimitives.push(primitive);
  }

  // Gepinnte Trade-Setups OHNE verknüpften (gerade sichtbaren) Trade (Task "Pin-Kontext: gepinnte
  // Objekte direkt rendern", Punkt 6) — diese Funktion loopte bisher NUR über
  // tradesVisibleForCandles, ein trade_setup-Pin ohne Trade (z.B. ein von Lana interessant
  // gefundenes, noch nicht ausgeführtes Setup) hatte dadurch gar keinen Rendering-Pfad.
  // drawnTradeSetupIds dedupliziert gegen die oben schon gezeichneten Setups, damit ein Setup, das
  // ZUSÄTZLICH gepinnt ist, keine doppelte Box bekommt.
  for (const setup of props.pinnedTradeSetups) {
    if (drawnTradeSetupIds.has(setup.tradeSetupId) || setup.instrument !== props.symbol) continue;
    const key = setup.direction === "short" ? "tradeSetupShort" : "tradeSetupLong";
    const isSelectedPin = props.hoveredPinTradeSetupId != null && props.hoveredPinTradeSetupId === setup.tradeSetupId;
    const primitive = new OrderBlockPrimitive(
      {
        top: setup.top,
        bottom: setup.bottom,
        startTime: setup.startTime,
        endTime: setup.startTime + TRADE_SETUP_OB_WIDTH_SEC,
        touched: true, // siehe Kommentar bei der ersten OrderBlockPrimitive-Stelle oben
        tradeSetupId: setup.tradeSetupId,
        direction: setup.direction,
        instrument: setup.instrument,
      },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        borderWidth: lineWidth(key),
        textColor: "rgba(255, 255, 255, 0.9)",
        label: `#${setup.tradeSetupId}`,
        inPinContext: true,
        pinColor: cssColor("pin"),
        isSelectedPin,
        hoverColor: cssColor("tradeHover"),
      },
      candles,
    );
    candleSeries.attachPrimitive(primitive);
    tradeSetupLinkPrimitives.push(primitive);
  }
}

// Zeichnet die Pivot-/OB-Targets eines Trades als Linie — Wiederverwendung LiquidityLinePrimitive
// für beide Target-Arten (auch OB, siehe findClickedOBZone: nur die nähere Kante wird übernommen).
// Bewusst UNABHÄNGIG von showLiquidity/showObsM5/-1h/-4h, aber wie refreshTradeSetupLinksInternal
// an showTradeSetups+showTrades gekoppelt.
//
// target.touchedTime wird NUR einmalig beim Hinzufügen des Targets gesetzt, nie mehr aktualisiert.
// Bug-Report Philip 2026-07-30 (OB 1.13737 #12): ein Target ohne touched_time zeichnete die Linie
// deshalb dauerhaft "bis jetzt" weiter, obwohl längst eine Kerze durchgelaufen war — deshalb hier
// zusätzlich selbst in den geladenen Kerzen nachschauen statt dem gespeicherten Stand blind zu
// vertrauen (self-healt automatisch bei jedem Render).

// obBoxTouchState/firstCandleTouch/firstCandleTouchRange brauchen den "gerade live erkannten
// Zonen"-Kontext (M5-Kerzen, dbObZones, Symbol/Replay, aktueller Preis) — dieselben Werte, die
// collectObsZones() für refreshPoiZonesInternal baut (siehe priceChartObZones.js), hier zusätzlich
// gebündelt für refreshTradeTargetLinksInternal/-TradeConfirmationLinksInternal.
function obZoneCtx() {
  return {
    m5Candles: clipReplay(tradeSetupM5Candles),
    dbObZones: props.dbObZones,
    symbol: props.symbol,
    replayUntil: props.replayUntil,
    price: currentPriceEstimate(allCandles),
  };
}

function refreshTradeTargetLinksInternal() {
  for (const p of tradeTargetLinkPrimitives) candleSeries.detachPrimitive(p);
  tradeTargetLinkPrimitives.length = 0;
  if (!tradesVisible(props.showTradeSetups, props.showTrades)) return;
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const precision = pricePrecisionForInstrument(props.symbol);
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    for (const target of t.targets ?? []) {
      if (target.sourceTime == null) continue;
      const label = `🎯 ${targetKindLabel(target.kind)} ${fmtPrice(target.price, precision)} #${target.id}`;
      // OB-Ziele als echte Box statt nur einer Linie an der näheren Kante (Bug-Report Philip
      // 2026-07-31: "es zeichnet sich weder Linie noch Box, nur das Label"). Alt-OB-Targets ohne
      // rangeLow/rangeHigh (vor Migration 20260731170000) fallen zurück auf die bisherige Linie.
      //
      // Box-Ende: siehe obBoxTouchState (priceChartObZones.js) für die Priorität touchedTime ->
      // liveObZoneState -> Selbstheilung -> "letzte geladene Kerze" (Bug-Report 2026-07-31/08-07).
      if (target.kind === "ob" && target.rangeLow != null && target.rangeHigh != null) {
        const { touched, endTime } = obBoxTouchState(target, candles, obZoneCtx());
        const primitive = new OrderBlockPrimitive(
          { top: target.rangeHigh, bottom: target.rangeLow, startTime: target.sourceTime, endTime, touched },
          {
            fillColor: cssColorScaled("tradeTarget", TRADE_SETUP_OB_FILL_RATIO),
            borderColor: cssColorScaled("tradeTarget", TRADE_SETUP_OB_BORDER_RATIO),
            borderWidth: lineWidth("tradeTarget"),
            textColor: "rgba(255, 255, 255, 0.9)",
            label,
          },
          candles,
        );
        candleSeries.attachPrimitive(primitive);
        tradeTargetLinkPrimitives.push(primitive);
        continue;
      }
      // Ein Pivot-Target mit liquidity_level_id (Task "1H-Struktur-Pivots auf kanonische
      // liquidity_levels-ID konsolidieren", 2026-08-24/25) wird NICHT mehr hier eigenständig
      // gezeichnet — dasselbe Level läuft bereits über renderLiquidityLevels (Dashboard.vue:
      // pinnedLiquidityLevels/pinLiquidityLevelKeys hängen es dort mit Pin-Halo ein), Philip:
      // "soll einfach das LQ-Chartobjekt selbst sein, nur gehighlighted" statt einer eigenen,
      // abweichenden Linie. Alt-Targets ohne liquidity_level_id (vor der Migration) fallen
      // weiterhin auf die bisherige Linie zurück.
      if (target.kind === "pivot" && target.liquidityLevel) continue;
      const touchedTime = target.touchedTime ?? firstCandleTouch(candles, target.sourceTime, target.price);
      const endTime = touchedTime ?? candles[candles.length - 1].time;
      const tier = classifyAge(businessSecondsBetween(target.sourceTime, touchedTime ?? nowSec));
      const primitive = new LiquidityLinePrimitive(
        { price: target.price, pivotTime: target.sourceTime, endTime },
        {
          color: cssColor("tradeTarget"),
          lineWidth: lineWidth("tradeTarget") * TARGET_TIER_WIDTH_RATIO[tier],
          // "🎯 Pivot #12"/"🎯 OB #12" — matcht 1:1 die Zeile in TradesTable/TradeEditModal (siehe
          // tradeTargets.ts: kindLabel), wie schon beim Setup-"#<id>"-Muster.
          label,
          // Bug-Report Philip 2026-07-28: bei Short-Trades soll das Label UNTER statt über der
          // Linie stehen (Long bleibt wie bisher) — analog zur Short/Long-Positionierung bei den
          // Trade-Setup-LS-/Fraktal-Linien weiter oben (renderTradeSetupsInternal).
          labelSide: t.direction === "short" ? "end-below" : "end-above",
        },
        candles,
      );
      candleSeries.attachPrimitive(primitive);
      tradeTargetLinkPrimitives.push(primitive);
    }
  }
}

// Zeichnet die Sweep-/OB-Bestätigungen eines Trades als Linie — strukturell identisch zu
// refreshTradeTargetLinksInternal, eigene Farbe (tradeConfirmation) + Label-Präfix, damit sich
// Bestätigung (bereits passiert) und Target (Erwartung) auf einen Blick unterscheiden lassen.
//
// Bewusste Lücke: loopt nur über tradesVisibleForCandles — ein trade_confirmation-Pin dessen Trade
// gerade nicht sichtbar ist, hat dadurch keinen Rendering-Pfad. Anders als bei trade_setup nicht
// gefixt: pinContext.js' trade_confirmations-Embed bringt kein instrument mit, ein Direkt-Render
// bräuchte erst eine Embed-Erweiterung — rechtfertigt den Aufwand (noch) nicht (seltener Fall).
function refreshTradeConfirmationLinksInternal() {
  for (const p of tradeConfirmationLinkPrimitives) candleSeries.detachPrimitive(p);
  tradeConfirmationLinkPrimitives.length = 0;
  if (!tradesVisible(props.showTradeSetups, props.showTrades)) return;
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const precision = pricePrecisionForInstrument(props.symbol);
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    for (const confirmation of t.confirmations ?? []) {
      if (confirmation.sourceTime == null) continue;
      const label = `✔ ${confirmationKindLabel(confirmation.kind)} ${fmtPrice(confirmation.price, precision)} #${confirmation.id}`;
      // RSI-Divergenz-Bestätigungen als echter Zwei-Bein-Konnektor (dieselbe DivergenceLinePrimitive
      // wie die live erkannten Divergenzen, siehe refreshRsiDivergenceInternal) statt nur einer
      // horizontalen Linie — sourceTime/touchedTime tragen bereits fromTime/toTime (siehe
      // findClickedDivergence), price/fromPrice die beiden Preis-Enden. Nur an candleSeries, kein
      // eigenes RSI-Bein hier (die Bestätigungs-Box soll auch ohne offene RSI-Pane sichtbar sein).
      if (confirmation.kind === "rsi_divergence" && confirmation.fromPrice != null) {
        const primitive = new DivergenceLinePrimitive(
          { time: confirmation.sourceTime, price: confirmation.fromPrice },
          { time: confirmation.touchedTime, price: confirmation.price },
          { color: cssColor("tradeConfirmation"), lineWidth: lineWidth("tradeConfirmation"), label },
          candles,
        );
        candleSeries.attachPrimitive(primitive);
        tradeConfirmationLinkPrimitives.push(primitive);
        continue;
      }
      // OB-Bestätigungen als echte Box statt nur einer Linie (siehe refreshTradeTargetLinksInternal
      // — dieselbe Begründung, dieselbe touchedTime-vor-liveObZoneState-Priorität).
      if (confirmation.kind === "ob" && confirmation.rangeLow != null && confirmation.rangeHigh != null) {
        const { touched, endTime } = obBoxTouchState(confirmation, candles, obZoneCtx());
        // Pin-Kontext, vierte Art (Chat 2026-08-01, vierte Runde — Bug-Report Philip: DIESE
        // Box, "✔ OB 1,15229 #22", wurde mit der Trade-Setup-Link-Box verwechselt, war bisher
        // komplett unverdrahtet). confirmationId ist bereits die echte trade_confirmations.id.
        const inPinContext = props.pinTradeConfirmationIds?.has(confirmation.id) ?? false;
        const isSelectedPin = props.hoveredPinTradeConfirmationId != null && props.hoveredPinTradeConfirmationId === confirmation.id;
        const primitive = new OrderBlockPrimitive(
          { top: confirmation.rangeHigh, bottom: confirmation.rangeLow, startTime: confirmation.sourceTime, endTime, touched, confirmationId: confirmation.id, instrument: t.instrument },
          {
            fillColor: cssColorScaled("tradeConfirmation", TRADE_SETUP_OB_FILL_RATIO),
            borderColor: cssColorScaled("tradeConfirmation", TRADE_SETUP_OB_BORDER_RATIO),
            borderWidth: lineWidth("tradeConfirmation"),
            textColor: "rgba(255, 255, 255, 0.9)",
            label,
            inPinContext,
            pinColor: cssColor("pin"),
            isSelectedPin,
            hoverColor: cssColor("tradeHover"),
          },
          candles,
        );
        candleSeries.attachPrimitive(primitive);
        tradeConfirmationLinkPrimitives.push(primitive);
        continue;
      }
      // Self-Heal wie bei Pivot-Targets (firstCandleTouch) — eine Bestätigung ohne touchedTime (z.B.
      // ein Fib, das per findClickedFibLevel IMMER touchedTime:null liefert) zog sich sonst dauerhaft
      // bis "jetzt" (Bug-Report Philip 2026-07-31). Eine Pivot-Bestätigung mit liquidity_level_id
      // läuft analog zu refreshTradeTargetLinksInternal über die native renderLiquidityLevels+
      // Pin-Halo-Anzeige, nicht mehr über eine eigene Linie hier.
      if (confirmation.kind === "pivot" && confirmation.liquidityLevel) continue;
      const touchedTime = confirmation.touchedTime ?? firstCandleTouch(candles, confirmation.sourceTime, confirmation.price);
      const endTime = touchedTime ?? candles[candles.length - 1].time;
      const tier = classifyAge(businessSecondsBetween(confirmation.sourceTime, touchedTime ?? nowSec));
      const primitive = new LiquidityLinePrimitive(
        { price: confirmation.price, pivotTime: confirmation.sourceTime, endTime },
        {
          color: cssColor("tradeConfirmation"),
          lineWidth: lineWidth("tradeConfirmation") * TARGET_TIER_WIDTH_RATIO[tier],
          label,
          labelSide: t.direction === "short" ? "end-below" : "end-above",
        },
        candles,
      );
      candleSeries.attachPrimitive(primitive);
      tradeConfirmationLinkPrimitives.push(primitive);
    }
  }
}

// Invalidierungs-Linie einer dealing_range — eine Linie vom ersten Entry bis zum letzten Exit ALLER
// trade_positions darunter. Bewusst NUR der Preis, keine eigene Touch-Logik: "ob die Idee gestorben
// ist" lässt sich direkt live gegen die Kerzen prüfen. Eine Zeile pro dealing_range (nicht pro
// Ausführung) — mehrere Positionen darunter teilen sich denselben invalidation-Wert.
function refreshInvalidationLinesInternal() {
  for (const p of invalidationLinePrimitives) candleSeries.detachPrimitive(p);
  invalidationLinePrimitives.length = 0;
  if (!tradesVisible(props.showTradeSetups, props.showTrades)) return;
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const precision = pricePrecisionForInstrument(props.symbol);

  const byRange = new Map();
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    // entryPrice == null heißt "nie tatsächlich gefüllt" (siehe tradeIntake.js:
    // createTradeFromSetup-Kommentar "es gibt ein setupEntry, aber kein entryPrice") — ohne
    // echten Entry gibt es auch keinen "ersten Entry", ab dem die Linie laut Konzept oben
    // beginnen soll. Ohne diesen Filter zählte so ein Trade trotzdem als "still open" (kein
    // exitTime) und ließ die Linie bis zur letzten geladenen Kerze wachsen — Bug-Report Philip
    // 2026-08-19: DR#40 (nie gefüllte Backtest-Idee vom 03.06., siehe Journal) zeichnete die
    // Invalidierung quer über Monate an live geladenen Kerzen "bis ins Unendliche".
    if (t.invalidation == null || t.entryPrice == null) continue;
    const exitOrNow = t.exitTime ?? nowSec;
    const group = byRange.get(t.dealingRangeId);
    if (!group) {
      byRange.set(t.dealingRangeId, {
        invalidation: t.invalidation,
        direction: t.direction,
        startTime: t.entryTime,
        endTime: exitOrNow,
        stillOpen: t.exitTime == null,
      });
    } else {
      group.startTime = Math.min(group.startTime, t.entryTime);
      group.endTime = Math.max(group.endTime, exitOrNow);
      if (t.exitTime == null) group.stillOpen = true;
    }
  }

  for (const group of byRange.values()) {
    // Noch offene Ausführung dabei -> bis zur zuletzt geladenen Kerze wachsend zeichnen, wie eine
    // noch nicht getouchte Target-/Bestätigungs-Linie (statt beim letzten BEKANNTEN Exit einzufrieren).
    const endTime = group.stillOpen ? candles[candles.length - 1].time : group.endTime;
    const primitive = new LiquidityLinePrimitive(
      { price: group.invalidation, pivotTime: group.startTime, endTime },
      {
        color: cssColor("tradeInvalidation"),
        lineWidth: lineWidth("tradeInvalidation"),
        label: `🚫 Invalidierung ${fmtPrice(group.invalidation, precision)}`,
        labelSide: group.direction === "short" ? "end-below" : "end-above",
      },
      candles,
    );
    candleSeries.attachPrimitive(primitive);
    invalidationLinePrimitives.push(primitive);
  }
}

// Dünner Wrapper um usePriceChartClaudeAnnotations' refresh() — baut die Argumente aus Props/
// allCandles/tscCalloutModeActive zusammen (siehe usePriceChartClaudeAnnotations.js für die
// eigentliche Zeichenlogik + volle Bug-Historie).
function refreshClaudeAnnotationsInternal() {
  refreshClaudeAnnotations({
    annotations: props.claudeAnnotations,
    annotationsDate: props.claudeAnnotationsDate,
    candles: clipReplay(allCandles),
    tscCalloutModeActive: tscCalloutModeActive.value,
  });
}

// ZonePaneView.update() (orderBlocks.js) ruft snapToBarTime(candles, z.startTime) auf — findet sich
// dort keine Kerze bei/vor z.startTime, wird auf die älteste geladene Kerze geklemmt, die Box
// startet also links am Kerzenrand statt am echten Ursprung. Bewusst kein Auto-Nachladen mehr dafür
// (2026-08-23 umgekehrt, nach demselben Problem bei Liquidity-Leveln — mehrere sequenzielle
// Nachlade-Requests widersprechen dem 4D-Prinzip): die Box korrigiert sich von selbst, sobald aus
// einem anderen Grund (normales Zurückscrollen) genug Kerzen geladen sind.
function refreshPoiZonesInternal() {
  const candles = clipReplay(allCandles);
  const zones = collectObsZones({
    showObs4h: props.showObs4h,
    showObs1h: props.showObs1h,
    showObsM5: props.showObsM5,
    ...obZoneCtx(),
  });
  const visibleZones = mergePinnedZones(filterHistorical(zones, props.showHistoricalObs), props.pinnedObZones, candles);
  renderPersistedZones(candleSeries, visibleZones, orderBlockPrimitives, candles, props.pinObZoneKeys, props.hoveredPinObZoneKey);
  poiZonesMetadata.value = visibleZones;
}

// Liquiditäts-Level (Fractal-Pivots, siehe tv-indikator/src/liquidity.pine) gibt es bisher nicht
// aus dem Backend — deshalb hier direkt aus den geladenen Kerzen des aktuellen Chart-Timeframes
// neu erkannt, analog zur OB-Erkennung oben.
// `showSweptLiquidity` zeigt ALLE erkannten M5-Pivots ungefiltert (kein filterRelevantLevels,
// keine maxRelevant-Deckelung) — auch längst berührte. Für die Trendanalyse-Diskussion mit
// Philip: er braucht wirklich jeden Pivot sichtbar, nicht nur die 10 neuesten je Richtung, die
// filterRelevantLevels selbst mit onlyRelevant=false noch abschneiden würde.

// Kein Auto-Nachladen mehr (siehe refreshPoiZonesInternal-Kommentar, Punkt 10 — dieselbe
// Entscheidung 2026-08-23 umgekehrt): eine relevante 1H-Zeile, deren pivotTime vor der geladenen
// Kerzenserie liegt, wird per snapToBarTime auf die älteste geladene Kerze geklemmt statt einen
// Nachlade-Request auszulösen. Korrigiert sich von selbst, sobald aus einem anderen Grund
// (normales Zurückscrollen) genug Kerzen geladen sind.
function refreshLiquidityInternal() {
  const candles = clipReplay(allCandles);
  if (!props.showLiquidity) {
    // Kein db1h hier (mehr) — die relevanten 1H-Level sind seit 2026-08-23 an showLiquidity
    // gekoppelt (s.o.), bei showLiquidity=false bleiben nur Pins sichtbar, wie vor Punkt 12/13.
    const pinnedOnly = mergePinnedLevels([], props.pinnedLiquidityLevels, candles);
    renderLiquidityLevels(candleSeries, pinnedOnly, liquidityPrimitives, candles, {
      pinKeys: props.pinLiquidityLevelKeys,
      hoveredKey: props.hoveredPinLiquidityLevelKey,
    });
    liquidityMetadata.value = null;
    liquidityEarliestTime.value = null;
    currentLiquidityLevels = [];
    return;
  }
  // timeframe = der gerade angezeigte Chart-Timeframe (Task "Chart-Objekte..." Nachbesserung
  // 2026-08-23: M5/1H/4H-Chart-Style-Kategorien, siehe liquidity.js: liquidityStyleTimeframe) —
  // live erkannte Level tragen sonst kein eigenes Timeframe-Feld wie die persistierten HTF-Level.
  const { highs: rawHighs, lows: rawLows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const highs = rawHighs.map((l) => ({ ...l, timeframe: props.currentBar }));
  const lows = rawLows.map((l) => ({ ...l, timeframe: props.currentBar }));
  const liveRelevant = props.showSweptLiquidity
    ? [...highs, ...lows]
    : [...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true), ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true)];
  const htfLevels = computeHtfLiquidityLevels(candles, props.dbLiquidityLevelsHtf, props.symbol, props.replayUntil, currentPriceEstimate(allCandles));
  const relevant = mergeDbLiquidityLevels(liveRelevant, htfLevels);
  currentLiquidityLevels = relevant;
  const precision = pricePrecisionForInstrument(props.symbol);
  const finalLevels = mergePinnedLevels(relevant, props.pinnedLiquidityLevels, candles);
  renderLiquidityLevels(candleSeries, finalLevels, liquidityPrimitives, candles, {
    debugPrices: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
    // "Alter"-Anzeige an den Debug-Preis-Labels (Chat 2026-07-22) — im Replay bezogen auf
    // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
    nowSec: props.replayUntil ?? Math.floor(Date.now() / 1000),
    pinKeys: props.pinLiquidityLevelKeys,
    hoveredKey: props.hoveredPinLiquidityLevelKey,
  });
  liquidityMetadata.value = relevant.map(pivotForDisplay);
  liquidityEarliestTime.value = relevant.length > 0 ? Math.min(...relevant.map((lvl) => lvl.pivotTime)) : null;
}

// Sessions/News-Marker-Zeichenlogik lebt seit Phase 6 des Große-Dateien-Refactorings in
// usePriceChartSessionsAndNews.js (siehe dort) — hier nur noch dünne Wrapper, die candleSeries/
// Kerzen/Props durchreichen, damit alle bestehenden Call-Sites (refreshChart(), watch(...) unten)
// unverändert bleiben.
function refreshSessionsInternal() {
  refreshSessions(candleSeries, clipReplay(allCandles), { showSessions: props.showSessions, currentBar: props.currentBar, symbol: props.symbol });
}

function refreshNewsMarkersInternal() {
  refreshNewsMarkers(candleSeries, clipReplay(allCandles), { showNews: props.showNews, symbol: props.symbol, replayUntil: props.replayUntil });
}

// H1-Fraktale im konfigurierten Lookback-Fenster — reine Pivot-Liste, noch keine weak/protected/
// sweep-Klassifizierung. Generalisiert auf (period, lookbackHours), damit dieselbe Logik für die
// Periode-5- UND die eingebettete Periode-2-Erkennung läuft. cutoff statt "alle erkannten Pivots",
// weil RANGES_CANDLE_BUFFER zusätzliche Kerzen VOR dem Lookback-Fenster lädt (siehe
// loadRangesCandles) — die dort erkannten Fraktale sollen nicht mitgezählt werden.
function computeRangesPivotsFor(period, lookbackHours) {
  // Im Replay-Modus zählt das Lookback-Fenster ab replayUntil, nicht ab der echten aktuellen Zeit.
  // rangesFixedStartActive ersetzt den ROLLIERENDEN Cutoff durch einen ABSOLUTEN — bleibt beim
  // Scrubben durch den Replay-Modus stabil; lookbackHours wird in dem Fall komplett ignoriert.
  const now = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const cutoff = props.rangesFixedStartActive && props.rangesFixedStartTime != null ? props.rangesFixedStartTime : now - lookbackHours * 3600;
  return computeRangesPivots(clipReplay(rangesH1Candles), period, cutoff, fmtDateTime);
}

// Punkt-Marker für die H1-Ranges-Pivots — nur sichtbar, wenn Ranges-Metadaten-Panel + Debug-Modus
// beide an sind. ALLE Pivots EINER Periode in EINER renderPivotMarkers-Gruppe (nicht eine Gruppe
// pro Pivot), damit sich ihre Preis-Labels gegenseitig entzerren statt bei eng beieinanderliegenden
// Pivots übereinander zu fallen (Bug-Report Philip 2026-07-19). Periode-5 und Periode-2 laufen im
// SELBEN renderPivotMarkers-Aufruf (vorher zwei getrennte Listen mit unabhängiger Entzerrung —
// Bug-Report: Labels bei deckungsgleichem Pivot leicht verschoben). Periode-2 bekommt kleineren
// dotRadius + eigene, transparentere Farbe (rangesMarker2), um beide Ebenen optisch zu trennen.
function refreshRangesMarkersInternal() {
  const candles = clipReplay(allCandles);
  const precision = pricePrecisionForInstrument(props.symbol);
  const showMarkers = props.showRanges && props.showLiquidityDebug;

  if (!showMarkers || (!rangesPivots && !rangesPivots2)) {
    renderPivotMarkers(candleSeries, [], rangesMarkerPrimitives, candles);
  } else {
    const groups = [
      ...(rangesPivots ? [{ points: rangesPivots, color: cssColor("rangesMarker") }] : []),
      ...(rangesPivots2 ? [{ points: rangesPivots2, color: cssColor("rangesMarker2"), dotRadius: 1.5 }] : []),
    ];
    renderPivotMarkers(candleSeries, groups, rangesMarkerPrimitives, candles, {
      showLabels: true,
      formatPrice: (price) => fmtPrice(price, precision),
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
  // Bug-Report Philip 2026-07-26: loadRangesCandles() läuft als EIGENER async Fetch neben
  // loadInitial() her — nur loadInitial() ruft refreshChart() auf (baut activeMetadataSnapshot neu).
  // Ohne diesen Aufruf hier bliebe der Snapshot auf altem Stand eingefroren, obwohl der Chart selbst
  // längst aktuell ist.
  if (chart) activeMetadataSnapshot.value = buildActiveMetadataSnapshot();
}

// Neuer "1h-Range"-Marktstruktur-Trendalgorithmus (siehe marketStructureAnalysis.ts,
// test/tdd_mit_claude.ts) — läuft über dieselben H1-Pivots wie die Debug-Punktmarker, unabhängig
// vom Debug-Toggle: das eigentliche Analyse-Ergebnis. Reine Weiterleitung an buildMarketStructureState
// (marketStructureAnalysis.ts) — die Merge-/Apply-Logik lebt dort, NICHT hier, damit Tests exakt
// denselben Code aufrufen wie die App. Nutzt rangesH1Candles (nicht allCandles) — andere Auflösung
// je nach gewähltem Chart-Timeframe.
function computeMarketStructureState() {
  return buildMarketStructureState(rangesPivots, rangesPivots2, props.rangesPeriod, props.ranges2Period, clipReplay(rangesH1Candles));
}

// Roter Pfeil+Linie an range.high, grüner an range.low, ggf. "1h protected low"-Linie +
// Trend-Label rechts/mittig (siehe Chat) — sichtbar, sobald showRanges an ist, unabhängig vom
// Debug-Toggle (im Gegensatz zu den rohen Punktmarkern oben).
function refreshMarketStructureInternal() {
  if (!chart) return; // async loadRangesCandles kann nach unmount noch abschließen, siehe onUnmounted
  const state = computeMarketStructureState();
  marketStructureState.value = state; // fürs Metadaten-Panel + TSC, unabhängig von showRanges (Zeichnen)
  currentFibLevels = collectFibLevels(state); // für den Bestätigungs-Klick-Hittest, siehe findClickedFibLevel
  const candles = clipReplay(allCandles);
  const precision = pricePrecisionForInstrument(props.symbol);
  renderMarketStructureAnalysis(candleSeries, props.showRanges ? state : null, marketStructurePrimitives, candles, {
    // "Alter"-Anzeige an der "1h LQ-Sweep"-Linie (Chat 2026-07-22) — im Replay bezogen auf
    // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
    nowSec: props.replayUntil ?? Math.floor(Date.now() / 1000),
    // Preis ist seit Chat 2026-07-28 fester Bestandteil des LQ-Sweep-Labels ("Major LS 1,13545 ..."
    // statt "1h LQ-Sweep ..."), nicht mehr debug-gated — siehe formatLsLabel (liquidity.js).
    formatPrice: (price) => fmtPrice(price, precision),
  });
  // computeTradeSetups() liest marketStructureState.value (siehe collectH1LqLevels, Chat
  // 2026-07-28) — muss also nach JEDEM Recompute hier neu laufen, nicht nur bei neuen M5-Kerzen
  // (siehe loadTradeSetupM5). Reine lokale Berechnung, kein Netzwerk-Call.
  computeTradeSetups();
  renderTradeSetupsInternal();
  // Sofort weiterreichen statt auf den nächsten refreshChart()/Poll zu warten (siehe Chat
  // 2026-07-19: "TSC scheint zu hängen, dauert ne Weile bis da was drin steht") — marketStructureState
  // ist eine der beiden TSC-Datenquellen (siehe refreshCockpitInternal), die andere ist
  // currentTradeSetups (siehe loadTradeSetupM5 und computeTradeSetups() oben).
  refreshCockpitInternal();
}

// TSC-Zustandsberechnung lebt seit Phase 6c des Große-Dateien-Refactorings in
// usePriceChartCockpit.js (siehe dort für die volle Begründung) — hier nur noch der
// chart-Lifecycle-Guard und das Zusammenstellen der aktuellen Werte. Fokus (falls gesetzt) statt
// der Live-Liste — computeCockpitState nimmt ohnehin nur das letzte Element als "aktuell
// relevantes" Setup, ein Ein-Element-Array reicht also, um sie umzulenken.
function refreshCockpitInternal() {
  if (!chart) return; // async loadTradeSetupM5/-H1 können nach unmount noch abschließen
  refreshCockpit({
    showTradeSetupCockpit: props.showTradeSetupCockpit,
    candles: clipReplay(allCandles),
    replayUntil: props.replayUntil,
    symbol: props.symbol,
    marketStructureState: marketStructureState.value,
    tradeSetupsForCockpit: focusedTradeSetup ? [focusedTradeSetup] : currentTradeSetups,
  });
}

// Eigener H1-Fetch fürs Ranges-Metadaten-Panel (und seit Chat 2026-07-28 auch für die H1-Level
// der Trade-Setup-Erkennung, siehe collectH1LqLevels) — lädt genug Historie für das GRÖSSERE der
// beiden Lookback-Fenster (Periode 5 + eingebettete
// Periode 2, siehe Chat 2026-07-19) + Erkennungspuffer. EIN Fetch für beide Perioden (nicht zwei
// separate cTrader-Connects) — computeRangesPivotsFor schneidet sich aus rangesH1Candles selbst
// den für die jeweilige Periode passenden, ggf. kürzeren Ausschnitt raus.
async function loadRangesCandles() {
  // rangesFetchSeq schützt gegen Out-of-Order-Antworten (siehe Chat 2026-07-20: "im Replay-Modus
  // hängt der Trend-Algorithmus" — schneller mehrfacher Replay-Step feuert mehrfach diesen fetch;
  // ohne Guard kann eine ÄLTERE, aber langsamere Antwort eine NEUERE überschreiben und der Chart
  // bleibt auf einem veralteten Replay-Stand hängen, bis zufällig wieder die richtige Antwort
  // zuletzt eintrifft). Jeder Aufruf zieht seine eigene Sequenznummer; nur die zuletzt GESTARTETE
  // gilt noch als aktuell, ältere Ergebnisse werden beim Eintreffen verworfen.
  const seq = ++rangesFetchSeq;
  try {
    // rangesFixedStartActive: genug Historie ab dem fixen Startzeitpunkt laden statt der
    // rollierenden lookbackHours (siehe cutoff in computeRangesPivotsFor). Math.ceil zwingend
    // (Bug-Report Philip 2026-07-21: "+1 Kerze hängt") — ein nicht-ganzzahliges `hours`/`count` lief
    // ungeprüft bis in den cTrader-Request und war vermutlich der Auslöser des Hängers.
    const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
    const hours =
      props.rangesFixedStartActive && props.rangesFixedStartTime != null
        ? Math.max(1, Math.ceil((nowSec - props.rangesFixedStartTime) / 3600))
        : Math.max(props.rangesLookbackHours, props.ranges2LookbackHours);
    const count = hours + RANGES_CANDLE_BUFFER;
    // Teilt sich den H1-Cache-Eintrag mit loadInitial (falls currentBar "1h" ist) — statt
    // unabhängig komplett neu zu fetchen, nur der fehlende/neue Teil.
    const candles = await fetchCandlesCached(fetchInitialForexCandles, props.symbol, "1h", count, replayToMs("1h"), REPLAY_LOOKAHEAD_SEC);
    if (seq !== rangesFetchSeq) return true; // inzwischen überholt, siehe oben — kein Fehler
    rangesH1Candles = candles;
    refreshRangesInternal();
    refreshPoiZonesInternal(); // 1H-OB-Toggle (Chat 2026-07-30) läuft auf denselben Kerzen mit
    return true;
  } catch (err) {
    console.error("Ranges-Kerzen fehlgeschlagen:", err);
    return false;
  }
}

// showRanges (Marker) und showRangesMetadata (JSON-Panel) sind getrennte Toggles, teilen sich aber
// dieselben H1-Kerzen/Pivots. showTradeSetupCockpit zählt ebenfalls mit — sonst würde
// marketStructureState beim Wegtoggeln von Ranges/Metadaten einfrieren statt weiterzulaufen.
// showTradeSetups ebenso: computeTradeSetups() liest marketStructureState.value für die H1-Level
// (collectH1LqLevels). showObs1h ebenso: der 1H-OB-Toggle nutzt dieselben Kerzen (collectObsZones).
// Laden läuft also, solange MINDESTENS einer der vier an ist.
function rangesNeedsData() {
  return props.showRanges || props.showRangesMetadata || props.showTradeSetupCockpit || props.showTradeSetups;
}
// An den H1-Kerzenschluss ausgerichtet statt festem Intervall (Chat 2026-07-20) — H1-Kerzen
// ändern sich nur stündlich, ein häufigerer Poll bringt nichts außer zusätzlichen Requests.
function scheduleNextRangesPoll() {
  clearTimeout(rangesPollTimer);
  const barMs = barSecondsFor("1h") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  rangesPollTimer = setTimeout(async () => {
    // Im Replay-Modus bringt der echte Kerzenschluss nichts (siehe pollRecent) — Timer läuft
    // trotzdem weiter, damit Live-Updates beim Verlassen des Replays automatisch wieder anspringen.
    // withPollRetries prüft replayUntil selbst vor jedem Versuch, siehe dort.
    await withPollRetries(loadRangesCandles);
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

// Erkennung läuft nur, wenn sich M5-Kerzen oder marketStructureState geändert haben (siehe
// loadTradeSetupM5/refreshMarketStructureInternal) — currentTradeSetups bleibt über Refreshs hinweg
// stehen, nur renderTradeSetupsInternal() (Positionierung) läuft bei jedem Refresh neu. Zeigt die
// letzten `tradeSetupHistoryCount` Setups JE Richtung, nicht nur das aktive.
function computeTradeSetups() {
  const m5Candles = clipReplay(tradeSetupM5Candles);
  if (m5Candles.length === 0) {
    currentTradeSetups = [];
    tradeSetupsMetadata.value = currentTradeSetups;
    return;
  }
  const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(m5Candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
  // H1-Level kommen seit Chat 2026-07-28 aus marketStructureState.structurePivots statt einer
  // eigenen H1-Fraktal-Erkennung (siehe Kommentar bei TRADE_SETUP_M5_CANDLE_COUNT oben) — kann
  // leer sein, solange marketStructureState.value noch nicht geladen ist (siehe
  // refreshMarketStructureInternal/rangesNeedsData); Path A/B finden dann übergangsweise nur
  // M5-basierte Setups, kein Absturz.
  const h1Highs = collectH1LqLevels(marketStructureState.value, 1);
  const h1Lows = collectH1LqLevels(marketStructureState.value, -1);
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
  // Setups, deren bestätigende M5-OB in einer "forbidden"-Session entstanden ist, direkt raus (z.B.
  // Asia/Spread Hour, siehe isForbiddenAt in sessions.js) statt nur als TSC-No-Go anzuzeigen.
  // obStartTime statt fractal.pivotTime, weil der OB der früheste plausible Entry-Zeitpunkt ist. VOR
  // takeLast gefiltert, sonst würde ein rausgefiltertes Setup einen History-Platz "verbrauchen".
  const symbolSessions = sessions.filter((s) => s.instrument === props.symbol);
  const tzOffsetMinutes = (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset();
  const notForbidden = (s) => !isForbiddenAt(symbolSessions, s.obStartTime, tzOffsetMinutes);
  // IMMER beide Richtungen berechnen (unabhängig von showTradeSetupsLong/-Short) — siehe Chat
  // 2026-07-19: "TSC soll den aktuellsten und wahren Stand anzeigen", auch wenn im Chart gerade
  // eine Richtung zur Übersicht ausgetoggelt ist. Die Long/Short-Toggles filtern erst beim
  // ZEICHNEN (renderTradeSetupsInternal), currentTradeSetups selbst (und damit die TSC-Karte,
  // siehe refreshCockpitInternal) bleibt immer vollständig.
  const shorts = takeLast(detectTradeSetups(1, m5Highs, h1Highs, m5Highs, setupObs, params, m5Candles).filter(notForbidden));
  const longs = takeLast(detectTradeSetups(-1, m5Lows, h1Lows, m5Lows, setupObs, params, m5Candles).filter(notForbidden));
  // setupNumber (1..n je Richtung, chronologisch): nur bei aktiver Historie gesetzt (n > 1) — sonst
  // gibt's nur eine Box je Richtung, keine Zuordnung nötig. Separates Feld statt in `label`
  // eingebacken (wie vorher "Short (2)"), weil sowohl die OB-Box (Chart) als auch die TSC-Karte
  // (tradeSetupCockpit.ts) die Nummer jetzt als "#x"-Suffix brauchen, aber an unterschiedlichen
  // Stellen im Text (Chat 2026-07-27: "damit ich die Nummer sofort zuordnen kann").
  currentTradeSetups = [
    ...shorts.map((s, i) => ({ ...s, label: "Short", setupNumber: n > 1 ? i + 1 : null })),
    ...longs.map((s, i) => ({ ...s, label: "Long", setupNumber: n > 1 ? i + 1 : null })),
  ];
  tradeSetupsMetadata.value = currentTradeSetups;
}

// Dünne Koordinaten-Wrapper um die reinen Match-Funktionen in priceChartHitTest.js (siehe dort für
// die eigentliche Hittest-Logik samt Bug-Report-Historie) — lösen param.point einmalig gegen
// chart/candleSeries auf und reichen Preis/Zeit bzw. die passende Koordinaten-Umrechnungsfunktion
// weiter.
function findClickedSetup(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const price = candleSeries.coordinateToPrice(param.point.y);
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (price == null || time == null) return null;
  return matchTradeSetup(currentTradeSetups, price, time, {
    replayUntil: props.replayUntil,
    showTradeSetupsShort: props.showTradeSetupsShort,
    showTradeSetupsLong: props.showTradeSetupsLong,
    obWidthSec: TRADE_SETUP_OB_WIDTH_SEC,
  });
}

function findClickedLiquidityLevel(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (time == null) return null;
  return matchLiquidityLevel(currentLiquidityLevels, time, param.point.y, (price) => candleSeries.priceToCoordinate(price));
}

function findClickedOBZone(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const price = candleSeries.coordinateToPrice(param.point.y);
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (price == null || time == null) return null;
  return matchOBZone(poiZonesMetadata.value, price, time, props.symbol);
}

function findClickedFibLevel(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const timeScale = chart.timeScale();
  return matchFibLevel(
    currentFibLevels,
    param.point.x,
    param.point.y,
    (time) => timeScale.timeToCoordinate(time),
    (price) => candleSeries.priceToCoordinate(price),
  );
}

function findClickedDivergence(param) {
  if (!param.point) return null;
  return matchDivergence(priceChartRsi.divergencePriceLinePrimitives, param.point.x, param.point.y);
}

// Vereinigt beide Ziel-Modus-Klick-Flächen (Chat 2026-07-28) — Linie zuerst (präziser, kleinere
// Toleranz = eindeutigerer Treffer), Box als Fallback. Liefert ein Objekt im TradeTarget-Rohformat
// (siehe tradeTargets.ts), das direkt an addTargetToTrade durchgereicht werden kann.
function findClickedTarget(param) {
  const lvl = findClickedLiquidityLevel(param);
  if (lvl) return { kind: "pivot", price: lvl.price, sourceTime: lvl.pivotTime, touchedTime: lvl.touchedTime };
  return findClickedOBZone(param);
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
  if (!props.showTradeSetups) return;
  const candles = clipReplay(allCandles);
  // Preis-Labels an Fraktal-/LS-Linie, nur bei aktivem Debug-Toggle (Chat 2026-07-26: "ich tu mir
  // schwer beim debuggen ... bitte die Preiszahlen hinschreiben") — dasselbe Muster wie die
  // allgemeinen Liquiditäts-Level (siehe refreshLiquidityInternal: debugPrices/formatPrice).
  const precision = pricePrecisionForInstrument(props.symbol);
  const formatPrice = (price) => fmtPrice(price, precision);
  // Für formatLsLabel (Tier-Präfix + Alter am LS-Label, Chat 2026-07-28) — dieselbe Referenzzeit
  // wie refreshMarketStructureInternal, damit LS-Linie und "1h LQ-Sweep"-Linie bei identischem
  // Pivot exakt denselben Label-Text zeigen (siehe collectH1LqLevels: oft derselbe Pivot).
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);

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
      {
        color: cssColor("tradeSetupProtected"),
        lineWidth: lineWidth("tradeSetupProtected"),
        // Bei Path B ist fractal === ls (identischer Pivot, siehe pathType in tradeSetup.js) — die
        // Linie liegt exakt auf der LS-Linie darunter, ein eigenes Preislabel hier wäre nur eine
        // zweite Kopie desselben Preises an derselben Stelle (Bug-Report Philip 2026-07-27: "Label
        // des LQ-Sweeps ist immer noch doppelt"). Nur bei Path A anzeigen, wo fractal ein eigener,
        // vom LS verschiedener Pivot ist.
        // "PP "-Präfix + Positionierung wie bei der LS-Linie (Chat 2026-07-27: "genauso behandeln
        // wie die LS") — selbe end-above/end-below-Logik + Präfix-Zahlformat.
        label: props.showLiquidityDebug && setup.pathType !== "B" ? `PP ${formatPrice(setup.fractal.price)}` : null,
        labelSide: bullBearLabelSide(setup.dir === 1),
      },
      candles,
    );
    const lsLine = new LiquidityLinePrimitive(
      setup.ls,
      {
        color: lsColor,
        lineWidth: lineWidth(key),
        // "LS "-Präfix (Chat 2026-07-27: "extra Label vor den Preis, 1.3306 -> LS 1.3306") — sonst
        // bei Path A nicht von der protected-Fraktal-Linie darüber unterscheidbar, beide zeigen
        // sonst nur eine nackte Zahl. Seit Chat 2026-07-28 zusätzlich Tier-Präfix + Alter
        // (formatLsLabel, liquidity.js) — identisches Format wie die "1h LQ-Sweep"-Linie in
        // marketStructureAnalysis.ts, damit beide beim Überlappen (oft derselbe Pivot, siehe
        // collectH1LqLevels) lesbar bleiben statt zwei leicht unterschiedliche Strings übereinander.
        label: props.showLiquidityDebug ? formatLsLabel(formatPrice(setup.ls.price), setup.ls.pivotTime, nowSec) : null,
        // "end-above"/"end-below" statt Default "start" (Chat 2026-07-27: "muss ständig sau weit
        // nach links scrollen") — der M5-LQ-Sweep-Pivot liegt oft weit links vom aktuellen
        // Kerzenrand, das Preislabel soll trotzdem am rechten (aktuellen) Ende der Linie stehen.
        // Über/unter statt AUF der Linie — Short oben, Long unten, rein zur visuellen
        // Unterscheidung.
        labelSide: bullBearLabelSide(setup.dir === 1),
      },
      candles,
    );
    // Nummer-Suffix (Chat 2026-07-27: "damit ich die Nummer sofort zuordnen kann", siehe
    // computeTradeSetups) — nur gesetzt, wenn Trade-Setups-Historie aktiv ist (mehrere Boxen je
    // Richtung gleichzeitig sichtbar), sonst überflüssig.
    const numberSuffix = setup.setupNumber != null ? ` #${setup.setupNumber}` : "";
    // "Long"/"Short" + Pfad-Kürzel + Nummer als erste Zeile (A = eigenes bestätigtes Protected-Pivot,
    // B = fractal===ls, siehe pathType in tradeSetup.js). Danach je eine Zeile Oberkante/Unterkante
    // der OB, NUR im Debug-Modus, untereinander statt mit "/" getrennt (Bug-Report Philip: "dann weiß
    // ich, dass die obere Zahl für die Oberkante ist"). NUR hier angehängt, NICHT in setup.label —
    // die TSC-Karte baut ihren eigenen "Typ A/B #x"-Text separat aus pathType/setupNumber.
    const obLabelLines = [`${setup.label} ${setup.pathType}${numberSuffix}`];
    if (props.showLiquidityDebug) obLabelLines.push(formatPrice(top), formatPrice(bottom));
    const obBox = new OrderBlockPrimitive(
      // touched: true erzwingt die feste Box-Breite, siehe Kommentar bei refreshTradeSetupLinksInternal.
      { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC, touched: true },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        borderWidth: lineWidth(key),
        textColor: "rgba(255, 255, 255, 0.9)",
        // ZoneRenderer (orderBlocks.js) unterstützt mehrzeilige Labels per "\n" (seit diesem Chat) —
        // vorher war das immer genau eine Zeile.
        label: obLabelLines.join("\n"),
      },
      candles,
    );

    for (const primitive of [fractalLine, lsLine, obBox]) {
      candleSeries.attachPrimitive(primitive);
      tradeSetupPrimitives.push(primitive);
    }
  }
}

// EMA-/RSI-/Divergenz-Zeichenlogik lebt seit Phase 6b des Große-Dateien-Refactorings in
// usePriceChartRsi.js (siehe dort, inkl. der EMA/RSI-Series-Anlage aus onMounted und den
// Style-Watcher-Zeilen weiter unten) — hier nur noch dünne Wrapper, damit alle bestehenden
// Call-Sites (refreshChart(), watch(...) unten) unverändert bleiben.
function refreshEmaInternal() {
  priceChartRsi.refreshEma(clipReplay(trendAnalysisM5Candles), { showEma: props.showEma, currentBar: props.currentBar });
}

function refreshRsiInternal() {
  priceChartRsi.refreshRsi(clipReplay(allCandles), props.showRsi);
}

function refreshRsiDivergenceInternal() {
  priceChartRsi.refreshDivergence(clipReplay(allCandles), props.symbol, props, rsiDivergenceStatsData);
}

// TREND_ANALYSIS_CANDLE_COUNT (2000) liegt über dem Edge-Function-Limit pro Request (1000,
// siehe forexCandles.js) -> seitenweise rückwärts nachladen, analog zu fetchAllSince im
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

// M5-Kerzen für die Trade-Setup-Erkennung — unabhängig vom aktuell gewählten Chart-Timeframe
// (props.currentBar), da ein Setup immer auf M5-Fraktal + M5-OB basiert, egal ob der Nutzer
// gerade den 1h- oder den 15m-Chart anschaut. Bis Chat 2026-07-28 gab es hier zusätzlich einen
// eigenen H1-Poll (loadTradeSetupH1/scheduleNextTradeSetupH1Poll) für eine eigene H1-Fraktal-
// Erkennung — ersetzt durch collectH1LqLevels() auf marketStructureState.structurePivots (siehe
// computeTradeSetups/refreshMarketStructureInternal), das läuft am rangesH1Candles-Poll mit, kein
// eigener H1-Fetch für Trade-Setups mehr nötig.
async function loadTradeSetupM5() {
  const seq = ++tradeSetupM5FetchSeq; // Out-of-Order-Guard, siehe loadRangesCandles
  try {
    const toMs = replayToMs("5m");
    // Holt bei aktivem EMA-Toggle zusätzlich die größere M5-Historie für die EMA-Berechnung
    // (siehe TREND_ANALYSIS_CANDLE_COUNT) — nur dann, um unnötige cTrader-Connects zu vermeiden.
    // Hängt hier dran (nicht an einem dritten eigenen Poller), weil EMA ohnehin M5-Kerzen braucht
    // und dieser Poll schon läuft — inhaltlich hat EMA nichts mit Trade-Setups zu tun, siehe Chat.
    const fetches = [
      fetchCandlesCached(fetchInitialForexCandles, props.symbol, "5m", TRADE_SETUP_M5_CANDLE_COUNT, toMs, REPLAY_LOOKAHEAD_SEC),
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
    if (seq !== tradeSetupM5FetchSeq) return true; // inzwischen überholt — kein Fehler
    tradeSetupM5Candles = m5;
    if (trendM5) trendAnalysisM5Candles = trendM5;
    computeTradeSetups();
    renderTradeSetupsInternal();
    refreshEmaInternal();
    refreshCockpitInternal(); // sofort weiterreichen statt auf den nächsten refreshChart() zu warten
    refreshPoiZonesInternal(); // M5-OB-Toggle (Chat 2026-07-30) läuft auf denselben Kerzen mit
    return true;
  } catch (err) {
    console.error("Trade-Setup-M5-Kerzen fehlgeschlagen:", err);
    return false;
  }
}

// Prüft, ob die aktuell sichtbare Logical Range über den geladenen Datenanfang hinausragt
// (from < 0 => links vom ältesten Balken ist auf der X-Achse gerade nichts zu sehen) UND ob dort
// tatsächlich noch mehr Historie zu holen wäre — sonst würde der Retry-Button auch am echten Anfang
// der Historie (reachedHistoryStart) dauerhaft angezeigt, wo ein erneuter Fetch nur wieder 0 Kerzen
// zurückgäbe. range optional, damit sowohl der Scroll-Handler (hat es schon) als auch
// loadOlderCandlesNow()/loadInitial() (müssten es sonst extra abfragen) denselben Check nutzen können.
function updateLoadOlderButtonVisibility(range) {
  const r = range ?? chart?.timeScale().getVisibleLogicalRange();
  // showLiveHistoryConfirm hat Vorrang (gleiche Bildschirmposition, siehe Template) — sonst
  // würden beide Banner um denselben Platz konkurrieren, sobald der Archiv-Miss erkannt ist.
  showLoadOlderButton.value = !!r && r.from < 0 && !reachedHistoryStart && !showLiveHistoryConfirm.value;
}

// Gemeinsame Fetch-Logik für den beiläufigen Scroll-Back-Trigger (subscribeVisibleLogicalRangeChange
// oben) UND den manuellen Retry-Button (siehe showLoadOlderButton) — Bug-Report Philip 2026-08-09:
// bei einem cTrader-Timeout blieb das Nachladen unauffällig hängen, bis der User zufällig noch mal
// scrollte und den Handler erneut auslöste. Der Button ruft exakt dieselbe Funktion auf, damit sich
// beide Wege nicht unterscheiden (gleicher loadingOlder-Zustand, gleiche reachedHistoryStart-Logik).
async function loadOlderCandlesNow() {
  if (!chart || loadingOlder || allCandles.length === 0) return;
  if (reachedHistoryStart) return;
  if (showLiveHistoryConfirm.value) return; // wartet auf confirmLoadLiveHistory/den Banner-Button

  loadingOlder = true;
  try {
    const older = await fetchOlderForexCandles(props.symbol, props.currentBar, allCandles[0].time, FOREX_HISTORY_PAGE_SIZE, {
      allowLive: liveHistoryConfirmed,
    });
    if (older === null) {
      // Archiv erschöpft (vor 2026-01-01) UND noch nicht bestätigt — Banner zeigen statt
      // automatisch live nachzuladen (siehe showLiveHistoryConfirm-Kommentar oben).
      showLiveHistoryConfirm.value = true;
      return;
    }
    if (older.length === 0) reachedHistoryStart = true;
    else allCandles = older.concat(allCandles);
    refreshChart();
    updateLoadOlderButtonVisibility();
  } catch (err) {
    console.error("Ältere Daten laden fehlgeschlagen:", err);
  } finally {
    loadingOlder = false;
  }
}

async function retryLoadOlderCandles() {
  if (loadingOlder) return;
  loadOlderButtonBusy.value = true;
  try {
    await loadOlderCandlesNow();
  } finally {
    loadOlderButtonBusy.value = false;
  }
}

// Banner-Bestätigung (siehe showLiveHistoryConfirm oben) — liveHistoryConfirmed bleibt für den
// Rest dieser Symbol-/Timeframe-Sitzung an, damit nicht jede weitere Seite jenseits des Archivs
// erneut nachfragt.
async function confirmLoadLiveHistory() {
  liveHistoryConfirmed = true;
  showLiveHistoryConfirm.value = false;
  liveHistoryConfirmBusy.value = true;
  try {
    await loadOlderCandlesNow();
  } finally {
    liveHistoryConfirmBusy.value = false;
  }
}

function scheduleNextTradeSetupM5Poll() {
  clearTimeout(tradeSetupM5PollTimer);
  const barMs = barSecondsFor("5m") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  tradeSetupM5PollTimer = setTimeout(async () => {
    // Siehe scheduleNextRangesPoll — im Replay bringt der echte Kerzenschluss nichts.
    await withPollRetries(loadTradeSetupM5);
    if (chart) scheduleNextTradeSetupM5Poll(); // Komponente könnte während des awaits unmounted worden sein
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
  refreshSessionsInternal();
  refreshNewsMarkersInternal();
  refreshTradeMarkersInternal();
  refreshTradeSetupLinksInternal();
  refreshTradeTargetLinksInternal();
  refreshTradeConfirmationLinksInternal();
  refreshInvalidationLinesInternal();
  refreshClaudeAnnotationsInternal();
  renderTradeSetupsInternal();
  refreshRangesMarkersInternal();
  refreshMarketStructureInternal(); // ruft refreshCockpitInternal() selbst mit auf, siehe dort
  refreshEmaInternal();
  refreshRsiInternal();
  refreshRsiDivergenceInternal();
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
    // Fester count (INITIAL_CANDLE_COUNT) reicht "bis jetzt" gerechnet nicht bei jedem Timeframe
    // gleich weit zurück (1000 M5-Kerzen ~3,5 Tage, 1000 H1-Kerzen ~41 Tage) — ohne replayToMs()
    // würde ein TF-Wechsel während eines weit zurückliegenden Replays (z.B. 1h -> M5) einen leeren
    // Kerzenbereich laden, der nach clipReplay komplett verschwindet (siehe Chat 2026-07-19: "1h
    // auf M5 gewechselt und sehe keinen Chart").
    const toMs = replayToMs(props.currentBar);
    const candles = await fetchCandlesCached(
      fetchInitialForexCandles,
      props.symbol,
      props.currentBar,
      INITIAL_CANDLE_COUNT,
      toMs,
      REPLAY_LOOKAHEAD_SEC,
    );
    if (seq !== loadInitialFetchSeq) return; // inzwischen überholt, siehe oben
    allCandles = candles;
    reachedHistoryStart = false;
    liveHistoryConfirmed = false; // neues Symbol/Timeframe/Replay-Sprung -> erneut nachfragen, siehe showLiveHistoryConfirm
    showLiveHistoryConfirm.value = false;
    showLoadOlderButton.value = false; // frischer Datensatz, Sichtbarkeit racet sonst mit dem nächsten Scroll-Event
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

// Rückgabewert (true/false) treibt den Kurz-Retry in scheduleNextPoll unten — bis 2026-08-07
// wurde jeder Fehler hier nur geloggt, der nächste Versuch lief dann erst beim NÄCHSTEN
// Kerzenschluss (bei M5 also bis zu 5min später). Bug-Report Philip: "M5 Candle um 13:00 noch
// nicht da" 1-2min nach dem eigentlichen Schluss — ein einzelner fehlgeschlagener Poll (z.B. durch
// die cTrader-Latenz-Ausreißer, siehe _shared/ctrader/client.ts) ließ den Chart dadurch bis zu
// eine ganze Kerze lang auf altem Stand hängen, statt es zeitnah nochmal zu versuchen.
async function pollRecent() {
  // Im Replay-Modus bringt ein Update auf die echte "jetzt"-Kerze nichts (wird von clipReplay()
  // ohnehin weggefiltert) — kostet aber trotzdem einen Twelve-Data-Request im Hintergrund, egal ob
  // gerade "+1 Kerze" geklickt wird oder nicht (Bug-Report Philip 2026-07-23: 429 beim Replay-
  // Klicken). Timer läuft trotzdem weiter (siehe scheduleNextPoll) — Live-Updates springen beim
  // Verlassen des Replays automatisch wieder an, ohne dass hier extra gestartet/gestoppt werden muss.
  if (props.replayUntil != null) return true;
  // Bar-Mismatch-Guard (Bug-Report Philip 2026-07-19: "1h -> M5 -> wieder 1h, Chart zeigt nur noch
  // M5-Kerzen"): läuft der Poll-Timer kurz vor einem TF-Wechsel an, kommt die Antwort ggf. erst
  // NACH dem Wechsel zurück und würde sonst Kerzen des ALTEN Timeframes einmischen. loadInitialFetchSeq
  // zählt bei jedem echten Neu-Laden von allCandles hoch — eine Antwort für einen inzwischen
  // überholten Stand wird verworfen.
  const seq = loadInitialFetchSeq;
  try {
    const recent = await fetchRecentForexCandles(props.symbol, props.currentBar, RECENT_PAGE_SIZE);
    if (seq !== loadInitialFetchSeq) return true; // inzwischen überholt, siehe oben — kein Fehler, einfach nichts zu tun
    allCandles = mergeRecent(allCandles, recent);
    refreshChart();
    markSuccess();
    return true;
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generischer Kurz-Retry für die Forex-Poller (pollRecent/loadRangesCandles/loadTradeSetupM5) —
// ein Fehlschlag wurde sonst nur geloggt, der nächste Versuch lief erst beim NÄCHSTEN
// Kerzenschluss. Bug-Report Philip 2026-08-07: cTraders Demo-Server hatte eine mehrminütige
// Verbindungs-Flaute, 8 Retries/~2min decken das ab, ohne unbegrenzt weiterzuhämmern — danach
// übernimmt wieder der reguläre Poll. Bricht sofort ab bei Unmount/Replay-Wechsel.
async function withPollRetries(loadFn) {
  for (let attempt = 0; attempt <= POLL_MAX_RETRIES; attempt++) {
    if (!chart || props.replayUntil != null) return;
    if (await loadFn()) return;
    if (attempt < POLL_MAX_RETRIES) await sleep(POLL_RETRY_DELAY_MS);
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
    await withPollRetries(pollRecent);
    if (chart) scheduleNextPoll(); // Komponente könnte während des awaits unmounted worden sein
  }, delay);
}

onMounted(() => {
  chart = createChart(chartContainerRef.value, {
    layout: {
      background: { color: "#131722" },
      textColor: "#d1d4dc",
    },
    // Chat 2026-07-25: "brauch ich nicht bitte weg damit" — Raster (Stundenlinien X-Achse,
    // Preislinien Y-Achse) komplett aus, war rein optisch und wurde als störend empfunden.
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter,
      // Bug-Report Philip 2026-07-27: "die neueste Kerze wird nach ganz rechts auf die Y-Achse
      // hingemacht, ich muss jedesmal den Chart etwas verschieben" — Default (0) lässt die letzte
      // Kerze exakt an der Preisskala kleben. Ein paar Bar-Breiten Leerraum rechts, gleichzeitig
      // ungefähr der Bereich, in dem die TSC-Karte sitzt (siehe TradeSetupCockpit.vue), damit sie
      // nicht direkt über den jüngsten Kerzen hängt.
      rightOffset: 70,
    },
    localization: {
      timeFormatter: crosshairTimeFormatter,
    },
    // Bug-Report Philip 2026-08-07: Magnet-Crosshair (Default) snappt den Mauszeiger auf die
    // nächste Kerze statt der tatsächlichen Cursor-Position zu folgen — wollte er nicht.
    crosshair: {
      mode: CrosshairMode.Normal,
    },
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: cssColor("candleUp"),
    downColor: cssColor("candleDown"),
    borderVisible: false,
    wickUpColor: cssColor("candleUp"),
    wickDownColor: cssColor("candleDown"),
    // Forex-Kurse (GBPUSD z.B. 1.33941) brauchen 5 Nachkommastellen (Pipette) — der Default
    // (precision 2 / minMove 0.01) würde sie auf 1.34 gerundet fast nutzlos machen.
    priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
  });

  // EMA-Serien + RSI-Panel-Lifecycle leben in usePriceChartRsi.js (Phase 6b) — legt hier die
  // EMA-Serien an (RSI-Series+Pane erst bei Bedarf, siehe refreshRsiInternal/priceChartRsi.refreshRsi).
  priceChartRsi.create(chart, candleSeries);
  createClaudeAnnotations(chart, candleSeries);

  chart.subscribeClick((param) => {
    if (!param.point || !props.tradeModeActive) return;
    // Ziel-Modus (Chat 2026-07-27/28): Klick auf ein Pivot (Linie) oder eine OB-Zone (Box) -> ans
    // Dashboard durchreichen, das den Preis als Target zum gerade "scharfen" Trade hinzufügt.
    // Eigener Modus statt einfach zusätzlich zum Setup-Klick zu testen, damit ein Klick nie
    // mehrdeutig ist (Setup-OB-Box vs. Ziel-Pivot/-OB könnten sich sonst überlappen).
    if (props.targetModeActive) {
      // Fib-Tick NUR im Bestätigungs-Modus prüfen (siehe confirmationModeActive-Kommentar oben) —
      // zuerst, weil er eine feinere Toleranz hat und sonst evtl. von einer überlappenden
      // Liquiditäts-Linie verdeckt würde.
      const fib = props.confirmationModeActive && findClickedFibLevel(param);
      if (fib) {
        emit("select-target", fib);
        return;
      }
      // RSI-Divergenz NUR im Bestätigungs-Modus (siehe findClickedDivergence), vor findClickedTarget
      // geprüft — sonst würde ein Klick auf den Divergenz-Konnektor evtl. stattdessen eine darunter
      // liegende Liquiditäts-Linie/OB-Zone treffen.
      const divergence = props.confirmationModeActive && findClickedDivergence(param);
      if (divergence) {
        emit("select-target", divergence);
        return;
      }
      // Ganzes Trade-Setup (LS+OB, evtl. PP) anklicken -> alle Teile auf einmal als Bestätigungen
      // übernehmen (Chat 2026-07-31: "ich kann leider kein Short-Setup anklicken ... LS und OB
      // sollen als Bestätigung aufgenommen werden, PP als Stop-Loss") — NUR im Bestätigungs-Modus,
      // nicht im reinen Ziel-Modus (ein ganzes Setup als "Target" ergibt keinen Sinn, ein Ziel ist
      // ein einzelner Preis). Vor findClickedTarget geprüft, weil die Setup-OB-Box i.d.R. dieselbe
      // Fläche wie eine generische OB-Zone überdeckt — sonst würde nie das Setup, nur das einzelne
      // Near-Edge-Target treffen.
      const setup = props.confirmationModeActive && findClickedSetup(param);
      if (setup) {
        emit("select-setup-confirmations", setup);
        return;
      }
      const target = findClickedTarget(param);
      if (target) emit("select-target", target);
      return;
    }
    // Trade-Modus (Chat 2026-07-27): Klick auf eine Trade-Setup-OB-Box -> sofort im TSC fokussieren
    // (unmittelbares Feedback, noch bevor irgendein Formular offen ist) und ans Dashboard
    // durchreichen, das das Übernahme-Formular öffnet.
    const setup = findClickedSetup(param);
    if (setup) {
      focusedTradeSetup = setup;
      refreshCockpitInternal();
      emit("select-setup", setup);
    }
  });

  // Kandidaten-Aufbau/Dedupe + der Boolean-Check leben in priceChartHitTest.js (samt Bug-Historie
  // als Kommentar + Testfälle, siehe test/priceChartHitTest.test.js) — hier nur noch das Bündeln
  // der aktuellen Primitive-Arrays, die PriceChart.vue selbst führt.
  function pinPrimitivesBag() {
    return {
      tradePrimitives,
      orderBlockPrimitives,
      liquidityPrimitives,
      tradeSetupLinkPrimitives,
      tradeConfirmationLinkPrimitives,
      divergencePrimitives: priceChartRsi.divergencePriceLinePrimitives,
    };
  }
  function findNearbyPinCandidates(x, y) {
    return findNearbyPinCandidatesPure(x, y, pinPrimitivesBag(), { symbol: props.symbol, currentBar: props.currentBar });
  }
  function hasNearbyPinCandidate(x, y) {
    return hasNearbyPinCandidatePure(x, y, pinPrimitivesBag());
  }

  // Rechtsklick -> Pin-Kontextmenü. lightweight-charts hat kein natives Rechtsklick-Event, daher ein
  // normaler DOM-Listener. Koordinaten-Umrechnung exakt wie in claudeCalloutTick (chartContainerRef
  // per getBoundingClientRect() als lokaler Ursprung, derselbe Pixel-Raum wie *Primitive.distanceTo).
  // preventDefault() NUR bei mindestens einem Treffer, sonst bleibt das native Browser-Menü an.
  pinContextMenuHandler = (event) => {
    const rect = chartContainerRef.value.getBoundingClientRect();
    const candidates = findNearbyPinCandidates(event.clientX - rect.left, event.clientY - rect.top);
    if (candidates.length === 0) return;
    event.preventDefault();
    emit("pin-context-menu", { candidates, x: event.clientX, y: event.clientY });
  };
  chartContainerRef.value?.addEventListener("contextmenu", pinContextMenuHandler);

  // Cursor-Feedback (Trade-Modus UND Pin) — EIN einziger roher mousemove-Listener statt zwei
  // getrennter. Bug-Report Philip 2026-08-01 "Cursor bleibt immer normal": chart.subscribeCrosshairMove
  // feuerte als zweiter, unabhängiger Listener bei JEDER Mausbewegung und überschrieb den gerade per
  // Pin-Hittest gesetzten Cursor jedes Frame wieder. EIN Listener, EINE Entscheidung pro Bewegung
  // behebt das strukturell — findClickedSetup/-FibLevel/-Target lesen nur param.point, ein
  // synthetisches { point: { x, y } } reicht ihnen also.
  pinCursorHandler = (event) => {
    if (!chartContainerRef.value) return;
    const rect = chartContainerRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (props.tradeModeActive) {
      const point = { point: { x, y } };
      const hit = props.targetModeActive
        ? (props.confirmationModeActive && (findClickedFibLevel(point) || findClickedDivergence(point) || findClickedSetup(point))) ||
          findClickedTarget(point)
        : findClickedSetup(point);
      chartContainerRef.value.style.cursor = hit ? "pointer" : "";
      return;
    }
    chartContainerRef.value.style.cursor = hasNearbyPinCandidate(x, y) ? "context-menu" : "";
  };
  chartContainerRef.value?.addEventListener("mousemove", pinCursorHandler);

  resizeObserver = new ResizeObserver((entries) => {
    if (!chart) return; // Resize-Callback kann nach chart.remove() noch nachfeuern
    const { width, height } = entries[0].contentRect;
    // Bug-Report Philip 2026-07-27: "Preisskala verschwindet regelmäßig beim Verschieben/Ziehen des
    // Browserfensters" — contentRect liefert Sub-Pixel-Floats, lightweight-charts' Preisskala-
    // Layout kollabiert bei bestimmten Zwischenwerten dauerhaft auf 0 Breite. Gerundet auf ganze
    // CSS-Pixel vermeidet das. width/height 0 (Fenster momentan nicht gerendert) ist derselbe
    // Kollaps-Fall, nur anders ausgelöst — resize(0, ...) wird deshalb nicht angewendet.
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    if (roundedWidth <= 0 || roundedHeight <= 0) return;
    chart.resize(roundedWidth, roundedHeight);
    // .chart-container ist flex:1 in .chart-wrapper und dessen einziges layoutrelevantes Kind
    // (alle Geschwister — TSC/Metadaten-Panels — sind position:absolute/fixed) — die
    // beobachtete Höhe entspricht also praktisch exakt der Höhe von .chart-wrapper. Chat
    // 2026-07-30: natives CSS `resize` auf .chart-wrapper (siehe Template/Style unten) mutiert
    // dessen Höhe direkt im DOM: dieser ohnehin schon vorhandene Observer ist der einfachste Weg,
    // das Ergebnis eines Resize-Drags nach localStorage zurückzuschreiben, ohne einen zweiten,
    // eigenen ResizeObserver nur dafür zu brauchen.
    chartWrapperHeight.value = roundedHeight;
  });
  resizeObserver.observe(chartContainerRef.value);

  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!chart || !range || allCandles.length === 0) return;
    updateLoadOlderButtonVisibility(range);
    if (loadingOlder) return;
    if (range.from > LAZY_LOAD_LOGICAL_THRESHOLD) return;
    if (reachedHistoryStart) return;
    loadOlderCandlesNow();
  });

  loadInitial();
  scheduleNextPoll();
  // Bug-Report Philip 2026-08-07 ("signal timed out" ständig): loadInitial() plus loadTradeSetupM5()/
  // startRangesPolling() lösten jede für sich eine EIGENE cTrader-Verbindung im selben Tick aus —
  // mehrere gleichzeitige Handshakes waren der plausibelste Grund für die Timeouts. Fetches laufen
  // unverändert alle sofort los, aber forexCandles.js bündelt sie jetzt zu EINEM Batch-Request.
  loadTradeSetupM5();
  scheduleNextTradeSetupM5Poll();
  if (rangesNeedsData()) startRangesPolling();
  // getCtx liefert dem rAF-Tick (usePriceChartClaudeAnnotations.js) pro Frame frisch, was NICHT über
  // createClaudeAnnotations() gesetzt werden kann (chartContainerRef/allCandles/Props ändern sich
  // laufend, chart/candleSeries dagegen sind für die Lebensdauer der Component fix).
  startClaudeCalloutTick(() => ({
    wrapperEl: chartContainerRef.value,
    candles: clipReplay(allCandles),
    annotations: props.claudeAnnotations,
    annotationsDate: props.claudeAnnotationsDate,
    tscCalloutModeActive: tscCalloutModeActive.value,
    tscCardEl: tscCardRef.value?.$el?.nodeType === 1 ? tscCardRef.value.$el : null,
  }));
});

onUnmounted(() => {
  stopClaudeCalloutTick();
  disposeClaudeAnnotations();
  // scheduleNextPoll/-TradeSetupM5Poll/-RangesPoll nutzen setTimeout statt setInterval
  // (Kerzenschluss-Ausrichtung, siehe dort) -> clearTimeout statt clearInterval.
  clearTimeout(pollTimer);
  clearTimeout(tradeSetupM5PollTimer);
  clearTimeout(rangesPollTimer);
  clearTimeout(replayFetchDebounceTimer);
  resizeObserver?.disconnect();
  if (pinContextMenuHandler) chartContainerRef.value?.removeEventListener("contextmenu", pinContextMenuHandler);
  if (pinCursorHandler) chartContainerRef.value?.removeEventListener("mousemove", pinCursorHandler);
  chart?.remove();
  // Nullen, damit noch laufende Async-Loads (loadInitial/pollRecent) beim Abschluss
  // per Guard erkennen, dass der Chart schon disposed ist, statt lightweight-charts'
  // "Object is disposed" auszulösen.
  chart = null;
  candleSeries = null;
  priceChartRsi.dispose();
});

watch(() => props.currentBar, () => {
  loadInitial();
  scheduleNextPoll(); // neuer Timeframe -> neue Kerzenschluss-Taktung, siehe dort
});
watch([() => props.trades, () => props.showTrades], () => {
  refreshTradeMarkersInternal();
  refreshTradeSetupLinksInternal();
  refreshTradeTargetLinksInternal();
  refreshTradeConfirmationLinksInternal();
  refreshInvalidationLinesInternal();
});
// Eigener, schlanker Watch statt im obigen Trades-Watch mitzulaufen — Hover feuert pro
// Mausbewegung, soll aber NUR die Marker neu zeichnen, nicht auch noch Setup-/Target-/
// Confirmation-Links und Invalidation-Linien jedes Mal mit neu berechnen.
watch(() => props.hoveredTradeId, refreshTradeMarkersInternal);
watch(() => props.pinTradeIds, refreshTradeMarkersInternal);
watch(() => props.pinObZoneKeys, refreshPoiZonesInternal);
watch(() => props.pinTradeSetupIds, refreshTradeSetupLinksInternal);
watch(() => props.pinTradeConfirmationIds, refreshTradeConfirmationLinksInternal);
watch(() => props.pinLiquidityLevelKeys, refreshLiquidityInternal);
watch(() => props.pinRsiDivergenceKeys, refreshRsiDivergenceInternal);
// Pin-Panel-Hover (Chat 2026-08-18) — dieselben Refresh-Funktionen wie die dauerhaften pin*Keys/
// pin*Ids-Watches oben, nur für die zusätzliche Auswahl-Hervorhebung.
watch(() => props.hoveredPinObZoneKey, refreshPoiZonesInternal);
watch(() => props.hoveredPinTradeSetupId, refreshTradeSetupLinksInternal);
watch(() => props.hoveredPinTradeConfirmationId, refreshTradeConfirmationLinksInternal);
watch(() => props.hoveredPinLiquidityLevelKey, refreshLiquidityInternal);
watch(() => props.hoveredPinRsiDivergenceKey, refreshRsiDivergenceInternal);
// Direkt-Rendering gepinnter Objekte (Chat 2026-08-18, Task "Pin-Kontext: gepinnte Objekte direkt
// rendern") — dieselben Refresh-Funktionen wie die zugehörigen pin*Keys/hoveredPin*-Watches oben.
watch(() => props.pinnedObZones, refreshPoiZonesInternal);
watch(() => props.pinnedLiquidityLevels, refreshLiquidityInternal);
watch(() => props.pinnedTradeSetups, refreshTradeSetupLinksInternal);
watch(() => props.pinnedRsiDivergences, refreshRsiDivergenceInternal);
watch(() => props.claudeAnnotations, refreshClaudeAnnotationsInternal);
// tscCalloutModeActive wechselt (TSC wird ein-/ausgeblendet, Locked-Zustand etc.) -> Canvas-Text
// muss sofort erscheinen/verschwinden, nicht erst beim nächsten claudeAnnotations-Wechsel.
watch(tscCalloutModeActive, refreshClaudeAnnotationsInternal);
// M5/1H/4H unabhängig an-/ausschaltbar (Chat 2026-07-30) — siehe collectObsZones. Seit Punkt 7 der
// ob_zones-Konsolidierung (2026-08-22) kommen 1H/4H per DB-Read (dbObZones-Prop, in Dashboard.vue
// gepollt), brauchen also keine eigene Poll-Pipeline/Kerzen-Abhängigkeit mehr — nur M5 läuft weiter
// live auf tradeSetupM5Candles, das ohnehin immer geladen ist. Alle drei Toggles daher einheitlich
// nur ein Neuzeichnen.
watch(() => props.showObs1h, refreshPoiZonesInternal);
watch(() => props.showObs4h, refreshPoiZonesInternal);
watch(() => props.showObsM5, refreshPoiZonesInternal);
watch(() => props.dbObZones, refreshPoiZonesInternal);
watch(() => props.showHistoricalObs, refreshPoiZonesInternal);
watch(() => props.showLiquidity, refreshLiquidityInternal);
watch(() => props.dbLiquidityLevelsHtf, refreshLiquidityInternal);
watch(() => props.showSweptLiquidity, refreshLiquidityInternal);
watch(() => props.showLiquidityDebug, () => {
  refreshLiquidityInternal();
  refreshRangesMarkersInternal();
  renderTradeSetupsInternal();
  refreshTradeMarkersInternal();
});
watch(() => props.showTradeSetups, () => {
  // showTradeSetups zählt seit Chat 2026-07-28 mit in rangesNeedsData() (computeTradeSetups()
  // braucht marketStructureState.value für die H1-Level, siehe collectH1LqLevels) -> Polling-
  // Zustand neu bewerten, genau wie beim showTradeSetupCockpit-Watcher unten.
  refreshRangesPollingState();
  renderTradeSetupsInternal();
  refreshTradeMarkersInternal();
  refreshTradeSetupLinksInternal();
  refreshTradeTargetLinksInternal();
  refreshTradeConfirmationLinksInternal();
  refreshInvalidationLinesInternal();
});
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

// TSC-Fokus endet, sobald der Trade-Modus verlassen wird (Chat 2026-07-27, Philips Wahl unter den
// möglichen Optionen) — ein per Listen-Klick gesetzter Fokus (siehe focusTradeSetup unten) bleibt
// davon unberührt, der hängt nicht am Trade-Modus.
watch(
  () => props.tradeModeActive,
  (active) => {
    if (!active) {
      if (focusedTradeSetup) {
        focusedTradeSetup = null;
        refreshCockpitInternal();
      }
      if (chartContainerRef.value) chartContainerRef.value.style.cursor = "";
    }
  },
);
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
// RSI braucht keinen Nachlade-Zweig wie EMA oben — läuft auf allCandles, das für den Chart selbst
// ohnehin immer schon geladen ist.
watch(() => props.showRsi, () => {
  refreshRsiInternal();
  refreshRsiDivergenceInternal(); // showRsi aus -> rsiSeries verschwindet, Divergenz-Linien müssen mit
});
watch(() => props.showRsiDivergence, refreshRsiDivergenceInternal);
watch(() => props.showRsiDivergenceHistory, refreshRsiDivergenceInternal);
watch(() => props.rsiDivergenceHistoryCount, refreshRsiDivergenceInternal);
watch(() => props.showRsiDivergenceOutcomeDebug, refreshRsiDivergenceInternal);
watch(() => props.showRsiDivergenceStats, refreshRsiDivergenceInternal);
// showSessions (Toggle) UND der sessions-Store selbst (Hinzufügen/Editieren/Löschen in
// SessionsModal.vue, deep weil Label/Zeiten/Farbe direkt auf den reactive-Objekten mutiert werden,
// kein splice/push) sollen beide sofort neu zeichnen, nicht erst beim nächsten refreshChart()-Zyklus.
watch(() => props.showSessions, refreshSessionsInternal);
watch(sessions, refreshSessionsInternal, { deep: true });
// showNews (Toggle) UND der newsEvents-Store selbst (async-Fetch beim Modul-Laden, siehe
// newsEvents.js) sollen beide sofort neu zeichnen, nicht erst beim nächsten refreshChart()-Zyklus —
// sonst blieben die Marker leer, falls der Fetch erst NACH dem ersten refreshChart() ankommt.
watch(() => props.showNews, refreshNewsMarkersInternal);
watch(newsEvents, refreshNewsMarkersInternal, { deep: true });
watch(() => props.showTradeSetupCockpit, () => {
  // showTradeSetupCockpit zählt seit Chat 2026-07-19 mit in rangesNeedsData() (TSC braucht den
  // H1-Range-State immer, auch ohne Trend-Toggle) -> Polling-Zustand neu bewerten, genau wie beim
  // showRanges/showRangesMetadata-Watcher oben.
  refreshRangesPollingState();
  refreshCockpitInternal();
});
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
// Kerze"-Button tat einfach nichts) — loadInitial() bindet den Fetch an replayToMs(), allCandles
// endet also IMMER exakt am zuletzt geladenen Replay-Zeitpunkt, nie später; refreshChart() allein
// würde nur denselben, schon geclippten Datenstand neu rendern. Trade-Setups/Ranges brauchen aus
// demselben Grund ebenfalls ein echtes Neu-Fetchen: ihr fester count/Lookback deckt den neuen
// Replay-Zeitpunkt sonst ggf. nicht mehr ab.
let replayFetchDebounceTimer = null;
watch(() => props.replayUntil, () => {
  refreshChart();
  // Debounced statt bei JEDEM einzelnen "+1 Kerze"-Klick sofort zu fetchen — jeder Fetch ist ein
  // frischer, spürbar langsamer cTrader-TLS-Connect (siehe loadTradeSetupM5/loadRangesCandles);
  // schnelles mehrfaches Klicken hat sonst mehrere überlappende Fetches gleichzeitig laufen, die
  // (ohne die *FetchSeq-Guards dort, inkl. loadInitialFetchSeq) in falscher Reihenfolge
  // zurückkommen können und den Chart auf einem veralteten Replay-Stand hängen lassen. Bei einem
  // einzelnen Klick spürt man die 400ms nicht.
  clearTimeout(replayFetchDebounceTimer);
  replayFetchDebounceTimer = setTimeout(() => {
    loadInitial();
    loadTradeSetupM5();
    if (rangesNeedsData()) loadRangesCandles();
  }, REPLAY_FETCH_DEBOUNCE_MS);
});
// StyleModal (Dashboard.vue) schreibt direkt in den chartColors-Singleton — Serien-OPTIONEN
// (Candles/EMA) werden von refreshChart() nicht angefasst (das setzt nur setData), deshalb
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
    priceChartRsi.applyColorOptions();
    refreshChart();
  },
  { deep: true },
);
// Analog zum chartColors-Watcher oben, für Linienstärke (Chat 2026-07-25, Style-Modal) — siehe
// chartLineWidths.js. Native Serien-Optionen (EMA/RSI) explizit, alles Primitive-basierte über
// refreshChart() (liest lineWidth() live bei jedem Render-Aufruf, genau wie cssColor()).
watch(
  chartLineWidths,
  () => {
    if (!chart) return;
    priceChartRsi.applyLineWidthOptions();
    refreshChart();
  },
  { deep: true },
);

// Für den "+1 Kerze"-Button in Dashboard.vue: replayUntil lebt dort, daher kein direktes Setzen von
// hier aus möglich — gibt stattdessen den Zeitpunkt der nächsten Kerze zurück, den Dashboard.vue als
// neuen replayUntil-Wert übernimmt. Kernlogik + Bug-Historie lebt in computeNextReplayTime
// (chartTimeUtils.js). WICHTIG: setzt voraus, dass allCandles gerade aus einem vollen Fetch stammt
// (inkl. REPLAY_LOOKAHEAD_SEC) — ein Cache-HIT muss den gecachten Lookahead mit zurückgeben, sonst
// sieht's hier nach "keine geladene Kerze mehr" aus, obwohl sie im Cache längst daliegt.

// Aus dem früheren defineExpose-jumpToTrade herausgezogen — das RSI-Divergenz-Statistik-Panel will
// auf denselben "auf einen Zeitraum springen"-Mechanismus zurückgreifen, ohne sich selbst über die
// exposeRef aufzurufen. jumpToTrade bleibt als dünner Wrapper für externe Aufrufer bestehen.
// Nachlade-/Verbrück-Algorithmus + Viewport-Berechnung leben in priceChartJumpToTime.js (samt
// Bug-Historie als Testfälle) — hier nur noch der loadingOlder-Guard und die chart-Aufrufe.
async function jumpToTimeRange(entryTime, exitTime) {
  if (!chart) return;
  const barSeconds = barSecondsFor(props.currentBar);
  if (!loadingOlder && !isTimeCovered(allCandles, entryTime, barSeconds)) {
    loadingOlder = true;
    try {
      allCandles = await loadCandlesAroundTrade(
        allCandles,
        entryTime,
        exitTime,
        barSeconds,
        (anchor) => fetchOlderForexCandles(props.symbol, props.currentBar, anchor, FOREX_HISTORY_PAGE_SIZE),
        { bufferBars: JUMP_TARGET_BUFFER_BARS, maxPages: MAX_JUMP_FETCH_PAGES },
      );
      refreshChart();
    } catch (err) {
      console.error("Kerzen für Trade-Sprung laden fehlgeschlagen:", err);
    } finally {
      loadingOlder = false;
    }
  }
  const viewport = computeJumpViewport(clipReplay(allCandles), entryTime, exitTime, chart.timeScale().getVisibleLogicalRange());
  if (viewport) chart.timeScale().setVisibleLogicalRange(viewport);
}

function jumpToDivergence(d) {
  jumpToTimeRange(d.fromTime, d.toTime);
}

defineExpose({
  async nextReplayTime(after) {
    const barSeconds = barSecondsFor(props.currentBar);
    return computeNextReplayTime(
      allCandles,
      after,
      barSeconds,
      (afterSec) => fetchInitialForexCandles(props.symbol, props.currentBar, 200, (afterSec + MAX_PLAUSIBLE_GAP_SEC) * 1000),
      MAX_PLAUSIBLE_GAP_SEC,
    );
  },

  // Für den Klick auf eine Zeile in TradesTable.vue (Chat 2026-07-27) — dünner Wrapper, die
  // eigentliche Logik samt Bug-Historie steckt in jumpToTimeRange/priceChartJumpToTime.js.
  async jumpToTrade(entryTime, exitTime) {
    return jumpToTimeRange(entryTime, exitTime);
  },

  // Für den Klick (nicht Hover, siehe hoveredPin*-Props oben) auf eine PinPanel.vue-Zeile
  // (Chat 2026-08-18) — dünner Wrapper wie jumpToTrade/jumpToDivergence, aber generisch für jede
  // Pin-Art: toTimeUnixSec optional (Default = fromTimeUnixSec), da die meisten Pin-Kinds nur EINEN
  // Zeitpunkt haben (Zonen-/Level-Start), nur rsi_divergence hat wie ein Trade zwei (fromTime/toTime).
  async jumpToPin(fromTimeUnixSec, toTimeUnixSec) {
    return jumpToTimeRange(fromTimeUnixSec, toTimeUnixSec ?? fromTimeUnixSec);
  },

  // Für den Klick auf eine Zeile in TradesTable.vue (Chat 2026-07-27: TSC-Fokus soll auch für
  // einen Trade aus der Liste funktionieren, nicht nur für einen frisch im Trade-Modus
  // angeklickten Live-Setup) — Dashboard.vue reicht hier ein bereits ins m5Setup-Format gebrachtes
  // Objekt rein (siehe tradeIntake.js/shapeTradeSetupRow), computeCockpitState liest beide Quellen
  // identisch.
  focusTradeSetup(setup) {
    focusedTradeSetup = setup;
    refreshCockpitInternal();
  },
  clearTradeSetupFocus() {
    focusedTradeSetup = null;
    refreshCockpitInternal();
  },
});
</script>

<template>
  <div class="chart-wrapper" :style="{ height: chartWrapperHeight + 'px' }">
    <div ref="chartContainerRef" class="chart-container"></div>
    <div v-if="rangesLoading" class="ranges-loading">
      <span class="ranges-spinner"></span>
      Ranges laden…
    </div>
    <button
      v-if="showLoadOlderButton"
      class="load-older-btn"
      :disabled="loadOlderButtonBusy"
      title="Nachladen der älteren Kerzen ist offenbar hängengeblieben (z.B. cTrader-Timeout) — hier erneut auslösen"
      @click="retryLoadOlderCandles"
    >
      <span v-if="loadOlderButtonBusy" class="ranges-spinner"></span>
      {{ loadOlderButtonBusy ? "lädt…" : "⟲ Ältere Kerzen laden" }}
    </button>
    <div v-if="showLiveHistoryConfirm" class="live-history-confirm">
      <span>Kerzen vor dem archivierten Zeitraum (ab 01.01.2026) — live von cTrader laden? Kann langsam sein.</span>
      <button :disabled="liveHistoryConfirmBusy" @click="confirmLoadLiveHistory">
        <span v-if="liveHistoryConfirmBusy" class="ranges-spinner"></span>
        {{ liveHistoryConfirmBusy ? "lädt…" : "Ja, laden" }}
      </button>
      <button :disabled="liveHistoryConfirmBusy" @click="showLiveHistoryConfirm = false">Abbrechen</button>
    </div>
    <TradeSetupCockpit
      ref="tscCardRef"
      :state="cockpitState"
      :now-sec="cockpitNowSec"
      :instrument="symbol"
      :trade-mode-active="tradeModeActive"
      @toggle-trade-mode="emit('toggle-trade-mode')"
    />
    <template v-if="claudeCalloutItems.length > 0">
      <svg class="claude-callout-svg">
        <line
          v-for="line in claudeCalloutLines"
          :key="'callout-line-' + line.id"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          :stroke="line.color"
        />
      </svg>
      <div class="claude-callout-stack" :style="{ bottom: claudeCalloutStackBottom + 'px' }">
        <div
          v-for="item in claudeCalloutItems"
          :key="'callout-chip-' + item.id"
          :ref="(el) => setCalloutChipEl(item.id, el)"
          class="claude-callout-chip"
          :style="{ borderColor: item.color, color: item.color }"
        >
          {{ item.text }}
        </div>
      </div>
    </template>
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

    <MetadataPanel
      v-if="showRsiDivergenceStats"
      title="RSI-Divergenz-Statistik"
      :width="900"
      :height="650"
      @close="emit('close-rsi-divergence-stats')"
    >
      <RsiDivergenceStatsPanel
        v-if="rsiDivergenceStatsData"
        :divergences="rsiDivergenceStatsData.divergences"
        :lookback-bars="rsiDivergenceStatsData.lookbackBars"
        :lookforward-bars="rsiDivergenceStatsData.lookforwardBars"
        :instrument="symbol"
        @select="jumpToDivergence"
      />
      <p v-else class="metadata-empty">Kein RSI/Divergenz-Toggle aktiv — "RSI" und "Divergenz" bzw. "Divergenz (Historie)" einschalten.</p>
    </MetadataPanel>
  </div>
</template>

<style scoped>
.chart-wrapper {
  position: relative;
  /* Vorher flex:1;min-height:0 — teilte sich die Höhe mit .trades-panel (Dashboard.vue) innerhalb
     einer exakt Viewport-hohen (100vh), nie scrollenden Seite (App.vue): je mehr Platz das
     Trades-Panel brauchte, desto weniger blieb für den Chart übrig (Bug-Report Philip 2026-07-30,
     "je mehr Trades in der Liste, desto kleiner wird der Chart"). Zwischenstand war eine feste
     75vh-Höhe; jetzt (Philip: "die allermeisten Trading-Seiten haben unten rechts an der Ecke
     einen Drag-Handler, genau wie beim Metadaten-Modal") natives CSS `resize` statt eigenem
     Maus-Drag-Code — dieselbe resize/overflow-Kombination wie MetadataPanel.vue. Höhe kommt aus
     chartWrapperHeight (Inline-Style, siehe Script), der bestehende ResizeObserver dort schreibt
     das Ergebnis eines Resize-Drags zurück nach localStorage. App.vue lässt die Seite dafür
     wachsen/scrollen (min-height statt height:100vh), statt Chart+Trades-Panel in denselben
     festen Viewport-Raum zu zwingen. .chart-container darunter bleibt flex:1 (füllt diese Höhe
     komplett aus). */
  resize: vertical;
  overflow: hidden;
  min-height: 300px;
  max-height: 90vh;
  display: flex;
}

.chart-container {
  flex: 1;
  min-height: 0;
}

/* TSC-Callouts ("Zeiger-Linien", siehe claudeCalloutTick in PriceChart.vue) — SVG ohne eigenes
   viewBox, deckungsgleich mit .chart-wrapper (position:absolute;inset:0 + width/height:100%):
   1 SVG-Nutzereinheit entspricht dadurch exakt 1 CSS-Pixel, dieselbe Koordinatenbasis wie
   timeToCoordinate/priceToCoordinate (siehe annotationAnchorPoint in claudeAnnotations.js). */
.claude-callout-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 7;
}

.claude-callout-svg line {
  stroke-width: 1;
  stroke-dasharray: 3, 3;
}

.claude-callout-stack {
  position: absolute;
  /* Gleicher rechter Anschlag wie .tsc-card (TradeSetupCockpit.vue) — Labels docken an derselben
     Kante an, wachsen per column-reverse nach oben von der TSC-Karte weg. */
  right: 70px;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: 2px;
  pointer-events: none;
  z-index: 7;
}

/* Bug-Report Philip 2026-07-30: bei vielen Annotationen wurde der Stack mit Zeilenumbruch + Box
   pro Chip zu hoch, die obersten Labels ragten über den sichtbaren Bereich hinaus. Kein Umbruch
   (nowrap statt max-width) und keine Box (kein border/background/padding) mehr — jeder Chip ist
   jetzt nur noch eine einzeilige, unauffällige Textzeile, spart deutlich vertikalen Platz. */
.claude-callout-chip {
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
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

/* Retry-Button für hängengebliebenes Scroll-Back-Nachladen (siehe showLoadOlderButton in
   PriceChart.vue) — links vertikal zentriert, dort wo bei einer Lücke sonst nur leere Fläche auf
   der X-Achse zu sehen ist. */
.load-older-btn {
  position: absolute;
  z-index: 6;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #2962ff;
  background: rgba(30, 34, 45, 0.9);
  color: #d1d4dc;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.load-older-btn:hover:not(:disabled) {
  background: #2962ff;
}

.load-older-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

/* Bestätigungs-Banner für einen Live-cTrader-Fetch jenseits des archivierten Zeitraums (Bug-Report
   Philip 2026-08-23: weites Herauszoomen auf 1H fror die App ein, weil das automatisch mehrere
   langsame Live-Fetches am Stück auslöste) — bewusst ROT statt der neutralen Blau-Optik von
   .load-older-btn, damit klar ist, dass hier eine potenziell langsame Aktion bevorsteht, die der
   User aktiv bestätigen muss, statt dass sie automatisch losläuft. Gleiche Position/Ausrichtung
   wie .load-older-btn (schließen sich laut updateLoadOlderButtonVisibility gegenseitig aus). */
.live-history-confirm {
  position: absolute;
  z-index: 6;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid #ef5350;
  background: rgba(45, 24, 24, 0.95);
  color: #d1d4dc;
  font-size: 12px;
}

.live-history-confirm button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #ef5350;
  background: transparent;
  color: #d1d4dc;
  font-size: 12px;
  cursor: pointer;
}

.live-history-confirm button:hover:not(:disabled) {
  background: #ef5350;
}

.live-history-confirm button:disabled {
  cursor: default;
  opacity: 0.7;
}

@keyframes ranges-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
