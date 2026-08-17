<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createChart, CandlestickSeries, LineSeries, TickMarkType, CrosshairMode, LineStyle } from "lightweight-charts";
import { detectOrderBlocks, renderPersistedZones, OrderBlockPrimitive } from "../orderBlocks.js";
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
import { sessions, renderSessions, currentSessionDanger, isForbiddenAt } from "../sessions.js";
import { newsEvents, currentNewsNoGo, newsEventsForInstrument } from "../newsEvents.js";
import { renderNewsMarkers, isSameBerlinDay } from "../newsMarkers.js";
import { detectSetupObs, detectTradeSetups, tradeSetupObBoxBounds } from "../tradeSetup.js";
import { renderPivotMarkers } from "../pivotMarkers";
import { computeRangesPivots, buildMarketStructureState, pivotForDisplay, summarizeMarketStructureState } from "../marketStructureAnalysis";
import { renderMarketStructureAnalysis, collectH1LqLevels, collectFibLevels } from "../marketStructureRendering";
import { computeCockpitState } from "../tradeSetupCockpit";
import { computeEma } from "../ema.js";
import { computeRsi, detectRsiDivergence, detectRsiDivergenceHistory, DEFAULT_RSI_PERIOD, DEFAULT_DIVERGENCE_LOOKBACK_BARS } from "../rsi.js";
import { DivergenceLinePrimitive } from "../rsiRendering.js";
import { classifyDivergenceOutcome, DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS } from "../rsiDivergenceOutcome.js";
import { chartColors, cssColor, cssColorScaled } from "../chartColors.js";
import { chartLineWidths, lineWidth } from "../chartLineWidths.js";
import { PIP_SIZE } from "../pipConfig.js";
import { useTabScopedRef } from "../composables/useTabScopedRef.js";

// lightweight-charts' native LineSeries-Option lineWidth erwartet eine kleine Ganzzahl (1-4), anders
// als die Linienstärke unserer eigenen Primitives (liquidity.js/marketStructureAnalysis.ts/...), die
// jeden positiven Zahlenwert akzeptieren — daher hier gerundet+geclampt, nur für CVD/EMA (die
// einzigen nativen Serien mit konfigurierbarer Linienstärke, siehe chartLineWidths.js).
function nativeLineWidth(key) {
  return Math.min(4, Math.max(1, Math.round(lineWidth(key))));
}
import { selectActiveMetadataSections, earliestRelevantTime, saveDebugMetadataSection } from "../debugMetadata.js";
import { useLastDataExport } from "../composables/useLastDataExport.js";
import { renderTradeMarkers } from "../tradeMarkers.js";
import { renderClaudeAnnotations, annotationAnchorPoint, ANNOTATION_COLOR as CLAUDE_ANNOTATION_COLOR } from "../claudeAnnotations.js";
import {
  binanceIntervalFor,
  fetchInitialDeltas,
  fetchDailyDeltas,
  fetchOlderDeltas,
  mergeRecentDeltas,
  cumulativeFromDeltas,
} from "../cvd.js";
import { okxBarFor, barSecondsFor, REPLAY_LOOKAHEAD_SEC } from "../timeframes.js";
import {
  fetchInitialCandles as fetchInitialForexCandles,
  fetchRecentCandles as fetchRecentForexCandles,
  fetchOlderCandles as fetchOlderForexCandles,
} from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import { replayFetchToMs, nextCandleAfter, snapToBarTime, businessSecondsBetween } from "../chartTimeUtils.js";
import { classifyAge } from "../ageTier";
import { kindLabel as targetKindLabel } from "../tradeTargets";
import { kindLabel as confirmationKindLabel } from "../tradeConfirmations";
import { useStatusBar } from "../composables/useStatusBar.js";
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";
import Gauge from "./Gauge.vue";
import MetadataPanel from "./MetadataPanel.vue";
import JsonTree from "./JsonTree.vue";
import RsiDivergenceStatsPanel from "./RsiDivergenceStatsPanel.vue";
import TradeSetupCockpit from "./TradeSetupCockpit.vue";

const props = defineProps({
  symbol: { type: String, required: true },
  currentBar: { type: String, required: true },
  trades: { type: Array, default: () => [] },
  // Hover-Hervorhebung (Chat 2026-08-01, Philips Wunsch für bessere Live-Kommunikation mit Lana):
  // trade_positions.id der gerade in TradesTable.vue gehoverten Zeile, null wenn keine — siehe
  // renderTradeMarkers/tradeMarkers.js für die eigentliche Glow-Darstellung. Bewusst NUR eine Id
  // (kein ganzer Trade), analog zu selectedSetupId-artigen Props andernorts in diesem Repo.
  hoveredTradeId: { type: [String, Number], default: null },
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
  poiZones: { type: Array, default: () => [] },
  // Ersetzt seit Chat 2026-07-30 den einzelnen showOrderBlocks-Schalter (Bug-Report Philip: "wenn
  // ich Indikatoren > OBs im M5 anhabe, werden mir ganz viele M5 OBs angezeigt" — showOrderBlocks
  // folgte bei Forex bisher IMMER dem gerade angezeigten Chart-Timeframe, nie mehrere gleichzeitig).
  // Jeder der drei Timeframes ist jetzt unabhängig an-/ausschaltbar, siehe refreshPoiZonesInternal.
  showObsM5: { type: Boolean, default: false },
  showObs1h: { type: Boolean, default: true },
  showObs4h: { type: Boolean, default: true },
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

// CVD (Binance-Futures-Orderflow) gibt es nur für BTC-USDT — für Forex-Symbole (cTrader)
// bleiben Gauges/CVD-Pane komplett weg statt leer. Der Wert steht bei onMounted fest:
// Dashboard.vue rendert <PriceChart :key="symbol">, ein Symbolwechsel montiert die
// Komponente also neu, statt dieses Flag zur Laufzeit umzuschalten.
const isForex = props.symbol !== "BTC-USDT";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
// Bug-Report Philip 2026-07-30: Scroll-Back im BTC-M5-Chart blieb nach einem Nachladen für den
// Rest der Session hängen, ohne Fehler/weiteren Request. Ursache: fetchCandlePage() (hier) UND
// cvd.js' Binance-Fetch liefen beide OHNE Timeout — anders als forexCandles.js (siehe dort:
// AbortSignal.timeout), das jeden Fetch schon immer so absichert. Hängt einer der beiden parallel
// per Promise.all() laufenden Scroll-Back-Fetches (siehe subscribeVisibleLogicalRangeChange unten)
// auf unbestimmte Zeit (Netzwerk-Stall, kein Fehler, keine Antwort), erreicht der Code nie
// `finally` -> `loadingOlder` bleibt für immer true, jeder weitere Scroll-Versuch wird schon in der
// ersten Guard-Zeile stillschweigend abgewiesen. Ein harter Timeout macht ein Hängenbleiben
// stattdessen zu einem normalen, gefangenen Fehler.
const FETCH_TIMEOUT_MS = 20_000;
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
// Forex-Scroll-Back (Chat 2026-08-09, Philip: "sollen mehr Candles geholt werden als 100"): seit
// forexCandles.js' fetchOlderCandles zuerst das DB-Archiv (forex_candles) versucht, ist ein
// größerer count fürs Archiv praktisch kostenlos (Postgres liefert ein paar tausend Zeilen in
// einem Call problemlos) — deckt damit gleich mehrere Handelstage pro Scroll-Back-Schritt ab statt
// in 100er-Häppchen. Für den Live-cTrader-Fallback (außerhalb des Archivs) kappt die
// forex-candles Edge Function ohnehin serverseitig auf MAX_COUNT (aktuell 1000), dieser Wert ist
// also KEIN neues Live-Request-Limit, nur die Obergrenze für den (häufigeren) Archiv-Treffer.
const FOREX_HISTORY_PAGE_SIZE = 2000;
// jumpToTrade(): Puffer NACH dem Trade-Exit für den ersten Anker-Fetch (siehe dort) — genug, damit
// auch ein Trade ohne Exit (noch offen) plus etwas "Nachher"-Kontext in die erste Seite passt.
const JUMP_TARGET_BUFFER_BARS = 20;
// jumpToTrade(): harte Obergrenze an Nachlade-Seiten für einen einzelnen Sprung, nur als Notbremse
// für einen ungewöhnlich lang laufenden Trade (Entry Wochen vor Exit) — kein Regelfall.
const MAX_JUMP_FETCH_PAGES = 5;
const INITIAL_CANDLE_COUNT = 1000; // depth loaded on startup / timeframe switch
// Wunsch Philip 2026-07-20: "ich werd bei Replay öfter auf +1 klicken, fetch doch gleich die
// nächsten Kerzen" — an alle Replay-Fetches (fetchCandlesCached lookaheadSec-Parameter)
// durchgereicht, damit wiederholtes "+1 Kerze"-Klicken innerhalb dieses Fensters ohne neuen
// Roundtrip auskommt (siehe candleCache.js: der Hit-Check bleibt dabei strikt am WAHREN
// replayUntil, nur der tatsächliche Fetch/completeUpTo reicht weiter). Jetzt in timeframes.js
// (Chat 2026-07-23: von 4h auf ~8,68 Tage hochgesetzt, 429 beim Replay-Klicken) statt hier lokal,
// weil sich der Wert aus TRADE_SETUP_M5_CANDLE_COUNT ableitet und für alle Timeframes gleich sein
// soll.
const LAZY_LOAD_LOGICAL_THRESHOLD = 20; // fetch older data once this close to the left edge
const WINDOW_BARS = 15; // letzte 15 Binance-1m-Kerzen für das rollierende Gauge-Fenster
const TRADE_MARKER_BARS = new Set(["1m", "5m", "15m", "1h"]); // 4h/1D würden zu unübersichtlich
// Pin-Rechtsklick (Chat 2026-08-01, zweite Runde) — großzügiger Fang-Radius statt exaktem
// Treffen, siehe findNearbyPinCandidates. MAX_CANDIDATES deckelt die Auswahl-Liste, damit ein
// dicht bevölkerter Chart-Bereich kein unübersichtlich langes Menü erzeugt.
const PIN_SEARCH_RADIUS = 40; // px
const PIN_MAX_CANDIDATES = 6;
// Trade-Setup (Liquidity Sweep + Protected M5-Fraktal + M5-OB, siehe tv-indikator/src/
// tradesetup.pine) — nur für Forex (braucht M5-Kerzen zusätzlich zum aktuell angezeigten
// Chart-Timeframe). Werte 1:1 aus den getunten Defaults in tv-indikator/src/inputs.pine
// übernommen (TRADE-SETUP-Gruppen), nicht neu geraten — siehe auch poi-watcher/index.ts,
// das dieselben Werte serverseitig für die Telegram-Alarme nutzt.
const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
// H1-Level kamen bis Chat 2026-07-28 aus einer eigenen liquidity.js-Fraktal-Erkennung (liqH1Period
// = 10) auf einem eigenen, nur 300 Kerzen (≈12,5 Tage) kurzen H1-Fenster — Bug-Report Philip: ein
// 32 Tage altes, aber gerade erst geswepptes Level (1.13545) war dadurch unsichtbar. Statt das
// Fenster zu vergrößern ("das allermeiste ist nur Datenmüll") kommen H1-Level jetzt aus den längst
// gefilterten structurePivots des "1h-Range"-Strukturalgorithmus (siehe collectH1LqLevels in
// marketStructureAnalysis.ts, aufgerufen in computeTradeSetups) — kein eigenes H1-Fenster mehr
// nötig, siehe rangesH1Candles/loadRangesCandles weiter unten.
const TRADE_SETUP_M5_CANDLE_COUNT = 2500;
const TRADE_SETUP_GRACE_SEC = 5 * 60; // eine M5-Kerzenlänge
const TRADE_SETUP_LS_MAX_LEAD_SEC_H1 = 120 * 60; // lsMaxLeadMinutesH1 — eigenes, größeres Fenster
// als M5 (H1-Sweep liegt typischerweise deutlich länger vor dem Fraktal), siehe poi-watcher/index.ts
const TRADE_SETUP_LS_MAX_LEAD_SEC_M5 = 45 * 60; // lsMaxLeadMinutesM5
const TRADE_SETUP_LS_MAX_DISTANCE_M5 = 5.0 * PIP_SIZE; // lsMaxDistancePipsM5=5, nur für M5-LS
const TRADE_SETUP_OB_MAX_DELAY_SEC = 60 * 60; // obMaxDelayMinutes
const TRADE_SETUP_LOOKBACK_SEC = 6 * 60 * 60; // protectedHighLookbackHours
const TRADE_SETUP_OB_WIDTH_SEC = 10 * TRADE_SETUP_GRACE_SEC; // obBoxWidthM5Candles=10, rein optisch
// Linienstärke konfigurierbar seit Chat 2026-07-25 (Style-Modal) — siehe chartLineWidths.js, EIN
// Wert pro Farb-Key (tradeSetupProtected/tradeSetupShort/tradeSetupLong). Kein Modul-Konstante
// mehr, damit ein Style-Modal-Wechsel live greift statt nur beim nächsten Seiten-Reload
// (lineWidth() liest den reaktiven Store live bei jedem Aufruf).
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
// schnellere Uptrend-Erkennung, siehe computeRangesPivotsFor. Bis Chat 2026-07-28 bewusst
// unabhängig von den H1-Leveln der Trade-Setup-Erkennung gehalten ("die Konzepte sollen sich
// nicht querbeeinflussen") — diese Trennung ist seitdem aufgehoben: computeTradeSetups() liest
// jetzt genau diese Pivots (siehe collectH1LqLevels), rangesH1Candles/marketStructureState müssen
// also auch dann geladen sein, wenn nur Trade-Setups (nicht Ranges selbst) sichtbar sind, siehe
// rangesNeedsData().
// Puffer vor/nach dem Lookback-Fenster: ein Fraktal braucht period+4 Kerzen davor und period
// danach, um überhaupt erkannt zu werden (siehe isUpFractal/isDownFractal in liquidity.js) — ohne
// Puffer würden Fraktale am Rand des konfigurierten Fensters unter den Tisch fallen. 20 ist für
// BEIDE Perioden (5 und 2) großzügig genug, kein separater Puffer je Periode nötig.
const RANGES_CANDLE_BUFFER = 20;

// OB-Timeframe-Toggles (Chat 2026-07-30) — 1H (Forex: rangesH1Candles, BTC: props.poiZones) und M5
// (Forex: tradeSetupM5Candles, läuft für Forex ohnehin schon immer) brauchen KEINEN eigenen Fetch,
// die Kerzen sind für andere Features bereits da bzw. kommen fertig vom Backend. Nur diese zwei
// Fälle haben sonst wirklich nichts, das ihre Kerzen laden würde:
// - 4H bei Forex (kein anderes Feature braucht 4H-Kerzen)
// - M5 bei BTC (BTC hat weder Trade-Setups noch TSC, die M5 bräuchten)
const OBS_4H_CANDLE_COUNT = 300; // ≈ 50 Tage, großzügig fürs Erkennen auch länger unberührter Zonen
const OBS_M5_BTC_CANDLE_COUNT = 2500; // wie TRADE_SETUP_M5_CANDLE_COUNT, gleiche Größenordnung

// EMA 50/200 auf M5 (siehe Chat: Philips "Trend über EMA + Anzahl protected highs/lows"-Idee) —
// läuft auf trendAnalysisM5Candles (dieselbe M5-Historie wie der Zigzag-Algo), kein eigener Fetch
// nötig, siehe loadTradeSetupM5.
const EMA_PERIOD_FAST = 50;
const EMA_PERIOD_SLOW = 200;

// RSI(14)-Panel (Chat 2026-08-11) — eigene Pane unterhalb des Candlestick-Charts wie CVD. CVD
// belegt Pane-Index 1 nur bei BTC (siehe unten, isForex-Verzweigung), RSI kommt danach: bei Forex
// direkt Pane 1 (kein CVD da), bei BTC Pane 2. positionGauges() (siehe dort) verlässt sich
// weiterhin auf Pane-Index 1 = CVD bei BTC — RSI_PANE_INDEX daher bewusst NACH der CVD-Pane.
const RSI_PANE_INDEX = isForex ? 1 : 2;

const { markSuccess } = useStatusBar();
const { lastDataExport } = useLastDataExport();

const chartContainerRef = ref(null);
// Chart-Höhe (Chat 2026-07-30, siehe Dashboard.vue: tradesPanelHeight für dieselbe Begründung,
// inkl. useTabScopedRef statt useLocalStorageRef — pro Tab verstellbar, aber ein frischer Tab/
// Browser-Neustart startet trotzdem beim zuletzt benutzten Wert). Ein einziger Key (nicht pro
// Symbol) — Philip will EINE konsistente Chart-Höhe unabhängig davon, welcher Symbol-Tab gerade
// aktiv ist. PriceChart.vue wird bei Symbolwechsel per :key neu gemountet — kein Problem hier
// (anders als bei useLocalStorageRef gibt es keinen geteilten Cache, aber es existiert ohnehin nur
// eine lebende Instanz gleichzeitig, die neue liest beim Mount einfach den zuletzt geschriebenen
// Wert erneut aus session-/localStorage).
const chartWrapperHeight = useTabScopedRef("chartWrapperHeight", 675);
const gaugesBottom = ref(12);
const windowDelta = ref(0);
const dailyDelta = ref(0);
// pivotForDisplay/summarizeMarketStructureState kommen seit Chat 2026-07-27 aus
// marketStructureAnalysis.ts (Daten-Export braucht dieselbe Aufbereitung, siehe
// dataExport.js) — hier nur noch der reaktive State drumherum.
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

// Für den "kopieren + lokal speichern"-Button im Debug-Metadaten-Panel — Clipboard-Copy UND
// Datei-Save (unter der "chart"-Sektion, siehe debugMetadata.js: saveDebugMetadataSection) zusammen,
// mit dem "✓ kopiert"-Feedback am Button (siehe copyJson).
async function copyJsonAndSaveLocally(section, value) {
  await copyJson(section, value);
  await saveDebugMetadataSection("chart", value);
}

// Auto-Save (Chat 2026-07-21: "alle X Sekunden automatisch neu speichern, nur im localhost dann...
// einmal bei App-Start und dann alle X Sekunden, so dass es nicht zu belastend für den PC ist") —
// damit .debug/metadata.json immer aktuell ist, ohne dass Philip vor jedem Bug-Report erst den
// Button klicken muss. import.meta.env.DEV ist Vites eingebautes "läuft das gerade im
// `vite dev`-Server" (true nur dort, false im Production-Build/`vite preview`) — deckt sich exakt
// mit "nur im localhost", ohne Hostname-Sniffing nötig; der Endpoint existiert im Production-Build
// ohnehin nicht (siehe vite.config.js), der Fetch würde dort sowieso ins Leere laufen.
// 30s: JSON bauen + ein kleiner lokaler POST sind beide sehr billig (auch bei ~1000 Kerzen), 30s
// ist trotzdem großzügig genug, um den PC nicht unnötig zu belasten.
const DEBUG_AUTOSAVE_INTERVAL_MS = 30_000;
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
let cvdSeries;
let ema50Series;
let ema200Series;
let rsiSeries;
let rsiOverboughtLine;
let rsiOversoldLine;
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
let sessionPrimitives = [];
let newsMarkerPrimitives = [];
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
let divergencePriceLinePrimitives = []; // Preis-Bein der Divergenz-Konnektoren, an candleSeries
let divergenceRsiLinePrimitives = []; // RSI-Bein, an rsiSeries — siehe refreshRsiDivergenceInternal
let divergenceOutcomeDebugPrimitives = []; // Struktur-Marken-Linien fürs Outcome-Debug, an candleSeries
let tradeSetupPrimitives = [];
let claudeAnnotationPrimitives = [];
let claudeAnnotationPriceLines = [];
let allCandles = [];
let allCvdDeltas = [];
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
// Out-of-Order-Guards für loadInitial/loadRangesCandles/loadTradeSetupM5, siehe dort (Chat
// 2026-07-20: "im Replay-Modus hängt der Trend-Algorithmus"). loadInitialFetchSeq wird
// zusätzlich von pollRecent() als Bar-Mismatch-Guard gelesen (siehe dort, Bug-Report Philip
// 2026-07-19: "1h -> M5 -> wieder 1h, Chart zeigt nur noch M5-Kerzen") — jeder echte Neu-Load von
// allCandles (TF-/Symbol-Wechsel, Replay-Schritt) zählt hoch, ein noch laufender pollRecent()-Fetch
// von VOR diesem Wechsel erkennt daran, dass er überholt ist.
let loadInitialFetchSeq = 0;
let rangesFetchSeq = 0;
let tradeSetupM5FetchSeq = 0;
let obs4hCandles = []; // nur Forex, siehe OBS_4H_CANDLE_COUNT oben
let obs4hFetchSeq = 0;
let obsM5BtcCandles = []; // nur BTC, siehe OBS_M5_BTC_CANDLE_COUNT oben
let obsM5BtcFetchSeq = 0;
let loadingOlder = false;
let reachedHistoryStart = false;
let reachedCvdHistoryStart = false;
// Bug-Report Philip 2026-08-09: Scroll-Back-Nachladen (siehe subscribeVisibleLogicalRangeChange
// unten) hängt bei einem cTrader-Timeout unauffällig fest — der Fehler landet nur in der Konsole,
// der User sieht bloß leere Fläche links im Chart und muss zufällig nochmal scrollen, damit der
// Handler erneut feuert. showLoadOlderButton zeigt stattdessen einen expliziten Retry-Button genau
// dann, wenn die sichtbare Logical Range über den Datenanfang hinausragt (from < 0, siehe
// updateLoadOlderButtonVisibility) UND wirklich noch mehr Historie zu holen wäre (!reachedHistoryStart
// — bei echtem Datenanfang bleibt die Lücke bewusst ohne Button).
const showLoadOlderButton = ref(false);
const loadOlderButtonBusy = ref(false);
let pollTimer = null;
let tradeSetupM5PollTimer = null;
let rangesPollTimer = null;
let obs4hPollTimer = null;
let obsM5BtcPollTimer = null;
let windowGaugeTimer = null;
let dailyGaugeTimer = null;
// Für das RSI-Divergenz-Statistik-Panel (Chat 2026-08-11, vierte Runde) — { divergences (inkl.
// Outcome-Klassifikation), lookbackBars, lookforwardBars } oder null, wenn der Toggle aus ist
// bzw. gerade keine Divergenzen vorliegen. Befüllt in refreshRsiDivergenceInternal, analog zu
// rangesMetadata unten.
const rsiDivergenceStatsData = ref(null);
const rangesMetadata = ref(null); // Liste der erkannten H1-Periode-5-Pivots fürs Ranges-Metadaten-Panel
const rangesMetadata2 = ref(null); // dito für die eingebettete Periode-2-Erkennung — siehe Chat 2026-07-19:
// EIN gemeinsames Metadaten-Panel für beide Perioden reicht ("wenn es zu schwer ist zwei Modals
// gleichzeitig offen zu haben"), daher kein zweiter showRangesMetadata2-Toggle.
// Der erste H1-Fetch (loadRangesCandles) ist ein frischer cTrader-TLS-Connect+Auth-Handshake
// (siehe forexCandles.js/_shared/twelvedata/client.ts) statt eines simplen DB-Reads — das kann
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
// Rohes CockpitState fürs TSC-Rendering (TradeSetupCockpit.vue) — getrennt von cockpitMetadata
// oben, das über pivotForDisplay bereits fürs Debug-Metadaten-Panel aufbereitet ist (formatierte
// Zeitstrings statt roher pivotTime/touchedTime-Zahlen, die die TSC-Komponente aber für ihre
// Alters-Berechnung braucht).
const cockpitState = ref(null);
const cockpitNowSec = ref(undefined);
const structureEarliestTime = ref(null);

// TSC-Callouts ("Zeiger-Linien", Chat 2026-07-30, Philip: "ich freu mich auf die 'Zeiger' Linien
// :D") — Claude-Notizen-Labels (line/marker/label) floaten als eigene DOM-Chips über der TSC-Karte
// und zeigen per SVG-Linie auf ihren Chart-Punkt, statt direkt auf dem Chart zu stehen. Anfangs
// automatisch für ALLE Notizen, sobald TSC sichtbar war — bei vielen gleichzeitigen Annotationen
// (Bias-Pflicht-Block: Invalidierung+Zonen+Targets+Risiko-Level, oft 7+ Stück) ergab das ein
// unlesbares Spinnennetz aus Verbindungslinien ("okay irgendwie ist es schlimmer als davor
// HAHAHA"). Jetzt opt-in PRO Annotation über das "pointer"-Feld (siehe claudeAnnotations.js
// validateAnnotationList) — Claude entscheidet selbst, welche Notiz sich als Zeiger lohnt (z.B. ein
// enges Level-Cluster) und welche inline über der Linie bleibt (die meisten). Nur überhaupt aktiv,
// wenn die TSC-Karte gerade tatsächlich sichtbar ist (Forex + Toggle an + State vorhanden) — sonst
// gibt's keinen sinnvollen Anker, und pointer:true-Notizen fallen automatisch auf inline zurück.
// Abstand zwischen der TSC-Karten-Oberkante und der Unterkante des Label-Stacks darüber.
const CALLOUT_STACK_GAP_PX = 10;
const tscCardRef = ref(null);
const claudeCalloutItems = ref([]); // [{ id, text, color, x, y }] — x/y = Chart-lokaler Anker (CSS-Px)
const claudeCalloutLines = ref([]); // [{ id, x1, y1, x2, y2, color }] — x1/y1 = Label-Chip-Position
const claudeCalloutStackBottom = ref(24); // px von unten in .chart-wrapper, knapp über der TSC-Karte
const claudeCalloutChipEls = {}; // id -> HTMLElement, NICHT reaktiv (nur fürs Auslesen der Rects im rAF-Tick)
let claudeCalloutRafId = null;
// WeakMap statt einer id-Eigenschaft auf den Annotation-Objekten selbst (die kommen roh aus
// Supabase/claudeAnnotationsStore.js, sollen nicht mutiert werden) — stabile id pro Objekt-Referenz,
// unabhängig von Array-Position (die sich durchs Filtern auf "hat Text, ist kein hline" verschiebt).
const claudeCalloutIdMap = new WeakMap();
let claudeCalloutIdSeq = 0;
function calloutIdFor(ann) {
  if (!claudeCalloutIdMap.has(ann)) claudeCalloutIdMap.set(ann, ++claudeCalloutIdSeq);
  return claudeCalloutIdMap.get(ann);
}

function setCalloutChipEl(id, el) {
  if (el) claudeCalloutChipEls[id] = el;
  else delete claudeCalloutChipEls[id];
}

// TSC-Karte gerade sichtbar? (siehe TradeSetupCockpit.vue: v-if="isForex" außen, v-if="state"
// innen — cockpitState wird von refreshCockpitInternal() bereits auf null gesetzt, wenn
// showTradeSetupCockpit aus ist, die Bedingung hier ist also strenggenommen redundant, aber
// explizit robuster gegen künftige Änderungen an refreshCockpitInternal.)
const tscCalloutModeActive = computed(() => isForex && props.showTradeSetupCockpit && cockpitState.value != null);

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

// Gauges an die untere rechte Ecke der Kerzen-Pane pinnen, direkt oberhalb der CVD-Pane —
// sonst überlappen sie deren Preisskala/Legende. Seit dem RSI-Panel (Chat 2026-08-11) ist CVD
// bei BTC nicht mehr zwingend die unterste Pane (RSI kann darunter sitzen, siehe RSI_PANE_INDEX)
// — dessen Höhe muss mit in den Offset, sonst überlappen die Gauges die RSI-Pane (Bug-Report beim
// Testen: Gauges lagen über der RSI-Preisskala, wenn RSI bei BTC eingeschaltet war).
function positionGauges() {
  const cvdPane = chart.panes()[1];
  if (!cvdPane) return;
  const rsiPane = chart.panes()[RSI_PANE_INDEX];
  gaugesBottom.value = cvdPane.getHeight() + (rsiPane?.getHeight() ?? 0) + 12;
}

// OKX-Pagination: "after" liefert Kerzen VOR diesem Timestamp (ms) — für ältere Daten.
async function fetchCandlePage(endpoint, bar, { after, limit } = {}) {
  const params = new URLSearchParams({ instId: INST_ID, bar, limit: String(limit) });
  if (after) params.set("after", after);
  const res = await fetch(`${OKX_BASE_URL}${endpoint}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
// Bug-Report Philip 2026-07-30 ("Scroll-Back bleibt hängen"): die eigentliche Ursache war ein
// fehlender Timeout auf diesem Fetch, siehe FETCH_TIMEOUT_MS oben. Der Retry hier ist eine
// ZUSÄTZLICHE, kleinere Absicherung: ein leeres data:[] von OKX wurde bisher 1:1 als "Anfang der
// Historie erreicht" gewertet (siehe reachedHistoryStart im visibleLogicalRangeChange-Handler) —
// EINMAL leer sollte das nicht permanent bedeuten (BTC-USDT hat nachweislich noch Jahre an Historie
// vor jedem realistischen Scroll-Back-Punkt), ein zweiter Versuch nach kurzer Pause unterscheidet
// einen echten Erreichen-des-Datenanfangs von einem einzelnen Aussetzer, kostet im Normalfall
// (Daten vorhanden) keinen zusätzlichen Request.
async function fetchOlderCandles(bar, oldestLoadedTime) {
  const params = { after: String(oldestLoadedTime * 1000), limit: HISTORY_PAGE_SIZE };
  let page = await fetchCandlePage("/api/v5/market/history-candles", bar, params);
  if (page.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    page = await fetchCandlePage("/api/v5/market/history-candles", bar, params);
  }
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

// Für jumpToTrade(): reicht NICHT, nur "time < candles[0].time" zu prüfen (Bug-Report Philip
// 2026-07-30, dritte Runde) — ein gezielter Sprung dort kann bewusst eine LÜCKE mitten im Array
// hinterlassen (siehe Kommentar in jumpToTrade), ein späterer Sprung auf einen Zeitpunkt GENAU IN
// dieser Lücke sähe mit der reinen Array-Anfang-Prüfung fälschlich wie "schon geladen" aus —
// snapToBarTime würde dann nur die letzte Kerze VOR der Lücke treffen (genau das beobachtete
// "Kerzen bis 14.07. 20:05, X-Achse springt dann auf 23.07."). Prüft stattdessen, ob die NÄCHSTE
// Kerze bei/vor `time` höchstens eine Kerzenbreite entfernt liegt.
function isTimeCovered(candles, time, barSeconds) {
  if (candles.length === 0 || time < candles[0].time || time > candles[candles.length - 1].time) return false;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (candles[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }
  return time - candles[lo].time <= barSeconds * 1.5;
}

// Gegenstück zu clipReplay für die FETCH-Seite: ein fester count/Lookback endet sonst immer bei
// der echten aktuellen Zeit (siehe forexCandles.js: toMs ohne Wert = "jetzt"), unabhängig von
// replayUntil — bei einem Replay-Zeitpunkt, der weiter zurückliegt als count reicht, deckt das
// geladene Fenster den gewünschten Bereich dann gar nicht ab (siehe Chat: "Ranges-Pivots gehen bei
// 12 Tagen Lookback + Replay nicht weit genug zurück"). loadRangesCandles/loadTradeSetupM5/-H1
// übergeben das hier an fetchInitialForexCandles, damit der Fetch selbst schon bis replayUntil
// zurückreicht statt erst hinterher (zu kurz) geclippt zu werden.
// bar (Forex-Aufrufe): siehe replayFetchToMs in chartTimeUtils.js — cTrader liefert die Kerze GENAU
// an replayUntil sonst strukturell nie mit (Bug-Report Philip 2026-07-21: "letzte Kerze nur 22:00
// statt 23:00", "+1 Kerze" brachte deshalb nie die neu angeforderte Kerze). OKX/BTC-Aufrufe lassen
// bar bewusst weg (kein bekanntes Analogon zu diesem cTrader-Verhalten).
function replayToMs(bar) {
  return replayFetchToMs(props.replayUntil, bar);
}

// Bug-Report Philip 2026-07-31: im Replay auf ein früheres Datum springen zeigte trotzdem Marker/
// Ziele/Bestätigungen/Setup-Links eines SPÄTEREN Trades (z.B. eines Longs vom 30.07., während man
// im Chart auf dem 27.07. steht) — snapToBarTime (in tradeMarkers.js/liquidity.js/orderBlocks.js)
// klemmt eine Zeit, die nach der letzten geladenen Kerze liegt, auf eben diese letzte Kerze fest,
// statt den Trade auszublenden. Ohne Filter stapeln sich dadurch ALLE "noch nicht passierten"
// Trades am rechten Rand exakt übereinander. Reine Anzeige-Filterung hier (kein DB-/Datenmodell-
// Fix nötig) — ein Trade "existiert" erst im Chart, sobald seine Einstiegszeit auf oder vor der
// letzten aktuell geladenen Kerze liegt.
function tradesVisibleForCandles(trades, candles) {
  if (candles.length === 0) return [];
  const lastTime = candles[candles.length - 1].time;
  return trades.filter((t) => t.entryTime <= lastTime);
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
  if (!isForex || !props.showTradeSetups || !props.showTrades) return;
  const candles = clipReplay(allCandles);
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    if (t.tradeSetupId == null || t.tradeSetupObStartTime == null || t.tradeSetupObTop == null || t.tradeSetupObBottom == null) continue;
    const top = t.tradeSetupObTop;
    const bottom = t.tradeSetupObBottom;
    const key = t.direction === "short" ? "tradeSetupShort" : "tradeSetupLong";
    // Pin-Kontext, dritte Art (Chat 2026-08-01, dritte Runde — Bug-Report Philip: genau DIESE
    // Box, "OB 1.15229#22", war bisher nie klickbar, weil sie über einen eigenen Rendering-Pfad
    // läuft statt über collectObsZones/orderBlockPrimitives). tradeSetupId ist bereits die echte
    // trade_setups.id (kein Natural-Key-Umweg wie bei ob_zone nötig) — direction/instrument vom
    // Trade selbst mitgegeben, damit die Kandidaten-Liste in Dashboard.vue ohne Zusatz-Fetch ein
    // Label bauen kann (siehe PriceChart.vue: findNearbyPinCandidates).
    const inPinContext = props.pinTradeSetupIds?.has(t.tradeSetupId) ?? false;
    const primitive = new OrderBlockPrimitive(
      { top, bottom, startTime: t.tradeSetupObStartTime, endTime: t.tradeSetupObStartTime + TRADE_SETUP_OB_WIDTH_SEC, tradeSetupId: t.tradeSetupId, direction: t.direction, instrument: t.instrument },
      {
        fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
        borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
        borderWidth: lineWidth(key),
        textColor: "rgba(255, 255, 255, 0.9)",
        label: `#${t.tradeSetupId}`,
        inPinContext,
        pinColor: cssColor("pin"),
      },
      candles,
    );
    candleSeries.attachPrimitive(primitive);
    tradeSetupLinkPrimitives.push(primitive);
  }
}

// Zeichnet die Pivot-/OB-Targets eines Trades als Linie — Wiederverwendung LiquidityLinePrimitive
// für beide Target-Arten (auch OB, siehe findClickedOBZone: nur die nähere Kante wird übernommen,
// kein eigenes Box-Rendering nötig). Bewusst UNABHÄNGIG von showLiquidity/showObsM5/-1h/-4h (ein
// Target gehört zum Trade, nicht zur Live-Anzeige-Rauschen-Filterung), aber wie bei
// refreshTradeSetupLinksInternal an showTradeSetups+showTrades gekoppelt (Bug-Report Philip
// 2026-07-28, siehe dort). Ohne source_time (Alt-Targets vor diesem Feature, siehe Migration
// 20260728140000) wird nichts gezeichnet, da keine Linie rekonstruierbar ist.
//
// target.touchedTime (DB-Spalte trade_targets.touched_time) wird NUR einmalig beim Hinzufügen des
// Targets gesetzt (PriceChart.vue: findClickedOBZone/findClickedPivot lesen dafür den Live-Zustand
// der Zone/des Levels zu DIESEM Zeitpunkt) und danach nie mehr aktualisiert — es gibt keinen
// Watcher, der ein bereits gespeichertes Target später nachträgt, wenn der Preis es erst danach
// berührt. Bug-Report Philip 2026-07-30 (OB 1.13737 #12): Target ohne touched_time zeichnete die
// Linie deshalb dauerhaft "bis jetzt" weiter, obwohl längst eine Kerze durchgelaufen war. Deshalb
// hier zusätzlich selbst in den geladenen Kerzen nachschauen (wie orderBlocks.js: z.touched via
// low<=price<=high) statt dem gespeicherten Stand blind zu vertrauen — self-healt automatisch bei
// jedem Render, sobald die berührende Kerze geladen ist.
const TARGET_TIER_WIDTH_RATIO = { minor: 1, medium: 1.6, major: 2.2 };
// Bug-Report Philip 2026-07-31 (Debug-Log bewies es: zone.startTime === zone.endTime): ">="
// ließ die eigene Entstehungs-Kerze des Targets als "Touch" durchgehen, weil deren High/Low die
// Kante ja per Definition selbst berührt (die Kante IST aus dieser Kerze abgeleitet) — endTime
// kollabierte dadurch praktisch immer auf sourceTime, Linie/Box wurden unsichtbar bzw. auf einen
// Punkt zusammengestaucht. ">" schließt die Entstehungs-Kerze aus, sucht nur nach einem SPÄTEREN
// echten Re-Touch.
// Nur für Pivot-Targets (eine einzelne, exakte Preis-Marke auf der GLEICHEN Zeitebene wie die
// gerade angezeigten Kerzen) — für OB-Targets als PRIMÄRER Weg bewusst NICHT verwendet, siehe
// Kommentar bei refreshTradeTargetLinksInternal weiter unten (Zeitebenen-Mismatch M5-Kerzen vs.
// 1H/4H-OB). firstCandleTouchRange (direkt darunter) ist trotzdem KEIN Widerspruch dazu — die
// dient dort nur als letzter Fallback, nicht als primäre Quelle.
function firstCandleTouch(candles, sourceTime, price) {
  const hit = candles.find((c) => c.time > sourceTime && c.low <= price && c.high >= price);
  return hit ? hit.time : null;
}
// Bug-Report Philip 2026-08-07 (OB 1,3466 #29, dealing_range #27 vom 03.08.): eine OB-Box ohne
// touchedTime UND ohne live wiederfindbare Zone (liveObZoneState) zog sich komplett durch den
// Chart bis "jetzt" — die schmale M5-Live-Lookback (~25h, tradeSetupM5Candles/obsM5BtcCandles,
// Twelve-Data-Rate-Limit-bedingt bewusst eng gehalten) enthält eine 4 Tage alte Zone gar nicht
// mehr, liveObZoneState findet sie darum nie wieder, egal wie oft neu gerendert wird — anders als
// bei firstCandleTouch oben (Bug-Report 2026-07-30) gab es für die Box-Variante bisher GAR KEINEN
// Fallback, der selbst in den bereits geladenen Kerzen nachschaut. Analog zu firstCandleTouch,
// aber für eine Preis-SPANNE (rangeLow/rangeHigh) statt eines einzelnen Preises — dieselbe
// Touch-Definition wie orderBlockDetection.js (low<=top && high>=bottom). Bewusst NUR als
// Fallback NACH liveObZoneState (siehe refreshTradeTargetLinksInternal/-ConfirmationLinksInternal)
// eingesetzt, nicht als Ersatz dafür: `candles` ist hier die gerade angezeigte Chart-Zeitebene,
// die von der tatsächlichen OB-Zeitebene (meist 5M) abweichen kann (derselbe Zeitebenen-Mismatch,
// wegen dem firstCandleTouch oben für OBs nie primär genutzt wird) — als letzter Ausweg (Zone
// nicht mehr live auffindbar) ist eine etwas ungenauere, aber tatsächlich endliche Touch-Kerze
// klar besser als eine für immer bis "jetzt" wachsende Box.
function firstCandleTouchRange(candles, sourceTime, rangeLow, rangeHigh) {
  const hit = candles.find((c) => c.time > sourceTime && c.low <= rangeHigh && c.high >= rangeLow);
  return hit ? hit.time : null;
}
function refreshTradeTargetLinksInternal() {
  for (const p of tradeTargetLinkPrimitives) candleSeries.detachPrimitive(p);
  tradeTargetLinkPrimitives.length = 0;
  if (!props.showTradeSetups || !props.showTrades) return;
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const precision = pricePrecisionForInstrument(props.symbol);
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    for (const target of t.targets ?? []) {
      if (target.sourceTime == null) continue;
      const label = `🎯 ${targetKindLabel(target.kind)} ${fmtPrice(target.price, precision)} #${target.id}`;
      // OB-Ziele als echte Box statt nur einer Linie an der näheren Kante (Bug-Report Philip
      // 2026-07-31: "es zeichnet sich weder Linie noch Box, nur das Label" — price allein reicht
      // für eine Box nicht, rangeLow/rangeHigh seit Migration 20260731170000 auch auf Targets, wie
      // schon bei Confirmations für kind='fib'). Alt-OB-Targets ohne rangeLow/rangeHigh (vor dieser
      // Migration) fallen zurück auf die bisherige Linie.
      //
      // Box-Ende: gespeichertes touchedTime hat IMMER Vorrang vor liveObZoneState (Bug-Report
      // Philip 2026-07-31, vierte Runde: eine schon korrekt auf ihre echte Touch-Kerze gezeichnete
      // Box zog sich später doch wieder bis "jetzt") — liveObZoneState detectet bei JEDEM Render
      // neu anhand der GERADE geladenen M5-Kerzen (tradeSetupM5Candles); verschiebt sich deren
      // Lookback-Fenster später über die damalige Touch-Kerze hinaus, "sieht" die Neuberechnung den
      // Touch nicht mehr und die Zone erscheint fälschlich wieder aktiv. Ein bereits bekanntes
      // touchedTime ist dagegen ein einmalig festgehaltener, echter Fakt — wird nie ungültig. Live
      // nur noch als Versuch für NOCH UNBEKANNTEN Touch-Status (touchedTime null); fällt die Zone
      // dabei aus dem schmalen Lookback-Fenster raus (siehe firstCandleTouchRange oben, Bug-Report
      // 2026-08-07), zuerst noch selbst in den bereits geladenen Kerzen nachschauen, erst dann
      // "letzte geladene Kerze" als wirklich letzter Ausweg.
      if (target.kind === "ob" && target.rangeLow != null && target.rangeHigh != null) {
        const endTime =
          target.touchedTime ??
          liveObZoneState(target)?.endTime ??
          firstCandleTouchRange(candles, target.sourceTime, target.rangeLow, target.rangeHigh) ??
          candles[candles.length - 1].time;
        const primitive = new OrderBlockPrimitive(
          { top: target.rangeHigh, bottom: target.rangeLow, startTime: target.sourceTime, endTime },
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

// Zeichnet die Sweep-/OB-Bestätigungen eines Trades als Linie (PLAN-trade-confluences.md #1) —
// strukturell identisch zu refreshTradeTargetLinksInternal (dieselbe Klick-Infrastruktur, dieselbe
// Tier-Skalierung), eigene Farbe (tradeConfirmation statt tradeTarget) und eigenes Label-Präfix,
// damit sich Bestätigung (bereits passiert) und Target (zukünftige Erwartung) auf einen Blick
// unterscheiden lassen, auch wenn beide zufällig an derselben Stelle sitzen.
function refreshTradeConfirmationLinksInternal() {
  for (const p of tradeConfirmationLinkPrimitives) candleSeries.detachPrimitive(p);
  tradeConfirmationLinkPrimitives.length = 0;
  if (!props.showTradeSetups || !props.showTrades) return;
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
        const endTime =
          confirmation.touchedTime ??
          liveObZoneState(confirmation)?.endTime ??
          firstCandleTouchRange(candles, confirmation.sourceTime, confirmation.rangeLow, confirmation.rangeHigh) ??
          candles[candles.length - 1].time;
        // Pin-Kontext, vierte Art (Chat 2026-08-01, vierte Runde — Bug-Report Philip: DIESE
        // Box, "✔ OB 1,15229 #22", wurde mit der Trade-Setup-Link-Box verwechselt, war bisher
        // komplett unverdrahtet). confirmationId ist bereits die echte trade_confirmations.id.
        const inPinContext = props.pinTradeConfirmationIds?.has(confirmation.id) ?? false;
        const primitive = new OrderBlockPrimitive(
          { top: confirmation.rangeHigh, bottom: confirmation.rangeLow, startTime: confirmation.sourceTime, endTime, confirmationId: confirmation.id, instrument: t.instrument },
          {
            fillColor: cssColorScaled("tradeConfirmation", TRADE_SETUP_OB_FILL_RATIO),
            borderColor: cssColorScaled("tradeConfirmation", TRADE_SETUP_OB_BORDER_RATIO),
            borderWidth: lineWidth("tradeConfirmation"),
            textColor: "rgba(255, 255, 255, 0.9)",
            label,
            inPinContext,
            pinColor: cssColor("pin"),
          },
          candles,
        );
        candleSeries.attachPrimitive(primitive);
        tradeConfirmationLinkPrimitives.push(primitive);
        continue;
      }
      // Self-Heal wie bei Pivot-Targets (firstCandleTouch) — bisher fehlte das hier komplett, eine
      // Bestätigung ohne touchedTime (z.B. ein Fib, das per findClickedFibLevel IMMER touchedTime:
      // null liefert, "kein 'getoucht'-Konzept für ein Fib-Level") zog sich deshalb dauerhaft bis
      // "jetzt" (Bug-Report Philip 2026-07-31). Anders als bei OB-Zonen unkritisch hier: eine
      // Bestätigung (Pivot ODER Fib) ist immer EIN einzelner Preis, keine Zonenspanne — derselbe
      // Zeitebenen-Mismatch wie bei OB kann also nicht auftreten.
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

// Invalidierungs-Linie einer dealing_range (Chat 2026-07-31: "fehlt nur noch die Visualisierung
// der Invalidierung ... eine Linie von dem Zeitpunkt des ersten Entries bis zum Zeitpunkt des
// letzten Exits ALLER trade_positions, die unter einer dealing_range liegen") — bewusst NUR der
// Preis, keine kind/sourceTime/touchedTime-Referenz wie bei Targets/Bestätigungen: "ob die Idee
// gestorben ist" lässt sich direkt live gegen die Kerzen prüfen (Philip: "wissen wir doch
// automatisch, wenn der aktuelle Candle-Preis sie erreicht hat"), keine eigene Touch-Logik nötig.
// Eine Zeile pro dealing_range (nicht pro Ausführung) — mehrere Positionen unter derselben Range
// teilen sich denselben invalidation-Wert, deshalb hier gruppiert statt pro Trade gezeichnet.
function refreshInvalidationLinesInternal() {
  for (const p of invalidationLinePrimitives) candleSeries.detachPrimitive(p);
  invalidationLinePrimitives.length = 0;
  if (!props.showTradeSetups || !props.showTrades) return;
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  const precision = pricePrecisionForInstrument(props.symbol);

  const byRange = new Map();
  for (const t of tradesVisibleForCandles(props.trades, candles)) {
    if (t.invalidation == null) continue;
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

// Bug-Report Philip 2026-07-30 ("okay irgendwie ist es schlimmer als davor HAHAHA"): ALLE
// Annotationen automatisch zu Zeiger-Callouts zu machen, sobald TSC sichtbar ist, ergab bei vielen
// gleichzeitigen Notizen ein unlesbares Spinnennetz aus Verbindungslinien. Jetzt entscheidet Claude
// das PRO Annotation über das neue optionale "pointer"-Feld (siehe validateAnnotationList) — nur
// pointer:true wandert in die schwebenden Chips über der TSC-Karte (siehe claudeCalloutTick), alles
// andere bleibt wie gehabt inline im Canvas (über der Linie/am Punkt, siehe resolveLabelPlacements).
// hline behält seinen Text immer (eigenes Preisachsen-Label, kein Überlappungs-/Streich-Problem wie
// bei line/marker), pointer wird dafür ignoriert.
function refreshClaudeAnnotationsInternal() {
  const annotationsForCanvas = tscCalloutModeActive.value
    ? props.claudeAnnotations.map((a) => (a.type === "hline" || !a.text || !a.pointer ? a : { ...a, text: undefined }))
    : props.claudeAnnotations;
  renderClaudeAnnotations(
    candleSeries,
    annotationsForCanvas,
    claudeAnnotationPrimitives,
    claudeAnnotationPriceLines,
    clipReplay(allCandles),
    props.claudeAnnotationsDate,
  );
}

// rAF-Tick statt einzelner Event-Subscriptions (Pan/Zoom/Resize/TSC-Inhaltsänderung durch Locked-
// Banner etc.) — die Zeiger-Linien müssen auf JEDE Chart-Bewegung reagieren, nicht nur auf Daten-
// änderungen; ein rAF-Loop garantiert das unabhängig davon, welches Event gerade der Auslöser war,
// bei vernachlässigbaren Kosten (ein paar timeToCoordinate/getBoundingClientRect-Aufrufe, nur
// während TSC-Callouts tatsächlich aktiv sind UND es beschriftete Annotationen gibt).
function claudeCalloutTick() {
  claudeCalloutRafId = requestAnimationFrame(claudeCalloutTick);
  if (!chart || !candleSeries || !chartContainerRef.value) return;

  const labeled = tscCalloutModeActive.value ? props.claudeAnnotations.filter((a) => a.type !== "hline" && a.text && a.pointer) : [];
  if (labeled.length === 0) {
    if (claudeCalloutItems.value.length > 0) claudeCalloutItems.value = [];
    if (claudeCalloutLines.value.length > 0) claudeCalloutLines.value = [];
    return;
  }

  // .chart-container füllt .chart-wrapper komplett aus (flex:1, einziges layoutrelevantes Kind,
  // siehe resizeObserver-Kommentar unten) — dessen Rect dient hier als lokaler Koordinaten-
  // Ursprung, ohne einen eigenen Ref auf .chart-wrapper zu brauchen.
  const wrapperRect = chartContainerRef.value.getBoundingClientRect();

  // 1) Verbindungslinien ZUERST anhand der aktuell im DOM stehenden Chips (vom letzten Tick)
  // berechnen — dadurch immer genau einen Frame "hinter" einer Textänderung, aber nie anhand
  // von Chips berechnet, die zu den gleich neu gesetzten Items gar nicht mehr passen.
  const lines = [];
  for (const item of claudeCalloutItems.value) {
    const chipEl = claudeCalloutChipEls[item.id];
    if (!chipEl) continue;
    const chipRect = chipEl.getBoundingClientRect();
    lines.push({
      id: item.id,
      x1: chipRect.left - wrapperRect.left,
      y1: chipRect.top - wrapperRect.top + chipRect.height / 2,
      x2: item.x,
      y2: item.y,
      color: item.color,
    });
  }
  claudeCalloutLines.value = lines;

  // 2) Label-Inhalte + Chart-Anker fürs nächste Chip-Layout neu berechnen.
  const candles = clipReplay(allCandles);
  const items = [];
  for (const ann of labeled) {
    const anchor = annotationAnchorPoint(chart, candleSeries, candles, props.claudeAnnotationsDate, ann);
    if (!anchor) continue; // Zeit/Preis gerade außerhalb des sichtbaren Bereichs
    items.push({ id: calloutIdFor(ann), text: ann.text, color: ann.color ?? CLAUDE_ANNOTATION_COLOR, x: anchor.x, y: anchor.y });
  }
  claudeCalloutItems.value = items;

  // 3) TSC-Karten-Position messen, Label-Stack knapp darüber andocken (Konstante CALLOUT_GAP_PX
  // unten bei den restlichen Layout-Konstanten).
  if (tscCardRef.value?.$el?.nodeType === 1) {
    const tscRect = tscCardRef.value.$el.getBoundingClientRect();
    const tscTopLocal = tscRect.top - wrapperRect.top;
    claudeCalloutStackBottom.value = wrapperRect.height - tscTopLocal + CALLOUT_STACK_GAP_PX;
  }
}

// "Historische OBs"-Toggle (Dashboard-Toolbar) blendet bereits angetestete, aber noch nicht
// invalidierte Zonen aus (analog zum tv-indikator-Toggle, siehe PLAN-notifications.md) —
// invalidierte Zonen bleiben unabhängig davon immer ausgeblendet (eigene, ältere Regel). Gilt
// einheitlich für alle drei Timeframes, kein eigener Feinschalter pro Timeframe nötig.
function filterHistorical(zones) {
  return props.showHistoricalObs ? zones : zones.filter((z) => !z.touched);
}

// BTC-Zonen für EIN Timeframe aus props.poiZones (poi-watcher-Backend, `ob_zones`) — im
// Replay-Modus zusätzlich auf Zonen bis replayUntil beschränkt, damit nicht schon Zonen auftauchen,
// die "in der Zukunft" (relativ zum Replay-Stand) erst entdeckt wurden.
function filterBtcObsZones(timeframe) {
  const byTf = props.poiZones.filter((z) => z.timeframe === timeframe);
  return props.replayUntil == null ? byTf : byTf.filter((z) => z.startTime <= props.replayUntil);
}

// Sammelt die Zonen aller AKTIVIERTEN Timeframe-Toggles (Chat 2026-07-30: "Indikatoren > OBs" bekam
// unabhängige M5-/1H-/4H-Checkboxen statt eines einzelnen showOrderBlocks-Schalters, der bei Forex
// bisher immer nur den gerade angezeigten Chart-Timeframe zeigte). BTC nutzt für 1H/4H fertige
// Zonen aus dem Backend (props.poiZones), Forex erkennt live aus den jeweils passenden Kerzen —
// 1H/M5 laufen dafür auf Kerzen mit, die ohnehin schon für andere Features geladen werden
// (rangesH1Candles/tradeSetupM5Candles), nur 4H (Forex) und M5 (BTC) haben einen eigenen, neuen
// Fetch (siehe loadObs4hCandles/loadObsM5BtcCandles unten).
function collectObsZones() {
  const zones = [];
  if (props.showObs4h) {
    zones.push(
      ...(isForex
        ? detectOrderBlocks(clipReplay(obs4hCandles), "4H", true)
            .filter((z) => !z.invalidated)
            .map((z) => ({ ...z, timeframe: "4H" }))
        : filterBtcObsZones("4H")),
    );
  }
  if (props.showObs1h) {
    zones.push(
      ...(isForex
        ? detectOrderBlocks(clipReplay(rangesH1Candles), "1H", true)
            .filter((z) => !z.invalidated)
            .map((z) => ({ ...z, timeframe: "1H" }))
        : filterBtcObsZones("1H")),
    );
  }
  if (props.showObsM5) {
    const m5Candles = isForex ? tradeSetupM5Candles : obsM5BtcCandles;
    zones.push(
      ...detectOrderBlocks(clipReplay(m5Candles), "5m", isForex)
        .filter((z) => !z.invalidated)
        .map((z) => ({ ...z, timeframe: "5M" })),
    );
  }
  return zones;
}

// Bug-Report Philip 2026-07-31, dritte Runde zur OB-Target-Box: außerhalb Replay zog sich die Box
// bis "jetzt" durch, weil sie ohne echten Touch einfach bis zur letzten geladenen Kerze reicht —
// Philip will stattdessen exakt dasselbe Verhalten wie die live gezeichneten OB-Zonen (dieselbe
// detectOrderBlocks()-Erkennung auf derselben Zeitebene, nicht nur ein einmaliger Snapshot vom
// Klick-Zeitpunkt). Sucht die Original-Zone anhand ihrer beim Klick festgehaltenen Kanten
// (rangeLow/rangeHigh) in der GERADE live neu erkannten Zonen-Liste derselben Zeitebene — bewusst
// unabhängig von showObs1h/-4h/-M5 (ein Target soll sichtbar bleiben, auch wenn der zugehörige
// Live-OB-Indikator-Toggle gerade aus ist), deshalb hier direkt detectOrderBlocks/filterBtcObsZones
// statt collectObsZones.
function liveObZonesForTimeframe(timeframe) {
  if (timeframe === "5M") return detectOrderBlocks(clipReplay(isForex ? tradeSetupM5Candles : obsM5BtcCandles), "5m", isForex);
  if (!isForex) return filterBtcObsZones(timeframe);
  return detectOrderBlocks(clipReplay(timeframe === "1H" ? rangesH1Candles : obs4hCandles), timeframe, true);
}

function liveObZoneState(item) {
  if (item.timeframe == null || item.rangeLow == null || item.rangeHigh == null) return null;
  const zone = liveObZonesForTimeframe(item.timeframe).find((z) => z.top === item.rangeHigh && z.bottom === item.rangeLow);
  return zone ? { touched: zone.touched, endTime: zone.endTime } : null;
}

function refreshPoiZonesInternal() {
  const candles = clipReplay(allCandles);
  const visibleZones = filterHistorical(collectObsZones());
  renderPersistedZones(candleSeries, visibleZones, orderBlockPrimitives, candles, props.pinObZoneKeys);
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
    currentLiquidityLevels = [];
    return;
  }
  const { highs, lows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const relevant = props.showSweptLiquidity
    ? [...highs, ...lows]
    : [...filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true), ...filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true)];
  currentLiquidityLevels = relevant;
  const precision = pricePrecisionForInstrument(props.symbol);
  renderLiquidityLevels(candleSeries, relevant, liquidityPrimitives, candles, {
    debugPrices: props.showLiquidityDebug,
    formatPrice: (price) => fmtPrice(price, precision),
    // "Alter"-Anzeige an den Debug-Preis-Labels (Chat 2026-07-22) — im Replay bezogen auf
    // replayUntil, nicht die echte Uhrzeit, sonst wäre das Alter beim Testen falsch/inkonsistent.
    nowSec: props.replayUntil ?? Math.floor(Date.now() / 1000),
    pinKeys: props.pinLiquidityLevelKeys,
  });
  liquidityMetadata.value = relevant.map(pivotForDisplay);
  liquidityEarliestTime.value = relevant.length > 0 ? Math.min(...relevant.map((lvl) => lvl.pivotTime)) : null;
}

// Sessions-Hintergrundbänder (Chat 2026-07-22) — tzOffsetMinutes kommt aus der Browser-Lokalzeit
// (-getTimezoneOffset() dreht JS' vorzeichenverkehrtes Offset ins übliche "UTC+X"-Format), passend
// zur restlichen Chart-Zeitachse (siehe tickMarkFormatter). Läuft auf allCandles wie refreshLiquidityInternal,
// nicht auf einem der Analyse-spezifischen Kerzen-Arrays (rangesH1Candles etc.).
function refreshSessionsInternal() {
  if (!candleSeries) return; // watch(sessions) kann vor dem ersten Chart-Mount feuern (Store lädt schon bei Modul-Import)
  const candles = clipReplay(allCandles);
  // Sessions sind seit Chat 2026-07-25 pro Asset getrennt (siehe sessions.js) — nur die des
  // gerade angezeigten Symbols rendern, nicht die anderer Instrumente.
  const symbolSessions = sessions.filter((s) => s.instrument === props.symbol);
  // Auf 4h/1D-Kerzen liegen mehrere Sessions in einer einzigen Kerze, die Bänder werden zu
  // bedeutungslosem Gematsche — Dashboard.vue disabled den Toggle-Button dafür bereits
  // (sessionsDisabled), hier zusätzlich gegen props.currentBar geprüft, analog zu
  // refreshEmaInternal (Chat 2026-07-31: "genauso wie bei EMA").
  const sessionsAllowedHere = props.currentBar !== "4h" && props.currentBar !== "1D";
  renderSessions(candleSeries, props.showSessions && sessionsAllowedHere ? symbolSessions : [], sessionPrimitives, candles, {
    // Funktion statt fixer Zahl (Bug-Report Philip 2026-07-22: Zeitumstellung) — allCandles kann per
    // Lazy-Load Monate zurückreichen, ein einzelner "jetzt"-Offset wäre für Kerzen auf der anderen
    // Seite einer Sommer-/Winterzeit-Umstellung eine Stunde daneben. sessionOccurrences fragt diese
    // Funktion PRO TAG einzeln ab (siehe sessions.js: localMidnightUtc).
    tzOffsetMinutes: (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset(),
  });
}

// Vertikale News-Marker (Chat 2026-07-26) — nur Forex (News-Events gibt es nur für EUR/GBP/USD,
// siehe newsEvents.js), analog zu refreshCockpitInternal/refreshSessionsInternal oben.
function refreshNewsMarkersInternal() {
  if (!isForex || !candleSeries) return; // watch(newsEvents) kann vor dem ersten Chart-Mount feuern (Store lädt schon bei Modul-Import)
  const candles = clipReplay(allCandles);
  let relevant = props.showNews ? newsEventsForInstrument(newsEvents, props.symbol) : [];
  // Zukünftige Termine bis zum Ende des aktuellen/Replay-Tages zeigen, weiter Entferntes ausblenden
  // (Bug-Report Philip 2026-07-30: "ich muss die Linie vorher sehen, pro Tag reicht" — löst den
  // pauschalen Replay-Filter vom 2026-07-26 ab, der ALLE zukünftigen Termine versteckte, weil sie
  // die Sicht auf die aktuelle Replay-Kerze verdeckten; ein Termin vom selben Tag verdeckt nichts,
  // der ist ja gerade der Punkt). newsMarkers.js zeichnet die Linie jetzt auch über die letzte
  // geladene Kerze hinaus (siehe dort: extrapolatedX) — das hier ist nur die Scope-Entscheidung,
  // wie weit im Voraus das noch sinnvoll ist: nächste Woche würde über eine Wochenend-Lücke hinweg
  // extrapoliert und läge potenziell sichtbar daneben.
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  relevant = relevant.filter((e) => e.eventTime <= nowSec || isSameBerlinDay(e.eventTime, nowSec));
  renderNewsMarkers(candleSeries, relevant, newsMarkerPrimitives, candles);
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
  return computeRangesPivots(clipReplay(rangesH1Candles), period, cutoff, fmtDateTime);
}

// Punkt-Marker für die H1-Ranges-Pivots — nur sichtbar, wenn sowohl das Ranges-Metadaten-Panel
// als auch der Debug-Modus an sind (siehe Chat: "wenn ranges angetoggelt ist und debug modus").
// Nutzt renderPivotMarkers aus pivotMarkers.ts (Punkt + entzertes Preis-Label ist dort schon
// fertig) — ALLE Pivots EINER Periode in EINER Gruppe (nicht mehr eine Gruppe pro Pivot wie
// früher), damit sich ihre Preis-Labels gegenseitig entzerren können, statt bei eng
// beieinanderliegenden Pivots übereinander zu fallen (Bug-Report Philip 2026-07-19: im
// M5-Replay mit Debug-Modus lagen alle H1-Pivot-Labels eng übereinander). Periode-5- und
// Periode-2-Gruppe laufen seit Chat 2026-07-26 im SELBEN renderPivotMarkers-Aufruf (vorher zwei
// getrennte Primitive-Listen mit unabhängiger Entzerrung — Bug-Report Philip: "wenn ein outer und
// innerpivot auf demselben Punkt liegen, sind die Labels leicht verschoben", weil beide Gruppen
// dieselbe Preis-Position dann je nach ihren EIGENEN, unterschiedlichen Nachbarn unterschiedlich
// weit verschoben haben). Periode-2 bekommt weiterhin kleineren dotRadius + eigene,
// transparentere Farbe (rangesMarker2), damit man beide Periode-Ebenen optisch auseinanderhält
// (siehe Chat: "Transparenz auf 50%").
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
  // Bug-Report Philip 2026-07-26 ("1.32934 ist da, aber sweeped-high kam im Debug-Export nicht"):
  // loadRangesCandles() (Aufrufer dieser Funktion) läuft als EIGENER async Fetch neben loadInitial()
  // her — nur loadInitial() ruft refreshChart() auf, das activeMetadataSnapshot neu baut (siehe dort).
  // Kommt loadInitial() zuerst zurück, baut refreshChart() den Snapshot mit noch alten
  // rangesH1Candles/marketStructureState — und ohne diesen Aufruf hier bliebe er dann eingefroren,
  // bis zufällig der nächste Replay-Schritt oder ein Toggle erneut refreshChart() auslöst, obwohl der
  // Chart selbst (siehe refreshRangesMarkersInternal/refreshMarketStructureInternal oben) längst
  // aktuell ist.
  if (chart) activeMetadataSnapshot.value = buildActiveMetadataSnapshot();
}

// Neuer "1h-Range"-Marktstruktur-Trendalgorithmus (siehe marketStructureAnalysis.ts,
// test/tdd_mit_claude.ts) — läuft über dieselben H1-Pivots wie die Debug-Punktmarker oben, aber
// unabhängig vom Debug-Toggle: das ist das eigentliche Analyse-Ergebnis der Ranges-Funktion, nicht
// nur eine Debug-Hilfe. Reine Weiterleitung an buildMarketStructureState (marketStructureAnalysis.ts)
// — die eigentliche Merge-/Apply-Logik lebt dort, NICHT hier, damit Tests exakt denselben Code
// aufrufen können wie die App (siehe Chat 2026-07-24: "wie kann es sein, dass Tests grün laufen
// aber der Algo trotzdem nicht das macht, was die Tests eigentlich sicherstellen sollen?" — vorher
// war diese Funktion lokal und für Tests nur über eine von Hand nachgebaute Kopie erreichbar).
// Für closesAboveOldHigh/closesBelowLevel/markLqSweeps: dieselben H1-Kerzen wie die Pivot-Erkennung
// selbst (rangesH1Candles), nicht allCandles — das wäre je nach gewähltem Chart-Timeframe eine
// andere Auflösung.
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
    cockpitState.value = null;
    cockpitMetadata.value = null;
    return;
  }
  const nowSec = props.replayUntil ?? Math.floor(Date.now() / 1000);
  // sessions.danger fürs aktuelle Instrument/JETZT — erster automatischer No-Go/Anti-Confluence-
  // Input (Chat 2026-07-26, siehe computeCockpitState in tradeSetupCockpit.ts). Gleicher
  // instrument-Filter + tzOffsetMinutes wie refreshSessionsInternal oben, sonst würde z.B. eine
  // BTC-Sperrzeit auch EURUSD sperren bzw. die Sommer-/Winterzeit-Umstellung falsch einfließen.
  const symbolSessions = sessions.filter((s) => s.instrument === props.symbol);
  const sessionDanger = currentSessionDanger(symbolSessions, nowSec, (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset());
  // News-Events kommen fertig aus der DB (siehe newsEvents.js) — Philip trägt sie per Screenshot
  // ein, hier nur noch der reine "ist gerade eins relevant für dieses Instrument"-Check.
  const newsNoGo = currentNewsNoGo(newsEvents, props.symbol, nowSec);
  // Fokus (falls gesetzt) statt der Live-Liste — computeCockpitState nimmt ohnehin nur das letzte
  // Element als "aktuell relevantes" Setup, ein Ein-Element-Array reicht also, um sie umzulenken.
  const tradeSetupsForCockpit = focusedTradeSetup ? [focusedTradeSetup] : currentTradeSetups;
  const state = computeCockpitState(marketStructureState.value, tradeSetupsForCockpit, sessionDanger, newsNoGo);
  // "Alter"-Anzeige an den LQ-Sweep-Zeilen (Chat 2026-07-22) — im Replay bezogen auf replayUntil,
  // nicht die echte Uhrzeit, sonst wäre das Alter während des Testens falsch/inkonsistent.
  cockpitNowSec.value = nowSec;
  cockpitState.value = state;
  cockpitMetadata.value = {
    h1Trend: state.h1Trend,
    h1Weakening: state.h1Weakening,
    h1LqSweep: pivotForDisplay(state.h1LqSweep),
    m5Setup: state.m5Setup,
    antiConfluences: state.antiConfluences,
    locked: state.locked,
  };
}

// Eigener H1-Fetch fürs Ranges-Metadaten-Panel (und seit Chat 2026-07-28 auch für die H1-Level
// der Trade-Setup-Erkennung, siehe collectH1LqLevels) — lädt genug Historie für das GRÖSSERE der
// beiden Lookback-Fenster (Periode 5 + eingebettete
// Periode 2, siehe Chat 2026-07-19) + Erkennungspuffer. EIN Fetch für beide Perioden (nicht zwei
// separate cTrader-Connects) — computeRangesPivotsFor schneidet sich aus rangesH1Candles selbst
// den für die jeweilige Periode passenden, ggf. kürzeren Ausschnitt raus.
async function loadRangesCandles() {
  if (!isForex) return true;
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

// Eigener Fetch NUR für den 4H-OB-Toggle bei Forex (Chat 2026-07-30) — kein anderes Feature
// braucht 4H-Kerzen, siehe OBS_4H_CANDLE_COUNT oben. Gleiches Out-of-Order-/Poll-Muster wie
// loadRangesCandles, nur ohne die Ranges-spezifischen Lookback-Optionen (fixer Start etc.).
async function loadObs4hCandles() {
  if (!isForex) return true;
  const seq = ++obs4hFetchSeq;
  try {
    const candles = await fetchCandlesCached(
      fetchInitialForexCandles,
      props.symbol,
      "4h",
      OBS_4H_CANDLE_COUNT,
      replayToMs("4h"),
      REPLAY_LOOKAHEAD_SEC,
    );
    if (seq !== obs4hFetchSeq) return true; // inzwischen überholt, siehe oben — kein Fehler
    obs4hCandles = candles;
    refreshPoiZonesInternal();
    return true;
  } catch (err) {
    console.error("4H-OB-Kerzen fehlgeschlagen:", err);
    return false;
  }
}
function scheduleNextObs4hPoll() {
  clearTimeout(obs4hPollTimer);
  const barMs = barSecondsFor("4h") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  obs4hPollTimer = setTimeout(async () => {
    await withPollRetries(loadObs4hCandles);
    if (chart) scheduleNextObs4hPoll();
  }, delay);
}
function startObs4hPolling() {
  loadObs4hCandles();
  scheduleNextObs4hPoll();
}
function stopObs4hPolling() {
  clearTimeout(obs4hPollTimer);
  obs4hPollTimer = null;
}

// Eigener Fetch NUR für den M5-OB-Toggle bei BTC (Chat 2026-07-30) — BTC hat weder Trade-Setups
// noch TSC, die schon eine M5-Historie laden würden (anders als Forex: tradeSetupM5Candles läuft
// dort ohnehin immer). Nutzt dieselbe lokale OKX-fetchInitialCandles-Funktion wie loadInitial,
// über okxBarFor("5m") — Twelve-Data-Rate-Limits spielen bei OKX keine Rolle, kein Cache/Debounce
// nötig wie bei Forex.
async function loadObsM5BtcCandles() {
  if (isForex) return;
  const seq = ++obsM5BtcFetchSeq;
  try {
    const toMs = replayToMs("5m");
    const candles = await fetchInitialCandles(okxBarFor("5m"), OBS_M5_BTC_CANDLE_COUNT, toMs);
    if (seq !== obsM5BtcFetchSeq) return;
    obsM5BtcCandles = candles;
    refreshPoiZonesInternal();
  } catch (err) {
    console.error("BTC-M5-OB-Kerzen fehlgeschlagen:", err);
  }
}
function scheduleNextObsM5BtcPoll() {
  clearTimeout(obsM5BtcPollTimer);
  const barMs = barSecondsFor("5m") * 1000;
  const delay = barMs - (Date.now() % barMs) + CLOSE_POLL_BUFFER_MS;
  obsM5BtcPollTimer = setTimeout(async () => {
    if (props.replayUntil == null) await loadObsM5BtcCandles();
    if (chart) scheduleNextObsM5BtcPoll();
  }, delay);
}
function startObsM5BtcPolling() {
  loadObsM5BtcCandles();
  scheduleNextObsM5BtcPoll();
}
function stopObsM5BtcPolling() {
  clearTimeout(obsM5BtcPollTimer);
  obsM5BtcPollTimer = null;
}

// showRanges (Marker im Chart) und showRangesMetadata (JSON-Panel) sind getrennte Toggles, teilen
// sich aber dieselben H1-Kerzen/Pivots. showTradeSetupCockpit zählt seit Chat 2026-07-19 ebenfalls
// mit ("TSC soll den aktuellsten und wahren Stand anzeigen, selbst wenn Trend im Chart gerade zur
// Übersicht ausgetoggelt ist") — sonst würde marketStructureState (siehe refreshMarketStructureInternal)
// beim Wegtoggeln von Ranges/Metadaten stumpf auf dem letzten Stand einfrieren statt weiter mit-
// zulaufen. showTradeSetups seit Chat 2026-07-28 ebenfalls: computeTradeSetups() liest
// marketStructureState.value für die H1-Level (siehe collectH1LqLevels) — ohne das hier bliebe
// Path A/B ohne H1-Sweeps hängen, sobald Ranges/TSC ausgetoggelt sind, aber Trade-Setups selbst
// an. Laden läuft also, solange MINDESTENS einer der vier an ist, kein unnötiger
// Twelve-Data-Request, solange wirklich niemand (auch nicht die TSC-Karte, auch nicht Trade-Setups
// selbst) hinschaut.
// showObs1h seit Chat 2026-07-30: der 1H-OB-Toggle nutzt bei Forex dieselben Kerzen mit
// (detectOrderBlocks(rangesH1Candles, "1H"), siehe collectObsZones), statt einen eigenen 1H-Fetch
// zu brauchen — muss also ebenfalls dafür sorgen, dass rangesH1Candles geladen bleibt.
function rangesNeedsData() {
  return props.showRanges || props.showRangesMetadata || props.showTradeSetupCockpit || props.showTradeSetups || props.showObs1h;
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

// Erkennung läuft nur, wenn sich die M5-Kerzen oder marketStructureState geändert haben (siehe
// loadTradeSetupM5/refreshMarketStructureInternal) — das Ergebnis (currentTradeSetups) bleibt
// über Timeframe-Wechsel/refreshChart-Aufrufe hinweg stehen, nur renderTradeSetupsInternal()
// (Positionierung) läuft bei jedem Refresh neu. Zeigt die letzten `tradeSetupHistoryCount`
// Setups JE Richtung (analog zu tradeSetupHistoryCountShort/Long + lastTradeSetups im Original)
// — nicht nur das gerade aktive. Nummerierung (1..n, chronologisch) nur für die angezeigte
// Auswahl, nicht global über die gesamte Historie — wir haben keinen fortlaufenden Zähler wie
// das Pine-Original, das bei jedem neuen Live-Setup hochzählt.
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
  // Setups, deren bestätigende M5-OB in einer "forbidden"-Session entstanden ist, direkt raus
  // (Chat 2026-07-29: "meine Regel, wann ich niemals einen Trade setze" — z.B. Asia/Spread Hour,
  // siehe DANGER_LEVELS/isForbiddenAt in sessions.js) statt sie nur als TSC-No-Go anzuzeigen.
  // obStartTime statt fractal.pivotTime, weil der OB der früheste plausible Entry-Zeitpunkt ist —
  // ein Setup, dessen Sweep noch in einer erlaubten Session lag, dessen OB aber erst in der
  // Sperrzeit kommt, ist trotzdem kein handelbarer Entry. VOR takeLast gefiltert, sonst würde ein
  // rausgefiltertes Setup einen der History-Plätze "verbrauchen", ohne angezeigt zu werden. Gilt
  // für BEIDE Richtungen (Philips Regel ist "wann ich niemals einen Trade setze", nicht auf Long
  // beschränkt — sein Beispiel war nur zufällig ein Long-Setup).
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

// Trade-Modus-Klick-Hittest (Chat 2026-07-27) — testet gegen genau die Box, die renderTradeSetupsInternal
// tatsächlich zeichnet (tradeSetupObBoxBounds + obStartTime/-breite), nicht gegen setup.obTop/obBottom
// direkt (das ist der rohe M5-OB, der für setupEntry/invalidation gebraucht wird, aber optisch eine
// andere Fläche als die gezeichnete Box sein kann). Respektiert dieselben Sichtbarkeits-Filter wie
// renderTradeSetupsInternal (Long/Short-Toggle, Replay-Cutoff) — man soll nichts anklicken können,
// was gerade gar nicht gezeichnet ist.
function findClickedSetup(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const price = candleSeries.coordinateToPrice(param.point.y);
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (price == null || time == null) return null;
  return (
    currentTradeSetups.find((s) => {
      if (props.replayUntil != null && s.fractal.pivotTime > props.replayUntil) return false;
      if (s.dir === 1 && !props.showTradeSetupsShort) return false;
      if (s.dir === -1 && !props.showTradeSetupsLong) return false;
      const { top, bottom } = tradeSetupObBoxBounds(s);
      const inTime = time >= s.obStartTime && time <= s.obStartTime + TRADE_SETUP_OB_WIDTH_SEC;
      const inPrice = price <= top && price >= bottom;
      return inTime && inPrice;
    }) ?? null
  );
}

// Ziel-Modus-Klick-Hittest (Chat 2026-07-27: "Können wir die Linien klickbar machen?") — Level sind
// horizontale Linien (keine Fläche), daher Pixel-Toleranz auf der Y-Achse statt eines Preisbereichs
// (bleibt so bei jedem Zoom-Stand gleich "breit" anklickbar). Zeitbereich [pivotTime, endTime] wie
// tatsächlich gezeichnet (siehe liquidity.js: buildLevel) — endTime wächst bei einem noch
// unberührten Level bis zur zuletzt geladenen Kerze mit, ist also praktisch "bis jetzt".
const LIQUIDITY_LINE_CLICK_TOLERANCE_PX = 6;
function findClickedLiquidityLevel(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (time == null) return null;
  return (
    currentLiquidityLevels.find((lvl) => {
      if (time < lvl.pivotTime || time > lvl.endTime) return false;
      const y = candleSeries.priceToCoordinate(lvl.price);
      if (y == null) return false;
      return Math.abs(y - param.point.y) <= LIQUIDITY_LINE_CLICK_TOLERANCE_PX;
    }) ?? null
  );
}

// Ziel-Modus, zweite Klick-Fläche (Chat 2026-07-28: "ein Pivot targetiere ich oder einen OB") —
// testet gegen dieselben allgemeinen OB-Zonen, die auch gezeichnet werden (poiZonesMetadata,
// respektiert also automatisch showObsM5/-1h/-4h/showHistoricalObs, siehe refreshPoiZonesInternal:
// die Liste ist schon leer, wenn alle drei Timeframe-Toggles aus sind). Nur der Preis (nicht die ganze Box) wird als
// Target übernommen — die dem Klick NÄHERE Kante, nicht fest nach Richtung, weil ein Klick näher an
// der Oberkante eher "ich will die Oberkante" meint als andersrum.
function findClickedOBZone(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const price = candleSeries.coordinateToPrice(param.point.y);
  const time = chart.timeScale().coordinateToTime(param.point.x);
  if (price == null || time == null) return null;
  const zone = (poiZonesMetadata.value ?? []).find(
    (z) => !z.invalidated && time >= z.startTime && time <= z.endTime && price <= z.top && price >= z.bottom,
  );
  if (!zone) return null;
  const nearEdge = Math.abs(price - zone.top) < Math.abs(price - zone.bottom) ? zone.top : zone.bottom;
  // endTime friert bei detectOrderBlocks() auf die berührende Kerze ein, sobald touched=true wird
  // (siehe orderBlocks.js) — praktisch also "touchedTime", ohne dass die Zone das Feld extra führt.
  // rangeLow/rangeHigh (Bug-Report Philip 2026-07-31: "es zeichnet sich weder Linie noch Box, nur
  // das Label" — price allein reicht für eine Box nicht) — beide Kanten der Zone, damit
  // refreshTradeTargetLinksInternal/-ConfirmationLinksInternal daraus eine echte OB-Box zeichnen
  // können statt nur eine Linie an der näheren Kante.
  return {
    kind: "ob",
    price: nearEdge,
    sourceTime: zone.startTime,
    touchedTime: zone.touched ? zone.endTime : null,
    rangeLow: zone.bottom,
    rangeHigh: zone.top,
    // Bug-Report Philip 2026-07-31, dritte Runde: außerhalb Replay wollte die Box exakt wie die
    // live gezeichneten OB-Zonen laufen (bis zum echten Touch, sonst frei wachsend) — dafür muss
    // refreshTradeTargetLinksInternal wissen, von welcher Zeitebene die Zone stammt, um dieselbe
    // detectOrderBlocks()-Erkennung live nachzuvollziehen statt nur einen statischen Snapshot zu
    // zeigen (siehe dort).
    timeframe: zone.timeframe,
  };
}

// Bestätigungs-Modus, dritte Klick-Fläche (Chat 2026-07-30, siehe collectFibLevels in
// marketStructureAnalysis.ts) — NUR im Bestätigungs-Modus aktiv, nicht im Ziel-Modus (ein Fib ist
// keine sinnvolle Preis-Erwartung wie Pivot/OB, siehe onSelectTarget in Dashboard.vue). Anders als
// die Liquiditäts-Linie (horizontal, Zeitbereich [pivotTime, endTime]) ist der Fib-Tick ein PUNKT
// (kurzer Strich in der Mitte der Fib-Spanne, siehe FibTickPrimitive) — Hit-Test vergleicht deshalb
// den 2D-Pixel-Abstand zum exakt selben Mittelpunkt, den die Zeichnung auch benutzt, statt eines
// Zeitbereichs + Y-Toleranz.
const FIB_TICK_CLICK_TOLERANCE_PX = 8;
function findClickedFibLevel(param) {
  if (!param.point || !candleSeries || !chart) return null;
  const timeScale = chart.timeScale();
  for (const level of currentFibLevels) {
    const xa = timeScale.timeToCoordinate(level.a.pivotTime);
    const xb = timeScale.timeToCoordinate(level.b.pivotTime);
    if (xa == null || xb == null) continue;
    const x = (xa + xb) / 2;
    const y = candleSeries.priceToCoordinate(level.price);
    if (y == null) continue;
    const dx = param.point.x - x;
    const dy = param.point.y - y;
    if (Math.sqrt(dx * dx + dy * dy) > FIB_TICK_CLICK_TOLERANCE_PX) continue;
    return {
      kind: "fib",
      price: level.price,
      // Der spätere der beiden Anker-Zeitpunkte — erst ab da existiert dieser konkrete Fib-Wert
      // überhaupt (vorher stand mindestens einer der beiden Anker noch nicht fest).
      sourceTime: Math.max(level.a.pivotTime, level.b.pivotTime),
      touchedTime: null, // kein "getoucht"-Konzept für ein Fib-Level, siehe tradeConfirmations.ts
      rangeLow: Math.min(level.a.price, level.b.price),
      rangeHigh: Math.max(level.a.price, level.b.price),
    };
  }
  return null;
}

// Bestätigungs-Modus, vierte Klick-Fläche (milk-city Task "Divergenzen zur Dealing Range
// verknüpfen (klickbar)", 2026-08-15) — NUR im Bestätigungs-Modus aktiv (analog zu Fib: eine
// Divergenz ist bereits passierte Evidenz, keine sinnvolle künftige Preis-Erwartung wie Pivot/OB).
// Nutzt dieselben Primitives wie die live Divergenz-Zeichnung (divergencePriceLinePrimitives,
// siehe refreshRsiDivergenceInternal) samt ihrer bereits vorhandenen distanceTo()-Punkt-zu-Strecke-
// Projektion — eine Divergenz ist also nur klickbar, wenn sie gerade sichtbar gezeichnet ist
// (showRsiDivergence/-History + showRsi an), wie ein Fib-Tick nur bei aktiver Struktur-Anzeige.
// price=toPrice/sourceTime=fromTime/touchedTime=toTime (wie ein Pivot: Linie von Entstehung bis
// späterem "Touch", hier: von Referenz- bis geprüfter Schwungmarke) — fromPrice/fromRsi/toRsi/
// divergenceType zusätzlich, sonst wäre die Divergenz später nicht mehr nachzeichenbar (siehe
// Migration 20260815120000_trade_confirmations_rsi_divergence.sql).
const DIVERGENCE_CLICK_TOLERANCE_PX = 10;
function findClickedDivergence(param) {
  if (!param.point) return null;
  for (const p of divergencePriceLinePrimitives) {
    if (p.distanceTo(param.point.x, param.point.y) > DIVERGENCE_CLICK_TOLERANCE_PX) continue;
    const d = p.divergence;
    return {
      kind: "rsi_divergence",
      price: d.toPrice,
      sourceTime: d.fromTime,
      touchedTime: d.toTime,
      fromPrice: d.fromPrice,
      fromRsi: d.fromRsi,
      toRsi: d.toRsi,
      divergenceType: d.type,
    };
  }
  return null;
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
  if (!isForex || !props.showTradeSetups) return;
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
    // "Long"/"Short" + Pfad-Kürzel + Nummer als erste Zeile (Chat 2026-07-26: "möchte es visuell
    // unterschieden haben" — A = eigenes bestätigtes Protected-Pivot, B = fractal===ls, siehe
    // pathType in tradeSetup.js). Danach je eine Zeile Oberkante/Unterkante der OB, NUR im
    // Debug-Modus (Chat 2026-07-27: "die preise der M5 OB in die Box schreiben, aber nur an, wenn
    // debug modus an") — dieselbe showLiquidityDebug-Bedingung wie bei den anderen Preis-Labels
    // hier. Untereinander statt mit "/" getrennt (Chat 2026-07-27: "dann weiß ich, dass die obere
    // Zahl für die Oberkante ist und die untere für die Unterkante") — reihenfolge top/bottom
    // spiegelt die Box selbst. NUR hier am OB-Label angehängt, NICHT in setup.label selbst — die
    // TSC-Karte (tradeSetupCockpit.ts) baut ihren eigenen "Typ A/B #x"-Text separat aus
    // pathType/setupNumber.
    const obLabelLines = [`${setup.label} ${setup.pathType}${numberSuffix}`];
    if (props.showLiquidityDebug) obLabelLines.push(formatPrice(top), formatPrice(bottom));
    const obBox = new OrderBlockPrimitive(
      { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC },
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

// RSI(14) — anders als EMA oben bewusst auf allCandles (dem gerade angezeigten Chart-Timeframe),
// kein eigener Fetch nötig. Series+Pane werden hier erst bei Bedarf angelegt/entfernt (siehe
// Kommentar an der ursprünglichen addSeries-Stelle im onMounted-Block) statt permanent zu
// existieren und nur leerzulaufen wie ema50Series/ema200Series — echtes chart.removePane()
// vermeidet die Interferenz mit CVDs eigener Stretch-Factor-Pane bei BTC.
function refreshRsiInternal() {
  if (!chart) return;
  if (!props.showRsi) {
    if (rsiSeries) {
      chart.removeSeries(rsiSeries);
      chart.removePane(RSI_PANE_INDEX);
      rsiSeries = null;
      rsiOverboughtLine = null;
      rsiOversoldLine = null;
      positionGauges(); // Pane weg -> BTC-Gauges (siehe dort) müssen nachrücken
    }
    return;
  }
  if (!rsiSeries) {
    rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: cssColor("rsi"),
        lineWidth: nativeLineWidth("rsi"),
        priceLineVisible: false,
        lastValueVisible: true,
        title: "RSI(14)",
        // Feste 0-100-Skala statt Auto-Zoom auf die sichtbare Spanne — sonst würde ein RSI, der
        // z.B. nur zwischen 55 und 65 pendelt, die Y-Achse voll ausfüllen und wie ein extremer
        // Ausschlag aussehen, obwohl er nahe der Mitte liegt (klassische Oszillator-Darstellung
        // braucht die volle 0-100-Referenz).
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 0, maxValue: 100 },
        }),
      },
      RSI_PANE_INDEX,
    );
    // Default-Scale-Margins (10% oben/unten) würden die 0-100-Skala zusätzlich aufblähen (Achse
    // zeigte 0-120 statt 0-100) — hier eng gehalten, RSI-Linie darf ruhig nah an den Panerand.
    rsiSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });
    // Stretch-Factor statt fixer Pixel-Höhe, wie CVD (siehe chart.panes()[1]?.setStretchFactor
    // oben) — konsistent mit CVDs eigener Pane-Größe, statt zwei verschiedene Sizing-Mechanismen
    // in derselben Chart-Instanz zu mischen.
    chart.panes()[RSI_PANE_INDEX]?.setStretchFactor(0.25);
    rsiOverboughtLine = rsiSeries.createPriceLine({ price: 70, color: cssColor("rsi"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
    rsiOversoldLine = rsiSeries.createPriceLine({ price: 30, color: cssColor("rsi"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
  }
  const points = computeRsi(clipReplay(allCandles), DEFAULT_RSI_PERIOD)
    .filter((p) => p.rsi != null)
    .map((p) => ({ time: p.time, value: p.rsi }));
  rsiSeries.setData(points);
  positionGauges();
}

// Divergenz-Konnektoren (Chat 2026-08-11) — läuft NACH refreshRsiInternal (siehe refreshChart()),
// damit rsiSeries bei showRsi+showRsiDivergence schon existiert. Zwei Primitive-Instanzen pro
// gefundener Divergenz (Preis-Bein an candleSeries, RSI-Bein an rsiSeries, siehe rsiRendering.js)
// statt einer einzigen über beide Panes hinweg — lightweight-charts' Primitives hängen immer an
// genau einer Series/Pane.
//
// showRsiDivergenceHistory (Chat 2026-08-11, zweite Runde) läuft ZUSÄTZLICH zu showRsiDivergence,
// ersetzt es nicht — beide zusammen zeichnen dieselbe "aktuelle" Divergenz zwar doppelt (die
// Historie endet strukturell auf demselben letzten Ereignis), das ist aber nur dieselbe Linie
// zweimal übereinander, kein sichtbarer Unterschied.
function refreshRsiDivergenceInternal() {
  for (const p of divergencePriceLinePrimitives) candleSeries.detachPrimitive(p);
  divergencePriceLinePrimitives.length = 0;
  for (const p of divergenceRsiLinePrimitives) rsiSeries?.detachPrimitive(p);
  divergenceRsiLinePrimitives.length = 0;
  for (const p of divergenceOutcomeDebugPrimitives) candleSeries.detachPrimitive(p);
  divergenceOutcomeDebugPrimitives.length = 0;

  // needsDrawing/needsStats bewusst getrennt (Korrektur Philip, vierte Runde: "die liste soll alle
  // divergenzen anzeigen, die durch die historie eh schon berechnet sind" — das Statistik-Panel
  // hängt NICHT an showRsiDivergence/-History/rsiDivergenceHistoryCount, das sind reine
  // Chart-Zeichnungs-Toggles/-Caps. Erste Version dieses Panels hatte fälschlich dieselbe Menge
  // wiederverwendet ("was gerade im Chart sichtbar ist"), das war nicht gemeint.
  const needsDrawing = (props.showRsiDivergence || props.showRsiDivergenceHistory) && props.showRsi && !!rsiSeries;
  const needsStats = props.showRsiDivergenceStats && props.showRsi;
  if (!needsDrawing && !needsStats) {
    rsiDivergenceStatsData.value = null;
    return;
  }

  const candles = clipReplay(allCandles);
  if (candles.length === 0) {
    rsiDivergenceStatsData.value = null;
    return;
  }
  const precision = pricePrecisionForInstrument(props.symbol);

  if (needsDrawing) {
    const drawnDivergences = [
      ...(props.showRsiDivergence ? detectRsiDivergence(candles) : []),
      ...(props.showRsiDivergenceHistory ? detectRsiDivergenceHistory(candles, undefined, undefined, props.rsiDivergenceHistoryCount) : []),
    ];

    for (const d of drawnDivergences) {
      const colorKey = d.type === "bearish" ? "divergenceBearish" : "divergenceBullish";
      const label = `${d.type === "bearish" ? "▽" : "△"} ${fmtPrice(d.fromPrice, precision)} → ${fmtPrice(d.toPrice, precision)}`;
      // Pin-Kontext (Chat 2026-08-17) — derselbe "type|fromTime|toTime"-Schlüssel wie
      // findNearbyPinCandidates' candidateKey für kind='rsi_divergence' (siehe pinContext.js:
      // rsiDivergenceEntryNaturalKey), hier direkt aus den rohen rsi.js-Unix-Sekunden gebaut.
      const inPinContext = props.pinRsiDivergenceKeys?.has(`${d.type}|${d.fromTime}|${d.toTime}`) ?? false;
      const opts = { color: cssColor(colorKey), lineWidth: lineWidth(colorKey), label, inPinContext, pinColor: cssColor("pin") };

      const pricePrimitive = new DivergenceLinePrimitive({ time: d.fromTime, price: d.fromPrice }, { time: d.toTime, price: d.toPrice }, opts, candles, d);
      candleSeries.attachPrimitive(pricePrimitive);
      divergencePriceLinePrimitives.push(pricePrimitive);

      const rsiPrimitive = new DivergenceLinePrimitive({ time: d.fromTime, price: d.fromRsi }, { time: d.toTime, price: d.toRsi }, opts, candles, d);
      rsiSeries.attachPrimitive(rsiPrimitive);
      divergenceRsiLinePrimitives.push(rsiPrimitive);
    }

    // Outcome-Debug — zeichnet für jede oben schon gezeichnete Divergenz die Struktur-Marke aus
    // classifyDivergenceOutcome: grün bis zum Bruch-Zeitpunkt bei "hit", rot bis zum geprüften
    // Fensterende bei "miss", grau bei "pending" (noch nicht genug Kerzen danach geladen). Bewusst
    // literale Farben statt chartColors-Tokens — reine Wegwerf-Debug-Ansicht (siehe
    // rsiDivergenceOutcome.js-Kommentar "wir basteln gerade"), kein Style-Modal-Eintrag für etwas,
    // das übermorgen wieder rausfliegen kann. Bleibt bewusst an denselben Chart-Toggles/-Cap wie
    // die Linien selbst (zeigt Outcomes für das, was gerade gezeichnet ist), anders als die
    // Statistik unten.
    if (props.showRsiDivergenceOutcomeDebug) {
      const OUTCOME_COLOR = { hit: "#26a69a", miss: "#ef5350", pending: "#787b86" };
      for (const d of drawnDivergences) {
        const result = classifyDivergenceOutcome(candles, d);
        if (result.structureLevel == null) continue;
        const color = OUTCOME_COLOR[result.outcome] ?? "#787b86";
        const endTime = result.outcome === "hit" ? result.breakTime : result.windowEndTime;
        const label =
          result.outcome === "hit"
            ? `HIT (${result.barsToBreak} Bars) · Struktur ${fmtPrice(result.structureLevel, precision)}`
            : `${result.outcome.toUpperCase()} · Struktur ${fmtPrice(result.structureLevel, precision)}`;
        const debugPrimitive = new DivergenceLinePrimitive(
          { time: result.structureTime, price: result.structureLevel },
          { time: endTime, price: result.structureLevel },
          { color, lineWidth: 1.5, label },
          candles,
        );
        candleSeries.attachPrimitive(debugPrimitive);
        divergenceOutcomeDebugPrimitives.push(debugPrimitive);
      }
    }
  }

  // Statistik-Panel — IMMER die volle, von der Historie-Erkennung gelieferte Menge (maxCount=
  // Infinity, siehe collectDivergenceHistory: .slice(-Infinity) ergibt das komplette Array), nicht
  // die evtl. viel kleinere rsiDivergenceHistoryCount-Chart-Anzeige-Grenze und unabhängig davon, ob
  // die Chart-Toggles selbst an sind — nur showRsi (RSI-Berechnung nötig) und der Statistik-Toggle
  // selbst zählen.
  rsiDivergenceStatsData.value = needsStats
    ? {
        divergences: detectRsiDivergenceHistory(candles, undefined, undefined, Infinity).map((d) => ({
          ...d,
          ...classifyDivergenceOutcome(candles, d),
        })),
        lookbackBars: DEFAULT_DIVERGENCE_LOOKBACK_BARS,
        lookforwardBars: DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS,
      }
    : null;
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
  if (!isForex) return true;
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
  showLoadOlderButton.value = !!r && r.from < 0 && !reachedHistoryStart;
}

// Gemeinsame Fetch-Logik für den beiläufigen Scroll-Back-Trigger (subscribeVisibleLogicalRangeChange
// oben) UND den manuellen Retry-Button (siehe showLoadOlderButton) — Bug-Report Philip 2026-08-09:
// bei einem cTrader-Timeout blieb das Nachladen unauffällig hängen, bis der User zufällig noch mal
// scrollte und den Handler erneut auslöste. Der Button ruft exakt dieselbe Funktion auf, damit sich
// beide Wege nicht unterscheiden (gleicher loadingOlder-Zustand, gleiche reachedHistoryStart-Logik).
async function loadOlderCandlesNow() {
  if (!chart || loadingOlder || allCandles.length === 0) return;
  if (reachedHistoryStart && reachedCvdHistoryStart) return;

  loadingOlder = true;
  try {
    const tasks = [];
    if (!reachedHistoryStart) {
      const olderPromise = isForex
        ? fetchOlderForexCandles(props.symbol, props.currentBar, allCandles[0].time, FOREX_HISTORY_PAGE_SIZE)
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
    // auf M5 gewechselt und sehe keinen Chart"). bar nur für Forex (siehe replayToMs) — der OKX-Fetch
    // (BTC, else-Zweig unten) bekommt bewusst KEIN bar, kein bekanntes Analogon zum cTrader-Verhalten.
    const toMs = replayToMs(isForex ? props.currentBar : undefined);
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
    if (seq !== loadInitialFetchSeq) return true; // inzwischen überholt, siehe oben — kein Fehler, einfach nichts zu tun
    allCandles = mergeRecent(allCandles, recent);
    if (freshDeltas) allCvdDeltas = mergeRecentDeltas(allCvdDeltas, freshDeltas);
    refreshChart();
    markSuccess();
    return true;
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
    return false;
  }
}

const POLL_RETRY_DELAY_MS = 15_000;
const POLL_MAX_RETRIES = 8; // ~2min zusätzlicher Puffer, bevor der reguläre Kerzenschluss-Poll übernimmt

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generischer Kurz-Retry für alle vier Forex-Poller (pollRecent/loadRangesCandles/
// loadObs4hCandles/loadTradeSetupM5, siehe jeweilige scheduleNext...Poll unten) — alle vier hatten
// dieselbe Schwäche: ein Fehlschlag wurde nur geloggt, der nächste Versuch lief erst beim NÄCHSTEN
// Kerzenschluss (siehe pollRecent-Kommentar). Bug-Report Philip 2026-08-07 (Folgerunde): das erste,
// auf 3 Retries/45s ausgelegte Fenster reichte nicht — cTraders Demo-Server hatte eine mehrminütige
// Verbindungs-Flaute (502 Connect-Timeout gefolgt von rohen "Failed to fetch"-Netzwerkfehlern).
// 8 Retries/~2min decken das ab, ohne bei einem wirklich längeren Ausfall unbegrenzt weiterzuhämmern
// — danach übernimmt ganz normal wieder der reguläre, an den Kerzenschluss gekoppelte Poll. Bricht
// sofort ab, wenn währenddessen unmounted oder in den Replay-Modus gewechselt wurde.
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
        lineWidth: nativeLineWidth("cvdLine"),
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
      lineWidth: nativeLineWidth("emaFast"),
      priceLineVisible: false,
      lastValueVisible: false,
      // Chat 2026-07-25: "wenn der EMA an ist, dann fokusiert die Maus den EMA, anstatt die
      // Candles" — der Magnet-Crosshair (Default) snappt sonst auf den Datenpunkt der Serie, die
      // dem Mauszeiger am nächsten ist, und das ist bei einer glatten EMA-Linie oft eher die EMA
      // selbst als die Kerze. crosshairMarkerVisible:false nimmt die EMA-Serien komplett aus der
      // Magnet-Berechnung raus, Fokus bleibt auf den Kerzen.
      crosshairMarkerVisible: false,
      // Kein title: lightweight-charts zeigt den title-Text als eigenes Label neben der
      // Preisskala an, AUCH wenn lastValueVisible false ist (Bug-Report Philip 2026-07-26: "EMA
      // 200/50 zeigt mir rechts neben der Price-Y-Skala Labels an, brauch ich nicht").
    });
    ema200Series = chart.addSeries(LineSeries, {
      color: cssColor("emaSlow"),
      lineWidth: nativeLineWidth("emaSlow"),
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
  }

  // RSI(14)-Panel (Chat 2026-08-11) — Series+Pane werden erst bei refreshRsiInternal() angelegt
  // (siehe dort), nicht hier fest verdrahtet: ein permanent existierendes, nur leer-genulltes
  // RSI-Panel (analog zu CVD) hat sich beim Testen NICHT sauber mit CVDs Stretch-Factor-Pane
  // vertragen (setHeight(0) auf einer dritten Pane verzerrte CVDs eigene 0.25-Stretch-Aufteilung,
  // Gauges landeten mitten in der RSI-Pane) — echtes chart.removePane() beim Ausschalten umgeht
  // das komplett, der Chart ist dann wieder exakt im alten 2-Panes-Zustand (bzw. 1 bei Forex).

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

  // Kandidatensuche im Radius statt Exakt-Hittest (Chat 2026-08-01, zweite Runde — Bug-Report
  // Philip: "tu mir schwer die Box zu treffen ... lass mal die anderen Lösungsmöglichkeiten
  // anschauen") — Rechtsklick funktioniert jetzt IRGENDWO in der Nähe eines Objekts statt exakt
  // darauf; sammelt alle Trade-Marker/1H-4H-OB-Zonen im PIN_SEARCH_RADIUS um den Klick, nach
  // Distanz sortiert (nächstes zuerst), gekappt auf PIN_MAX_CANDIDATES. Bei genau einem
  // Treffer öffnet Dashboard.vue direkt das Notiz-Popup, bei mehreren eine Auswahl-Liste (siehe
  // dort: onPinContextMenu) — Philip wählt dann aus, statt pixelgenau zielen zu müssen.
  function findNearbyPinCandidates(x, y) {
    const candidates = [];
    for (const p of tradePrimitives) {
      const distance = p.distanceTo(x, y);
      if (distance <= PIN_SEARCH_RADIUS) candidates.push({ kind: "trade_position", trade: p.trade, distance });
    }
    // OB-Zonen — 1H/4H lösen sich gegen die persistierte ob_zones-Zeile auf (kind="ob_zone").
    // M5-Boxen existieren dort NIE (siehe orderBlocks.js/collectObsZones-Kommentar) — bekommen
    // stattdessen einen eigenen Rohdaten-Snapshot-Kind (kind="m5_ob", Chat 2026-08-02: "Rohdaten-
    // Snapshot", JEDE M5-Box soll klickbar sein, nicht nur bereits zu einem Trade-Setup gehörende).
    for (const p of orderBlockPrimitives) {
      const distance = p.distanceTo(x, y);
      if (distance > PIN_SEARCH_RADIUS) continue;
      if (p.zone.timeframe === "5M") {
        candidates.push({
          kind: "m5_ob",
          zone: { instrument: props.symbol, dirNum: p.zone.dir, top: p.zone.top, bottom: p.zone.bottom, startTime: p.zone.startTime },
          distance,
        });
      } else {
        candidates.push({
          kind: "ob_zone",
          zone: { instrument: props.symbol, timeframe: p.zone.timeframe, dir: p.zone.dir, startTime: p.zone.startTime },
          distance,
        });
      }
    }
    // Liquiditäts-Level — im 1h-Chart entspricht die live gezeichnete Linie einer echten
    // liquidity_levels-Zeile (poi-watcher persistiert nur Timeframe '1H', siehe supabase/functions/
    // poi-watcher/index.ts), löst sich also per Natural-Key auf (kind="liquidity_level"). Auf jedem
    // anderen Timeframe (Bug-Report Philip 2026-08-02: "ich will eine M5 LQ-Linie anklicken") gibt
    // es dafür keine DB-Zeile, deshalb Rohdaten-Snapshot (kind="m5_liquidity_level", analog zu
    // m5_ob oben) — inkl. timeframe-Feld (props.currentBar), da das nicht zwingend M5 sein muss.
    for (const p of liquidityPrimitives) {
      const distance = p.distanceTo(x, y);
      if (distance > PIN_SEARCH_RADIUS) continue;
      if (props.currentBar === "1h") {
        candidates.push({
          kind: "liquidity_level",
          level: { instrument: props.symbol, timeframe: "1H", dirNum: p.level.dir, pivotTime: p.level.pivotTime },
          distance,
        });
      } else {
        candidates.push({
          kind: "m5_liquidity_level",
          level: { instrument: props.symbol, timeframe: props.currentBar, dirNum: p.level.dir, price: p.level.price, pivotTime: p.level.pivotTime },
          distance,
        });
      }
    }
    // Trade-Setup-Link-Box (dritte Art, Chat 2026-08-01, dritte Runde) — eigener Primitive-Array
    // (tradeSetupLinkPrimitives), tradeSetupId ist bereits die echte trade_setups.id, siehe
    // refreshTradeSetupLinksInternal.
    for (const p of tradeSetupLinkPrimitives) {
      const distance = p.distanceTo(x, y);
      if (distance <= PIN_SEARCH_RADIUS) {
        candidates.push({
          kind: "trade_setup",
          tradeSetupId: p.zone.tradeSetupId,
          direction: p.zone.direction,
          instrument: p.zone.instrument,
          distance,
        });
      }
    }
    // Trade-Bestätigungs-Box, kind='ob' (vierte Art, Chat 2026-08-01, vierte Runde — Bug-Report
    // Philip: "✔ OB 1,15229 #22" wurde mit der Trade-Setup-Link-Box verwechselt, bisher komplett
    // unverdrahtet). tradeConfirmationLinkPrimitives ist GEMISCHT (OrderBlockPrimitive für kind='ob',
    // LiquidityLinePrimitive für kind='pivot'/'fib', siehe refreshTradeConfirmationLinksInternal) —
    // instanceof-Guard statt einfach .distanceTo() aufzurufen, sonst Crash auf einer Linie ohne
    // diese Methode. confirmationId ist bereits die echte trade_confirmations.id.
    for (const p of tradeConfirmationLinkPrimitives) {
      if (!(p instanceof OrderBlockPrimitive)) continue;
      const distance = p.distanceTo(x, y);
      if (distance <= PIN_SEARCH_RADIUS) {
        candidates.push({ kind: "trade_confirmation", confirmationId: p.zone.confirmationId, instrument: p.zone.instrument, distance });
      }
    }
    // RSI-Divergenz-Konnektoren (Chat 2026-08-11, Philip: "ich will DIR paar Stellen zeigen ... wir
    // haben ja die Funktion da") — nur das Preis-Bein (divergencePriceLinePrimitives), nicht auch
    // das RSI-Bein in der eigenen Pane: dessen priceToCoordinate()-Y ist relativ zur RSI-Pane, nicht
    // zum ganzen Chart-Container wie hier gerechnet (siehe pinContextMenuHandler unten) — für
    // "eine Divergenz anklicken" reicht das Preis-Bein, beide Beine wären ohnehin derselbe DB-Eintrag.
    for (const p of divergencePriceLinePrimitives) {
      const distance = p.distanceTo(x, y);
      if (distance <= PIN_SEARCH_RADIUS) {
        candidates.push({ kind: "rsi_divergence", divergence: p.divergence, instrument: props.symbol, distance });
      }
    }
    // Dedupe (Chat 2026-08-01, dritte Runde) — mehrere Ausführungen (trade_positions) derselben
    // Dealing Range teilen sich dasselbe verlinkte Setup, tauchten deshalb als exakt gleicher
    // Kandidat mehrfach in der Liste auf ("Short-Setup #105" zweimal).
    const candidateKey = (c) => {
      if (c.kind === "trade_position") return `trade_position:${c.trade.id}`;
      if (c.kind === "ob_zone") return `ob_zone:${c.zone.timeframe}|${c.zone.dir}|${c.zone.startTime}`;
      if (c.kind === "m5_ob") return `m5_ob:${c.zone.dirNum}|${c.zone.top}|${c.zone.bottom}|${c.zone.startTime}`;
      if (c.kind === "trade_setup") return `trade_setup:${c.tradeSetupId}`;
      if (c.kind === "liquidity_level") return `liquidity_level:${c.level.dirNum}|${c.level.pivotTime}`;
      if (c.kind === "m5_liquidity_level") return `m5_liquidity_level:${c.level.timeframe}|${c.level.dirNum}|${c.level.pivotTime}`;
      if (c.kind === "rsi_divergence") return `rsi_divergence:${c.divergence.type}|${c.divergence.fromTime}|${c.divergence.toTime}`;
      return `trade_confirmation:${c.confirmationId}`;
    };
    const seen = new Set();
    const deduped = [];
    for (const c of candidates.sort((a, b) => a.distance - b.distance)) {
      const key = candidateKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }
    return deduped.slice(0, PIN_MAX_CANDIDATES);
  }

  // Leichtgewichtiger Boolean-Check fürs Cursor-Feedback (jede Mausbewegung) — baut anders als
  // findNearbyPinCandidates() keine Objekte/kein Sortieren, nur "gibt's überhaupt was in der
  // Nähe".
  function hasNearbyPinCandidate(x, y) {
    return (
      tradePrimitives.some((p) => p.distanceTo(x, y) <= PIN_SEARCH_RADIUS) ||
      orderBlockPrimitives.some((p) => p.distanceTo(x, y) <= PIN_SEARCH_RADIUS) ||
      tradeSetupLinkPrimitives.some((p) => p.distanceTo(x, y) <= PIN_SEARCH_RADIUS) ||
      tradeConfirmationLinkPrimitives.some((p) => p instanceof OrderBlockPrimitive && p.distanceTo(x, y) <= PIN_SEARCH_RADIUS) ||
      liquidityPrimitives.some((p) => p.distanceTo(x, y) <= PIN_SEARCH_RADIUS) ||
      divergencePriceLinePrimitives.some((p) => p.distanceTo(x, y) <= PIN_SEARCH_RADIUS)
    );
  }

  // Rechtsklick -> Pin-Kontextmenü (Chat 2026-08-01). lightweight-charts hat kein natives
  // Rechtsklick-Event (nur subscribeClick/subscribeCrosshairMove oben), daher ein normaler
  // DOM-Listener statt eines chart.subscribe*-Aufrufs. Koordinaten-Umrechnung exakt wie in
  // claudeCalloutTick (siehe dort): chartContainerRef ist .chart-container, das .chart-wrapper
  // komplett ausfüllt, dessen getBoundingClientRect() dient als lokaler Koordinaten-Ursprung —
  // derselbe Pixel-Raum, in dem TradeMarkerPrimitive/OrderBlockPrimitive.distanceTo ihre gecachten
  // Koordinaten halten (timeToCoordinate/priceToCoordinate liefern bereits CSS-Pixel, kein
  // pixelRatio-Faktor nötig). preventDefault() NUR bei mindestens einem Treffer, sonst bleibt das
  // native Browser-Menü unangetastet (kein Verhaltens-Bruch abseits von Markern/Zonen).
  pinContextMenuHandler = (event) => {
    const rect = chartContainerRef.value.getBoundingClientRect();
    const candidates = findNearbyPinCandidates(event.clientX - rect.left, event.clientY - rect.top);
    if (candidates.length === 0) return;
    event.preventDefault();
    emit("pin-context-menu", { candidates, x: event.clientX, y: event.clientY });
  };
  chartContainerRef.value?.addEventListener("contextmenu", pinContextMenuHandler);

  // Cursor-Feedback (Trade-Modus, Chat 2026-07-27, UND Pin, Chat 2026-08-01) — EIN einziger
  // roher mousemove-Listener statt (wie ursprünglich) zwei getrennter (chart.subscribeCrosshairMove
  // fürs eine, ein eigener addEventListener fürs andere): Bug-Report Philip 2026-08-01 "Cursor
  // bleibt immer normal" — lightweight-charts feuert subscribeCrosshairMove bei JEDER Mausbewegung
  // auch außerhalb des Trade-Modus und setzte dort den Cursor unconditional auf "" zurück; das lief
  // als zweiter, unabhängiger Listener und überschrieb den gerade erst per Pin-Hittest
  // gesetzten "context-menu"-Cursor auf jedem einzelnen Frame wieder — sah dadurch aus, als würde
  // sich der Cursor nie ändern, obwohl der Rechtsklick-Hittest selbst (ein einzelnes Event, nicht
  // pro Frame überschreibbar) längst korrekt traf. EIN Listener, EINE Entscheidung pro Bewegung,
  // behebt das strukturell. findClickedSetup/-FibLevel/-Target lesen nachweislich nur param.point
  // (siehe deren Implementierung), ein synthetisches { point: { x, y } } aus derselben
  // rect-basierten Rechnung wie pinContextMenuHandler reicht ihnen also.
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
    // Bug-Report Philip 2026-07-27: "Preisskala verschwindet regelmäßig beim Verschieben/Ziehen/
    // Verkleinern/Vergrößern des Browserfensters, muss dann reloaden" — contentRect liefert
    // Sub-Pixel-Floats (z.B. 842.3984375), lightweight-charts' interne Spalten-/Canvas-Layout-
    // Berechnung für die rechte Preisskala verträgt das bei bestimmten Zwischenwerten während
    // eines laufenden Drags nicht und kollabiert die Preisskala-Spalte dauerhaft auf 0 Breite,
    // bis zum nächsten vollständigen Remount (Reload). Gerundet auf ganze CSS-Pixel vermeidet das.
    // Zusätzlich: während eines Fenster-Drags kann der Callback kurzzeitig mit width/height 0
    // feuern (Fenster momentan nicht gerendert) — ein resize(0, ...) sollte nicht angewendet
    // werden, das ist derselbe Kollaps-Fall, nur durch eine andere Ursache ausgelöst.
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    if (roundedWidth <= 0 || roundedHeight <= 0) return;
    chart.resize(roundedWidth, roundedHeight);
    // .chart-container ist flex:1 in .chart-wrapper und dessen einziges layoutrelevantes Kind
    // (alle Geschwister — Gauges/TSC/Metadaten-Panels — sind position:absolute/fixed) — die
    // beobachtete Höhe entspricht also praktisch exakt der Höhe von .chart-wrapper. Chat
    // 2026-07-30: natives CSS `resize` auf .chart-wrapper (siehe Template/Style unten) mutiert
    // dessen Höhe direkt im DOM: dieser ohnehin schon vorhandene Observer ist der einfachste Weg,
    // das Ergebnis eines Resize-Drags nach localStorage zurückzuschreiben, ohne einen zweiten,
    // eigenen ResizeObserver nur dafür zu brauchen.
    chartWrapperHeight.value = roundedHeight;
    positionGauges();
  });
  resizeObserver.observe(chartContainerRef.value);
  positionGauges();

  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!chart || !range || allCandles.length === 0) return;
    updateLoadOlderButtonVisibility(range);
    if (loadingOlder) return;
    if (range.from > LAZY_LOAD_LOGICAL_THRESHOLD) return;
    if (reachedHistoryStart && reachedCvdHistoryStart) return;
    loadOlderCandlesNow();
  });

  loadInitial();
  scheduleNextPoll();
  if (isForex) {
    // Bug-Report Philip 2026-08-07 ("signal timed out" ständig, vor allem im Live-Modus): bis
    // hierhin lösten loadInitial() oben plus loadTradeSetupM5()/startRangesPolling()/
    // startObs4hPolling() jede für sich eine EIGENE cTrader-Verbindung (Connect+Auth-Handshake)
    // aus, alle im selben Tick — mehrere gleichzeitige frische Handshakes gegen denselben Account
    // waren der plausibelste Grund für die gehäuften Timeouts. Kein Entzerren mehr nötig: die
    // Fetches laufen unverändert alle sofort los, aber `forexCandles.js` sammelt jetzt kurz
    // gleichzeitig eingehende Requests und schickt sie als EINEN Batch-Request raus (eine
    // gemeinsame cTrader-Verbindung statt vier, siehe dort) — Entzerren würde dem sogar im Weg
    // stehen, weil dann nichts mehr zum Bündeln im selben Fenster ankommt.
    loadTradeSetupM5();
    scheduleNextTradeSetupM5Poll();
    if (rangesNeedsData()) startRangesPolling();
    if (props.showObs4h) startObs4hPolling();
  }
  if (!isForex) {
    updateWindowGauge();
    updateDailyGauge();
    windowGaugeTimer = setInterval(updateWindowGauge, POLL_MS);
    dailyGaugeTimer = setInterval(updateDailyGauge, POLL_MS);
    if (props.showObsM5) startObsM5BtcPolling();
  }
  claudeCalloutRafId = requestAnimationFrame(claudeCalloutTick);
});

onUnmounted(() => {
  if (claudeCalloutRafId != null) cancelAnimationFrame(claudeCalloutRafId);
  clearTimeout(obs4hPollTimer);
  clearTimeout(obsM5BtcPollTimer);
  // scheduleNextPoll/-TradeSetupM5Poll/-RangesPoll nutzen setTimeout statt setInterval
  // (Kerzenschluss-Ausrichtung, siehe dort) -> clearTimeout statt clearInterval.
  clearTimeout(pollTimer);
  clearTimeout(tradeSetupM5PollTimer);
  clearTimeout(rangesPollTimer);
  clearInterval(windowGaugeTimer);
  clearInterval(dailyGaugeTimer);
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
  cvdSeries = null;
  ema50Series = null;
  ema200Series = null;
  rsiSeries = null;
  rsiOverboughtLine = null;
  rsiOversoldLine = null;
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
watch(() => props.claudeAnnotations, refreshClaudeAnnotationsInternal);
// tscCalloutModeActive wechselt (TSC wird ein-/ausgeblendet, Locked-Zustand etc.) -> Canvas-Text
// muss sofort erscheinen/verschwinden, nicht erst beim nächsten claudeAnnotations-Wechsel.
watch(tscCalloutModeActive, refreshClaudeAnnotationsInternal);
watch(() => props.poiZones, refreshPoiZonesInternal);
// M5/1H/4H unabhängig an-/ausschaltbar (Chat 2026-07-30) — siehe collectObsZones. showObs1h braucht
// zusätzlich refreshRangesPollingState (rangesNeedsData() prüft jetzt auch showObs1h), showObs4h/
// showObsM5(BTC) starten/stoppen ihre eigene, unabhängige Poll-Pipeline (siehe loadObs4hCandles/
// loadObsM5BtcCandles) — Forex-M5 braucht das NICHT (tradeSetupM5Candles läuft für Forex ohnehin
// immer), daher der isForex-Guard dort.
watch(() => props.showObs1h, () => {
  refreshRangesPollingState();
  refreshPoiZonesInternal();
});
watch(() => props.showObs4h, (on) => {
  if (isForex) {
    if (on) startObs4hPolling();
    else stopObs4hPolling();
  }
  refreshPoiZonesInternal();
});
watch(() => props.showObsM5, (on) => {
  if (!isForex) {
    if (on) startObsM5BtcPolling();
    else stopObsM5BtcPolling();
  }
  refreshPoiZonesInternal();
});
watch(() => props.showHistoricalObs, refreshPoiZonesInternal);
watch(() => props.showLiquidity, refreshLiquidityInternal);
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
  // frischer, spürbar langsamer cTrader-TLS-Connect (siehe loadTradeSetupM5/loadRangesCandles);
  // schnelles mehrfaches Klicken hat sonst mehrere überlappende Fetches gleichzeitig laufen, die
  // (ohne die *FetchSeq-Guards dort, inkl. loadInitialFetchSeq) in falscher Reihenfolge
  // zurückkommen können und den Chart auf einem veralteten Replay-Stand hängen lassen. Bei einem
  // einzelnen Klick spürt man die 400ms nicht.
  clearTimeout(replayFetchDebounceTimer);
  replayFetchDebounceTimer = setTimeout(() => {
    loadInitial();
    if (isForex) loadTradeSetupM5();
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
    rsiSeries?.applyOptions({ color: cssColor("rsi") });
    rsiOverboughtLine?.applyOptions({ color: cssColor("rsi") });
    rsiOversoldLine?.applyOptions({ color: cssColor("rsi") });
    refreshChart();
  },
  { deep: true },
);
// Analog zum chartColors-Watcher oben, für Linienstärke (Chat 2026-07-25, Style-Modal) — siehe
// chartLineWidths.js. Native Serien-Optionen (CVD/EMA) explizit, alles Primitive-basierte über
// refreshChart() (liest lineWidth() live bei jedem Render-Aufruf, genau wie cssColor()).
watch(
  chartLineWidths,
  () => {
    if (!chart) return;
    cvdSeries?.applyOptions({ lineWidth: nativeLineWidth("cvdLine") });
    ema50Series?.applyOptions({ lineWidth: nativeLineWidth("emaFast") });
    ema200Series?.applyOptions({ lineWidth: nativeLineWidth("emaSlow") });
    rsiSeries?.applyOptions({ lineWidth: nativeLineWidth("rsi") });
    refreshChart();
  },
  { deep: true },
);

// Für den "+1 Kerze"-Button in Dashboard.vue: replayUntil lebt dort (fließt nur als Prop rein),
// daher kein direktes Setzen von hier aus möglich — stattdessen den Zeitpunkt der nächsten Kerze
// im AKTUELLEN Timeframe zurückgeben, den Dashboard.vue dann als neuen replayUntil-Wert übernimmt.
// `after == null` (noch kein Replay aktiv) liefert die älteste geladene Kerze, damit der Button
// auch aus Live heraus sofort funktioniert.
// Seit Chat 2026-07-19 (Bug-Report: Button tat einfach nichts) BEWUSST NICHT rein arithmetisch,
// sondern sucht per nextCandleAfter (chartTimeUtils.js) die nächste TATSÄCHLICH geladene Kerze —
// dank REPLAY_LOOKAHEAD_SEC (2500 M5-Kerzen Historie + 2500 Lookahead, siehe timeframes.js)
// enthält allCandles inzwischen auch schon Kerzen ETWAS über replayUntil hinaus, die alte Sorge
// ("allCandles hat strukturell nie eine Kerze nach dem Replay-Stand") gilt also nicht mehr
// uneingeschränkt — WICHTIG: das stimmt nur, wenn allCandles gerade aus einem vollen Fetch stammt.
// Ein Cache-HIT (candleCache.js: cachedCandlesUpTo) muss den dort schon gecachten Lookahead
// deshalb ausdrücklich mit zurückgeben, sonst sieht's hier bei jedem zweiten "+1 Kerze"-Klick nach
// "keine geladene Kerze mehr" aus, obwohl sie im Cache längst daliegt.
// Reicht das geladene Fenster nicht (z.B. Wochenende/Feiertag bei Forex — Chat 2026-07-21: "Das ist
// der Freitag! Am WE gibts kein Forex!!") -> gezielt 7 Tage weiter nachfragen (deckt jede normale
// Markt-Schließzeit ab) und daraus die früheste Kerze NACH `after` nehmen — cTrader liefert nur
// "N Kerzen BIS X" (rückwärts), nie "AB X vorwärts", daher der Umweg über einen extra Fetch statt
// eines direkten Vorwärts-Lookups. Rein arithmetischer Fallback (+ eine Kerzenlänge) nur noch für
// BTC/OKX (kein bekanntes Markt-Schließzeit-Analogon) und falls der Extra-Fetch selbst fehlschlägt.
// Sanity-Check auf den Fund (Bug-Report Philip 2026-07-29: "+1 Kerze" sprang unvermittelt auf den
// echten aktuellen Zeitpunkt): liegt `after` weiter als die angefragten 7 Tage in der Vergangenheit
// zurück (z.B. weil allCandles durch den oben genannten Cache-Hit-Bug fälschlich schon "erschöpft"
// aussah), landet `toMs` selbst in der ECHTEN Zukunft — Twelve Data kann keine Zukunft liefern und
// gibt dann einfach die neuesten ECHTEN Kerzen zurück, beliebig weit von `after` entfernt. So ein
// Fund ist kein Wochenende/Feiertag mehr, sondern ein Bug — lieber nichts zurückgeben (Button tut
// dann einmal nichts) als kommentarlos auf einen falschen Zeitpunkt springen.
const MAX_PLAUSIBLE_GAP_SEC = 7 * 24 * 3600;

// Aus dem früheren defineExpose-jumpToTrade herausgezogen (Chat 2026-08-11, vierte Runde) — das
// RSI-Divergenz-Statistik-Panel (rsiDivergenceStatsData/Template unten) will auf denselben
// "auf einen Zeitraum springen"-Mechanismus zurückgreifen, ohne sich selbst über die exposeRef
// aufzurufen (unnötiger Umweg innerhalb derselben Komponente). jumpToTrade bleibt als dünner
// Wrapper für externe Aufrufer (TradesTable.vue etc.) bestehen.
async function jumpToTimeRange(entryTime, exitTime) {
  if (!chart) return;
  // Bug-Report Philip 2026-07-30, zweite Runde: die erste Version hier lud Seite für Seite RÜCKWÄRTS
  // ab dem aktuellen Datenanfang, bis entryTime erreicht war — bei einem 16 Tage alten Trade schon
  // spürbar langsam, bei einem echt alten Trade (Philip: "2022 Trade der Supergau") wären das
  // hunderte sequentielle Requests gewesen. Stattdessen jetzt ein GEZIELTER Fetch direkt um den
  // Trade herum (Anker kurz nach dem Exit, siehe JUMP_TARGET_BUFFER_BARS), unabhängig davon, wie
  // weit der Trade zurückliegt — das Ergebnis wird vorne an allCandles gehängt, MIT einer
  // bewussten Lücke zum bisherigen Datenanfang dazwischen (gleiches Prinzip wie mergeCandles in
  // candleCache.js: eine Lücke in der Mitte ist unkritisch, lightweight-charts braucht nur
  // strikt aufsteigende Zeiten, keine Lückenlosigkeit). MAX_JUMP_FETCH_PAGES ist nur eine
  // Notbremse für ungewöhnlich lange Trades (Entry Wochen vor Exit), keine Regelgröße.
  const barSeconds = barSecondsFor(props.currentBar);
  if (!loadingOlder && !isTimeCovered(allCandles, entryTime, barSeconds)) {
    loadingOlder = true;
    try {
      let anchor = (exitTime ?? entryTime) + JUMP_TARGET_BUFFER_BARS * barSeconds;
      let pages = 0;
      while (pages < MAX_JUMP_FETCH_PAGES && !isTimeCovered(allCandles, entryTime, barSeconds)) {
        const older = isForex
          ? await fetchOlderForexCandles(props.symbol, props.currentBar, anchor, FOREX_HISTORY_PAGE_SIZE)
          : await fetchOlderCandles(okxBarFor(props.currentBar), anchor);
        if (older.length === 0) break;
        allCandles = older.concat(allCandles);
        anchor = allCandles[0].time;
        pages++;
      }
      refreshChart();
    } catch (err) {
      console.error("Kerzen für Trade-Sprung laden fehlgeschlagen:", err);
    } finally {
      loadingOlder = false;
    }
  }
  const candles = clipReplay(allCandles);
  if (candles.length === 0) return;
  const from = snapToBarTime(candles, entryTime) ?? entryTime;
  const to = exitTime != null ? (snapToBarTime(candles, exitTime) ?? exitTime) : from;
  const fromIdx = candles.findIndex((c) => c.time === from);
  const toIdx = candles.findIndex((c) => c.time === to);
  if (fromIdx === -1 || toIdx === -1) return;

  const centerIdx = (fromIdx + toIdx) / 2;
  const tradeSpanBars = Math.abs(toIdx - fromIdx);
  const currentRange = chart.timeScale().getVisibleLogicalRange();
  const currentBars = currentRange ? currentRange.to - currentRange.from : 100;
  const halfBars = Math.max(currentBars / 2, tradeSpanBars / 2 + 15);
  chart.timeScale().setVisibleLogicalRange({ from: centerIdx - halfBars, to: centerIdx + halfBars });
}

function jumpToDivergence(d) {
  jumpToTimeRange(d.fromTime, d.toTime);
}

defineExpose({
  async nextReplayTime(after) {
    if (after == null) return allCandles[0]?.time ?? null;
    const barSeconds = barSecondsFor(props.currentBar);
    const loaded = nextCandleAfter(allCandles, after);
    if (loaded != null) return loaded;
    if (!isForex) return after + barSeconds;
    try {
      const probe = await fetchInitialForexCandles(props.symbol, props.currentBar, 200, (after + MAX_PLAUSIBLE_GAP_SEC) * 1000);
      const candidate = nextCandleAfter(probe, after);
      if (candidate != null && candidate - after > MAX_PLAUSIBLE_GAP_SEC) {
        console.error(
          `nextReplayTime: Fund (${candidate}) liegt weiter als ${MAX_PLAUSIBLE_GAP_SEC}s nach after (${after}) — ` +
            "vermutlich echte 'jetzt'-Kerzen statt einer echten Markt-Lücke, verworfen.",
        );
        return null;
      }
      return candidate ?? after + barSeconds;
    } catch (err) {
      console.error("Nächste Kerze über eine Lücke hinweg suchen fehlgeschlagen:", err);
      return after + barSeconds;
    }
  },

  // Für den Klick auf eine Zeile in TradesTable.vue (Chat 2026-07-27: "auf den Trade klicken und
  // dann im Chart gleich an diese Stelle springen") — bewusst NICHT über Replay gelöst (das würde
  // alle Kerzen nach dem Trade ausblenden, man will beim Review aber gerade sehen, wie's danach
  // weiterging), sondern ein einfacher Sprung auf der Zeitachse. Per setVisibleLogicalRange (Bar-
  // Index) statt setVisibleRange (Zeit) UND mit der aktuell schon eingestellten Zoomweite
  // (getVisibleLogicalRange) reproduziert — ein fester Bar-Count hätte bei jedem Sprung immer
  // dieselbe (zu enge) Zoomstufe erzwungen, unabhängig davon, wie weit der User gerade rausgezoomt
  // hatte (Bug-Report Philip 2026-07-27: "muss immer ein ganzes Stück rauszoomen, Candles zu
  // riesig"). Nur wenn die aktuelle Zoomweite den Trade selbst (Entry bis Exit) nicht einmal
  // abdecken würde, wird sie für diesen einen Sprung testweise erweitert.
  // Bug-Report Philip 2026-07-30: wiederholtes Klicken auf einen alten Trade (16 Tage zurück) feuerte
  // bei jedem Klick genau EINEN weiteren history-candles-Request mit noch früherem "after", kam aber
  // nie tatsächlich an — diese Funktion sprang bisher einmalig per setVisibleLogicalRange auf den
  // aktuellen Datenrand (snapToBarTime klemmt ein zu altes entryTime auf candles[0].time, siehe
  // chartTimeUtils.js) und überließ das eigentliche Nachladen dem beiläufigen Seiteneffekt des
  // Scroll-Handlers oben — der lädt pro Aufruf aber nur EINE Seite (~8h bei M5), bei 16 Tagen wären
  // das Dutzende Klicks gewesen. Jetzt wird VOR dem Sprung so lange nachgeladen (derselbe
  // loadingOlder-Zustand wie der Scroll-Handler, damit sich beide nicht überschneiden), bis
  // entryTime abgedeckt ist oder wirklich der Anfang der Historie erreicht ist.
  async jumpToTrade(entryTime, exitTime) {
    return jumpToTimeRange(entryTime, exitTime);
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
    <div v-if="!isForex" class="cvd-gauges" :style="{ bottom: gaugesBottom + 'px' }">
      <Gauge id="window" :value="windowDelta" label="Δ 15m" />
      <Gauge id="daily" :value="dailyDelta" label="Δ Tag (UTC)" />
    </div>
    <TradeSetupCockpit
      v-if="isForex"
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

.cvd-gauges {
  position: absolute;
  z-index: 5;
  right: 12px;
  display: flex;
  gap: 8px;
  pointer-events: none;
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

@keyframes ranges-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
