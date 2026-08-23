<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import PriceChart from "../components/PriceChart.vue";
import TradesTable from "../components/TradesTable.vue";
import TradeStats from "../components/TradeStats.vue";
import StyleModal from "../components/StyleModal.vue";
import SessionsModal from "../components/SessionsModal.vue";
import NewsModal from "../components/NewsModal.vue";
import TakeTradeModal from "../components/TakeTradeModal.vue";
import TradeEditModal from "../components/TradeEditModal.vue";
import TradingAccountSwitcher from "../components/TradingAccountSwitcher.vue";
import MetadataPanel from "../components/MetadataPanel.vue";
import ContextMenu from "../components/ContextMenu.vue";
import PinAddPopup from "../components/PinAddPopup.vue";
import PinPanel from "../components/PinPanel.vue";
import { selectedTradingAccountId } from "../tradingAccounts.js";
import { TIMEFRAMES, barSecondsForTimeframeCi } from "../timeframes.js";
import { fetchTrades } from "../trades.js";
import {
  fetchTradeSetupForCockpit,
  linkTradeToSetup,
  addTargetToTrade,
  addConfirmationToTrade,
  addRangeConfirmation,
  updateTrade,
  updateDealingRange,
} from "../tradeIntake.js";
import { fetchObZones } from "../obZones.js";
import { fetchLiquidityLevels1h } from "../liquidityLevels.js";
import {
  fetchPinContext,
  addPinEntry,
  addPinM5ObEntry,
  addPinM5LiquidityEntry,
  addPinRsiDivergenceEntry,
  removePinEntry,
  updatePinNote,
  resolveObZoneId,
  resolveLiquidityLevelId,
  obZoneEntryNaturalKey,
  liquidityLevelEntryNaturalKey,
  m5LiquidityEntryNaturalKey,
  rsiDivergenceEntryNaturalKey,
} from "../pinContext.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { useSessionStorageRef } from "../composables/useSessionStorageRef.js";
import { useTabScopedRef } from "../composables/useTabScopedRef.js";
import { useClaudeAnnotations } from "../composables/useClaudeAnnotations.js";

const SYMBOLS = ["GBPUSD", "EURUSD"];

// Toggle-Zustand persistiert in localStorage (siehe useLocalStorageRef), damit ein Reload nicht
// jedes Mal auf die Default-Werte zurückspringt — die Defaults hier gelten nur beim allerersten
// Aufruf (noch nichts im localStorage). Symbol/Timeframe waren früher reine (nicht-persistierte)
// refs — beim Ranges-Algo-Testen mit Replay (siehe Chat 2026-07-19) nervt ein Reset auf 5m/GBPUSD
// bei jedem Reload aber, deshalb jetzt genau wie die Toggles persistiert. Defaults hier bewusst
// aufs aktuelle Testszenario gesetzt (GBP 1h) statt auf die alten Werte.
const currentSymbol = useLocalStorageRef("currentSymbol", "GBPUSD");
// Trades-Panel-Höhe (Chat 2026-07-30, Bug-Report Philip: "je mehr Trades in der Liste stehen,
// desto kleiner wird der Chart") — .trades-panel hatte ursprünglich nur `max-height`, also eine
// vom INHALT abhängige Höhe: mit wenigen Trades war das Panel klein (Chart groß), mit vielen wuchs
// es bis zum Deckel (Chart entsprechend kleiner). Zweite Runde (Philip: "die tradeliste ist noch
// etwas klein ... lass mich die ganze Seite scrollable machen") gab dem Chart eine eigene, vom
// Trades-Panel unabhängige Höhe (siehe PriceChart.vue: .chart-wrapper) und einen ersten,
// selbstgebauten Maus-Drag-Handle hier. DRITTE Runde (Philip: "wenn ich den Drag-Handle benutze,
// wird nur die Liste größer, nicht der Chart ... die allermeisten Trading-Seiten haben unten
// rechts an der Ecke ein Drag-Handler, genau wie beim Metadaten-Modal") — der eigene Maus-Handler
// hier wird ersetzt durch dasselbe Muster wie MetadataPanel.vue: natives CSS `resize` (kein
// JS-Drag-Code mehr nötig) auf .trades-panel selbst UND auf PriceChart.vue: .chart-wrapper, damit
// BEIDE Panels unabhängig voneinander per Ecken-Handle größenveränderbar sind, nicht nur die
// Grenze dazwischen. tradesPanelHeight wird jetzt vom ResizeObserver unten synchron gehalten
// statt von eigenen mousemove-Handlern. VIERTE Runde (Philip: "wenn pro Tab getrennt: dann
// immernoch möglich allgemein zu speichern? Also wenn ich den PC neu starte...") — useTabScopedRef
// statt useLocalStorageRef: jeder Tab kann unabhängig resizen (wie currentBar), aber ein frischer
// Tab/Browser-Neustart startet trotzdem beim zuletzt irgendwo benutzten Wert, siehe dort.
const tradesPanelHeight = useTabScopedRef("tradesPanelHeight", 600);
const tradesPanelRef = ref(null);
let tradesPanelResizeObserver;
onMounted(() => {
  if (!tradesPanelRef.value) return;
  tradesPanelResizeObserver = new ResizeObserver((entries) => {
    // NICHT entries[0].contentRect.height verwenden — das ist die Höhe OHNE Padding, während die
    // per :style gebundene `height` (bei globalem box-sizing:border-box, siehe style.css) die
    // Höhe INKLUSIVE Padding meint. .trades-panel hat 10px Padding oben/unten: contentRect direkt
    // zurückgeschrieben hätte die Höhe bei jedem Observer-Tick um genau 2x10px schrumpfen lassen,
    // bis sie an min-height hängen blieb (realer Bug, gefunden beim Testen: 600 -> 474 -> 99 ->
    // an der 120px-Grenze geclamped). borderBoxSize ist die höhen-korrekte Alternative.
    const height = Math.round(entries[0].borderBoxSize?.[0]?.blockSize ?? entries[0].target.getBoundingClientRect().height);
    if (height > 0) tradesPanelHeight.value = height;
  });
  tradesPanelResizeObserver.observe(tradesPanelRef.value);
});
onUnmounted(() => tradesPanelResizeObserver?.disconnect());
// currentBar bewusst sessionStorage statt localStorage (siehe Chat 2026-07-19: "ich hab zwei Tabs
// offen, eins im M5 und eins im 1h") — sessionStorage ist pro Tab isoliert, localStorage wäre
// tab-übergreifend geteilt und würde die beiden Tabs gegenseitig auf denselben TF zwingen.
const currentBar = useSessionStorageRef("currentBar", "1h");
// Historische (bereits angetestete) OB-Zonen standardmäßig ausgeblendet, um den Chart
// übersichtlich zu halten — analog zum "Historische OBs"-Toggle im tv-indikator-Projekt
// (dort default auch aus). Ein einzelner Schalter statt pro-Timeframe (4H/1H getrennt wie
// dort), weil hier ohnehin nur "schon getestet ja/nein" existiert, kein Nearest-3-Ranking.
const showHistoricalObs = useLocalStorageRef("showHistoricalObs", false);
// Ersetzt seit Chat 2026-07-30 den einzelnen showOrderBlocks-Schalter (Chat 2026-07-25: "nicht nur
// historische Obs an- und ausschalten ... sondern auch OBs") — Bug-Report Philip: "wenn ich
// Indikatoren > OBs im M5 anhabe, dann werden mir ganz viele M5 OBs angezeigt", weil showOrderBlocks
// bei Forex bisher IMMER nur den gerade angezeigten Chart-Timeframe zeigte, nie M5+1H+4H gleichzeitig.
// Jetzt unabhängig an-/ausschaltbar (siehe PriceChart.vue: collectObsZones), "Historische OBs"
// (Untermenü) bleibt weiterhin ein gemeinsamer Filter für alle drei.
const showObsM5 = useLocalStorageRef("showObsM5", false);
const showObs1h = useLocalStorageRef("showObs1h", true);
const showObs4h = useLocalStorageRef("showObs4h", true);
const showLiquidity = useLocalStorageRef("showLiquidity", true);
// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12 (Philip 2026-08-22:
// "neuer unabhängiger 1H-Level-Toggle") — zeigt persistierte 1H-Level (liquidity_levels) IMMER
// zusätzlich an, unabhängig vom gerade gewählten Chart-Timeframe, analog zu showObs1h bei den
// Order Blocks. Default false: additives Feature, kein Ersatz für showLiquidity (das weiterhin nur
// den aktuellen currentBar live zeigt).
const showLiquidity1h = useLocalStorageRef("showLiquidity1h", false);
// Debug-Hilfsmittel für die Trend-Indikator-Entwicklung: Preise an den Pivot-Linien
// einblenden und die aktuell ausgeblendeten (bereits gesweepten) Liquiditäts-Level
// mitanzeigen. Beide default aus, um den Chart im Normalbetrieb nicht zuzumüllen.
const showLiquidityDebug = useLocalStorageRef("showLiquidityDebug", false);
const showSweptLiquidity = useLocalStorageRef("showSweptLiquidity", false);
const showTradeSetups = useLocalStorageRef("showTradeSetups", true);
// Ein/Ausblenden der eigenen geloggten Trades (Entry/Exit-Marker, verlinkte M5-OB-Box, Target-
// Linien) — Untermenü-Feinschalter unter dem übergeordneten "Trades"-Toggle (showTradeSetups),
// siehe Kommentar im Template.
const showTrades = useLocalStorageRef("showTrades", true);
// Anzahl vergangener Setups je Richtung, analog zu tradeSetupHistoryCountShort/Long im
// tv-indikator (dort default 5, 0-50) — 0 zeigt nur das gerade aktive/letzte Setup.
const tradeSetupHistoryCount = useLocalStorageRef("tradeSetupHistoryCount", 5);
// Long/Short einzeln de-/aktivierbar (siehe Chat 2026-07-19: "hilft für die Übersicht") — beide
// default an. Wirkt sowohl auf die gezeichneten Setups als auch auf das TSC (siehe
// PriceChart.vue: computeTradeSetups() lässt die deaktivierte Richtung komplett weg, TSC zeigt
// dadurch automatisch nur noch das jüngste SICHTBARE Setup).
const showTradeSetupsLong = useLocalStorageRef("showTradeSetupsLong", true);
const showTradeSetupsShort = useLocalStorageRef("showTradeSetupsShort", true);

// "Ranges" — erster Baustein des neuen PA-Analyse-Konzepts (siehe Chat 2026-07-18: weg von der
// verschachtelten Trend-State-Machine, hin zu PA-Analyse/Trendanalyse/Marktstärke als getrennten
// Bausteinen). Lookback-Fenster für die H1-Periode-5-Fraktalsuche, maßgeblich in Stunden
// persistiert (default 168 = 7 Tage) — rangesLookbackDays (unten) ist nur ein Eingabe-Helper,
// der beim Editieren in Stunden umrechnet, kein eigener State.
// Im Toolbar-Label seit Chat 2026-07-19 "Trend" statt "Ranges" (das alte, eigenständige
// Trend/Pivots/Zigzag-Feature ist komplett raus — Ranges IST jetzt die Trendanalyse), seit Chat
// 2026-07-20 "Structure" (passend zu src/marketStructureAnalysis.ts, vormals rangeAnalysis.ts).
// Interne Namen (rangesPeriod, showRanges, ...) bewusst NICHT mitumbenannt, um keinen reinen
// Textumbenennungs-Diff über viele Dateien zu erzeugen — nur die sichtbaren Strings ändern sich.
const rangesPeriod = useLocalStorageRef("rangesPeriod", 5);
const rangesLookbackHours = useLocalStorageRef("rangesLookbackHours", 7 * 24);
const rangesLookbackDays = computed({
  get: () => rangesLookbackHours.value / 24,
  set: (days) => { rangesLookbackHours.value = Math.round(days * 24); },
});
// Eingebetteter zweiter Fraktal-Lauf mit eigener Periode/Lookback (siehe Chat 2026-07-19: "wir
// brauchen nen zweiten state ... mit periode 2" — schnellere Uptrend-Erkennung). Eigene Felder
// statt die obigen umzubenennen, damit rangesLookbackHours/-Period (bereits persistiert) unangetastet
// bleiben.
const ranges2Period = useLocalStorageRef("ranges2Period", 2);
const ranges2LookbackHours = useLocalStorageRef("ranges2LookbackHours", 7 * 24);
const ranges2LookbackDays = computed({
  get: () => ranges2LookbackHours.value / 24,
  set: (days) => { ranges2LookbackHours.value = Math.round(days * 24); },
});
// Fixer Startzeitpunkt statt rollierendem "letzte X Tage"-Fenster (Chat 2026-07-21: "im
// Replaymodus wird das ja immer dynamisch angepasst ... für Testszenarien bräuchte ich einen
// fixen Punkt, ab wann die Pivots gezählt werden sollen") — beim Scrubben durch den Replay-Modus
// verschiebt sich sonst ständig, welche Pivots überhaupt als "die letzten X Tage" zählen, was ein
// Testszenario nicht reproduzierbar macht. EIN gemeinsamer Startzeitpunkt für Periode 5 UND die
// eingebettete Periode 2 (nicht zwei getrennte) — Philip wollte "ab Zeitpunkt X", nicht zwei
// unabhängige Fixpunkte. Bewusst additiv (rangesLookbackHours/ranges2LookbackHours bleiben
// unangetastet, der bestehende Rolling-Modus ist weiterhin der Default) — rangesFixedStartActive
// schaltet nur um, welcher der beiden Cutoff-Berechnungen computeRangesPivotsFor/loadRangesCandles
// (PriceChart.vue) tatsächlich verwenden.
const rangesFixedStartActive = useLocalStorageRef("rangesFixedStartActive", false);
const rangesFixedStartTime = useLocalStorageRef("rangesFixedStartTime", 1783011600); // Default = derselbe Testszenario-Start wie replayTime
// showRanges (Punkt-Marker im Chart, siehe PriceChart.vue) und showRangesMetadata (JSON-Panel)
// sind bewusst getrennte Toggles — Philip will Ranges anzeigen können, ohne dafür das
// Metadaten-Panel offen zu haben (siehe Chat: "man kann ranges nicht einzelnd toggeln"). EIN
// gemeinsames Metadaten-Panel für Periode 5 + eingebettete Periode 2 (siehe PriceChart.vue) —
// kein zweiter showRangesMetadata2-Toggle, Philip reicht "einmal Metadaten".
const showRanges = useLocalStorageRef("showRanges", false);
const showRangesMetadata = useLocalStorageRef("showRangesMetadata", false);
// EMA 50/200 auf M5 (siehe Chat: "Trend über EMA + Anzahl protected highs/lows") — ein Toggle für
// beide Linien zusammen, keine separaten Schalter je Periode (nicht verlangt).
const showEma = useLocalStorageRef("showEma", false);
// EMA rechnet/rendert nur auf M5 (siehe PriceChart.vue: refreshEmaInternal, currentBar !== "5m"
// blendet aus) — Button in anderen TFs disabled statt anklickbar-aber-wirkungslos (Bug-Report
// Philip 2026-07-31: klickt in anderen TFs drauf und wundert sich, dass nichts passiert).
const emaDisabled = computed(() => currentBar.value !== "5m");
// RSI(14)-Panel (Chat 2026-08-11) — anders als EMA nicht auf M5 beschränkt (folgt dem gerade
// gewählten Chart-Timeframe, siehe PriceChart.vue: refreshRsiInternal), daher kein *Disabled-Pendant.
const showRsi = useLocalStorageRef("showRsi", false);
// Divergenz-Konnektoren (Chat 2026-08-11, siehe rsi.js: detectRsiDivergence) — braucht die
// RSI-Pane selbst, deshalb disabled statt wirkungslos anklickbar, wenn showRsi aus ist (Muster
// wie emaDisabled oben).
const showRsiDivergence = useLocalStorageRef("showRsiDivergence", false);
// Zusätzlicher, unabhängiger Toggle für die komplette Divergenz-Historie statt nur der aktuell
// gültigen (Chat 2026-08-11, zweite Runde: "wie viel Aufwand wäre es historische Divergenzen
// anzuzeigen") — läuft NEBEN showRsiDivergence, ersetzt es nicht. rsiDivergenceHistoryCount analog
// zu tradeSetupHistoryCount (siehe unten): wie viele Ereignisse je Richtung.
const showRsiDivergenceHistory = useLocalStorageRef("showRsiDivergenceHistory", false);
const rsiDivergenceHistoryCount = useLocalStorageRef("rsiDivergenceHistoryCount", 5);
// Outcome-Debug (Chat 2026-08-11, dritte Runde, Philip: "kannst du debug mäßig die hits und misses
// im chart anzeigen") — zeichnet die Struktur-Marke aus rsiDivergenceOutcome.js pro Divergenz,
// grün/rot/grau je nach hit/miss/pending. Bewusst NICHT in localStorage (anders als die anderen
// Toggles hier) — reine Wegwerf-Debug-Ansicht, kein Zustand, der über einen Reload hinaus Sinn
// macht, während noch an der Klassifikation selbst herumexperimentiert wird.
const showRsiDivergenceOutcomeDebug = ref(false);
// Statistik-Modal (Chat 2026-08-11, vierte Runde: "ich denke wir wären jetzt bereit für
// statistik") — persistiert wie showRangesMetadata/showDebugMetadata/showPinPanel (gleiches
// Modal-Muster: bleibt über einen Reload hinweg offen, statt bei jedem Reload neu geöffnet werden
// zu müssen).
const showRsiDivergenceStats = useLocalStorageRef("showRsiDivergenceStats", false);
const rsiDivergenceDisabled = computed(() => !showRsi.value);
// Vertikale News-Marker auf dem Chart (Chat 2026-07-26: "ich würd die News gern visuell irgendwo
// sehen") — Sichtbarkeits-Toggle wie showEma/showSessions, die Termine selbst kommen aus dem
// newsEvents.js-Store (siehe PriceChart.vue).
const showNews = useLocalStorageRef("showNews", false);
// "News verwalten"-Modal (Chat 2026-07-26: manueller Eintragungsweg als Fallback) — reiner
// Öffnen/Schließen-Zustand, analog zu showSessionsModal/showStyleModal, nicht persistiert.
const showNewsModal = ref(false);
// Sessions-Indikator (Chat 2026-07-22) — Sichtbarkeits-Toggle für die Hintergrundbänder, die
// eigentlichen Session-Definitionen (Zeiten/Farbe/Label) liegen im sessions.js-Store, den
// SessionsModal.vue direkt editiert. showSessionsModal ist analog zu showStyleModal reiner
// Öffnen/Schließen-Zustand (nicht persistiert), showSessions (die Sichtbarkeit) dagegen schon,
// wie die übrigen Indikator-Toggles.
const showSessions = useLocalStorageRef("showSessions", true);
const showSessionsModal = ref(false);
// Sessions-Bänder markieren Tageszeit-Fenster (Asia/London/NY etc.) — auf 4h/1D-Kerzen liegen
// mehrere Sessions in einer einzigen Kerze, die Bänder werden dann zu bedeutungslosem Gematsche.
// Button in diesen TFs disabled statt anklickbar-aber-nutzlos, analog zu emaDisabled oben (Chat
// 2026-07-31: "genauso wie bei EMA").
const sessionsDisabled = computed(() => currentBar.value === "4h" || currentBar.value === "1D");
// Claude-Antwort-Import (siehe claudeAnnotations.js, trading/chart-daten.md) — Button
// + Modal leben global in App.vue (neben "Backtest-Daten"), in Supabase persistiert (siehe
// claudeAnnotationsStore.js). instrument/dateStr werden jetzt zentral in useClaudeAnnotations.js
// hergeleitet (dieselben Keys wie hier: currentSymbol/replayTime/replayActive), nicht mehr separat
// hier berechnet — claudeAnnotationsDate bleibt als Alias, weil der Prop-Name an PriceChart schon
// so heißt. visibleClaudeAnnotations blendet die Liste aus, wenn der Toggle in App.vue aus ist,
// ohne die geladenen Zeichnungen selbst zu verwerfen.
const { flatAnnotations: claudeAnnotations, visible: claudeAnnotationsVisible, dateStr: claudeAnnotationsDate } = useClaudeAnnotations();
const visibleClaudeAnnotations = computed(() => (claudeAnnotationsVisible.value ? claudeAnnotations.value : []));
// Trade-Setup-Cockpit (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln") — bündelt H1-Range-Analyse + M5-Trade-Setups in einer Karte im Chart. Seit
// Chat 2026-07-27 eine echte Vue-Komponente mit festem Platz — der frühere "neben der letzten
// Kerze"-Positionsmodus (und sein Abstands-Regler) ist entfallen, siehe TradeSetupCockpit.vue.
const showTradeSetupCockpit = useLocalStorageRef("showTradeSetupCockpit", true);
// Style-Modal (Farben aller Chart-Indikatoren, siehe StyleModal.vue/chartColors.js) — reiner
// Öffnen/Schließen-Zustand, NICHT in localStorage (die Farben selbst persistieren bereits über
// den chartColors-Singleton, das Modal muss nicht offen bleiben).
const showStyleModal = ref(false);
// Trade-Modus (Chat 2026-07-27: "damit ich nicht versehentlich in den Chart reinklicke, evtl.
// Buttons einbauen") — bewusst NICHT persistiert (useLocalStorageRef), ein Reload soll immer im
// harmlosen Navigieren-Modus starten, nicht mitten im Trade-Modus von der letzten Session.
const tradeModeActive = ref(false);
const selectedSetupForTrade = ref(null);
// Bearbeiten-Panel (Chat 2026-07-28: "lass die Entity 'trades' CRUD Funktionalität weitermachen",
// ersetzt die vorherigen Inline-Buttons in TradesTable.vue) — nur die Id gemerkt, nicht der Trade
// selbst, damit editingTrade unten immer den LIVE-Stand aus der trades-Liste zeigt (z.B. sofort
// aktualisiert, nachdem im Panel ein Setup/Ziel über den Chart hinzugefügt wurde).
const editingTradeId = ref(null);
const editingTrade = computed(() => trades.value.find((t) => t.id === editingTradeId.value) ?? null);
function onEditRequest(t) {
  editingTradeId.value = t.id;
}
function onTradeDeleted() {
  editingTradeId.value = null;
  refreshTrades();
}
// Ziel hinzufügen (Chat 2026-07-27: "wie wärs, wenn wir ermöglichen, einem Trade ein Target
// hinzuzufügen ... die Linien klickbar machen") — TradesTable.vue's "+"-Button armt hierüber "der
// nächste Klick auf eine Liquiditäts-Linie im Trade-Modus fügt DIESEM Trade das Level als Ziel
// hinzu". Eigener Modus, weil mehrere Arm-Zustände gleichzeitig den Klick-Handler in PriceChart.vue
// umschalten (Setup-OB vs. LQ-Linie, siehe targetModeActive) — nur einer kann gerade "scharf"
// sein, siehe die onXRequest-Funktionen unten.
const targetAddTrade = ref(null);
// Bestätigung hinzufügen (PLAN-trade-confluences.md #1: "genau wie bei Targets, dass ich einfach
// die Linie per Maus anklicke") — Arm-Zustand für die Entry-Ebene (trade_position_id). Nur einer
// der Arm-Zustände kann gerade "scharf" sein, siehe onXRequest-Funktionen unten und
// targetModeActive-Berechnung im Template.
const confirmationAddTrade = ref(null);
// Zweiter Bestätigungs-Arm-Zustand für die Idee-Ebene (dealing_range_id) — Chat 2026-07-31: "wir
// haben die gesamte Basis um alles per Klick übernehmen zu können", ersetzt einen kurz zuvor
// probierten, dann verworfenen manuellen Formular-Weg fürs Dealing-Range-GO.
const rangeConfirmationAddTrade = ref(null);
// Invalidierung per Chart-Klick setzen (Chat 2026-07-31, zweite Runde: "mach wieder so, dass ich
// es im Edit-Modal anklicken kann") — nimmt denselben Pivot/OB-Klick wie Target-Modus, aber
// schreibt den Preis direkt auf dealing_ranges.invalidation statt eine trade_targets-Zeile
// anzulegen (siehe onSelectTarget unten). Die frühere Retrofit-Verknüpfung (🔗 Setup verknüpfen,
// linkTargetTrade) ist komplett raus — das automatische Setup-Klick-zu-Bestätigungen
// (onSelectSetupConfirmations unten) deckt denselben Bedarf ab, siehe TradeEditModal.vue.
const invalidationAddTrade = ref(null);
function onAddTargetRequest(t) {
  targetAddTrade.value = t;
  confirmationAddTrade.value = null;
  rangeConfirmationAddTrade.value = null;
  invalidationAddTrade.value = null;
  tradeModeActive.value = true;
}
function onAddConfirmationRequest(t) {
  confirmationAddTrade.value = t;
  targetAddTrade.value = null;
  rangeConfirmationAddTrade.value = null;
  invalidationAddTrade.value = null;
  tradeModeActive.value = true;
}
function onAddRangeConfirmationRequest(t) {
  rangeConfirmationAddTrade.value = t;
  targetAddTrade.value = null;
  confirmationAddTrade.value = null;
  invalidationAddTrade.value = null;
  tradeModeActive.value = true;
}
function onSetInvalidationRequest(t) {
  invalidationAddTrade.value = t;
  targetAddTrade.value = null;
  confirmationAddTrade.value = null;
  rangeConfirmationAddTrade.value = null;
  tradeModeActive.value = true;
}
// Verlassen des Trade-Modus räumt eine noch "scharfe" Ziel-/Bestätigungs-/Invalidierungs-Anfrage
// mit ab — sonst würde ein späteres Wieder-Reinklicken in den Trade-Modus (für einen ganz anderen
// Zweck) unerwartet den alten Trade verändern.
watch(tradeModeActive, (active) => {
  if (!active) {
    targetAddTrade.value = null;
    confirmationAddTrade.value = null;
    rangeConfirmationAddTrade.value = null;
    invalidationAddTrade.value = null;
  }
});
// target: {kind, price, sourceTime, touchedTime} — siehe PriceChart.vue: findClickedTarget (Pivot
// oder OB, Chat 2026-07-28). Dieselbe Klick-Quelle bedient jetzt sowohl Target- als auch
// Bestätigungs-Anfragen (PLAN-trade-confluences.md #1) — welches der beiden gemeint ist, entscheidet
// allein, welcher Arm-Zustand gerade gesetzt ist.
async function onSelectTarget(target) {
  if (targetAddTrade.value) {
    const trade = targetAddTrade.value;
    targetAddTrade.value = null;
    // Ziele gehören zur dealing_range, nicht zur einzelnen Ausführung (Chat 2026-07-31).
    const ok = await addTargetToTrade(trade.dealingRangeId, target);
    if (ok) refreshTrades();
    return;
  }
  if (confirmationAddTrade.value) {
    const trade = confirmationAddTrade.value;
    confirmationAddTrade.value = null;
    const ok = await addConfirmationToTrade(trade.id, target);
    if (ok) refreshTrades();
    return;
  }
  if (rangeConfirmationAddTrade.value) {
    const trade = rangeConfirmationAddTrade.value;
    rangeConfirmationAddTrade.value = null;
    const ok = await addRangeConfirmation(trade.dealingRangeId, target);
    if (ok) refreshTrades();
    return;
  }
  if (invalidationAddTrade.value) {
    const trade = invalidationAddTrade.value;
    invalidationAddTrade.value = null;
    const ok = await updateDealingRange(trade.dealingRangeId, { invalidation: target.price });
    if (ok) refreshTrades();
  }
}
// Ganzes Trade-Setup als Bestätigungen übernehmen (Chat 2026-07-31: "wenn ich ein Trade-Setup
// anklicke, sollen LS und OB als Bestätigung aufgenommen werden. PP, falls vorhanden, als
// Stop-Loss der trade_position") — nur im Bestätigungs-Modus erreichbar (PriceChart.vue:
// subscribeClick), deshalb hier dieselben beiden Arm-Zustände wie onSelectTarget statt eines
// dritten. LS/OB gehen an dieselbe Ebene (Range oder Position), die gerade "scharf" ist; der
// Stop-Loss sitzt IMMER auf der Ausführung (trade_position), unabhängig davon, welche Ebene für
// die Bestätigungen gerade gewählt ist — dafür braucht es aber überhaupt eine offene Ausführung.
async function onSelectSetupConfirmations(setup) {
  const trade = confirmationAddTrade.value ?? rangeConfirmationAddTrade.value;
  if (!trade) return;
  const isRangeLevel = rangeConfirmationAddTrade.value != null;
  confirmationAddTrade.value = null;
  rangeConfirmationAddTrade.value = null;

  const lsConfirmation = {
    kind: "pivot",
    price: setup.ls.price,
    sourceTime: setup.ls.pivotTime,
    touchedTime: setup.ls.touchedTime ?? null,
  };
  // Bewusst die ROHEN (nicht ums Fraktal geweiteten) OB-Kanten (setup.obTop/obBottom), NICHT
  // tradeSetupObBoxBounds() — Bug-Report Philip 2026-07-31, zweite Runde ("OB zeichnet sich durch
  // bis zum jetzigen Zeitpunkt, sollte nur bis zur berührenden Kerze"): detectSetupObs() ruft
  // laut eigenem Kommentar 1:1 detectOrderBlocks(candles, "5m") auf und übernimmt dessen top/bottom
  // unverändert — mit timeframe:"5M" findet PriceChart.vue: liveObZoneState darüber dieselbe Zone
  // live wieder und zeichnet die Box bis zum ECHTEN Touch, statt bis "jetzt" (kein Touch bekannt).
  // Die geweitete Box bleibt dem Setup selbst vorbehalten (dort ist die feste Breite/kein Live-
  // Tracking ohnehin unkritisch, siehe refreshTradeSetupLinksInternal).
  const obConfirmation = {
    kind: "ob",
    price: setup.dir === 1 ? setup.obBottom : setup.obTop,
    sourceTime: setup.obStartTime,
    touchedTime: null,
    rangeLow: setup.obBottom,
    rangeHigh: setup.obTop,
    timeframe: "5M",
  };

  const addFn = isRangeLevel ? (c) => addRangeConfirmation(trade.dealingRangeId, c) : (c) => addConfirmationToTrade(trade.id, c);
  await addFn(lsConfirmation);
  await addFn(obConfirmation);

  // pathType "A" = eigenes bestätigtes Protected-Pivot (siehe tradeSetup.js), "B" = fractal===ls,
  // also KEIN eigenständiger PP — "falls vorhanden" heißt genau das.
  if (setup.pathType === "A") {
    await updateTrade(trade.id, { stopLoss: setup.fractal.price });
  }
  // Übernimmt auch die Setup-Verknüpfung selbst (trade_setup_id + die davon abgeleitete
  // Invalidierung) — ersetzt die frühere manuelle "🔗 Setup verknüpfen"-Aktion (Chat 2026-07-31,
  // zweite Runde: "kann weg, da ... die Bestätigungen fügen sich von selbst hinzu"), same Ableitung
  // wie createTradeFromSetup für einen brandneuen Trade.
  await linkTradeToSetup(trade.dealingRangeId, currentSymbol.value, setup);

  refreshTrades();
}
async function onSelectSetup(setup) {
  selectedSetupForTrade.value = setup;
}

// Klick auf eine Zeile in TradesTable.vue: springt im Chart hin (siehe jumpToTrade, Chat
// 2026-07-27, erste Runde) UND fokussiert den TSC auf das verknüpfte Trade-Setup, falls
// vorhanden — kein trade_setup_id (älterer/manueller Trade ohne Verknüpfung) räumt einen evtl.
// noch aktiven Fokus einfach ab, statt eine veraltete Karte stehen zu lassen.
async function onSelectTrade(t) {
  priceChartRef.value?.jumpToTrade(t.entryTime, t.exitTime);
  if (t.tradeSetupId == null) {
    priceChartRef.value?.clearTradeSetupFocus();
    return;
  }
  const setup = await fetchTradeSetupForCockpit(t.tradeSetupId);
  if (setup) priceChartRef.value?.focusTradeSetup(setup);
}

// Hover statt Klick (Chat 2026-08-01) — bewusst OHNE jumpToTrade/TSC-Fokus wie bei onSelectTrade,
// nur eine reine Hervorhebung der schon sichtbaren Marker (siehe hoveredTradeId-Prop an
// PriceChart.vue), damit ein flüchtiges Drüberfahren nicht den Chart wegscrollt.
const hoveredTradeId = ref(null);
function onHoverTrade(t) {
  hoveredTradeId.value = t?.id ?? null;
}

// Pin-Kontextmenü (Chat 2026-08-01, zweite Runde — "lass mal die anderen Lösungsmöglichkeiten
// anschauen", Philip tat sich mit dem pixelgenauen Treffen schwer) — TradesTable.vue/PriceChart.vue
// liefern jetzt immer eine Liste von KANDIDATEN (bei der Tabellenzeile immer genau einer, beim
// Chart alles im Fangradius um den Klick, siehe PriceChart.vue: findNearbyPinCandidates). Bei
// genau einem Kandidaten geht's direkt zum Notiz-Popup, bei mehreren erst eine Auswahl-Liste
// (pinCandidateMenu) — beide teilen sich denselben Kandidaten-Shape: { kind: "trade_position",
// trade } | { kind: "ob_zone", zone: {instrument, timeframe, dir, startTime} }.
const pinCandidateMenu = ref(null); // { candidates, x, y } | null
const pinAddPopupTarget = ref(null); // { kind, trade?/zone?, x, y } | null
// Nur bei kind="ob_zone" relevant (siehe onPinAddConfirm) — resolveObZoneId kann fehlschlagen,
// wenn poi-watcher diese Zone noch nicht persistiert hat; Popup bleibt dann offen statt zu schließen.
const pinAddPopupError = ref(null);

// Bug-Report Philip 2026-08-01: eine Dealing Range mit mehreren Re-Entries (mehrere
// trade_positions, siehe CLAUDE.md-Abschnitt zum Trade-Journal) erzeugte in der Kandidaten-Liste
// mehrere IDENTISCH aussehende Einträge ("Short #26" dreimal) — nicht unterscheidbar, welcher
// welcher ist. Trade-position-id (dieselbe "#<id>", die auch TradeEditModal.vue im Titel zeigt)
// dazu, damit jede Zeile eindeutig ist.
function pinCandidateLabel(c) {
  if (c.kind === "ob_zone") return `${c.zone.timeframe} ${c.zone.dir === 1 ? "Bull" : "Bear"}-OB`;
  if (c.kind === "m5_ob") return `M5 ${c.zone.dirNum === 1 ? "Bull" : "Bear"}-OB`;
  if (c.kind === "trade_setup") return `${c.direction === "short" ? "Short" : "Long"}-Setup #${c.tradeSetupId} (${c.instrument})`;
  if (c.kind === "trade_confirmation") return `✔ Bestätigung #${c.confirmationId} (${c.instrument})`;
  if (c.kind === "liquidity_level") return `1H LQ-Level ${c.level.dirNum === 1 ? "Hoch" : "Tief"}`;
  if (c.kind === "m5_liquidity_level") return `${c.level.timeframe} LQ-Level ${c.level.dirNum === 1 ? "Hoch" : "Tief"}`;
  if (c.kind === "rsi_divergence") return `RSI-Divergenz (${c.divergence.type === "bearish" ? "bearish" : "bullish"}, ${c.instrument})`;
  return `${c.trade.direction === "short" ? "Short" : "Long"} #${c.trade.dealingRangeId} · Position #${c.trade.id}`;
}

function onPinContextMenu({ candidates, x, y }) {
  if (candidates.length === 0) return;
  if (candidates.length === 1) {
    pinAddPopupTarget.value = { ...candidates[0], x, y };
    pinAddPopupError.value = null;
    return;
  }
  pinCandidateMenu.value = { candidates, x, y };
}
function onPinCandidateSelect(key) {
  const menu = pinCandidateMenu.value;
  pinCandidateMenu.value = null;
  const candidate = menu?.candidates[Number(key)];
  if (!candidate) return;
  pinAddPopupTarget.value = { ...candidate, x: menu.x, y: menu.y };
  pinAddPopupError.value = null;
}
async function onPinAddConfirm(note) {
  const target = pinAddPopupTarget.value;
  if (target.kind === "ob_zone") {
    const { instrument, timeframe, dir, startTime } = target.zone;
    const obZoneId = await resolveObZoneId(instrument, timeframe, dir, startTime);
    if (obZoneId == null) {
      // poi-watcher refresht 1H/4H nur einmal pro Stunde/4h-Boundary (siehe CLAUDE.md
      // poi-watcher-Throttling) — eine gerade erst entstandene Zone kann also noch fehlen.
      pinAddPopupError.value = "Diese OB-Zone ist noch nicht gespeichert (poi-watcher braucht bis zu einer Stunde) — bitte gleich nochmal versuchen.";
      return;
    }
    await addPinEntry("ob_zone", obZoneId, note);
  } else if (target.kind === "trade_setup") {
    // Kein Resolve nötig — trade_setups.id ist schon direkt bekannt (siehe PriceChart.vue:
    // refreshTradeSetupLinksInternal), anders als bei ob_zone.
    await addPinEntry("trade_setup", target.tradeSetupId, note);
  } else if (target.kind === "trade_confirmation") {
    // Kein Resolve nötig — trade_confirmations.id ist schon direkt bekannt, analog zu trade_setup.
    await addPinEntry("trade_confirmation", target.confirmationId, note);
  } else if (target.kind === "liquidity_level") {
    const { instrument, timeframe, dirNum, pivotTime } = target.level;
    const liquidityLevelId = await resolveLiquidityLevelId(instrument, timeframe, dirNum, pivotTime);
    if (liquidityLevelId == null) {
      // poi-watcher refresht 1H nur einmal pro Stunde (siehe CLAUDE.md poi-watcher-Throttling) —
      // ein gerade erst entstandenes Level kann also noch fehlen.
      pinAddPopupError.value = "Dieses Liquiditäts-Level ist noch nicht gespeichert (poi-watcher braucht bis zu einer Stunde) — bitte gleich nochmal versuchen.";
      return;
    }
    await addPinEntry("liquidity_level", liquidityLevelId, note);
  } else if (target.kind === "m5_ob") {
    // "m5_ob" bleibt hier ein rein clientseitiger Kandidaten-Kind (siehe PriceChart.vue:
    // findNearbyPinCandidates) — anders als resolveObZoneId oben (SELECT-only, wartet auf
    // poi-watcher) legt addPinM5ObEntry die ob_zones-Zeile bei Bedarf per find-or-create gleich mit
    // an (Punkt 6), landet danach aber als ganz normaler kind='ob_zone'-Pin.
    await addPinM5ObEntry(target.zone, note);
  } else if (target.kind === "m5_liquidity_level") {
    // Kein Resolve nötig — Liquiditäts-Level auf einem Nicht-1h-Timeframe werden nie persistiert,
    // Rohdaten-Snapshot direkt (siehe addPinM5LiquidityEntry).
    await addPinM5LiquidityEntry(target.level, note);
  } else if (target.kind === "rsi_divergence") {
    // Kein Resolve nötig — Divergenzen werden nie persistiert, Rohdaten-Snapshot direkt (siehe
    // addPinRsiDivergenceEntry).
    await addPinRsiDivergenceEntry(target.instrument, target.divergence, note);
  } else {
    await addPinEntry("trade_position", target.trade.id, note);
  }
  pinAddPopupTarget.value = null;
  pinAddPopupError.value = null;
  refreshPinContext();
}
async function onPinRemove(entryId) {
  await removePinEntry(entryId);
  refreshPinContext();
}
async function onPinUpdateNote(entryId, note) {
  await updatePinNote(entryId, note);
  refreshPinContext();
}

// Pin-Panel-Hover → Chart-Auswahl-Halo (Chat 2026-08-18, Task "Pin-Kontext: Listen-Hover hebt
// Chart-Highlight hervor, Klick springt hin") — Philip: bei einer ganzen Liste von Pins (z.B. von
// Lana via add_pin_entry angelegt) muss er erst zuordnen können, welcher Listen-Eintrag zu welchem
// Chart-Highlight gehört. Analog zu onHoverTrade oben, aber für alle Pin-Kinds. kind='trade_position'
// läuft bewusst über das bestehende hoveredTradeId (kein eigener Prop nötig, siehe dort) — beide
// Quellen (TradesTable.vue-Hover UND PinPanel.vue-Hover) schreiben denselben Ref, es kann ohnehin
// immer nur EINE Zeile gleichzeitig gehovert sein.
const hoveredPinEntry = ref(null);
function onPinHover(entry) {
  hoveredPinEntry.value = entry;
  if (entry == null || entry.kind === "trade_position") {
    hoveredTradeId.value = entry?.tradePositionId ?? null;
  }
}
// Kaskaden-Regel für gepinnte 1h/4h/M5-Objekte (Bug 2026-08-21, Philip: "1h/4h OBs oder
// LQ-Levels, die ich anpinne, sollen im M5 trotzdem angezeigt werden ... M5 OBs in 4h TF
// anzuzeigen ist nicht so hilfreich, es verdeckt die Sicht") — ein gepinntes Objekt wird nur auf
// seinem EIGENEN oder einem FEINEREN Timeframe angezeigt (z.B. ein 4h-Pin ist auf 4h/1h/M5
// sichtbar, aber NICHT umgekehrt ein M5-Pin auf 4h). barSecondsForTimeframeCi liefert null bei
// unbekanntem/fehlendem Timeframe-String — dann fail-open (true), ein Datenlücken-Fall bleibt
// lieber sichtbar als dass er unsichtbar verschwindet.
function pinVisibleOnCurrentTf(pinTimeframeRaw) {
  const pinSec = barSecondsForTimeframeCi(pinTimeframeRaw);
  const currentSec = barSecondsForTimeframeCi(currentBar.value);
  if (pinSec == null || currentSec == null) return true;
  return currentSec <= pinSec;
}
// Dieselben Filter (aktuelles Symbol/Timeframe/Kaskaden-Regel) wie pinObZoneKeys & Co. oben — ein
// gehoverter Eintrag für ein anderes Symbol oder einen gröberen Timeframe ergibt hier bewusst
// KEINEN Treffer (die zugehörige Chart-Stelle existiert im gerade sichtbaren Chart schlicht nicht).
const hoveredPinObZoneKey = computed(() => {
  const e = hoveredPinEntry.value;
  if (!e) return null;
  // M5-OB-Pins laufen seit Punkt 6 (Migration 20260823120000) über denselben kind='ob_zone' wie
  // 1H/4H (e.obZone.timeframe === "5M") — kein eigener m5_ob-Zweig mehr nötig.
  if (e.kind === "ob_zone" && e.obZone?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.obZone.timeframe)) {
    return obZoneEntryNaturalKey(e.obZone);
  }
  return null;
});
const hoveredPinTradeSetupId = computed(() => {
  const e = hoveredPinEntry.value;
  return e?.kind === "trade_setup" && e.tradeSetup?.instrument === currentSymbol.value ? e.tradeSetupId : null;
});
const hoveredPinTradeConfirmationId = computed(() =>
  hoveredPinEntry.value?.kind === "trade_confirmation" ? hoveredPinEntry.value.tradeConfirmationId : null,
);
// Kaskaden-Regel statt reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf
// oben) — ein auf 4H gepinntes Level bekommt jetzt auch auf 1H/M5 einen Halo, nicht nur auf 4H
// selbst; ein auf M5 gepinntes Level aber weiterhin keinen auf 1H/4H.
const hoveredPinLiquidityLevelKey = computed(() => {
  const e = hoveredPinEntry.value;
  if (!e) return null;
  if (e.kind === "liquidity_level" && e.liquidityLevel?.instrument === currentSymbol.value && pinVisibleOnCurrentTf("1H")) {
    return liquidityLevelEntryNaturalKey(e.liquidityLevel);
  }
  if (e.kind === "m5_liquidity_level" && e.m5Liquidity?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.m5Liquidity.timeframe)) {
    return m5LiquidityEntryNaturalKey(e.m5Liquidity);
  }
  return null;
});
const hoveredPinRsiDivergenceKey = computed(() => {
  const e = hoveredPinEntry.value;
  return e?.kind === "rsi_divergence" && e.rsiDivergence?.instrument === currentSymbol.value ? rsiDivergenceEntryNaturalKey(e.rsiDivergence) : null;
});

// ISO-Zeiten aus pinContext.js müssen zurück in Unix-Sekunden (jumpToPin/jumpToTimeRange erwarten
// dasselbe Format wie candle.time).
function toUnixSec(iso) {
  return iso == null ? null : Math.floor(new Date(iso).getTime() / 1000);
}

// Gepinnte Objekte, direkt aus ihren pin_context-Daten gebaut statt nur als Vergleichsschlüssel
// (Chat 2026-08-18, Task "Pin-Kontext: gepinnte Objekte direkt rendern statt nur per
// Live-Redetection") — siehe PriceChart.vue: mergePinnedZones/mergePinnedLevels/
// mergePinnedDivergences/refreshTradeSetupLinksInternal für die Verwendung. touched: null markiert
// einen reinen Snapshot ohne bekannten Live-Status — PriceChart.vue self-heilt das anhand der
// aktuell geladenen Kerzen. pinVisibleOnCurrentTf (Bug 2026-08-21) filtert zusätzlich per
// Kaskaden-Regel: nur auf dem eigenen oder einem feineren Timeframe sichtbar.
const pinnedObZones = computed(() => {
  return pinContextEntries.value
    .filter((e) => e.kind === "ob_zone" && e.obZone?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.obZone.timeframe))
    .map((e) => ({
      top: e.obZone.top,
      bottom: e.obZone.bottom,
      startTime: toUnixSec(e.obZone.startTime),
      dir: e.obZone.direction === "long" ? 1 : -1,
      timeframe: e.obZone.timeframe,
      // M5-ob_zones-Zeilen werden nie live nachverfolgt (nur die referenzierte Teilmenge wird beim
      // Pinnen einmalig persistiert, siehe PLAN-chart-objekte-forex.md Abschnitt 5/Punkt 6) —
      // touched bleibt in der DB für immer auf ihrem Insert-Default (false) stehen. touched: null
      // löst hier denselben Self-Heal-gegen-geladene-Kerzen-Pfad in PriceChart.vue aus wie vorher
      // beim eigenen kind='m5_ob'-Snapshot, statt den nie aktualisierten DB-Wert zu glauben.
      touched: e.obZone.timeframe === "5M" ? null : e.obZone.touched,
      invalidated: e.obZone.invalidated,
      endTime: toUnixSec(e.obZone.endTime),
    }));
});
// Kaskaden-Regel statt reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf
// oben, Philip 2026-08-18/21: ein gepinntes 1H/4H-Level soll auch auf M5 sichtbar bleiben, siehe
// PriceChart.vue: mergePinnedLevels — aber NICHT umgekehrt ein M5-Level auf 4H).
const pinnedLiquidityLevels = computed(() => {
  return pinContextEntries.value
    .filter(
      (e) =>
        (e.kind === "liquidity_level" && e.liquidityLevel?.instrument === currentSymbol.value && pinVisibleOnCurrentTf("1H")) ||
        (e.kind === "m5_liquidity_level" && e.m5Liquidity?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.m5Liquidity.timeframe)),
    )
    .map((e) => {
      if (e.kind === "liquidity_level") {
        return {
          price: e.liquidityLevel.price,
          dir: e.liquidityLevel.direction === "high" ? 1 : -1,
          pivotTime: toUnixSec(e.liquidityLevel.pivotTime),
          touched: e.liquidityLevel.touched,
          endTime: toUnixSec(e.liquidityLevel.endTime),
        };
      }
      return {
        price: e.m5Liquidity.price,
        dir: e.m5Liquidity.direction === "high" ? 1 : -1,
        pivotTime: toUnixSec(e.m5Liquidity.pivotTime),
        touched: null,
        endTime: null,
      };
    });
});
const pinnedTradeSetups = computed(() => {
  return pinContextEntries.value
    .filter((e) => e.kind === "trade_setup" && e.tradeSetup?.instrument === currentSymbol.value)
    .map((e) => ({
      tradeSetupId: e.tradeSetupId,
      instrument: e.tradeSetup.instrument,
      direction: e.tradeSetup.direction,
      top: e.tradeSetup.obTop,
      bottom: e.tradeSetup.obBottom,
      startTime: toUnixSec(e.tradeSetup.obStartTime),
    }));
});
// TF-Kopplung bewusst NICHT aufgehoben (siehe PriceChart.vue: mergePinnedDivergences) — RSI-Werte
// sind timeframe-abhängig, ein Divergenz-Pin bleibt daher nur auf seinem ursprünglichen Timeframe
// sichtbar (Philip 2026-08-18, bestätigt).
const pinnedRsiDivergences = computed(() => {
  return pinContextEntries.value
    .filter((e) => e.kind === "rsi_divergence" && e.rsiDivergence?.instrument === currentSymbol.value)
    .map((e) => ({
      type: e.rsiDivergence.type,
      fromTime: toUnixSec(e.rsiDivergence.fromTime),
      toTime: toUnixSec(e.rsiDivergence.toTime),
      fromPrice: e.rsiDivergence.fromPrice,
      toPrice: e.rsiDivergence.toPrice,
      fromRsi: e.rsiDivergence.fromRsi,
      toRsi: e.rsiDivergence.toRsi,
    }));
});

// Warum ein Eintrag (noch) nicht ins Chart springen kann — null = passt, kann springen. Reine
// Berechnung ohne State, damit sie sowohl für den Hover-Hinweis (computed unten) als auch als
// Sprung-Guard in onSelectPin wiederverwendet werden kann, ohne die Bedingungen doppelt zu pflegen.
// trade_confirmation ohne touchedTime hat kein Sprungziel — kein Instrument-/Timeframe-Fall, aber
// dieselbe "kann gerade nicht springen"-Semantik.
function pinJumpMismatch(entry) {
  if (!entry || entry.kind === "trade_position") return null;
  if (entry.kind === "ob_zone") {
    if (entry.obZone?.instrument !== currentSymbol.value) return `Erst zu ${entry.obZone?.instrument} wechseln.`;
    // Kaskaden-Regel wie pinVisibleOnCurrentTf (Bug 2026-08-21) — für 5M (feinster Timeframe hier)
    // kollabiert das auf "nur auf 5M selbst sichtbar", exakt das alte kind='m5_ob'-Verhalten
    // (ehemals ein hartes currentBar.value !== "5m"-Check), jetzt generisch für jeden Timeframe.
    return pinVisibleOnCurrentTf(entry.obZone.timeframe) ? null : `Erst zu ${entry.obZone.timeframe} wechseln.`;
  }
  if (entry.kind === "trade_setup") {
    return entry.tradeSetup?.instrument !== currentSymbol.value ? `Erst zu ${entry.tradeSetup?.instrument} wechseln.` : null;
  }
  if (entry.kind === "trade_confirmation") return entry.tradeConfirmation?.touchedTime == null ? "Noch nicht getoucht, kein Sprungziel." : null;
  if (entry.kind === "liquidity_level") {
    if (entry.liquidityLevel?.instrument !== currentSymbol.value) return `Erst zu ${entry.liquidityLevel?.instrument} wechseln.`;
    return currentBar.value !== "1h" ? "Erst zu 1h wechseln." : null;
  }
  if (entry.kind === "m5_liquidity_level") {
    if (entry.m5Liquidity?.instrument !== currentSymbol.value) return `Erst zu ${entry.m5Liquidity?.instrument} wechseln.`;
    return entry.m5Liquidity?.timeframe !== currentBar.value ? `Erst zu ${entry.m5Liquidity?.timeframe} wechseln.` : null;
  }
  if (entry.kind === "rsi_divergence") {
    return entry.rsiDivergence?.instrument !== currentSymbol.value ? `Erst zu ${entry.rsiDivergence?.instrument} wechseln.` : null;
  }
  return null;
}

// Hinweis lebt bewusst nur so lange wie der Hover selbst (Philip 2026-08-18: "nicht 4 Sekunden
// lang, sondern nur solange ich hovere") — kein Timer, reine Ableitung aus hoveredPinEntry, wie der
// Chart-Auswahl-Halo selbst. Klick auf eine Zeile setzt IMMER erst einen Hover voraus (Maus muss
// über der Zeile sein), der Hinweis ist zum Klick-Zeitpunkt also schon sichtbar.
const pinJumpHint = computed(() => {
  const message = pinJumpMismatch(hoveredPinEntry.value);
  return message ? { entryId: hoveredPinEntry.value.id, message } : null;
});

function onSelectPin(entry) {
  if (!entry || pinJumpMismatch(entry)) return;
  if (entry.kind === "trade_position") {
    const t = trades.value.find((x) => x.id === entry.tradePositionId);
    if (t) priceChartRef.value?.jumpToTrade(t.entryTime, t.exitTime);
  } else if (entry.kind === "ob_zone") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.obZone.startTime));
  } else if (entry.kind === "trade_setup") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.tradeSetup.obStartTime));
  } else if (entry.kind === "trade_confirmation") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.tradeConfirmation.touchedTime));
  } else if (entry.kind === "liquidity_level") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.liquidityLevel.pivotTime));
  } else if (entry.kind === "m5_liquidity_level") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.m5Liquidity.pivotTime));
  } else if (entry.kind === "rsi_divergence") {
    priceChartRef.value?.jumpToPin(toUnixSec(entry.rsiDivergence.fromTime), toUnixSec(entry.rsiDivergence.toTime));
  }
}

// Pin-Modal (Chat 2026-08-01) — "genau wie bei Metadaten" (Philip), analog persistiert.
const showPinPanel = useLocalStorageRef("showPinPanel", false);

// Debug-Metadaten-Sammel-Panel (siehe Chat 2026-07-20: "damit ich dir nicht ständig die Daten von
// dem was ich in TradingView sehe hier schreiben muss") — Unterpunkt bei "Debug", analog zu
// showRangesMetadata persistiert (bleibt über einen Reload offen, falls man gerade aktiv vergleicht).
const showDebugMetadata = useLocalStorageRef("showDebugMetadata", false);

// Replay-Modus (siehe Chat 2026-07-19): Chart + alle Indikatoren zeigen nur Daten bis zu diesem
// Zeitpunkt, während im Hintergrund ganz normal weitergeholt wird (siehe PriceChart.vue:
// clipReplay) — zum visuellen Prüfen des Ranges-Algos (oder jedes anderen Indikators), ohne
// dabei schon die "Zukunft" zu sehen. Jetzt (siehe Chat 2026-07-19) genau wie Symbol/Timeframe
// persistiert, damit das aktuelle Testszenario nicht bei jedem Reload zurückspringt.
// replayTime (der eingestellte Zeitpunkt) und replayActive (Toggle) sind bewusst getrennt — der
// "⏮ Replay bis"-Button schaltet nur zwischen live/replay um, ohne den eingestellten Zeitpunkt im
// Datumsfeld daneben zu löschen (siehe Chat: "verschwinden aber die eingestellten datetime daten
// im input daneben nicht"). replayUntil (an PriceChart durchgereicht) ist nur die Kombination.
// replayTime-Default bleibt auf dem Start des Long-Setup-Testszenarios (02.07.2026 19:00, kurz
// nach pivot5 in gbp_h1_uptrend_LQ_sweep_long_setup.ts) — nur relevant, falls replayActive mal
// eingeschaltet wird. replayActive selbst ist seit Chat 2026-07-20 per Default AUS: ein
// brandneuer Nutzer (noch nichts in localStorage) soll live starten, nicht mitten in einem alten
// Test-Replay — wer aktiv testet, toggelt Replay bewusst an, das bleibt dann wie gehabt persistiert.
const replayTime = useLocalStorageRef("replayTime", 1783011600); // 02.07.2026 19:00 (Berlin)
const replayActive = useLocalStorageRef("replayActive", false);
const replayUntil = computed(() => (replayActive.value ? replayTime.value : null));
function toDatetimeLocal(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// <input type="datetime-local"> liefert/erwartet "YYYY-MM-DDTHH:mm" in der Browser-Lokalzeit —
// new Date(v) parst das wieder als Lokalzeit, der Roundtrip braucht also keine eigene TZ-Logik.
const replayInputValue = computed({
  get: () => (replayTime.value == null ? "" : toDatetimeLocal(replayTime.value)),
  set: (v) => {
    replayTime.value = v ? Math.floor(new Date(v).getTime() / 1000) : null;
  },
});
const rangesFixedStartInputValue = computed({
  get: () => (rangesFixedStartTime.value == null ? "" : toDatetimeLocal(rangesFixedStartTime.value)),
  set: (v) => {
    rangesFixedStartTime.value = v ? Math.floor(new Date(v).getTime() / 1000) : null;
  },
});
// "+1 Kerze"-Button: den Zeitpunkt der nächsten geladenen Kerze im aktuellen Timeframe holt
// PriceChart.vue (kennt allCandles, siehe defineExpose dort) — replayTime/-Active gehören hierher,
// nicht in die Kind-Komponente (fließt nur als Prop nach unten). Aus Live heraus (noch kein
// Zeitpunkt gesetzt) springt der erste Klick auf die älteste geladene Kerze (siehe nextReplayTime)
// und aktiviert Replay gleich mit — sonst würde der Klick unsichtbar ins Leere laufen.
const priceChartRef = ref(null);
// nextReplayTime ist seit Chat 2026-07-21 async (kann bei einer Markt-Schließlücke, z.B. Wochenende,
// selbst nachfetchen, siehe PriceChart.vue) — stepReplayInFlight verhindert überlappende Aufrufe bei
// mehrfachem schnellen Klicken, während der vorige Aufruf noch fetcht.
const stepReplayInFlight = ref(false);
async function stepReplayForward() {
  if (stepReplayInFlight.value) return;
  stepReplayInFlight.value = true;
  try {
    const next = await priceChartRef.value?.nextReplayTime(replayTime.value);
    if (next != null) {
      replayTime.value = next;
      replayActive.value = true;
    }
  } finally {
    stepReplayInFlight.value = false;
  }
}

// Toolbar wurde zu voll (siehe Chat) -> Liquidity-Sweeps unter "Liquidität", Periode/Lookback
// unter "Structure" als Dropdown. Reiner UI-Zustand, bewusst NICHT in localStorage (anders als die
// Toggles selbst) — welches Dropdown gerade offen ist, ist keine Einstellung, die überdauern muss.
const rsiMenuOpen = ref(false);
const liquidityMenuOpen = ref(false);
const obsMenuOpen = ref(false);
const rangesMenuOpen = ref(false);
const tradeSetupsMenuOpen = ref(false);
const debugMenuOpen = ref(false);
// Neuer Sammel-Menüpunkt "Indikatoren" (Chat 2026-07-22: "Du kannst wohl neuen Menupunkt
// 'Indikatoren' machen. Unterpunkte Sessions, EMA, Liquidität, OBs") — bündelt die vorher
// einzeln in der Toolbar stehenden Sessions/EMA/Liquidität/OBs-Schalter. Liquidität behält ihr
// eigenes verschachteltes Sweep-Untermenü (liquidityMenuOpen), das jetzt innerhalb des
// Indikatoren-Dropdowns lebt statt auf oberster Ebene.
const indikatorenMenuOpen = ref(false);
// Feature-Wunsch Philip 2026-07-26: "Klick auf Indikatoren soll alle darunterliegenden Indikatoren
// ausblenden" — "Indikatoren" bekommt damit denselben Sammel-Toggle wie Liquidität/OBs (Klick =
// alle Sub-Indikatoren an/aus, der Caret bleibt separat fürs Dropdown), statt wie bisher rein ein
// Dropdown-Auslöser zu sein. Snapshot statt pauschalem "alles auf Werkseinstellung" beim
// Wieder-Einblenden, damit ein Klick nicht z.B. eine bewusst deaktivierte EMA wieder anschaltet.
// Sessions seit Chat 2026-07-29 NICHT mehr dabei ("ich deaktiviere gerne Indikatoren um mehr zu
// sehen, aber Sessions eig nie — die geben mir Orientierung zur Charthistorie") — eigener,
// permanenter Toggle links neben News statt im Sammel-Dropdown, siehe Template.
const INDIKATOREN_REFS = [showEma, showRsi, showRsiDivergence, showRsiDivergenceHistory, showLiquidity, showLiquidity1h, showSweptLiquidity, showObsM5, showObs1h, showObs4h, showHistoricalObs];
const indikatorenActive = computed(() => INDIKATOREN_REFS.some((r) => r.value));
let indikatorenSavedState = null;
function toggleIndikatoren() {
  if (indikatorenActive.value) {
    indikatorenSavedState = INDIKATOREN_REFS.map((r) => r.value);
    INDIKATOREN_REFS.forEach((r) => { r.value = false; });
  } else if (indikatorenSavedState) {
    INDIKATOREN_REFS.forEach((r, i) => { r.value = indikatorenSavedState[i]; });
    indikatorenSavedState = null;
  } else {
    // Noch nie über diesen Button ausgeblendet (z.B. alle Sub-Toggles waren schon einzeln aus) —
    // fällt auf die App-Werkseinstellungen zurück (siehe useLocalStorageRef-Defaults oben).
    showEma.value = false;
    showRsi.value = false;
    showRsiDivergence.value = false;
    showRsiDivergenceHistory.value = false;
    showLiquidity.value = true;
    showSweptLiquidity.value = false;
    showObsM5.value = false;
    showObs1h.value = true;
    showObs4h.value = true;
    showHistoricalObs.value = false;
  }
}
// Eigener Sammel-Toggle für den "OBs"-Hauptbutton (Chat 2026-07-30) — gleiches Snapshot/Restore-
// Muster wie toggleIndikatoren oben, nur eine Ebene tiefer (nur die drei Timeframe-Schalter, nicht
// showHistoricalObs — der bleibt unabhängig vom Ein-/Ausschalten aller OBs bestehen, wie bisher).
const OBS_REFS = [showObsM5, showObs1h, showObs4h];
const obsActive = computed(() => OBS_REFS.some((r) => r.value));
let obsSavedState = null;
function toggleObs() {
  if (obsActive.value) {
    obsSavedState = OBS_REFS.map((r) => r.value);
    OBS_REFS.forEach((r) => { r.value = false; });
  } else if (obsSavedState) {
    OBS_REFS.forEach((r, i) => { r.value = obsSavedState[i]; });
    obsSavedState = null;
  } else {
    showObsM5.value = false;
    showObs1h.value = true;
    showObs4h.value = true;
  }
}
function closeMenusOutside(e) {
  if (!e.target.closest?.(".toggle-group")) {
    rsiMenuOpen.value = false;
    liquidityMenuOpen.value = false;
    obsMenuOpen.value = false;
    rangesMenuOpen.value = false;
    tradeSetupsMenuOpen.value = false;
    debugMenuOpen.value = false;
    indikatorenMenuOpen.value = false;
  }
}
onMounted(() => window.addEventListener("click", closeMenusOutside));
onUnmounted(() => window.removeEventListener("click", closeMenusOutside));
// Kein Intervall-Poll mehr (Bug-Report Philip 2026-07-31: Begründung im Edit-Modal wurde alle
// POLL_MS mit dem alten DB-Stand überschrieben) — Trades ändern sich nur durch explizite Aktionen
// (Speichern, Symbol-/Kontowechsel, Ziel/Bestätigung im Chart hinzugefügt, siehe die
// refreshTrades()-Aufrufe unten), kein eigenes intervalMs also kein Hintergrund-Poll (siehe
// usePolledFetch.js). Eine externe Änderung durch Lana (MCP-Server) erscheint dadurch erst nach
// einem manuellen Reload/Tab-Wechsel — bewusst in Kauf genommen.
const { data: trades, refresh: refreshTrades } = usePolledFetch(() => fetchTrades(currentSymbol.value, selectedTradingAccountId.value));
// Pin-Kontext (Chat 2026-08-01, siehe pinContext.js) — symbolunabhängig (anders als
// `trades` oben), kein intervalMs, da nur durch explizite Aktionen (Rechtsklick "Anpinnen"/
// Modal-Löschen) geändert, kein Hintergrund-Poll nötig.
const { data: pinContextEntries, refresh: refreshPinContext } = usePolledFetch(() => fetchPinContext());
// 1H/4H-OB-Zonen (Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7) —
// anders als trades/pinContextEntries oben ändert sich das hier NICHT nur durch explizite
// Browser-Aktionen, sondern im Hintergrund durch poi-watcher (Cron alle 5min) — deshalb, anders als
// die beiden Fälle oben, MIT intervalMs. 60s reicht: schneller als jede sinnvolle manuelle
// Beobachtung, ohne unnötig oft zu pollen.
const { data: dbObZones } = usePolledFetch(() => fetchObZones(), { intervalMs: 60_000 });
// 1H-Liquidity-Level (Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12)
// — analog zu dbObZones oben, gleicher Grund für intervalMs (poi-watcher-Cron im Hintergrund).
const { data: dbLiquidityLevels1h } = usePolledFetch(() => fetchLiquidityLevels1h(), { intervalMs: 60_000 });
// Nur die Ids, die zum GERADE geladenen Symbol gehören (trades enthält nur dessen Trades) — ein
// Pin-Eintrag für ein anderes Symbol kann im Chart/in der Tabelle ohnehin nicht markiert
// werden, solange dieses Symbol nicht ausgewählt ist.
const pinTradeIds = computed(() => {
  const tradeIds = new Set(trades.value.map((t) => t.id));
  return new Set(pinContextEntries.value.filter((e) => tradeIds.has(e.tradePositionId)).map((e) => e.tradePositionId));
});
// OB-Zonen-Pendant (Chat 2026-08-01) — Natural-Key statt Id (siehe pinContext.js:
// obZoneEntryNaturalKey/orderBlocks.js: obZoneNaturalKey), gefiltert aufs aktuelle Symbol (eine
// OB-Zone aus GBPUSD ergibt im EURUSD-Chart keinen sinnvollen Treffer). Seit Punkt 6 (Migration
// 20260823120000) läuft ein M5-OB-Pin über denselben kind='ob_zone' wie 1H/4H (e.obZone.timeframe
// === "5M") — kein eigener m5_ob-Zweig mehr nötig, obZoneEntryNaturalKey baut für "5M" denselben
// "5M|..."-Schlüssel wie zuvor die eigene m5ObEntryNaturalKey. pinVisibleOnCurrentTf (Bug 2026-08-21)
// filtert per Kaskaden-Regel: nur auf dem eigenen oder einem feineren Timeframe gehighlightet (ein
// M5-OB-Pin bekommt auf 4H bewusst keinen Halo mehr).
const pinObZoneKeys = computed(() => {
  return new Set(
    pinContextEntries.value
      .filter((e) => e.kind === "ob_zone" && e.obZone?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.obZone.timeframe))
      .map((e) => obZoneEntryNaturalKey(e.obZone)),
  );
});
// Trade-Setup-Pendant (Chat 2026-08-01, dritte Runde) — echte Id (kein Natural-Key-Umweg wie bei
// ob_zone nötig, siehe pinContext.js), trotzdem aufs aktuelle Symbol gefiltert.
const pinTradeSetupIds = computed(() => {
  return new Set(
    pinContextEntries.value
      .filter((e) => e.kind === "trade_setup" && e.tradeSetup?.instrument === currentSymbol.value)
      .map((e) => e.tradeSetupId),
  );
});
// Bestätigungs-Pendant (Chat 2026-08-01, vierte Runde) — echte Id, kein Symbol-Filter möglich
// (trade_confirmations hat keine eigene instrument-Spalte, siehe pinContext.js) — unkritisch,
// die zugehörige Box existiert im Chart ohnehin nur für Trades des gerade angezeigten Symbols.
const pinTradeConfirmationIds = computed(() => {
  return new Set(pinContextEntries.value.filter((e) => e.kind === "trade_confirmation").map((e) => e.tradeConfirmationId));
});
// Liquiditäts-Level-Pendant (Chat 2026-08-17) — mischt kind='liquidity_level' (1H, echte DB-
// Zeile) und kind='m5_liquidity_level' (Nicht-1h-Snapshot) in EINE Menge. Kaskaden-Regel statt
// reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf oben, analog zum Fix
// bei pinnedLiquidityLevels/hoveredPinLiquidityLevelKey): ein auf 4H gepinntes Level bekommt jetzt
// auch auf 1H/M5 einen Halo (Philip: "1h/4h ... sollen im M5 trotzdem angezeigt werden"), ein auf
// M5 gepinntes Level aber weiterhin keinen auf 1H/4H (Philip: "M5 OBs in 4h TF anzuzeigen ist
// nicht so hilfreich").
const pinLiquidityLevelKeys = computed(() => {
  return new Set([
    ...pinContextEntries.value
      .filter((e) => e.kind === "liquidity_level" && e.liquidityLevel?.instrument === currentSymbol.value && pinVisibleOnCurrentTf("1H"))
      .map((e) => liquidityLevelEntryNaturalKey(e.liquidityLevel)),
    ...pinContextEntries.value
      .filter(
        (e) => e.kind === "m5_liquidity_level" && e.m5Liquidity?.instrument === currentSymbol.value && pinVisibleOnCurrentTf(e.m5Liquidity.timeframe),
      )
      .map((e) => m5LiquidityEntryNaturalKey(e.m5Liquidity)),
  ]);
});
// RSI-Divergenz-Pendant (Chat 2026-08-17) — nur nach Symbol gefiltert, kein Timeframe-Filter
// nötig (RSI-Divergenz-Erkennung läuft ausschließlich auf M5, siehe rsi.js/CLAUDE.md).
const pinRsiDivergenceKeys = computed(() => {
  return new Set(
    pinContextEntries.value
      .filter((e) => e.kind === "rsi_divergence" && e.rsiDivergence?.instrument === currentSymbol.value)
      .map((e) => rsiDivergenceEntryNaturalKey(e.rsiDivergence)),
  );
});
// Symbolwechsel soll sofort auf die Trades des neuen Symbols springen, statt bis zum nächsten
// Poll die des vorherigen Symbols über dem neuen Chart hängen zu lassen. Kontowechsel (Chat
// 2026-07-30) refresht aus demselben Grund sofort statt bis zum nächsten Poll.
watch(currentSymbol, () => {
  refreshTrades();
});
watch(selectedTradingAccountId, refreshTrades);
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
      <div class="toggle-group">
        <button :class="{ active: indikatorenActive }" @click="toggleIndikatoren">
          Indikatoren
        </button>
        <button
          class="toggle-caret"
          :class="{ open: indikatorenMenuOpen }"
          title="Untermenü"
          @click="indikatorenMenuOpen = !indikatorenMenuOpen"
        >
          ▾
        </button>
        <div v-if="indikatorenMenuOpen" class="toggle-dropdown indikatoren-dropdown">
          <button
            :class="{ active: showEma }"
            :disabled="emaDisabled"
            :title="emaDisabled ? 'EMA nur für M5' : ''"
            @click="showEma = !showEma"
          >
            EMA
          </button>
          <div class="toggle-group">
            <button :class="{ active: showRsi }" @click="showRsi = !showRsi">
              RSI
            </button>
            <button
              class="toggle-caret"
              :class="{ open: rsiMenuOpen }"
              title="Untermenü"
              @click="rsiMenuOpen = !rsiMenuOpen"
            >
              ▾
            </button>
            <div v-if="rsiMenuOpen" class="toggle-dropdown">
              <button
                :class="{ active: showRsiDivergence }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : ''"
                @click="showRsiDivergence = !showRsiDivergence"
              >
                Divergenz
              </button>
              <button
                :class="{ active: showRsiDivergenceHistory }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : ''"
                @click="showRsiDivergenceHistory = !showRsiDivergenceHistory"
              >
                Divergenz (Historie)
              </button>
              <label class="ranges-lookback-field">
                Historie
                <input
                  v-model.number="rsiDivergenceHistoryCount"
                  type="number"
                  min="1"
                  max="50"
                  class="ranges-lookback-input"
                  title="Anzahl vergangener Divergenzen je Richtung"
                />
              </label>

              <div class="toggle-dropdown-divider"></div>

              <button
                :class="{ active: showRsiDivergenceOutcomeDebug }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : 'Debug: zeichnet fuer jede sichtbare Divergenz die Struktur-Marke (gruen=hit/rot=miss/grau=pending)'"
                @click="showRsiDivergenceOutcomeDebug = !showRsiDivergenceOutcomeDebug"
              >
                Outcome-Debug
              </button>
              <button
                :class="{ active: showRsiDivergenceStats }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : 'Liste aller sichtbaren Divergenzen inkl. Statistik'"
                @click="showRsiDivergenceStats = !showRsiDivergenceStats"
              >
                Statistik
              </button>
            </div>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <div class="toggle-group">
            <button :class="{ active: showLiquidity }" @click="showLiquidity = !showLiquidity">
              Liquidität
            </button>
            <button
              class="toggle-caret"
              :class="{ open: liquidityMenuOpen }"
              title="Untermenü"
              @click="liquidityMenuOpen = !liquidityMenuOpen"
            >
              ▾
            </button>
            <div v-if="liquidityMenuOpen" class="toggle-dropdown">
              <button :class="{ active: showSweptLiquidity }" @click="showSweptLiquidity = !showSweptLiquidity">
                Liquidity-Sweeps
              </button>
              <!-- Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12 —
                   zeigt persistierte 1H-Level immer zusätzlich, unabhängig vom Chart-Timeframe. -->
              <button :class="{ active: showLiquidity1h }" @click="showLiquidity1h = !showLiquidity1h">
                1H-Level
              </button>
            </div>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <div class="toggle-group">
            <button :class="{ active: obsActive }" @click="toggleObs">
              OBs
            </button>
            <button
              class="toggle-caret"
              :class="{ open: obsMenuOpen }"
              title="Untermenü"
              @click="obsMenuOpen = !obsMenuOpen"
            >
              ▾
            </button>
            <!-- M5/1H/4H unabhängig an-/ausschaltbar (Chat 2026-07-30, Bug-Report Philip: "wenn ich
                 Indikatoren > OBs im M5 anhabe, werden mir ganz viele M5 OBs angezeigt" — vorher
                 folgten Forex-OBs immer nur dem gerade angezeigten Chart-Timeframe, nie mehrere
                 gleichzeitig, siehe PriceChart.vue: collectObsZones). -->
            <div v-if="obsMenuOpen" class="toggle-dropdown">
              <button :class="{ active: showObsM5 }" @click="showObsM5 = !showObsM5">
                M5
              </button>
              <button :class="{ active: showObs1h }" @click="showObs1h = !showObs1h">
                1H
              </button>
              <button :class="{ active: showObs4h }" @click="showObs4h = !showObs4h">
                4H
              </button>

              <div class="toggle-dropdown-divider"></div>

              <button :class="{ active: showHistoricalObs }" @click="showHistoricalObs = !showHistoricalObs">
                Historische OBs
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="toggle-group">
        <button :class="{ active: showTradeSetups }" @click="showTradeSetups = !showTradeSetups">
          Trades
        </button>
        <button
          class="toggle-caret"
          :class="{ open: tradeSetupsMenuOpen }"
          title="Untermenü"
          @click="tradeSetupsMenuOpen = !tradeSetupsMenuOpen"
        >
          ▾
        </button>
        <div v-if="tradeSetupsMenuOpen" class="toggle-dropdown">
          <!-- Untermenü-Feinschalter: braucht den übergeordneten "Trades"-Toggle (showTradeSetups)
               zusätzlich an, um überhaupt was anzuzeigen (Bug-Report Philip 2026-07-28: "der
               übergeordnete Trades-Toggle soll Trades auch ausblenden, TSC ist einzige Ausnahme") —
               siehe PriceChart.vue: refreshTradeMarkersInternal/-TradeSetupLinksInternal/
               -TradeTargetLinksInternal, die auf BEIDE Props prüfen. -->
          <button :class="{ active: showTrades }" @click="showTrades = !showTrades">
            Trades
          </button>

          <div class="toggle-dropdown-divider"></div>

          <button :class="{ active: showTradeSetupsLong }" @click="showTradeSetupsLong = !showTradeSetupsLong">
            Long Setups
          </button>
          <button :class="{ active: showTradeSetupsShort }" @click="showTradeSetupsShort = !showTradeSetupsShort">
            Short Setups
          </button>
          <label class="ranges-lookback-field">
            Historie
            <input
              v-model.number="tradeSetupHistoryCount"
              type="number"
              min="0"
              max="50"
              class="ranges-lookback-input"
              title="Anzahl vergangener Trade-Setups je Richtung"
            />
          </label>

          <div class="toggle-dropdown-divider"></div>

          <button :class="{ active: showTradeSetupCockpit }" @click="showTradeSetupCockpit = !showTradeSetupCockpit">
            TSC
          </button>
        </div>
      </div>

      <div class="toggle-group">
        <button :class="{ active: showRanges }" @click="showRanges = !showRanges">
          Structure
        </button>
        <button
          class="toggle-caret"
          :class="{ open: rangesMenuOpen }"
          title="Untermenü"
          @click="rangesMenuOpen = !rangesMenuOpen"
        >
          ▾
        </button>
        <div v-if="rangesMenuOpen" class="toggle-dropdown">
          <button
            :class="{ active: rangesFixedStartActive }"
            title="Fester Startzeitpunkt statt 'letzte X Tage' — bleibt beim Scrubben im Replay-Modus stabil, statt sich mitzuverschieben (gilt für Periode 5 UND die eingebettete Periode 2)"
            @click="rangesFixedStartActive = !rangesFixedStartActive"
          >
            Fixer Start
          </button>
          <input
            v-if="rangesFixedStartActive"
            v-model="rangesFixedStartInputValue"
            type="datetime-local"
            class="replay-input ranges-fixed-start-input"
            title="Ab diesem Zeitpunkt werden Structure-Pivots gezählt (beide Perioden)"
          />

          <div class="toggle-dropdown-divider"></div>

          <label class="ranges-period-field">
            Periode
            <input
              v-model.number="rangesPeriod"
              type="number"
              min="1"
              class="ranges-period-input"
              title="Fraktal-Periode für die Haupt-Range-Erkennung"
            />
          </label>
          <label class="ranges-lookback-field">
            Tage
            <input
              v-model.number="rangesLookbackDays"
              type="number"
              min="1"
              class="ranges-lookback-input"
              title="Lookback in Tagen — rechnet automatisch in Stunden um"
              :disabled="rangesFixedStartActive"
            />
          </label>
          <label class="ranges-lookback-field">
            Stunden
            <input
              v-model.number="rangesLookbackHours"
              type="number"
              min="1"
              class="ranges-lookback-input"
              title="Lookback in Stunden (maßgeblicher Wert für die Fraktal-Suche)"
              :disabled="rangesFixedStartActive"
            />
          </label>

          <div class="toggle-dropdown-divider"></div>

          <button :class="{ active: showRangesMetadata }" @click="showRangesMetadata = !showRangesMetadata">
            Metadaten
          </button>

          <label class="ranges-period-field">
            Periode
            <input
              v-model.number="ranges2Period"
              type="number"
              min="1"
              class="ranges-period-input"
              title="Fraktal-Periode für die eingebettete (schnellere) Erkennung"
            />
          </label>
          <label class="ranges-lookback-field">
            Tage
            <input
              v-model.number="ranges2LookbackDays"
              type="number"
              min="1"
              class="ranges-lookback-input"
              title="Lookback in Tagen (eingebettete Periode) — rechnet automatisch in Stunden um"
              :disabled="rangesFixedStartActive"
            />
          </label>
          <label class="ranges-lookback-field">
            Stunden
            <input
              v-model.number="ranges2LookbackHours"
              type="number"
              min="1"
              class="ranges-lookback-input"
              title="Lookback in Stunden (eingebettete Periode)"
              :disabled="rangesFixedStartActive"
            />
          </label>
        </div>
      </div>

      <button
        :class="{ active: showEma }"
        :disabled="emaDisabled"
        :title="emaDisabled ? 'EMA nur für M5' : ''"
        @click="showEma = !showEma"
      >
        EMA
      </button>

      <!-- Eigener, permanenter Toggle statt im "Indikatoren"-Sammel-Dropdown (Chat 2026-07-29:
           "ich deaktiviere gerne Indikatoren um mehr zu sehen, aber Sessions eig nie — die geben
           mir Orientierung zur Charthistorie") — bewusst links neben News, nicht im Indikatoren-
           Sammel-Toggle enthalten (siehe INDIKATOREN_REFS oben). -->
      <div class="toggle-group">
        <button
          :class="{ active: showSessions }"
          :disabled="sessionsDisabled"
          :title="sessionsDisabled ? 'Sessions nur bis 1h' : ''"
          @click="showSessions = !showSessions"
        >
          Sessions
        </button>
        <button class="toggle-caret" title="Sessions verwalten" @click="showSessionsModal = true">
          ⚙
        </button>
      </div>

      <div class="toggle-group">
        <button :class="{ active: showNews }" @click="showNews = !showNews">
          News
        </button>
        <button class="toggle-caret" title="News verwalten" @click="showNewsModal = true">
          ⚙
        </button>
      </div>

      <div class="toggle-group replay-control" :class="{ active: replayActive }">
        <button
          class="replay-toggle-btn"
          :class="{ active: replayActive }"
          title="Replay an/aus — Datum bleibt beim Ausschalten stehen"
          @click="replayActive = !replayActive"
        >
          Replay ⏮
        </button>
        <input v-model="replayInputValue" type="datetime-local" class="replay-input" title="Chart+Indikatoren nur bis zu diesem Zeitpunkt anzeigen" />
        <button class="replay-step-btn" title="+1 Kerze" :disabled="stepReplayInFlight" @click="stepReplayForward">
          {{ stepReplayInFlight ? '…' : '▶|' }}
        </button>
      </div>

      <div class="trade-mode-switcher" :class="{ 'trade-mode-active': tradeModeActive }">
        <button :class="{ active: !tradeModeActive }" title="Chart normal bedienen (Pan/Zoom)" @click="tradeModeActive = false">
          🖐 Navigieren
        </button>
        <button :class="{ active: tradeModeActive }" title="Auf ein Trade-Setup klicken, um es als Trade zu übernehmen" @click="tradeModeActive = true">
          🎯 Trade-Modus
        </button>
        <span v-if="targetAddTrade" class="trade-link-armed">🎯 nächster Klick auf Pivot/OB fügt Trade #{{ targetAddTrade.id }} ein Target hinzu</span>
        <span v-if="confirmationAddTrade" class="trade-link-armed">✔ nächster Klick auf Sweep/OB fügt Trade #{{ confirmationAddTrade.id }} eine Bestätigung hinzu</span>
        <span v-if="rangeConfirmationAddTrade" class="trade-link-armed">✔ nächster Klick auf Sweep/OB fügt Dealing Range #{{ rangeConfirmationAddTrade.dealingRangeId }} eine Bestätigung hinzu</span>
        <span v-if="invalidationAddTrade" class="trade-link-armed">🚫 nächster Klick auf Pivot/OB setzt Invalidierung für Dealing Range #{{ invalidationAddTrade.dealingRangeId }}</span>
      </div>

      <button :class="{ active: showPinPanel }" title="Angepinnte Stellen im Chart" @click="showPinPanel = !showPinPanel">
        📌 Pins
      </button>

      <div class="toggle-group">
        <button :class="{ active: showLiquidityDebug }" @click="showLiquidityDebug = !showLiquidityDebug">
          Debug
        </button>
        <button
          class="toggle-caret"
          :class="{ open: debugMenuOpen }"
          title="Untermenü"
          @click="debugMenuOpen = !debugMenuOpen"
        >
          ▾
        </button>
        <div v-if="debugMenuOpen" class="toggle-dropdown">
          <button :class="{ active: showDebugMetadata }" @click="showDebugMetadata = !showDebugMetadata">
            📋 Metadaten
          </button>
        </div>
      </div>

      <button :class="{ active: showStyleModal }" @click="showStyleModal = !showStyleModal">
        🎨 Style
      </button>
    </div>
  </div>

  <StyleModal v-if="showStyleModal" @close="showStyleModal = false" />
  <SessionsModal v-if="showSessionsModal" :instrument="currentSymbol" @close="showSessionsModal = false" />
  <NewsModal v-if="showNewsModal" @close="showNewsModal = false" />
  <TakeTradeModal
    v-if="selectedSetupForTrade"
    :instrument="currentSymbol"
    :setup="selectedSetupForTrade"
    @close="selectedSetupForTrade = null"
    @saved="refreshTrades"
  />
  <TradeEditModal
    v-if="editingTrade"
    :trade="editingTrade"
    @close="editingTradeId = null"
    @saved="refreshTrades"
    @deleted="onTradeDeleted"
    @request-add-target="onAddTargetRequest(editingTrade)"
    @request-add-confirmation="onAddConfirmationRequest(editingTrade)"
    @request-add-range-confirmation="onAddRangeConfirmationRequest(editingTrade)"
    @request-set-invalidation="onSetInvalidationRequest(editingTrade)"
  />

  <PriceChart
    ref="priceChartRef"
    :key="currentSymbol"
    :symbol="currentSymbol"
    :current-bar="currentBar"
    :trades="trades"
    :hovered-trade-id="hoveredTradeId"
    :pin-trade-ids="pinTradeIds"
    :pin-ob-zone-keys="pinObZoneKeys"
    :pin-trade-setup-ids="pinTradeSetupIds"
    :pin-trade-confirmation-ids="pinTradeConfirmationIds"
    :pin-liquidity-level-keys="pinLiquidityLevelKeys"
    :pin-rsi-divergence-keys="pinRsiDivergenceKeys"
    :hovered-pin-ob-zone-key="hoveredPinObZoneKey"
    :hovered-pin-trade-setup-id="hoveredPinTradeSetupId"
    :hovered-pin-trade-confirmation-id="hoveredPinTradeConfirmationId"
    :hovered-pin-liquidity-level-key="hoveredPinLiquidityLevelKey"
    :hovered-pin-rsi-divergence-key="hoveredPinRsiDivergenceKey"
    :pinned-ob-zones="pinnedObZones"
    :db-ob-zones="dbObZones"
    :db-liquidity-levels-1h="dbLiquidityLevels1h"
    :show-liquidity-1h="showLiquidity1h"
    :pinned-liquidity-levels="pinnedLiquidityLevels"
    :pinned-trade-setups="pinnedTradeSetups"
    :pinned-rsi-divergences="pinnedRsiDivergences"
    :show-trades="showTrades"
    :show-obs-m5="showObsM5"
    :show-obs-1h="showObs1h"
    :show-obs-4h="showObs4h"
    :show-historical-obs="showHistoricalObs"
    :show-liquidity="showLiquidity"
    :show-swept-liquidity="showSweptLiquidity"
    :show-liquidity-debug="showLiquidityDebug"
    :show-trade-setups="showTradeSetups"
    :trade-setup-history-count="tradeSetupHistoryCount"
    :show-trade-setups-long="showTradeSetupsLong"
    :show-trade-setups-short="showTradeSetupsShort"
    :ranges-period="rangesPeriod"
    :ranges-lookback-hours="rangesLookbackHours"
    :ranges2-period="ranges2Period"
    :ranges2-lookback-hours="ranges2LookbackHours"
    :ranges-fixed-start-active="rangesFixedStartActive"
    :ranges-fixed-start-time="rangesFixedStartTime"
    :show-ranges="showRanges"
    :show-ranges-metadata="showRangesMetadata"
    :show-ema="showEma"
    :show-rsi="showRsi"
    :show-rsi-divergence="showRsiDivergence"
    :show-rsi-divergence-history="showRsiDivergenceHistory"
    :rsi-divergence-history-count="rsiDivergenceHistoryCount"
    :show-rsi-divergence-outcome-debug="showRsiDivergenceOutcomeDebug"
    :show-rsi-divergence-stats="showRsiDivergenceStats"
    :show-news="showNews"
    :show-sessions="showSessions"
    :show-trade-setup-cockpit="showTradeSetupCockpit"
    :replay-until="replayUntil"
    :show-debug-metadata="showDebugMetadata"
    :claude-annotations="visibleClaudeAnnotations"
    :claude-annotations-date="claudeAnnotationsDate"
    :trade-mode-active="tradeModeActive"
    :target-mode-active="targetAddTrade != null || confirmationAddTrade != null || rangeConfirmationAddTrade != null || invalidationAddTrade != null"
    :confirmation-mode-active="confirmationAddTrade != null || rangeConfirmationAddTrade != null"
    @close-ranges-metadata="showRangesMetadata = false"
    @close-debug-metadata="showDebugMetadata = false"
    @close-rsi-divergence-stats="showRsiDivergenceStats = false"
    @select-setup="onSelectSetup"
    @select-target="onSelectTarget"
    @select-setup-confirmations="onSelectSetupConfirmations"
    @toggle-trade-mode="tradeModeActive = !tradeModeActive"
    @pin-context-menu="onPinContextMenu"
  />

  <aside ref="tradesPanelRef" class="trades-panel" :style="{ height: tradesPanelHeight + 'px' }">
    <div class="trades-panel-header">
      <h2 class="trades-panel-title">Trades</h2>
      <TradingAccountSwitcher />
    </div>
    <div class="trades-list">
      <TradesTable
        :trades="trades"
        :pin-trade-ids="pinTradeIds"
        @select="onSelectTrade"
        @edit-request="onEditRequest"
        @hover-trade="onHoverTrade"
        @pin-context-menu="onPinContextMenu"
      />
    </div>
    <TradeStats :trades="trades" />
  </aside>

  <ContextMenu
    v-if="pinCandidateMenu"
    :x="pinCandidateMenu.x"
    :y="pinCandidateMenu.y"
    :items="pinCandidateMenu.candidates.map((c, i) => ({ key: String(i), label: `📌 ${pinCandidateLabel(c)}` }))"
    @select="onPinCandidateSelect"
    @close="pinCandidateMenu = null"
  />
  <PinAddPopup
    v-if="pinAddPopupTarget"
    :x="pinAddPopupTarget.x"
    :y="pinAddPopupTarget.y"
    :label="pinCandidateLabel(pinAddPopupTarget)"
    :error="pinAddPopupError"
    @confirm="onPinAddConfirm"
    @cancel="
      pinAddPopupTarget = null;
      pinAddPopupError = null;
    "
  />
  <MetadataPanel v-if="showPinPanel" title="📌 Pins" @close="showPinPanel = false">
    <PinPanel
      :entries="pinContextEntries"
      :trades="trades"
      :mismatch-hint="pinJumpHint"
      @remove="onPinRemove"
      @update-note="onPinUpdateNote"
      @hover="onPinHover"
      @select="onSelectPin"
    />
  </MetadataPanel>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 16px;
  background: #131722;
  border-bottom: 1px solid #2a2e39;
}

.symbol-switcher,
.timeframe-switcher,
.trade-mode-switcher,
.drawing-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Eigener Rand statt nur "active"-Button-Highlight (Chat 2026-07-27: Trade-Modus ändert, was ein
   Chart-Klick tut — soll auffallen, nicht nur wie ein normaler Anzeige-Toggle aussehen). */
.trade-mode-switcher {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px;
}

.trade-mode-switcher.trade-mode-active {
  border-color: rgba(255, 179, 0, 0.6);
}

.drawing-toggles {
  padding-left: 12px;
  border-left: 1px solid #2a2e39;
  row-gap: 8px;
}

.symbol-switcher button {
  font-weight: 600;
}

.symbol-switcher button,
.timeframe-switcher button,
.trade-mode-switcher button,
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
.trade-mode-switcher button:hover,
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

.drawing-toggles button:disabled,
.toggle-dropdown button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.drawing-toggles button:disabled:hover,
.toggle-dropdown button:disabled:hover {
  background: transparent;
  color: #787b86;
}

.trade-mode-switcher button.active {
  background: #2962ff;
  color: #fff;
}

.trade-mode-switcher.trade-mode-active button.active {
  background: rgba(255, 179, 0, 0.9);
  color: #131722;
}

.trade-link-armed {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: rgba(255, 179, 0, 0.9);
  padding: 0 6px;
  white-space: nowrap;
}

.toggle-group {
  position: relative;
  display: flex;
  gap: 1px;
}

.toggle-caret {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 4px 5px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.toggle-caret:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.toggle-caret.open {
  background: #2a2e39;
  color: #d1d4dc;
}

.toggle-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 20;
  background: #1e222d;
  border: 1px solid #2a2e39;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: max-content;
}

.toggle-dropdown button {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
}

.toggle-dropdown button:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.toggle-dropdown button.active {
  background: #2962ff;
  color: #fff;
}

.ranges-lookback-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  font-size: 13px;
  color: #787b86;
  white-space: nowrap;
}

.ranges-lookback-input {
  width: 50px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
}

.ranges-lookback-input:disabled,
.ranges-period-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ranges-fixed-start-input {
  margin: 2px 10px 5px;
  width: calc(100% - 20px);
}

.ranges-period-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #9aa0ac;
  white-space: nowrap;
}

.ranges-period-input {
  width: 40px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
}

.toggle-dropdown-divider {
  height: 1px;
  margin: 4px 6px;
  background: #2a2e39;
}

.indikatoren-dropdown {
  min-width: 180px;
}

.replay-control {
  margin-left: auto;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
}

.replay-control.active {
  background: rgba(41, 98, 255, 0.12);
}

.replay-toggle-btn {
  background: transparent;
  border: none;
  color: #787b86;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.replay-toggle-btn:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.replay-toggle-btn.active {
  background: #2962ff;
  color: #fff;
}

.replay-input {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
  color-scheme: dark;
}

.replay-step-btn {
  background: #2a2e39;
  border: none;
  color: #d1d4dc;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.replay-step-btn:hover {
  background: #363b47;
}

.trades-panel {
  flex-shrink: 0;
  background: #1e222d;
  border-top: 1px solid #2a2e39;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  /* Natives CSS resize statt eigenem Maus-Drag-Code (Chat 2026-07-30, "genau wie beim
     Metadaten-Modal", siehe MetadataPanel.vue: dieselbe resize:.../overflow:hidden-Kombination) —
     zieht man an der Ecke unten rechts, greift der ResizeObserver im Script (tradesPanelRef) und
     schreibt die neue Höhe in tradesPanelHeight (persistiert, wie currentSymbol). Nur vertikal,
     die Breite soll weiterhin die volle Zeile ausfüllen. */
  resize: vertical;
  overflow: hidden;
  min-height: 120px;
  max-height: 90vh;
}

.trades-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.trades-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  color: #d1d4dc;
}

.trades-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
</style>
