<script setup>
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from "vue";
import PriceChart from "../components/PriceChart.vue";
import GoldPreview from "../components/GoldPreview.vue";
import TradeSetupCockpit from "../components/TradeSetupCockpit.vue";
import TradeSetupBewertung from "../components/TradeSetupBewertung.vue";
import TradesTable from "../components/TradesTable.vue";
import TradeStats from "../components/TradeStats.vue";
import StyleModal from "../components/StyleModal.vue";
import SessionsModal from "../components/SessionsModal.vue";
import NewsModal from "../components/NewsModal.vue";
import TradeEditModal from "../components/TradeEditModal.vue";
import TradingAccountSwitcher from "../components/TradingAccountSwitcher.vue";
import MetadataPanel from "../components/MetadataPanel.vue";
import ContextMenu from "../components/ContextMenu.vue";
import PinAddPopup from "../components/PinAddPopup.vue";
import PinPanel from "../components/PinPanel.vue";
import ToggleButton from "../components/ui/ToggleButton.vue";
import { selectedTradingAccountId, writableTradingAccountId } from "../tradingAccounts.js";
import { TIMEFRAMES, barSecondsForTimeframeCi } from "../timeframes.js";
import { toPips } from "../pipConfig.js";
import { fetchTrades } from "../trades.js";
import { useTscRange } from "../composables/useTscRange.js";
import {
  fetchTradeSetupForCockpit,
  linkTradeToSetup,
  directionForSetup,
  addTargetToTrade,
  addConfirmationToTrade,
  addRangeConfirmation,
  removeTargetFromTrade,
  removeConfirmationFromTrade,
  updateTrade,
  updateDealingRange,
  setDealingRangeInvalidation,
  createDealingRange,
  addPositionToDealingRange,
  deleteDealingRange,
  deriveSetupEntryInvalidation,
} from "../tradeIntake.js";
import { fetchObZones } from "../obZones.js";
import { fetchTradeSetups } from "../tradeSetups.js";
import { fetchLiquidityLevelsHtf } from "../liquidityLevels.js";
import { fetchDailyStructurePivots } from "../dailyPivots.js";
import { liquidityLevelNaturalKey } from "../liquidity.js";
import { tradesVisible } from "../tradeVisibility.js";
import { QUOTEN_HERKUNFT } from "../drQuoten.js";
import {
  fetchPinContext,
  addPinEntry,
  addPinM5ObEntry,
  addPinTscSetupEntry,
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
import { useDrawings } from "../composables/useDrawings.js";
import { measureDrawing } from "../chartMeasure.js";
import { chartMode, chartHint } from "../chartModes.js";

const SYMBOLS = ["GBPUSD", "EURUSD"];
// Gold nutzt zunächst nur den H1-Testchart; Forex-Auswahl und Journalzustand bleiben erhalten.
const goldPreview = ref(false);

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
// R-Skala (2-10 R ab der nahen OB-Kante, siehe rScale.js) — eigener Toggle neben den
// Richtungs-Schaltern: bei großer Setup-Historie sind das neun zusätzliche Marken PRO Setup.
const showRScale = useLocalStorageRef("showRScale", true);
// Die Einordnung der Quoten kommt aus drQuoten.js, wo auch die Zahlen selbst stehen — hier nur der
// R-Skala-eigene Teil davor. Getrennt gehalten war der Tooltip schon einmal veraltet (er nannte
// noch 915 Ranges, als die Tabellen längst auf 3282 standen).
const rScaleHint =
  "Marken bei 2-10 R ab der nahen OB-Kante, 1 R = Risiko bis zur Invalidierung, gedeckelt auf 6 Pips — wie der Stopp im " +
  `Trade. Prozent = wie oft vergleichbare Dealing Ranges diese Strecke erreicht haben. ${QUOTEN_HERKUNFT}`;
// Pip-Skala (10-40 Pips ab derselben Kante, siehe pipScale.js) — zweiter, unabhängiger Toggle
// statt eines Umschalters: Philip will beide Leitern nebeneinander sehen können (23.09.2026).
// Default aus, damit der Chart nicht mit zwei Leitern je Setup startet.
const showPipScale = useLocalStorageRef("showPipScale", false);
const pipScaleHint =
  "Marken bei 10-40 Pips ab der nahen OB-Kante — feste Strecke, unabhängig davon wie weit die Range aufgespannt ist. " +
  `Prozent = wie oft vergleichbare Dealing Ranges diese Strecke erreicht haben. ${QUOTEN_HERKUNFT}`;

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
// Start-Zeitpunkt für die Structure-Pivot-Zählung (Periode 5 + eingebettete Periode 2 gemeinsam,
// Philip wollte "ab Zeitpunkt X", nicht zwei unabhängige Fixpunkte) — drei Modi statt eines reinen
// An/Aus-Toggles (Task "Structure: 3 Start-Modi", 2026-08-30, ersetzt den bisherigen "Fixer
// Start"-Toggle aus Chat 2026-07-21):
// - "days": rollierendes "letzte X Tage/Stunden"-Fenster (rangesLookbackHours/ranges2LookbackHours,
//   bisheriger Default-Modus).
// - "date": fester, von Philip manuell gewählter Zeitpunkt (rangesFixedStartDateInput) — bleibt
//   beim Scrubben durch den Replay-Modus stabil, für reproduzierbare Testszenarien.
// - "pivot": automatisch der letzte persistierte 1D-Periode-4-Struktur-Pivot dieses Instruments
//   (daily_structure_pivots, siehe latestDailyPivotStructureStartTime weiter unten) — Default.
// rangesFixedStartActive/-Time bleiben als die EFFEKTIVEN, tatsächlich an PriceChart.vue
// durchgereichten Werte bestehen (siehe Watcher weiter unten, bei dbDailyPivots) — wer sonst noch
// via useLocalStorageRef.s Key-Cache dieselbe Instanz liest, soll denselben effektiven Stand
// sehen wie der Chart, nicht nur den "date"-Modus-Rohwert. rangesFixedStartDateInput ist die vom
// Modus UNABHÄNGIGE, im "Datum"-Modus eingegebene Roh-Zeit, damit ein Moduswechsel den zuletzt
// eingegebenen Wert nicht überschreibt.
const rangesFixedStartActive = useLocalStorageRef("rangesFixedStartActive", false);
const rangesFixedStartTime = useLocalStorageRef("rangesFixedStartTime", 1783011600);
const rangesStartMode = useLocalStorageRef("rangesStartMode", "pivot"); // "date" | "days" | "pivot"
const rangesFixedStartDateInput = useLocalStorageRef("rangesFixedStartDateInput", 1783011600); // Default = derselbe Testszenario-Start wie replayTime
// showRanges (Punkt-Marker im Chart, siehe PriceChart.vue) und showRangesMetadata (JSON-Panel)
// sind bewusst getrennte Toggles — Philip will Ranges anzeigen können, ohne dafür das
// Metadaten-Panel offen zu haben (siehe Chat: "man kann ranges nicht einzelnd toggeln"). EIN
// gemeinsames Metadaten-Panel für Periode 5 + eingebettete Periode 2 (siehe PriceChart.vue) —
// kein zweiter showRangesMetadata2-Toggle, Philip reicht "einmal Metadaten".
const showRanges = useLocalStorageRef("showRanges", false);
const showRangesMetadata = useLocalStorageRef("showRangesMetadata", false);
// M5-Struktur (PLAN-m5-trend.md): Linien und Trendphasen-Hintergrund je eigener Toggle, unabhängig
// vom 1h-showRanges — Philip blendet zur Herkunftsklärung gezielt eine Ebene aus. Perioden
// einstellbar, Start mit denselben 5/2 wie die 1h-Struktur.
const showM5Structure = useLocalStorageRef("showM5Structure", false);
// Blendet nur die 1h-Struktur aus (Linien + Debug-Punkte), damit die M5-Ebene allein prüfbar ist —
// "Structure" bleibt der Hauptschalter, PriceChart bekommt das UND beider als showRanges.
const showH1Structure = useLocalStorageRef("showH1Structure", true);
const showM5TrendPhases = useLocalStorageRef("showM5TrendPhases", false);
const m5StructurePeriod = useLocalStorageRef("m5StructurePeriod", 5);
const m5Structure2Period = useLocalStorageRef("m5Structure2Period", 2);
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
// Zeichnungen (siehe annotations.js, trading/chart-daten.md) — Knopf + Modal leben global in der
// Kopfleiste (App.vue), in Supabase persistiert (siehe drawingsStore.js). instrument/dateStr
// werden zentral in useDrawings.js hergeleitet (dieselben Keys wie hier: currentSymbol/replayTime/
// replayActive), nicht mehr separat hier berechnet. visibleAnnotations blendet die Liste aus, wenn
// der Toggle in App.vue aus ist, ohne die geladenen Zeichnungen selbst zu verwerfen.
const {
  flatAnnotations: annotations,
  visible: drawingsVisible,
  dateStr: annotationsDate,
  add: addDrawing,
} = useDrawings();
const visibleAnnotations = computed(() => (drawingsVisible.value ? annotations.value : []));
// Trade-Setup-Cockpit (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln") — bündelt H1-Range-Analyse + M5-Trade-Setups in einer Karte im Chart. Seit
// Chat 2026-07-27 eine echte Vue-Komponente mit festem Platz — der frühere "neben der letzten
// Kerze"-Positionsmodus (und sein Abstands-Regler) ist entfallen, siehe TradeSetupCockpit.vue.
const showTradeSetupCockpit = useLocalStorageRef("showTradeSetupCockpit", true);
const showTradeSetupBewertung = useLocalStorageRef("showTradeSetupBewertung", true);
// Style-Modal (Farben aller Chart-Indikatoren, siehe StyleModal.vue/chartColors.js) — reiner
// Öffnen/Schließen-Zustand, NICHT in localStorage (die Farben selbst persistieren bereits über
// den chartColors-Singleton, das Modal muss nicht offen bleiben).
const showStyleModal = ref(false);
// Trade-Modus (Chat 2026-07-27: "damit ich nicht versehentlich in den Chart reinklicke, evtl.
// Buttons einbauen") — bewusst NICHT persistiert (useLocalStorageRef), ein Reload soll immer im
// harmlosen Navigieren-Modus starten, nicht mitten im Trade-Modus von der letzten Session.
const tradeModeActive = computed(() => chartMode.value === "trade");
// Bearbeiten-Panel (Chat 2026-07-28: "lass die Entity 'trades' CRUD Funktionalität weitermachen",
// ersetzt die vorherigen Inline-Buttons in TradesTable.vue) — nur die Id gemerkt, nicht der Trade
// selbst, damit editingTrade unten immer den LIVE-Stand aus der trades-Liste zeigt (z.B. sofort
// aktualisiert, nachdem im Panel ein Setup/Ziel über den Chart hinzugefügt wurde).
const editingTradeId = ref(null);
const editingTrade = computed(() => trades.value.find((t) => t.id === editingTradeId.value) ?? null);
function onEditRequest(t) {
  editingTradeId.value = t.id;
}
// Bug-Report Philip 2026-08-30: schließt man das Modal per Klick, OHNE die Maus vorher von der
// gehoverten Zeile wegzubewegen, feuert nie ein mouseleave (die Komponente wird per v-if komplett
// entfernt) — hoveredModalEvidenceItem/-TargetItem blieben sonst für immer auf dem letzten Stand
// hängen, ein Phantom-Highlight im Chart, das sich nie mehr von selbst löst.
function closeTradeEditModal() {
  editingTradeId.value = null;
  hoveredModalEvidenceItem.value = null;
  hoveredModalTargetItem.value = null;
}
function onTradeDeleted() {
  closeTradeEditModal();
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
// Zusatzargument hinzufügen (Chat 2026-08-28, Confirmation/Confluence-Trennung — siehe
// trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt)
// — analog zu confirmationAddTrade/rangeConfirmationAddTrade, aber nur für Fib
// (Confluence: gibt mehr Sicherheit, aber kein GO) statt Sweep/OB/Divergenz (Confirmation). Eigene Arm-
// Zustände statt die bestehenden zwei mitzubenutzen, damit Chart-Klicks eindeutig bleiben (siehe
// PriceChart.vue: confluenceModeActive) und "Bestätigung"/"Zusatzargument" zwei getrennte
// UI-Sektionen bedienen. addConfirmationToTrade/addRangeConfirmation reichen als Insert-Pfad aus
// (category ergibt sich automatisch aus kind, siehe tradeIntake.js) — kein neuer DB-Call nötig.
const confluenceAddTrade = ref(null);
const rangeConfluenceAddTrade = ref(null);
// Anti-Confluence hinzufügen (Chat 2026-08-28, direkt im Anschluss an Confirmation/Confluence) —
// Philip: "im ersten Schritt klickbare Chart-Objekte", gleicher kind-Satz wie Confirmation/
// Confluence (pivot/ob/fib/rsi_divergence), aber category kommt jetzt vom Arm-Zustand statt aus
// kind (siehe tradeIntake.js: insertConfirmation, Migration 20260828130000) — z.B. ein
// gegenläufiger OB ist als Confirmation ODER Anti-Confluence klickbar, je nachdem, welcher Button
// gerade "scharf" ist.
const antiConfluenceAddTrade = ref(null);
const rangeAntiConfluenceAddTrade = ref(null);
// Invalidierung per Chart-Klick setzen (Chat 2026-07-31, zweite Runde: "mach wieder so, dass ich
// es im Edit-Modal anklicken kann") — nimmt denselben Pivot/OB-Klick wie Target-Modus, aber
// schreibt den Preis direkt auf dealing_ranges.invalidation statt eine trade_targets-Zeile
// anzulegen (siehe onSelectTarget unten). Die frühere Retrofit-Verknüpfung (🔗 Setup verknüpfen,
// linkTargetTrade) ist komplett raus — das automatische Setup-Klick-zu-Bestätigungen
// (onSelectSetupConfirmations unten) deckt denselben Bedarf ab, siehe TradeEditModal.vue.
const invalidationAddTrade = ref(null);
// TSC-Bootstrap (Chat 2026-08-26, TSC-Neuaufbau: "ich nehme oft auch manuell über den TSC Dealing
// Ranges an") — dritter Bestätigungs-Arm-Zustand, NUR solange die TSC noch KEINE dealingRangeId
// hat. Sobald eine existiert, läuft alles über den normalen rangeConfirmationAddTrade/
// targetAddTrade-Weg oben (mit einem synthetischen { dealingRangeId, isTsc: true } statt eines
// echten `trade`-Objekts) — siehe onTscAddConfirmationRequest/onTscAddTargetRequest unten.
const tscBootstrapArmed = ref(false);
// Räumt alle Arm-Zustände außer dem übergebenen Namen. Ersetzt die vorherige, pro Funktion
// ausgeschriebene Reset-Liste (Chat 2026-08-28: mit Anti-Confluence wären das sonst 7 Refs x 8
// Stellen geworden) — ein Objekt aus Name -> Ref, statt jede Ref einzeln in jeder Funktion zu
// nennen, hält das wartbar, wenn ein achter Arm-Zustand dazukommt.
const ARM_STATES = {
  target: targetAddTrade,
  confirmation: confirmationAddTrade,
  rangeConfirmation: rangeConfirmationAddTrade,
  confluence: confluenceAddTrade,
  rangeConfluence: rangeConfluenceAddTrade,
  antiConfluence: antiConfluenceAddTrade,
  rangeAntiConfluence: rangeAntiConfluenceAddTrade,
  invalidation: invalidationAddTrade,
};
function clearArmStatesExcept(keep) {
  for (const [key, ref] of Object.entries(ARM_STATES)) {
    if (key !== keep) ref.value = null;
  }
  tscBootstrapArmed.value = false;
}
// Hinweistext je scharfem Arm-Zustand — eine Tabelle statt acht fast gleicher Spans. Angezeigt
// wird er in der Kopfleiste (App.vue), weil der Modus-Umschalter dort sitzt; clearArmStatesExcept
// lässt immer höchstens einen scharf, deshalb reicht der erste Treffer.
const ARM_HINTS = {
  target: (t) => `🎯 nächster Klick auf Pivot/OB fügt Trade #${t.id} ein Target hinzu`,
  confirmation: (t) => `✔ nächster Klick auf Sweep/OB/Divergenz fügt Trade #${t.id} eine Bestätigung hinzu`,
  rangeConfirmation: (t) => `✔ nächster Klick auf Sweep/OB/Divergenz fügt Dealing Range #${t.dealingRangeId} eine Bestätigung hinzu`,
  confluence: (t) => `💡 nächster Klick auf Fib fügt Trade #${t.id} ein Zusatzargument hinzu`,
  rangeConfluence: (t) => `💡 nächster Klick auf Fib fügt Dealing Range #${t.dealingRangeId} ein Zusatzargument hinzu`,
  antiConfluence: (t) => `⚠️ nächster Klick auf Sweep/OB/Fib/Divergenz fügt Trade #${t.id} eine Anti-Confluence hinzu`,
  rangeAntiConfluence: (t) => `⚠️ nächster Klick auf Sweep/OB/Fib/Divergenz fügt Dealing Range #${t.dealingRangeId} eine Anti-Confluence hinzu`,
  invalidation: (t) => `🚫 nächster Klick auf Pivot/OB setzt Invalidierung für Dealing Range #${t.dealingRangeId}`,
  tscBootstrap: () => "✔ nächster Klick auf ein OB legt die Dealing Range an",
};
// Der eine scharfe Zustand, aus dem sowohl der Hinweis oben als auch das Button-Highlight unten
// kommen. payload.isTsc unterscheidet die beiden Anzeigeorte: dieselbe Aktion (z.B.
// rangeConfirmation) kann aus der TSC oder aus dem Trade-Edit-Modal stammen, nur einer der beiden
// Knöpfe darf leuchten.
const armedAction = computed(() => {
  const found = Object.entries(ARM_STATES).find(([, r]) => r.value != null);
  if (found) return { key: found[0], payload: found[1].value };
  if (tscBootstrapArmed.value) return { key: "tscBootstrap", payload: { isTsc: true } };
  return null;
});
watchEffect(() => {
  chartHint.value = armedAction.value ? ARM_HINTS[armedAction.value.key](armedAction.value.payload) : null;
});
// PriceChart.vue: target-mode-active — irgendein Arm-Zustand "scharf" (egal welcher), schaltet den
// Chart-Klick-Handler von Pan/Zoom auf "nimmt den nächsten Treffer entgegen" um.
const anyArmStateActive = computed(() => armedAction.value != null);
// Erledigte Aktion (oder abgeräumte) -> zurück auf Navigieren. Seit dem Wegfall des
// Trade-Modus-Knopfes gibt es in diesem Modus ohne scharfe Aktion nichts mehr zu klicken; vorher
// blieb der Chart danach still in einem Modus stehen, der nur noch anders aussah.
watch(armedAction, (armed) => {
  if (!armed && chartMode.value === "trade") chartMode.value = "navigate";
});
// TSC-Sektionsname statt roher Arm-Key — die TSC kennt nur ihre eigenen fünf Sektionen, und der
// Bootstrap-Fall gehört dort an denselben Knopf wie eine normale Bestätigung.
const TSC_SECTION_OF_ARM = {
  tscBootstrap: "confirmation",
  rangeConfirmation: "confirmation",
  rangeConfluence: "confluence",
  rangeAntiConfluence: "antiConfluence",
  target: "target",
  invalidation: "invalidation",
};
const armedTscSection = computed(() => (armedAction.value?.payload?.isTsc ? (TSC_SECTION_OF_ARM[armedAction.value.key] ?? null) : null));
// Das Trade-Edit-Modal hat je eine Range- und eine Positions-Sektion pro Art, deckt sich also 1:1
// mit den Arm-Keys — hier reicht der rohe Key.
const armedTradeAction = computed(() => (armedAction.value && !armedAction.value.payload?.isTsc ? armedAction.value.key : null));
// Sonst bliebe der Hinweis in der globalen Kopfleiste stehen, wenn man das Dashboard verlässt.
onUnmounted(() => (chartHint.value = null));
// Ein Weg, einen Chart-Klick scharf zu machen — vorher stand derselbe Dreizeiler achtmal da.
// Nochmal auf denselben Knopf verlässt den Modus wieder (Philip 2026-09-23: "wenn ich nochmal auf
// einen TSC Button klicke, dann kann ich den Modus nicht wieder verlassen, sondern nur über den
// Header"); der Vergleich läuft über Ziel-Id + Anzeigeort, weil die TSC bei jedem Klick ein frisch
// gebautes { dealingRangeId, isTsc }-Objekt schickt, also nie dasselbe per Identität.
function sameArmTarget(a, b) {
  return (a?.id ?? null) === (b?.id ?? null) && (a?.dealingRangeId ?? null) === (b?.dealingRangeId ?? null) && !!a?.isTsc === !!b?.isTsc;
}
function disarmChartClick() {
  clearArmStatesExcept(null);
  chartMode.value = "navigate";
}
function armChartClick(key, t) {
  if (armedAction.value?.key === key && sameArmTarget(armedAction.value.payload, t)) {
    disarmChartClick();
    return;
  }
  clearArmStatesExcept(key);
  ARM_STATES[key].value = t;
  chartMode.value = "trade";
}
function onAddTargetRequest(t) {
  armChartClick("target", t);
}
function onAddConfirmationRequest(t) {
  armChartClick("confirmation", t);
}
function onAddRangeConfirmationRequest(t) {
  armChartClick("rangeConfirmation", t);
}
function onAddConfluenceRequest(t) {
  armChartClick("confluence", t);
}
function onAddRangeConfluenceRequest(t) {
  armChartClick("rangeConfluence", t);
}
function onAddAntiConfluenceRequest(t) {
  armChartClick("antiConfluence", t);
}
function onAddRangeAntiConfluenceRequest(t) {
  armChartClick("rangeAntiConfluence", t);
}
function onSetInvalidationRequest(t) {
  armChartClick("invalidation", t);
}
// Verlassen des Trade-Modus räumt eine noch "scharfe" Ziel-/Bestätigungs-/Zusatzargument-/
// Invalidierungs-Anfrage mit ab — sonst würde ein späteres Wieder-Reinklicken in den Trade-Modus
// (für einen ganz anderen Zweck) unerwartet den alten Trade verändern.
watch(tradeModeActive, (active) => {
  if (!active) clearArmStatesExcept(null);
});

// Messung (Philip 2026-09-23): zwei Chart-Klicks -> eine persistierte Zeichnung mit Pip-Label
// (siehe chartMeasure.js), also automatisch im Chart sichtbar, einzeln aus-/einblendbar und
// löschbar wie jede andere Zeichnung — und im Debug-Snapshot nachlesbar.
async function onMeasureDone({ from, to }) {
  const drawing = measureDrawing(from, to);
  await addDrawing(drawing.annotations, drawing.title);
}

const {
  rangeId: tscRangeId, range: tscRange, fromJournal: tscFromJournal,
  error: tscLoadError, refresh: refreshTscRange, openJournal: openJournalTscRange,
  closeJournal: closeJournalTscRange,
} = useTscRange(currentSymbol);
watch(tscRange, () => { if (tscFromJournal.value) void refreshTrades(); });
async function onOpenJournalInTsc(trade) {
  disarmChartClick();
  await openJournalTscRange(trade.dealingRangeId, trade.instrument);
  showTradeSetupCockpit.value = true;
  // Das Modal bleibt offen: ungespeicherte Positionsfelder dürfen beim DR-Wechsel nicht verloren gehen.
}
// FVG-Größe der laufenden Dealing Range für den Bewertungs-Bereich. Sie steckt weder in der Range
// noch in ihrer OB-Bestätigung (die trägt nur ihre Kanten), sondern nur im erkannten Setup.
// Gesucht wird über den NATÜRLICHEN Schlüssel Richtung + OB-Startzeit — dieselbe Paarung, mit der
// auch findMatchingTradeSetupId (tradeIntake.js) und mergeDbTradeSetups (tradeSetups.js) arbeiten.
// Nicht über dealing_ranges.trade_setup_id: die Spalte wird erst beim Überführen in einen Trade
// geschrieben (linkTradeToSetup), eine reine TSC-Idee hat dort immer null — genau daran ist die
// erste Fassung gescheitert (Bug-Report Philip 2026-09-23, GBP-Short vom 09.09.).
const tscFvgPips = computed(() => {
  const ob = (tscRange.value?.confirmations ?? []).find((c) => c.kind === "ob" && c.sourceTime != null);
  if (!ob) return null;
  const dir = tscRange.value.direction === "short" ? 1 : -1;
  const setup = (dbTradeSetups.value ?? []).find((s) => s.dir === dir && s.obStartTime === ob.sourceTime);
  return setup?.obFvg > 0 ? toPips(setup.obFvg) : null;
});
function onTscAddConfirmationRequest() {
  if (tscFromJournal.value && tscRangeId.value == null) return;
  if (tscRangeId.value != null) {
    onAddRangeConfirmationRequest({ dealingRangeId: tscRangeId.value, isTsc: true });
    return;
  }
  // Bootstrap-Fall: noch keine Range, der nächste Klick MUSS ein OB sein (siehe onSelectTarget).
  // Eigener Zweig statt armChartClick, weil dieser Zustand kein Ziel-Objekt hat — der zweite Klick
  // auf denselben Knopf verlässt den Modus aber genauso.
  if (tscBootstrapArmed.value) {
    disarmChartClick();
    return;
  }
  clearArmStatesExcept(null);
  tscBootstrapArmed.value = true;
  chartMode.value = "trade";
}
function onTscAddTargetRequest() {
  // 🎯 bleibt in der TSC gesperrt, solange keine Range (= keine Richtung) existiert — siehe
  // TradeSetupCockpit.vue :disabled auf der Targets-Sektion.
  if (tscRangeId.value == null) return;
  onAddTargetRequest({ dealingRangeId: tscRangeId.value, isTsc: true });
}
function onTscAddConfluenceRequest() {
  // 💡 bleibt in der TSC gesperrt, solange keine Range existiert — anders als Bestätigungen kann
  // ein Zusatzargument keine neue Dealing Range bootstrappen (kein Sweep/OB, keine eindeutige
  // Richtung), siehe TradeSetupCockpit.vue :disabled auf der Zusatzargumente-Sektion.
  if (tscRangeId.value == null) return;
  onAddRangeConfluenceRequest({ dealingRangeId: tscRangeId.value, isTsc: true });
}
function onTscAddAntiConfluenceRequest() {
  // ⚠️ bleibt in der TSC gesperrt, solange keine Range existiert — aus demselben Grund wie
  // Zusatzargumente oben.
  if (tscRangeId.value == null) return;
  onAddRangeAntiConfluenceRequest({ dealingRangeId: tscRangeId.value, isTsc: true });
}
// 🚫-Icon an der Invalidierungs-Sektion des TSC — derselbe Chart-Klick-Arm-Mechanismus wie im
// Trade-Edit-Modal (onSetInvalidationRequest), nur mit dem synthetischen TSC-Objekt statt eines
// echten Trades. Ohne Range ergibt Invalidierung keinen Sinn, die Sektion ist dann ausgeblendet.
function onTscSetInvalidationRequest() {
  if (tscRangeId.value == null) return;
  onSetInvalidationRequest({ dealingRangeId: tscRangeId.value, isTsc: true });
}
// Invalidierung entfernen — räumt Preis UND Objekt-Verknüpfung ab (siehe tradeIntake.js:
// updateDealingRange), damit im Chart nichts mehr als Invalidierung hervorgehoben bleibt.
async function removeInvalidation(dealingRangeId, isTsc) {
  const ok = await updateDealingRange(dealingRangeId, { invalidation: null });
  if (ok) (isTsc ? refreshTscRange() : refreshTrades());
}
async function onTscRemoveConfirmation(c) {
  const ok = await removeConfirmationFromTrade(c.id);
  if (ok) refreshTscRange();
}
// Gleiche Funktion wie onTscRemoveConfirmation — removeConfirmationFromTrade löscht generisch per
// id aus trade_evidence, unabhängig von category (siehe tradeIntake.js).
async function onTscRemoveConfluence(c) {
  const ok = await removeConfirmationFromTrade(c.id);
  if (ok) refreshTscRange();
}
async function onTscRemoveAntiConfluence(c) {
  const ok = await removeConfirmationFromTrade(c.id);
  if (ok) refreshTscRange();
}
async function onTscRemoveTarget(t) {
  const ok = await removeTargetFromTrade(t.id);
  if (ok) refreshTscRange();
}
// Target-Vorschläge (PLAN-find-targets.md, Chat 2026-08-27) — PriceChart.vue: openTargetPicker
// baut das Pivot-Target bereits fertig (dieselbe Form wie ein Chart-Klick, siehe findClickedTarget),
// hier nur noch der ganz normale addTargetToTrade-Weg wie bei jedem anderen Target. Generisch seit
// Chat 2026-08-30 (TradeEditModal.vue bekam dieselben Lupe-Buttons wie die TSC) — dealingRangeId/
// isTsc kommen jetzt im Payload selbst statt hart tscRangeId zu verwenden, isTsc entscheidet nur
// noch, welche Liste danach neu geladen wird (analog trade.isTsc in onSelectTarget).
async function onAddTargetFromPicker({ dealingRangeId, isTsc, ...target }) {
  const ok = await addTargetToTrade(dealingRangeId, target);
  if (ok) (isTsc ? refreshTscRange() : refreshTrades());
}
// Anti-Confluence-Vorschläge (Chat 2026-08-30) — PriceChart.vue: openAntiConfluencePicker baut das
// Confirmation-Rohformat bereits fertig (dieselbe Form wie ein Chart-Klick), hier nur noch der ganz
// normale addRangeConfirmation-Weg mit explizitem category='anti_confluence' wie bei jeder anderen
// Anti-Confluence. Generisch seit Chat 2026-08-30, siehe onAddTargetFromPicker oben.
async function onAddAntiConfluenceFromPicker({ dealingRangeId, isTsc, ...confirmation }) {
  const ok = await addRangeConfirmation(dealingRangeId, confirmation, "anti_confluence");
  if (ok) (isTsc ? refreshTscRange() : refreshTrades());
}
// Lupe-Buttons im TradeEditModal (Chat 2026-08-30, analog zur TSC) — öffnet denselben Picker wie
// @open-target-picker/@open-anti-confluence-picker auf der TradeSetupCockpit unten, nur mit der
// Dealing Range des gerade bearbeiteten Trades statt tscRange, isTsc=false schickt die Picker-
// Auswahl oben in onAddTargetFromPicker/onAddAntiConfluenceFromPicker über refreshTrades() statt
// refreshTscRange() zurück. editingTrade trägt direction/targets/invalidation bereits eingebettet
// (siehe trades.js: fetchTrades).
function editingTradeAsRange() {
  const t = editingTrade.value;
  if (!t) return null;
  return { id: t.dealingRangeId, direction: t.direction, targets: t.targets, invalidation: t.invalidation };
}
function onOpenTradeTargetPicker() {
  priceChartRef.value?.openTargetPicker(editingTradeAsRange(), false);
}
function onOpenTradeAntiConfluencePicker() {
  priceChartRef.value?.openAntiConfluencePicker(editingTradeAsRange(), false);
}
// "In die Trades-Liste überführen" (Chat 2026-08-27) — legt eine leere trade_positions-Zeile für
// die bestehende TSC-Range an und öffnet sie sofort im Trade-Edit-Modal, damit Philip Entry/
// Stop-Loss/etc. dort ganz normal ausfüllt statt in einem zweiten, redundanten Formular in der TSC.
//
// triggeredAt (Bug-Report Philip: Range #48/Position #76 bekam "heute" als Datum, obwohl das
// zugrundeliegende Setup ein Backtest war) — statt "jetzt" das Datum der OB-Bestätigung nehmen
// (bevorzugt, konkreteste zeitliche Verankerung der Idee), sonst die früheste Bestätigung
// überhaupt. Die Uhrzeit ist dabei bewusst egal ("Uhrzeit brauch ma für ne DR nicht ... gibts ja
// bei Positionen") — die reicht einfach mit, weil sourceTime sie ohnehin trägt; die echte
// Entry-Zeit trägt erst die tatsächliche Ausführung im Trade-Edit-Modal ein.
//
// Nachbesserung (Bug-Report Philip, DRL#82): eine reine Sweep-Bestätigung nahm bisher sourceTime
// (= wann der Pivot/das Level ENTSTANDEN ist) statt touchedTime (= wann es tatsächlich GESWEEPT
// wurde) — "die DR zählt für den Tag, an dem der Sweep PASSIERT ist", nicht für den Entstehungstag
// des gesweepten Levels, der oft deutlich früher liegt. Feste, kind-abhängige Regel statt eines
// generischen Fallbacks (Philip: "das gilt immer so", nicht nur "bevorzugt"): LQ-Sweep (kind=
// 'pivot') IMMER touchedTime, OB-Bestätigung (kind='ob') IMMER sourceTime — bei einer OB ist die
// Formations-Zeit selbst schon der relevante Anker (das Setup ENTSTEHT dort), bei einem Sweep erst
// der tatsächliche Touch. Andere Bestätigungs-Arten (fib/rsi_divergence) haben keine explizite
// Regel bekommen, bleiben beim bisherigen touchedTime-vor-sourceTime-Fallback.
function confirmationAnchorTime(c) {
  if (c?.kind === "pivot") return c.touchedTime ?? null;
  if (c?.kind === "ob") return c.sourceTime ?? null;
  return c?.touchedTime ?? c?.sourceTime ?? null;
}
async function onTscTransferToTrades() {
  if (tscFromJournal.value || tscRangeId.value == null) return;
  const confirmations = tscRange.value?.confirmations ?? [];
  const obConfirmation = confirmations.find((c) => c.kind === "ob" && confirmationAnchorTime(c) != null);
  const earliestConfirmation = confirmations.reduce((earliest, c) => {
    const t = confirmationAnchorTime(c);
    return t != null && (earliest == null || t < confirmationAnchorTime(earliest)) ? c : earliest;
  }, null);
  const triggeredAt = confirmationAnchorTime(obConfirmation ?? earliestConfirmation);

  const position = await addPositionToDealingRange(tscRangeId.value, { tradingAccountId: writableTradingAccountId.value, triggeredAt });
  if (!position) return;
  await refreshTrades();
  editingTradeId.value = position.id;
  // Die Idee IST jetzt ein Trade und gehört nicht mehr ins Cockpit — genau das meint
  // fetchActiveTscRangeId mit "noch keine trade_positions-Zeile". Ohne dieses Leeren blieb die
  // Range sichtbar, der Reset-Knopf zeigte weiter auf sie, und weil trade_positions per
  // `on delete cascade` dranhängt, nahm ein Reset den frisch journalierten Trade mit.
  tscRangeId.value = null;
  tscRange.value = null;
}
// Reset (Chat 2026-08-27, Philip: "jetzt einen reset button im TSC hinzufügen") — verwirft die
// komplette Idee, nicht nur die Anzeige (sonst würde fetchActiveTscRangeId dieselbe Range nach
// einem Reload/Symbolwechsel einfach wiederfinden, siehe dort). Confirm() wie sonst bei
// destruktiven Aktionen (TradeEditModal.vue: onDelete).
async function onTscReset() {
  disarmChartClick();
  if (tscFromJournal.value) {
    await closeJournalTscRange();
    return;
  }
  if (tscRangeId.value == null) return;
  if (!confirm("TSC wirklich zurücksetzen? Löscht die Dealing Range inkl. aller Bestätigungen, Targets und — falls schon vorhanden — der Ausführungen im Journal.")) return;
  const ok = await deleteDealingRange(tscRangeId.value);
  if (!ok) return;
  tscRangeId.value = null;
  tscRange.value = null;
}
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
    if (ok) (trade.isTsc ? refreshTscRange() : refreshTrades());
    return;
  }
  if (confirmationAddTrade.value) {
    const trade = confirmationAddTrade.value;
    confirmationAddTrade.value = null;
    const ok = await addConfirmationToTrade(trade.id, target, "confirmation");
    if (ok) refreshTrades();
    return;
  }
  if (rangeConfirmationAddTrade.value) {
    const trade = rangeConfirmationAddTrade.value;
    rangeConfirmationAddTrade.value = null;
    const ok = await addRangeConfirmation(trade.dealingRangeId, target, "confirmation");
    if (ok) (trade.isTsc ? refreshTscRange() : refreshTrades());
    return;
  }
  // Zusatzargument (Confluence: Fib) — derselbe Insert-Pfad wie eine Confirmation,
  // category kommt seit der Anti-Confluence-Einführung explizit vom Arm-Zustand statt aus
  // target.kind abgeleitet zu werden (siehe tradeIntake.js: insertConfirmation).
  if (confluenceAddTrade.value) {
    const trade = confluenceAddTrade.value;
    confluenceAddTrade.value = null;
    const ok = await addConfirmationToTrade(trade.id, target, "confluence");
    if (ok) refreshTrades();
    return;
  }
  if (rangeConfluenceAddTrade.value) {
    const trade = rangeConfluenceAddTrade.value;
    rangeConfluenceAddTrade.value = null;
    const ok = await addRangeConfirmation(trade.dealingRangeId, target, "confluence");
    if (ok) (trade.isTsc ? refreshTscRange() : refreshTrades());
    return;
  }
  // Anti-Confluence — gleicher kind-Satz wie Confirmation/Confluence (pivot/ob/fib/rsi_divergence),
  // nur die category unterscheidet, siehe trade-from-poi.md#confirmation-confluence-und-anti-
  // confluence--wie-eine-dealing-range-go-bekommt.
  if (antiConfluenceAddTrade.value) {
    const trade = antiConfluenceAddTrade.value;
    antiConfluenceAddTrade.value = null;
    const ok = await addConfirmationToTrade(trade.id, target, "anti_confluence");
    if (ok) refreshTrades();
    return;
  }
  if (rangeAntiConfluenceAddTrade.value) {
    const trade = rangeAntiConfluenceAddTrade.value;
    rangeAntiConfluenceAddTrade.value = null;
    const ok = await addRangeConfirmation(trade.dealingRangeId, target, "anti_confluence");
    if (ok) (trade.isTsc ? refreshTscRange() : refreshTrades());
    return;
  }
  // Invalidierung — schreibt seit 22.09.2026 nicht mehr nur target.price, sondern das angeklickte
  // Chart-Objekt mit (tradeIntake.js: setDealingRangeInvalidation), damit es im Chart hervorgehoben
  // werden kann wie eine Bestätigung/ein Target.
  if (invalidationAddTrade.value) {
    const trade = invalidationAddTrade.value;
    invalidationAddTrade.value = null;
    const ok = await setDealingRangeInvalidation(trade.dealingRangeId, target);
    if (ok) (trade.isTsc ? refreshTscRange() : refreshTrades());
    return;
  }
  if (tscBootstrapArmed.value) {
    tscBootstrapArmed.value = false;
    // Erste Bestätigung ist meist der LQ-Sweep, nicht der OB (Philip-Korrektur 2026-08-26: "als
    // erstes kommt der LQ-Sweep. Vielleicht bildet sich eine OB danach. Aber nur vielleicht") —
    // beide Kinds tragen inzwischen `direction` (Sweep: siehe PriceChart.vue: findClickedTarget,
    // Sweep eines Tiefs = Long-Erwartung, eines Hochs = Short; OB: siehe findClickedOBZone). Fib/
    // Divergenz haben keine so eindeutige Richtungs-Semantik, bleiben beim Bootstrap außen vor.
    if (target.kind !== "ob" && target.kind !== "pivot") {
      alert("Die erste Bestätigung einer neuen Dealing Range muss ein Sweep (Pivot) oder ein OB sein — die legt die Richtung fest.");
      return;
    }
    const range = await createDealingRange({ instrument: currentSymbol.value, direction: target.direction });
    if (!range) return;
    tscRangeId.value = range.id;
    const ok = await addRangeConfirmation(range.id, target, "confirmation");
    if (ok) refreshTscRange();
  }
}
// Ganzes Trade-Setup als Bestätigungen übernehmen (Chat 2026-07-31: "wenn ich ein Trade-Setup
// anklicke, sollen LS und OB als Bestätigung aufgenommen werden. PP, falls vorhanden, als
// Stop-Loss der trade_position") — nur im Bestätigungs-Modus erreichbar (PriceChart.vue:
// subscribeClick), deshalb hier dieselben Arm-Zustände wie onSelectTarget statt eines eigenen.
// LS/OB gehen an dieselbe Ebene (Range oder Position), die gerade "scharf" ist; der Stop-Loss
// sitzt IMMER auf der Ausführung (trade_position), unabhängig davon, welche Ebene für die
// Bestätigungen gerade gewählt ist — dafür braucht es aber überhaupt eine offene Ausführung.
//
// TSC-Bootstrap (Chat 2026-08-27, Philip: "ich will auch Orderblöcke — in diesem Fall ein
// Short-Setup — als Bestätigung verknüpfen können") — ein ganzes Trade-Setup (LS+OB) ist der
// naheliegendste erste Klick, nicht nur eine einzelne Sweep-Linie/OB-Box: direction kommt hier
// direkt aus setup.dir (directionForSetup), linkTradeToSetup trägt trade_setup_id+invalidation
// gleich mit ein — genau das, was die alte, automatische TSC vorher live berechnet hat.
async function onSelectSetupConfirmations(setup) {
  const trade = confirmationAddTrade.value ?? rangeConfirmationAddTrade.value;
  if (!trade && !tscBootstrapArmed.value) return;
  const bootstrapping = tscBootstrapArmed.value && !trade;
  const isRangeLevel = bootstrapping || rangeConfirmationAddTrade.value != null;
  confirmationAddTrade.value = null;
  rangeConfirmationAddTrade.value = null;
  tscBootstrapArmed.value = false;

  // JEDER abgeräumte Level wird eine eigene Bestätigung, nicht nur der entscheidende (Philip
  // 21.09.2026: "Je mehr Bestätigungs-LQ-Sweeps desto besser") — sweeps ist nach Alter sortiert,
  // der erste ist der, der auch in trade_setups.ls_* steht. Ältere Setup-Objekte ohne sweeps
  // (DB-Zeilen von vor dem 21.09.2026) fallen auf den einen LS zurück.
  const sweeps = setup.sweeps ?? [{ level: setup.ls, timeframe: "5M" }];
  const sweepConfirmations = sweeps.map((sw) => ({
    kind: "pivot",
    price: sw.level.price,
    sourceTime: sw.level.pivotTime,
    touchedTime: sw.level.touchedTime ?? null,
    // Für die liquidity_level_id-Verknüpfung (siehe PriceChart.vue: findClickedTarget) — die
    // Zeitebene des LEVELS (1H oder 5M), nicht die des gerade angezeigten Charts. Stand bis
    // 21.09.2026 fest auf "5M" und verlinkte einen H1-Sweep damit auf eine 5M-Zeile. setup.dir
    // folgt derselben 1=high/-1=low-Konvention wie ein Liquiditäts-Level (directionForSetup:
    // dir===1 -> Short, also Sweep eines Hochs).
    instrument: currentSymbol.value,
    timeframe: sw.timeframe,
    levelDirection: setup.dir === 1 ? "high" : "low",
  }));
  // Bug-Report Philip 2026-07-31, zweite Runde ("OB zeichnet sich durch
  // bis zum jetzigen Zeitpunkt, sollte nur bis zur berührenden Kerze"): detectSetupObs() ruft
  // laut eigenem Kommentar 1:1 detectOrderBlocks(candles, "5m") auf und übernimmt dessen top/bottom
  // unverändert — mit timeframe:"5M" findet PriceChart.vue: liveObZoneState darüber dieselbe Zone
  // live wieder und zeichnet die Box bis zum ECHTEN Touch, statt bis "jetzt" (kein Touch bekannt).
  const obConfirmation = {
    kind: "ob",
    price: setup.dir === 1 ? setup.obBottom : setup.obTop,
    sourceTime: setup.obStartTime,
    touchedTime: null,
    rangeLow: setup.obBottom,
    rangeHigh: setup.obTop,
    timeframe: "5M",
    // ob_zone_id-Auflösung (siehe insertConfirmation/findOrCreateObZoneId) braucht instrument/
    // direction zusätzlich zu rangeLow/rangeHigh/timeframe/sourceTime.
    instrument: currentSymbol.value,
    direction: directionForSetup(setup),
  };

  let dealingRangeId;
  if (bootstrapping) {
    const range = await createDealingRange({ instrument: currentSymbol.value, direction: directionForSetup(setup) });
    if (!range) return;
    dealingRangeId = range.id;
    tscRangeId.value = range.id;
  } else {
    dealingRangeId = trade.dealingRangeId;
  }

  // Ein ganzes Trade-Setup (LS+OB) ist immer eine echte Confirmation (GO), nie ein
  // Anti-Confluence-Klick — dafür gibt es die eigenen Arm-Zustände oben.
  const addFn = isRangeLevel ? (c) => addRangeConfirmation(dealingRangeId, c, "confirmation") : (c) => addConfirmationToTrade(trade.id, c, "confirmation");
  for (const sweepConfirmation of sweepConfirmations) await addFn(sweepConfirmation);
  await addFn(obConfirmation);

  // Stop-Loss-Vorschlag = Invalidierung des Setups (ferne OB-Kante, siehe
  // deriveSetupEntryInvalidation). Bis 2026-09-20 nur bei Path A und aus fractal.price — bei Path B
  // zeigte das aufs gesweepte Level statt aufs Extrem, deshalb blieb der Vorschlag dort ganz aus.
  // Nur bei einer echten Ausführung sinnvoll (trade.id) — bootstrapping/TSC hat noch keine
  // trade_position.
  if (!bootstrapping && !trade?.isTsc) {
    await updateTrade(trade.id, { stopLoss: deriveSetupEntryInvalidation(setup).invalidation });
  }
  // Übernimmt auch die Setup-Verknüpfung selbst (trade_setup_id + die davon abgeleitete
  // Invalidierung) — ersetzt die frühere manuelle "🔗 Setup verknüpfen"-Aktion (Chat 2026-07-31,
  // zweite Runde: "kann weg, da ... die Bestätigungen fügen sich von selbst hinzu").
  await linkTradeToSetup(dealingRangeId, currentSymbol.value, setup);

  if (bootstrapping || trade?.isTsc) {
    refreshTscRange();
  } else {
    refreshTrades();
  }
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
  if (c.kind === "tsc_setup") return `${c.direction === "short" ? "Short" : "Long"}-Setup (live, ${c.instrument})`;
  if (c.kind === "trade_confirmation") return `✔ Bestätigung #${c.confirmationId} (${c.instrument})`;
  if (c.kind === "liquidity_level") return `${c.level.timeframe} LQ-Level ${c.level.dirNum === 1 ? "Hoch" : "Tief"}`;
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
  } else if (target.kind === "tsc_setup") {
    // Live erkannte Setup-Box OHNE bekannte trade_setups.id (siehe priceChartHitTest.js:
    // findNearbyPinCandidates) — addPinTscSetupEntry legt die Zeile bei Bedarf per find-or-create
    // an (analog zu addPinM5ObEntry), landet danach als ganz normaler kind="trade_setup"-Pin.
    await addPinTscSetupEntry({ instrument: target.instrument, direction: target.direction, setup: target.setup }, note);
  } else if (target.kind === "trade_confirmation") {
    // Kein Resolve nötig — trade_evidence.id ist schon direkt bekannt, analog zu trade_setup.
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
// Chat 2026-08-26, Philip: "wenn alle dieselbe Krankheit hatten, sollten sie ne gemeinsame Funktion
// verwenden" — die Prüfung "kind passt + Instrument passt + Kaskaden-Timeframe passt" stand für
// ob_zone/liquidity_level/m5_liquidity_level je dreifach (Hover-Halo/gepinnte Objekte/Highlight-
// Keys unten) copy-pasted da. Der 1H-Hardcode-Bug (liquidity_level bekam bisher immer
// pinVisibleOnCurrentTf("1H") statt des echten Pin-Timeframes) steckte in einer der drei Kopien und
// wäre in den anderen beiden unbemerkt geblieben — genau die Bug-Klasse, die eine gemeinsame
// Funktion strukturell verhindert, statt sie beim nächsten Mal wieder von Hand synchron halten zu
// müssen. `field` = der Property-Name der eingebetteten Zeile auf dem pin_context-Entry
// (z.B. "obZone"/"liquidityLevel"/"m5Liquidity", siehe pinContext.js: toEntry).
function pinEntryVisible(entry, kind, field) {
  const data = entry.kind === kind ? entry[field] : null;
  return data != null && data.instrument === currentSymbol.value && pinVisibleOnCurrentTf(data.timeframe);
}
// Analog zu pinEntryVisible, aber für den Sprung-Guard (pinJumpMismatch unten) — braucht statt
// eines Booleans eine Fehlermeldung (welches Symbol/Timeframe fehlt), sonst dieselbe Prüfung. Nur
// für die beiden Kinds mit Kaskaden-Regel (ob_zone/liquidity_level) — m5_liquidity_level braucht
// dort bewusst exakte Timeframe-Gleichheit statt Kaskade (siehe pinJumpMismatch), passt also nicht
// in dieses gemeinsame Muster.
function pinJumpMismatchForField(entry, field) {
  const data = entry[field];
  if (data?.instrument !== currentSymbol.value) return `Erst zu ${data?.instrument} wechseln.`;
  return pinVisibleOnCurrentTf(data.timeframe) ? null : `Erst zu ${data.timeframe} wechseln.`;
}
// Dieselben Filter (aktuelles Symbol/Timeframe/Kaskaden-Regel) wie pinObZoneKeys & Co. oben — ein
// gehoverter Eintrag für ein anderes Symbol oder einen gröberen Timeframe ergibt hier bewusst
// KEINEN Treffer (die zugehörige Chart-Stelle existiert im gerade sichtbaren Chart schlicht nicht).
const hoveredPinObZoneKey = computed(() => {
  const e = hoveredPinEntry.value;
  if (!e) return null;
  // M5-OB-Pins laufen seit Punkt 6 (Migration 20260823120000) über denselben kind='ob_zone' wie
  // 1H/4H (e.obZone.timeframe === "5M") — kein eigener m5_ob-Zweig mehr nötig.
  if (pinEntryVisible(e, "ob_zone", "obZone")) {
    return obZoneEntryNaturalKey(e.obZone);
  }
  return null;
});
const hoveredPinTradeSetupId = computed(() => {
  const e = hoveredPinEntry.value;
  return e?.kind === "trade_setup" && e.tradeSetup?.instrument === currentSymbol.value ? e.tradeSetupId : null;
});
// Chart-Objekt-Highlight bei Hover über eine TSC-/TradeEditModal-Zeile (Feature-Wunsch Philip
// 2026-08-30: "wenn ich im TSC über eine Bestätigung ... hovere, dass mir das Chart-objekt
// gehighlighted wird ... du hast diese Funktionalität schon öfter gebaut") — dieselbe Pin-Halo-
// Infrastruktur wie PinPanel.vue-Zeilen-Hover (isSelectedPin in PriceChart.vue), nur mit einer
// zweiten Quelle: CrudListSection.vue emittiert das rohe trade_evidence-/trade_targets-Item, TSC
// und TradeEditModal reichen es 1:1 hier hoch (kein Natural-Key-Umweg nötig — rangeLow/rangeHigh/
// price/sourceTime/liquidityLevel stehen schon direkt auf jeder Zeile, siehe trades.js:
// toLiquidityLevel). Zwei getrennte Refs pro Quelle (evidence/target), weil trade_evidence.id und
// trade_targets.id unabhängige Id-Räume sind — ein gemeinsames Feld würde bei zufällig gleicher Id
// das falsche Chart-Objekt highlighten.
const hoveredCockpitEvidenceItem = ref(null);
const hoveredCockpitTargetItem = ref(null);
const hoveredModalEvidenceItem = ref(null);
const hoveredModalTargetItem = ref(null);
const hoveredPinTradeConfirmationId = computed(
  () =>
    (hoveredPinEntry.value?.kind === "trade_confirmation" ? hoveredPinEntry.value.tradeConfirmationId : null) ??
    hoveredCockpitEvidenceItem.value?.id ??
    hoveredModalEvidenceItem.value?.id ??
    null,
);
const hoveredTradeTargetId = computed(() => hoveredCockpitTargetItem.value?.id ?? hoveredModalTargetItem.value?.id ?? null);
// Gehoverte Invalidierungs-Zeile (TSC oder Modal) — läuft über dieselben hovered*EvidenceItem-Refs
// wie eine Bestätigung, nur identifiziert über category+dealingRangeId statt einer Evidenz-Id.
const hoveredInvalidationRangeId = computed(() => {
  const item = hoveredCockpitEvidenceItem.value ?? hoveredModalEvidenceItem.value;
  return item?.category === "invalidation" ? (item.dealingRangeId ?? null) : null;
});
// Kaskaden-Regel statt reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf
// oben) — ein auf 4H gepinntes Level bekommt jetzt auch auf 1H/M5 einen Halo, nicht nur auf 4H
// selbst; ein auf M5 gepinntes Level aber weiterhin keinen auf 1H/4H. Läuft seit Nachbesserung
// 2026-08-26 über pinEntryVisible (siehe dort) statt einem hartcodierten "1H".
const hoveredPinLiquidityLevelKey = computed(() => {
  const e = hoveredPinEntry.value;
  if (e) {
    if (pinEntryVisible(e, "liquidity_level", "liquidityLevel")) {
      return liquidityLevelEntryNaturalKey(e.liquidityLevel);
    }
    if (pinEntryVisible(e, "m5_liquidity_level", "m5Liquidity")) {
      return m5LiquidityEntryNaturalKey(e.m5Liquidity);
    }
  }
  // Eine Bestätigung/ein Target mit kanonischer liquidity_level-Verknüpfung (kind='pivot', siehe
  // trades.js: toLiquidityLevel) zeichnet KEINE eigene Linie (siehe PriceChart.vue:
  // refreshTradeConfirmationLinksInternal/-TradeTargetLinksInternal), sondern highlightet das
  // native LQ-Chartobjekt — derselbe Natural-Key-Formalismus wie beim Pin-Fall oben, nur mit
  // numerischem dir/pivotTime statt des DB-Zeilen-Formats (liquidityLevelNaturalKey statt
  // liquidityLevelEntryNaturalKey).
  const rowLvl =
    hoveredCockpitEvidenceItem.value?.liquidityLevel ??
    hoveredCockpitTargetItem.value?.liquidityLevel ??
    hoveredModalEvidenceItem.value?.liquidityLevel ??
    hoveredModalTargetItem.value?.liquidityLevel ??
    null;
  return rowLvl ? liquidityLevelNaturalKey(rowLvl.dir, rowLvl.pivotTime) : null;
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
  return visiblePinContextEntries.value
    .filter((e) => pinEntryVisible(e, "ob_zone", "obZone"))
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
// Trade-Targets/-Bestätigungen mit liquidity_level_id (Task "1H-Struktur-Pivots auf kanonische
// liquidity_levels-ID konsolidieren", 2026-08-24/25, siehe trades.js: toLiquidityLevel) — dieselbe
// Form wie ein pin_context-Level oben, deshalb hier genauso in pinnedLiquidityLevels/
// pinLiquidityLevelKeys eingemischt, statt einen eigenen Zeichenpfad zu brauchen (PriceChart.vue:
// refreshTradeTargetLinksInternal zeichnet ein kind='pivot'-Target/eine Bestätigung MIT
// liquidity_level_id deshalb nicht mehr selbst, siehe dort). Dedupliziert per Natural Key, falls
// mehrere Targets/Bestätigungen auf denselben Pivot zeigen.
// Denselben Trades-Toggle respektieren wie PriceChart.vue's Trade-Zeichenpfade (Bug-Report
// Philip 2026-08-25: diese Linien blieben beim Ausschalten von "Trades" stehen) — siehe
// tradeVisibility.js für die gemeinsame Regel, damit sie nicht ein sechstes Mal separat
// nachgebaut wird.
// Trades und TSC bewusst UNABHÄNGIG voneinander gated — siehe PriceChart.vue:
// tradeLikeEntriesForCandles für die volle Bug-Historie (Philip: "Trades > Trades hab ich
// deaktiviert, weil das ja die Zeichnungen von der Trade-Liste sind" / "toggle für die TSC
// Visualisierungen sollte Trades > TSC sein" = showTradeSetupCockpit).
const rangeLikeEntriesForChart = computed(() =>
  [
    ...(tradesVisible(showTradeSetups.value, showTrades.value) ? isolatedTrades.value : []),
    ...(showTradeSetupCockpit.value && tscRange.value ? [tscRange.value] : []),
  ].filter((t) => t.instrument === currentSymbol.value),
);

// Die Invalidierung zählt hier wie ein Target/eine Bestätigung mit (Philip 22.09.2026) — ihr
// verknüpftes Chart-Objekt soll im Chart genauso auftauchen und hervorgehoben werden.
function rangeLinkedItems(t) {
  return [...t.targets, ...t.confirmations, ...(t.invalidationItem ? [t.invalidationItem] : [])];
}

const tradeLinkedLiquidityLevels = computed(() => {
  const byKey = new Map();
  for (const t of rangeLikeEntriesForChart.value) {
    for (const item of rangeLinkedItems(t)) {
      const lvl = item.liquidityLevel;
      if (!lvl) continue;
      byKey.set(liquidityLevelNaturalKey(lvl.dir, lvl.pivotTime), lvl);
    }
  }
  return [...byKey.values()];
});

// Ein Level kann mehrere Journal-Rollen haben; keine davon darf beim Zusammenführen verschwinden.
const journalLiquidityCategories = computed(() => {
  const categories = new Map();
  for (const t of rangeLikeEntriesForChart.value) {
    const items = [...t.confirmations, ...t.targets.map((target) => ({ ...target, category: "target" }))];
    for (const c of items) {
      if (c.kind === "pivot" && c.liquidityLevel) {
        const key = liquidityLevelNaturalKey(c.liquidityLevel.dir, c.liquidityLevel.pivotTime);
        if (!categories.has(key)) categories.set(key, new Set());
        categories.get(key).add(c.category ?? "confirmation");
      }
    }
  }
  return categories;
});
// Analog dazu die Level, die die Invalidierung einer Range SIND — sie tragen im Chart 🚫 und die
// Invalidierungsfarbe statt ihrer normalen LQ-Farbe (siehe liquidity.js: levelOptions).
const invalidationLiquidityKeys = computed(() => {
  const keys = new Set();
  for (const t of rangeLikeEntriesForChart.value) {
    const item = t.invalidationItem;
    if (item?.kind === "pivot" && item.liquidityLevel) {
      keys.add(liquidityLevelNaturalKey(item.liquidityLevel.dir, item.liquidityLevel.pivotTime));
    }
  }
  return keys;
});
// Kaskaden-Regel statt reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf
// oben, Philip 2026-08-18/21: ein gepinntes 1H/4H-Level soll auch auf M5 sichtbar bleiben, siehe
// PriceChart.vue: mergePinnedLevels — aber NICHT umgekehrt ein M5-Level auf 4H). e.liquidityLevel.
// timeframe statt hartem "1H" seit Nachbesserung 2026-08-26, siehe hoveredPinLiquidityLevelKey oben.
const pinnedLiquidityLevels = computed(() => {
  const fromPins = visiblePinContextEntries.value
    .filter((e) => pinEntryVisible(e, "liquidity_level", "liquidityLevel") || pinEntryVisible(e, "m5_liquidity_level", "m5Liquidity"))
    .map((e) => {
      if (e.kind === "liquidity_level") {
        return {
          price: e.liquidityLevel.price,
          dir: e.liquidityLevel.direction === "high" ? 1 : -1,
          pivotTime: toUnixSec(e.liquidityLevel.pivotTime),
          touched: e.liquidityLevel.touched,
          endTime: toUnixSec(e.liquidityLevel.endTime),
          // Chart-Style-Kategorie (M5/1H/4H, siehe liquidity.js: liquidityStyleTimeframe) —
          // liquidity_levels.timeframe ist seit 2026-08-23 '1H' ODER '4H' (vorher nur '1H').
          timeframe: e.liquidityLevel.timeframe,
        };
      }
      return {
        price: e.m5Liquidity.price,
        dir: e.m5Liquidity.direction === "high" ? 1 : -1,
        pivotTime: toUnixSec(e.m5Liquidity.pivotTime),
        touched: null,
        endTime: null,
        // Roh-Wert vom Pin-Zeitpunkt (z.B. "5m"/"15m"/"1h"/"4h") — liquidityStyleTimeframe
        // bucketet alles außer exakt 1H/4H in die M5-Kategorie.
        timeframe: e.m5Liquidity.timeframe,
      };
    });
  const seen = new Set(fromPins.map((l) => liquidityLevelNaturalKey(l.dir, l.pivotTime)));
  const fromTrades = tradeLinkedLiquidityLevels.value.filter((l) => !seen.has(liquidityLevelNaturalKey(l.dir, l.pivotTime)));
  return [...fromPins, ...fromTrades];
});
const pinnedTradeSetups = computed(() => {
  return visiblePinContextEntries.value
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
  return visiblePinContextEntries.value
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
  // Kaskaden-Regel wie pinVisibleOnCurrentTf/pinEntryVisible (Bug 2026-08-21, Nachbesserung
  // 2026-08-26: siehe pinJumpMismatchForField oben) — für ob_zone kollabiert das bei 5M (feinster
  // Timeframe dort) auf "nur auf 5M selbst sichtbar", exakt das alte kind='m5_ob'-Verhalten
  // (ehemals ein hartes currentBar.value !== "5m"-Check), jetzt generisch für jeden Timeframe.
  if (entry.kind === "ob_zone") return pinJumpMismatchForField(entry, "obZone");
  if (entry.kind === "trade_setup") {
    return entry.tradeSetup?.instrument !== currentSymbol.value ? `Erst zu ${entry.tradeSetup?.instrument} wechseln.` : null;
  }
  if (entry.kind === "trade_confirmation") return entry.tradeConfirmation?.touchedTime == null ? "Noch nicht getoucht, kein Sprungziel." : null;
  if (entry.kind === "liquidity_level") return pinJumpMismatchForField(entry, "liquidityLevel");
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
// Bewusst getrennt von showPinHighlights: die Chart-Visualisierung soll auch ohne offenes Modal
// laufen (Bug-Report Philip, vorher hing beides an diesem einen Flag).
const showPinPanel = useLocalStorageRef("showPinPanel", false);
const showPinHighlights = useLocalStorageRef("showPinHighlights", false);
const pinMenuOpen = ref(false);

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
  get: () => (rangesFixedStartDateInput.value == null ? "" : toDatetimeLocal(rangesFixedStartDateInput.value)),
  set: (v) => {
    rangesFixedStartDateInput.value = v ? Math.floor(new Date(v).getTime() / 1000) : null;
  },
});
// "+1 Kerze"-Button: den Zeitpunkt der nächsten geladenen Kerze im aktuellen Timeframe holt
// PriceChart.vue (kennt allCandles, siehe defineExpose dort) — replayTime/-Active gehören hierher,
// nicht in die Kind-Komponente (fließt nur als Prop nach unten). Aus Live heraus (noch kein
// Zeitpunkt gesetzt) springt der erste Klick auf die älteste geladene Kerze (siehe nextReplayTime)
// und aktiviert Replay gleich mit — sonst würde der Klick unsichtbar ins Leere laufen.
const priceChartRef = ref(null);
// Trend-Kette fürs TSC (Chat 2026-08-29) — reaktiver computed über PriceChart.vue's defineExpose
// (trendChain dort ist selbst ein computed über marketStructureState, siehe dort) statt eines
// eigenen Emit-Zyklus, analog zu anderem reinen Zustands-Durchreichen aus der Kind-Komponente.
const trendChain = computed(() => priceChartRef.value?.trendChain ?? []);
const m5Trend = computed(() => priceChartRef.value?.m5Trend ?? null);
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
const INDIKATOREN_REFS = [showEma, showRsi, showRsiDivergence, showRsiDivergenceHistory, showLiquidity, showSweptLiquidity, showObsM5, showObs1h, showObs4h, showHistoricalObs];
const indikatorenActive = computed(() => INDIKATOREN_REFS.some((r) => r.value));
// War bis 2026-08-30 eine reine JS-Variable (nicht in localStorage) — ein Reload zwischen
// Ausblenden und Wieder-Einblenden (z.B. Tab zu/wieder auf am nächsten Handelstag) verlor den
// Snapshot, toggleIndikatoren landete dann im else-Zweig und EMA/RSI blieben dauerhaft aus,
// während Liquidity/OBs (Default true) wieder anzeigten — sah aus wie "EMA und RSI schalten sich
// immer wieder von selbst aus". Bug-Report Philip 2026-08-30.
const indikatorenSavedState = useLocalStorageRef("indikatorenSavedState", null);
function toggleIndikatoren() {
  if (indikatorenActive.value) {
    indikatorenSavedState.value = INDIKATOREN_REFS.map((r) => r.value);
    INDIKATOREN_REFS.forEach((r) => { r.value = false; });
  } else if (indikatorenSavedState.value) {
    INDIKATOREN_REFS.forEach((r, i) => { r.value = indikatorenSavedState.value[i]; });
    indikatorenSavedState.value = null;
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
// obsSavedState ebenfalls in localStorage (2026-08-30, gleicher Reload-Bug wie indikatorenSavedState).
const OBS_REFS = [showObsM5, showObs1h, showObs4h];
const obsActive = computed(() => OBS_REFS.some((r) => r.value));
const obsSavedState = useLocalStorageRef("obsSavedState", null);
function toggleObs() {
  if (obsActive.value) {
    obsSavedState.value = OBS_REFS.map((r) => r.value);
    OBS_REFS.forEach((r) => { r.value = false; });
  } else if (obsSavedState.value) {
    OBS_REFS.forEach((r, i) => { r.value = obsSavedState.value[i]; });
    obsSavedState.value = null;
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
    pinMenuOpen.value = false;
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
// "Isolieren"-Modus (Task trade-journal-dr-im-chart-isolieren-zeilen-button, 2026-08-28): Philip
// tat sich schwer, Journal-Zeilen den richtigen Chart-Objekten zuzuordnen, wenn mehrere Trades im
// selben Zeitfenster liegen. isolatedTrades filtert NUR den Chart-Feed (PriceChart.vue's
// props.trades speist Marker/Setup-OB-Boxen/Target-/Bestätigungslinien direkt daraus, siehe
// tradeLikeEntriesForCandles) — TradesTable/TradeStats bekommen weiterhin die volle `trades`-Liste,
// die Journal-Liste selbst soll dabei nicht schrumpfen.
const isolatedDealingRangeId = ref(null);
const isolatedTrades = computed(() =>
  isolatedDealingRangeId.value == null ? trades.value : trades.value.filter((t) => t.dealingRangeId === isolatedDealingRangeId.value),
);
function onIsolateTrade(t) {
  const activating = isolatedDealingRangeId.value !== t.dealingRangeId;
  isolatedDealingRangeId.value = activating ? t.dealingRangeId : null;
  // Beim Aktivieren zusätzlich hinspringen (wie ein normaler Zeilen-Klick) — der ganze Zweck ist,
  // sofort zu sehen, was isoliert wurde. Beim Deaktivieren NICHT wegspringen, Philip schaut zu dem
  // Zeitpunkt oft schon woanders im Chart.
  if (activating) onSelectTrade(t);
}
// Pin-Kontext (Chat 2026-08-01, siehe pinContext.js) — symbolunabhängig (anders als
// `trades` oben). MIT intervalMs seit Bug-Report Philip 2026-08-23: die pin_context-ZEILE selbst
// (kind/ids) ändert sich zwar nur durch explizite Aktionen, aber die eingebetteten
// liquidity_levels/ob_zones/trade_setups-Felder (touched/end_time) ändert poi-watcher im
// Hintergrund per Cron — exakt derselbe Grund wie bei dbObZones/dbLiquidityLevelsHtf unten. Ohne
// Poll blieb ein gepinntes, längst getouchtes 1H-Level dauerhaft auf dem touched=false-Stand von
// vor dem Pin hängen, sobald es aus computeHtfLiquidityLevels' Top-N-"relevant"-Fenster
// rausgefallen war (neuere Touches verdrängen ältere) und die Pin-Kopie die einzige verbliebene
// Quelle war.
const { data: pinContextEntries, refresh: refreshPinContext } = usePolledFetch(() => fetchPinContext(), { intervalMs: 60_000 });
// Bug-Report Philip: Pin-Visualisierung (Halos + direkt gerenderte Pin-Objekte) blieb im Chart/in
// der Trades-Tabelle stehen, egal ob der "📌 Pins"-Button an oder aus war — analog
// zum bereits gefixten Trades-Toggle-Bug 2026-08-25 (siehe tradeLinkedLiquidityLevels oben). Eine
// gemeinsame Quelle statt den Toggle in jedem der ~10 abgeleiteten Computeds einzeln zu prüfen.
const visiblePinContextEntries = computed(() => (showPinHighlights.value ? pinContextEntries.value : []));
// 1H/4H-OB-Zonen (Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7) —
// anders als trades/pinContextEntries oben ändert sich das hier NICHT nur durch explizite
// Browser-Aktionen, sondern im Hintergrund durch poi-watcher (Cron alle 5min) — deshalb, anders als
// die beiden Fälle oben, MIT intervalMs. 60s reicht: schneller als jede sinnvolle manuelle
// Beobachtung, ohne unnötig oft zu pollen.
const { data: dbObZones } = usePolledFetch(() => fetchObZones(), { intervalMs: 60_000 });
// Von poi-watcher persistierte Trade-Setups (Task "Chart zeichnet die persistierten Trade-Setups")
// — gleicher Cron-im-Hintergrund-Grund fürs intervalMs wie dbObZones. Anders als dort NICHT über
// alle Instrumente: trade_setups liegt je Instrument schon nahe am PostgREST-Zeilendeckel (siehe
// fetchTradeSetups), deshalb je Symbol + Replay-Stand geladen und bei deren Wechsel sofort neu
// (Watcher unten), statt bis zum nächsten Poll den alten Stand über dem Chart hängen zu lassen.
const { data: dbTradeSetups, refresh: refreshDbTradeSetups } = usePolledFetch(() => fetchTradeSetups(currentSymbol.value, replayUntil.value), {
  intervalMs: 60_000,
});
// HTF-Liquidity-Level, 1H+4H (Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren",
// Punkt 12, seit 2026-08-23 auch 4H) — analog zu dbObZones oben, gleicher Grund für intervalMs
// (poi-watcher-Cron im Hintergrund).
const { data: dbLiquidityLevelsHtf } = usePolledFetch(() => fetchLiquidityLevelsHtf(), { intervalMs: 60_000 });
// 1D-Periode-4-Struktur-Pivots (Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots") — analog
// zu dbLiquidityLevelsHtf oben, gleicher Grund für intervalMs (die tägliche daily-structure-pivots-
// Cron-Function läuft im Hintergrund). Feed für die Dreieck-Marker (PriceChart.vue) UND für den
// "1D-Pivot"-Start-Modus unten.
const { data: dbDailyPivots } = usePolledFetch(() => fetchDailyStructurePivots(), { intervalMs: 60_000 });
// Neuester Pivot mit aufgelöstem structure_start_time für currentSymbol — treibt sowohl den
// "1D-Pivot"-Modus (Watcher unten) als auch dessen Read-only-Anzeige im Dropdown.
const latestDailyPivotStructureStartTime = computed(() => {
  const latest = dbDailyPivots.value
    .filter((p) => p.instrument === currentSymbol.value && p.structureStartTime != null)
    .sort((a, b) => b.pivotTime - a.pivotTime)[0];
  return latest ? latest.structureStartTime : null;
});
const rangesPivotStartDisplay = computed(() =>
  latestDailyPivotStructureStartTime.value == null ? "" : toDatetimeLocal(latestDailyPivotStructureStartTime.value),
);
// Leitet die EFFEKTIVEN rangesFixedStartActive/-Time aus dem gewählten Modus ab (siehe
// rangesStartMode-Kommentar oben) — läuft bei jedem Moduswechsel UND bei jeder Pivot-/Datum-
// Änderung erneut, damit der "1D-Pivot"-Modus automatisch mitzieht, sobald ein neuer Pivot dazu
// kommt (kein einmaliger Prefill mehr wie in der Vorversion, echter Live-Modus).
watch(
  [rangesStartMode, rangesFixedStartDateInput, latestDailyPivotStructureStartTime],
  () => {
    if (rangesStartMode.value === "days") {
      rangesFixedStartActive.value = false;
    } else if (rangesStartMode.value === "date") {
      rangesFixedStartActive.value = true;
      rangesFixedStartTime.value = rangesFixedStartDateInput.value;
    } else {
      // "pivot": bleibt so lange auf dem zuletzt bekannten Wert stehen, wie für dieses Symbol noch
      // kein aufgelöster Pivot vorliegt (z.B. currentSymbol gerade erst gewechselt, Poll noch nicht
      // durch) — kein Zurückfallen auf false/null, das würde beim Umschalten kurz auf den
      // rollierenden Lookback zurückspringen lassen.
      rangesFixedStartActive.value = latestDailyPivotStructureStartTime.value != null;
      if (latestDailyPivotStructureStartTime.value != null) {
        rangesFixedStartTime.value = latestDailyPivotStructureStartTime.value;
      }
    }
  },
  { immediate: true },
);
// Nur die Ids, die zum GERADE geladenen Symbol gehören (trades enthält nur dessen Trades) — ein
// Pin-Eintrag für ein anderes Symbol kann im Chart/in der Tabelle ohnehin nicht markiert
// werden, solange dieses Symbol nicht ausgewählt ist.
const pinTradeIds = computed(() => {
  const tradeIds = new Set(trades.value.map((t) => t.id));
  return new Set(visiblePinContextEntries.value.filter((e) => tradeIds.has(e.tradePositionId)).map((e) => e.tradePositionId));
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
    visiblePinContextEntries.value
      .filter((e) => pinEntryVisible(e, "ob_zone", "obZone"))
      .map((e) => obZoneEntryNaturalKey(e.obZone)),
  );
});
// Trade-Setup-Pendant (Chat 2026-08-01, dritte Runde) — echte Id (kein Natural-Key-Umweg wie bei
// ob_zone nötig, siehe pinContext.js), trotzdem aufs aktuelle Symbol gefiltert.
const pinTradeSetupIds = computed(() => {
  return new Set(
    visiblePinContextEntries.value
      .filter((e) => e.kind === "trade_setup" && e.tradeSetup?.instrument === currentSymbol.value)
      .map((e) => e.tradeSetupId),
  );
});
// Bestätigungs-Pendant (Chat 2026-08-01, vierte Runde) — echte Id, kein Symbol-Filter möglich
// (trade_evidence hat keine eigene instrument-Spalte, siehe pinContext.js) — unkritisch,
// die zugehörige Box existiert im Chart ohnehin nur für Trades des gerade angezeigten Symbols.
const pinTradeConfirmationIds = computed(() => {
  return new Set(visiblePinContextEntries.value.filter((e) => e.kind === "trade_confirmation").map((e) => e.tradeConfirmationId));
});
// Liquiditäts-Level-Pendant (Chat 2026-08-17) — mischt kind='liquidity_level' (1H/4H, echte DB-
// Zeile) und kind='m5_liquidity_level' (Nicht-HTF-Snapshot) in EINE Menge. Kaskaden-Regel statt
// reiner currentBar-Gleichheit (Bug 2026-08-21, siehe pinVisibleOnCurrentTf oben, analog zum Fix
// bei pinnedLiquidityLevels/hoveredPinLiquidityLevelKey): ein auf 4H gepinntes Level bekommt jetzt
// auch auf 1H/M5 einen Halo (Philip: "1h/4h ... sollen im M5 trotzdem angezeigt werden"), ein auf
// M5 gepinntes Level aber weiterhin keinen auf 1H/4H (Philip: "M5 OBs in 4h TF anzuzeigen ist
// nicht so hilfreich"). e.liquidityLevel.timeframe statt hartem "1H" seit Nachbesserung 2026-08-26.
const pinLiquidityLevelKeys = computed(() => {
  return new Set([
    ...visiblePinContextEntries.value
      .filter((e) => pinEntryVisible(e, "liquidity_level", "liquidityLevel"))
      .map((e) => liquidityLevelEntryNaturalKey(e.liquidityLevel)),
    ...visiblePinContextEntries.value
      .filter((e) => pinEntryVisible(e, "m5_liquidity_level", "m5Liquidity"))
      .map((e) => m5LiquidityEntryNaturalKey(e.m5Liquidity)),
    // Trade-Targets/-Bestätigungen mit liquidity_level_id bekommen denselben Halo wie ein Pin
    // (siehe tradeLinkedLiquidityLevels oben) — sie sind ohnehin schon Teil der Idee, ein
    // zusätzliches manuelles Anpinnen wäre nur Mehrarbeit für dasselbe Ergebnis.
    ...tradeLinkedLiquidityLevels.value.map((l) => liquidityLevelNaturalKey(l.dir, l.pivotTime)),
  ]);
});
// RSI-Divergenz-Pendant (Chat 2026-08-17) — nur nach Symbol gefiltert, kein Timeframe-Filter
// nötig (RSI-Divergenz-Erkennung läuft ausschließlich auf M5, siehe rsi.js/CLAUDE.md).
const pinRsiDivergenceKeys = computed(() => {
  return new Set(
    visiblePinContextEntries.value
      .filter((e) => e.kind === "rsi_divergence" && e.rsiDivergence?.instrument === currentSymbol.value)
      .map((e) => rsiDivergenceEntryNaturalKey(e.rsiDivergence)),
  );
});
// Symbolwechsel soll sofort auf die Trades des neuen Symbols springen, statt bis zum nächsten
// Poll die des vorherigen Symbols über dem neuen Chart hängen zu lassen. Kontowechsel (Chat
// 2026-07-30) refresht aus demselben Grund sofort statt bis zum nächsten Poll.
watch(currentSymbol, () => {
  refreshTrades();
  refreshDbTradeSetups();
  isolatedDealingRangeId.value = null;
});
watch(replayUntil, refreshDbTradeSetups);
watch(selectedTradingAccountId, () => {
  refreshTrades();
  isolatedDealingRangeId.value = null;
});
</script>

<template>
  <div class="toolbar">
    <div class="symbol-switcher">
      <ToggleButton
        v-for="sym in SYMBOLS"
        :key="sym"
        :class="{ active: !goldPreview && sym === currentSymbol }"
        @click="goldPreview = false; currentSymbol = sym"
      >
        {{ sym }}
      </ToggleButton>
      <ToggleButton :class="{ active: goldPreview }" @click="goldPreview = true">XAUUSD</ToggleButton>
    </div>
    <div v-if="!goldPreview" class="timeframe-switcher">
      <ToggleButton
        v-for="tf in TIMEFRAMES"
        :key="tf.label"
        :class="{ active: tf.label === currentBar }"
        @click="currentBar = tf.label"
      >
        {{ tf.label }}
      </ToggleButton>
    </div>
    <div v-if="!goldPreview" class="drawing-toggles">
      <div class="toggle-group">
        <ToggleButton :class="{ active: indikatorenActive }" @click="toggleIndikatoren">
          Indikatoren
        </ToggleButton>
        <ToggleButton
          variant="caret"
          :class="{ open: indikatorenMenuOpen }"
          title="Untermenü"
          @click="indikatorenMenuOpen = !indikatorenMenuOpen"
        >
          ▾
        </ToggleButton>
        <div v-if="indikatorenMenuOpen" class="toggle-dropdown indikatoren-dropdown">
          <ToggleButton
            variant="menu"
            :class="{ active: showEma }"
            :disabled="emaDisabled"
            :title="emaDisabled ? 'EMA nur für M5' : ''"
            @click="showEma = !showEma"
          >
            EMA
          </ToggleButton>
          <div class="toggle-group">
            <ToggleButton variant="menu" :class="{ active: showRsi }" @click="showRsi = !showRsi">
              RSI
            </ToggleButton>
            <ToggleButton
              variant="caret"
              :class="{ open: rsiMenuOpen }"
              title="Untermenü"
              @click="rsiMenuOpen = !rsiMenuOpen"
            >
              ▾
            </ToggleButton>
            <div v-if="rsiMenuOpen" class="toggle-dropdown">
              <ToggleButton
                variant="menu"
                :class="{ active: showRsiDivergence }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : ''"
                @click="showRsiDivergence = !showRsiDivergence"
              >
                Divergenz
              </ToggleButton>
              <ToggleButton
                variant="menu"
                :class="{ active: showRsiDivergenceHistory }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : ''"
                @click="showRsiDivergenceHistory = !showRsiDivergenceHistory"
              >
                Divergenz (Historie)
              </ToggleButton>
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

              <ToggleButton
                variant="menu"
                :class="{ active: showRsiDivergenceOutcomeDebug }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : 'Debug: zeichnet fuer jede sichtbare Divergenz die Struktur-Marke (gruen=hit/rot=miss/grau=pending)'"
                @click="showRsiDivergenceOutcomeDebug = !showRsiDivergenceOutcomeDebug"
              >
                Outcome-Debug
              </ToggleButton>
              <ToggleButton
                variant="menu"
                :class="{ active: showRsiDivergenceStats }"
                :disabled="rsiDivergenceDisabled"
                :title="rsiDivergenceDisabled ? 'Braucht RSI' : 'Liste aller sichtbaren Divergenzen inkl. Statistik'"
                @click="showRsiDivergenceStats = !showRsiDivergenceStats"
              >
                Statistik
              </ToggleButton>
            </div>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <div class="toggle-group">
            <ToggleButton variant="menu" :class="{ active: showLiquidity }" @click="showLiquidity = !showLiquidity">
              Liquidität
            </ToggleButton>
            <ToggleButton
              variant="caret"
              :class="{ open: liquidityMenuOpen }"
              title="Untermenü"
              @click="liquidityMenuOpen = !liquidityMenuOpen"
            >
              ▾
            </ToggleButton>
            <div v-if="liquidityMenuOpen" class="toggle-dropdown">
              <ToggleButton variant="menu" :class="{ active: showSweptLiquidity }" @click="showSweptLiquidity = !showSweptLiquidity">
                Liquidity-Sweeps
              </ToggleButton>
            </div>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <div class="toggle-group">
            <ToggleButton variant="menu" :class="{ active: obsActive }" @click="toggleObs">
              OBs
            </ToggleButton>
            <ToggleButton
              variant="caret"
              :class="{ open: obsMenuOpen }"
              title="Untermenü"
              @click="obsMenuOpen = !obsMenuOpen"
            >
              ▾
            </ToggleButton>
            <!-- M5/1H/4H unabhängig an-/ausschaltbar (Chat 2026-07-30, Bug-Report Philip: "wenn ich
                 Indikatoren > OBs im M5 anhabe, werden mir ganz viele M5 OBs angezeigt" — vorher
                 folgten Forex-OBs immer nur dem gerade angezeigten Chart-Timeframe, nie mehrere
                 gleichzeitig, siehe PriceChart.vue: collectObsZones). -->
            <div v-if="obsMenuOpen" class="toggle-dropdown">
              <ToggleButton variant="menu" :class="{ active: showObsM5 }" @click="showObsM5 = !showObsM5">
                M5
              </ToggleButton>
              <ToggleButton variant="menu" :class="{ active: showObs1h }" @click="showObs1h = !showObs1h">
                1H
              </ToggleButton>
              <ToggleButton variant="menu" :class="{ active: showObs4h }" @click="showObs4h = !showObs4h">
                4H
              </ToggleButton>

              <div class="toggle-dropdown-divider"></div>

              <ToggleButton variant="menu" :class="{ active: showHistoricalObs }" @click="showHistoricalObs = !showHistoricalObs">
                Historische OBs
              </ToggleButton>
            </div>
          </div>
        </div>
      </div>

      <div class="toggle-group">
        <ToggleButton :class="{ active: showTradeSetups }" @click="showTradeSetups = !showTradeSetups">
          Trades
        </ToggleButton>
        <ToggleButton
          variant="caret"
          :class="{ open: tradeSetupsMenuOpen }"
          title="Untermenü"
          @click="tradeSetupsMenuOpen = !tradeSetupsMenuOpen"
        >
          ▾
        </ToggleButton>
        <div v-if="tradeSetupsMenuOpen" class="toggle-dropdown">
          <!-- Untermenü-Feinschalter: braucht den übergeordneten "Trades"-Toggle (showTradeSetups)
               zusätzlich an, um überhaupt was anzuzeigen (Bug-Report Philip 2026-07-28: "der
               übergeordnete Trades-Toggle soll Trades auch ausblenden, TSC ist einzige Ausnahme") —
               siehe PriceChart.vue: refreshTradeMarkersInternal/-TradeSetupLinksInternal/
               -TradeTargetLinksInternal, die auf BEIDE Props prüfen. -->
          <ToggleButton variant="menu" :class="{ active: showTrades }" @click="showTrades = !showTrades">
            Trades
          </ToggleButton>

          <div class="toggle-dropdown-divider"></div>

          <ToggleButton variant="menu" :class="{ active: showTradeSetupsLong }" @click="showTradeSetupsLong = !showTradeSetupsLong">
            Long Setups
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showTradeSetupsShort }" @click="showTradeSetupsShort = !showTradeSetupsShort">
            Short Setups
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showRScale }" :title="rScaleHint" @click="showRScale = !showRScale">
            R-Skala
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showPipScale }" :title="pipScaleHint" @click="showPipScale = !showPipScale">
            Pip-Skala
          </ToggleButton>
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

          <ToggleButton variant="menu" :class="{ active: showTradeSetupCockpit }" @click="showTradeSetupCockpit = !showTradeSetupCockpit">
            TSC
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showTradeSetupBewertung }" title="Trade-Setup-Bewertung" @click="showTradeSetupBewertung = !showTradeSetupBewertung">
            TSB
          </ToggleButton>
        </div>
      </div>

      <div class="toggle-group">
        <ToggleButton :class="{ active: showRanges }" @click="showRanges = !showRanges">
          Structure
        </ToggleButton>
        <ToggleButton
          variant="caret"
          :class="{ open: rangesMenuOpen }"
          title="Untermenü"
          @click="rangesMenuOpen = !rangesMenuOpen"
        >
          ▾
        </ToggleButton>
        <div v-if="rangesMenuOpen" class="toggle-dropdown">
          <ToggleButton variant="menu" :class="{ active: showRangesMetadata }" @click="showRangesMetadata = !showRangesMetadata">
            Metadaten
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showH1Structure }" @click="showH1Structure = !showH1Structure">
            1h-Struktur
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showM5Structure }" @click="showM5Structure = !showM5Structure">
            M5-Struktur
          </ToggleButton>
          <ToggleButton variant="menu" :class="{ active: showM5TrendPhases }" @click="showM5TrendPhases = !showM5TrendPhases">
            M5-Trendphasen
          </ToggleButton>
          <label class="ranges-period-field">
            M5-Periode
            <input v-model.number="m5StructurePeriod" type="number" min="1" class="ranges-period-input" title="Fraktal-Periode der M5-Struktur (Outer)" />
          </label>
          <label class="ranges-period-field">
            M5-Periode (eingebettet)
            <input v-model.number="m5Structure2Period" type="number" min="1" class="ranges-period-input" title="Fraktal-Periode der M5-Struktur (eingebettet)" />
          </label>

          <div class="toggle-dropdown-divider"></div>

          <ToggleButton
            variant="menu"
            :class="{ active: rangesStartMode === 'date' }"
            title="Fester, von Hand gewählter Startzeitpunkt — bleibt beim Scrubben im Replay-Modus stabil (gilt für Periode 5 UND die eingebettete Periode 2)"
            @click="rangesStartMode = 'date'"
          >
            Start ab Datum
          </ToggleButton>
          <input
            v-if="rangesStartMode === 'date'"
            v-model="rangesFixedStartInputValue"
            type="datetime-local"
            class="replay-input ranges-fixed-start-input"
            title="Ab diesem Zeitpunkt werden Structure-Pivots gezählt (beide Perioden)"
          />
          <ToggleButton
            variant="menu"
            :class="{ active: rangesStartMode === 'days' }"
            title="Rollierendes 'letzte X Tage/Stunden'-Fenster ab jetzt (bzw. ab dem Replay-Zeitpunkt)"
            @click="rangesStartMode = 'days'"
          >
            Start ab X Tagen
          </ToggleButton>
          <ToggleButton
            variant="menu"
            :class="{ active: rangesStartMode === 'pivot' }"
            title="Automatisch: letzter persistierter 1D-Periode-4-Struktur-Pivot dieses Instruments (Default)"
            @click="rangesStartMode = 'pivot'"
          >
            Start ab 1D-Pivot
          </ToggleButton>
          <input
            v-if="rangesStartMode === 'pivot'"
            :value="rangesPivotStartDisplay"
            type="datetime-local"
            class="replay-input ranges-fixed-start-input"
            disabled
            title="Automatisch aufgelöst aus dem letzten 1D-Periode-4-Pivot — nicht editierbar"
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
              :disabled="rangesStartMode !== 'days'"
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
              :disabled="rangesStartMode !== 'days'"
            />
          </label>

          <div class="toggle-dropdown-divider"></div>

          <label class="ranges-period-field">
            Periode (eingebettet)
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
              :disabled="rangesStartMode !== 'days'"
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
              :disabled="rangesStartMode !== 'days'"
            />
          </label>
        </div>
      </div>

      <!-- Eigener, permanenter Toggle statt im "Indikatoren"-Sammel-Dropdown (Chat 2026-07-29:
           "ich deaktiviere gerne Indikatoren um mehr zu sehen, aber Sessions eig nie — die geben
           mir Orientierung zur Charthistorie") — bewusst links neben News, nicht im Indikatoren-
           Sammel-Toggle enthalten (siehe INDIKATOREN_REFS oben). -->
      <div class="toggle-group">
        <ToggleButton
          :class="{ active: showSessions }"
          :disabled="sessionsDisabled"
          :title="sessionsDisabled ? 'Sessions nur bis 1h' : ''"
          @click="showSessions = !showSessions"
        >
          Sessions
        </ToggleButton>
        <ToggleButton variant="caret" title="Sessions verwalten" @click="showSessionsModal = true">
          ⚙
        </ToggleButton>
      </div>

      <div class="toggle-group">
        <ToggleButton :class="{ active: showNews }" @click="showNews = !showNews">
          News
        </ToggleButton>
        <ToggleButton variant="caret" title="News verwalten" @click="showNewsModal = true">
          ⚙
        </ToggleButton>
      </div>

      <div class="toggle-group replay-control" :class="{ active: replayActive }">
        <ToggleButton
          class="replay-toggle-btn"
          :class="{ active: replayActive }"
          title="Replay an/aus — Datum bleibt beim Ausschalten stehen"
          @click="replayActive = !replayActive"
        >
          Replay ⏮
        </ToggleButton>
        <input v-model="replayInputValue" type="datetime-local" class="replay-input" title="Chart+Indikatoren nur bis zu diesem Zeitpunkt anzeigen" />
        <button class="replay-step-btn" title="+1 Kerze" :disabled="stepReplayInFlight" @click="stepReplayForward">
          {{ stepReplayInFlight ? '…' : '▶|' }}
        </button>
      </div>

      <div class="toggle-group">
        <ToggleButton :class="{ active: showPinHighlights }" title="Angepinnte Stellen im Chart hervorheben" @click="showPinHighlights = !showPinHighlights">
          📌 Pins
        </ToggleButton>
        <ToggleButton
          variant="caret"
          :class="{ open: pinMenuOpen }"
          title="Untermenü"
          @click="pinMenuOpen = !pinMenuOpen"
        >
          ▾
        </ToggleButton>
        <div v-if="pinMenuOpen" class="toggle-dropdown">
          <ToggleButton variant="menu" :class="{ active: showPinPanel }" @click="showPinPanel = !showPinPanel">
            📋 Pin-Liste
          </ToggleButton>
        </div>
      </div>

      <div class="toggle-group">
        <ToggleButton :class="{ active: showLiquidityDebug }" @click="showLiquidityDebug = !showLiquidityDebug">
          Debug
        </ToggleButton>
        <ToggleButton
          variant="caret"
          :class="{ open: debugMenuOpen }"
          title="Untermenü"
          @click="debugMenuOpen = !debugMenuOpen"
        >
          ▾
        </ToggleButton>
        <div v-if="debugMenuOpen" class="toggle-dropdown">
          <ToggleButton variant="menu" :class="{ active: showDebugMetadata }" @click="showDebugMetadata = !showDebugMetadata">
            📋 Metadaten
          </ToggleButton>
        </div>
      </div>

      <ToggleButton :class="{ active: showStyleModal }" @click="showStyleModal = !showStyleModal">
        🎨 Style
      </ToggleButton>
    </div>
  </div>

  <StyleModal v-if="showStyleModal" @close="showStyleModal = false" />
  <SessionsModal v-if="showSessionsModal" :instrument="currentSymbol" @close="showSessionsModal = false" />
  <NewsModal v-if="showNewsModal" @close="showNewsModal = false" />
  <TradeEditModal
    v-if="editingTrade"
    :trade="editingTrade"
    :armed-action="armedTradeAction"
    :current-symbol="currentSymbol"
    @close="closeTradeEditModal"
    @saved="refreshTrades"
    @open-in-tsc="onOpenJournalInTsc(editingTrade)"
    @deleted="onTradeDeleted"
    @request-add-target="onAddTargetRequest(editingTrade)"
    @request-add-confirmation="onAddConfirmationRequest(editingTrade)"
    @request-add-range-confirmation="onAddRangeConfirmationRequest(editingTrade)"
    @request-add-confluence="onAddConfluenceRequest(editingTrade)"
    @request-add-range-confluence="onAddRangeConfluenceRequest(editingTrade)"
    @request-add-anti-confluence="onAddAntiConfluenceRequest(editingTrade)"
    @request-add-range-anti-confluence="onAddRangeAntiConfluenceRequest(editingTrade)"
    @request-set-invalidation="onSetInvalidationRequest(editingTrade)"
    @remove-invalidation="removeInvalidation(editingTrade.dealingRangeId, false)"
    @open-target-picker="onOpenTradeTargetPicker"
    @open-anti-confluence-picker="onOpenTradeAntiConfluencePicker"
    @hover-evidence="hoveredModalEvidenceItem = $event"
    @hover-target="hoveredModalTargetItem = $event"
  />

  <!-- Chart + TSC nebeneinander (Chat 2026-08-28, Philip: "übersichtlicher, wenn der TSC nicht
       mehr über dem Chart liegt ... RECHTS vom Chart ... als eigenständigen Bereich") — die
       TSC-Karte war vorher ein position:absolute-Overlay INNERHALB von PriceChart.vue
       (TradeSetupCockpit.vue), jetzt echte Sidebar-Spalte hier. Breite bewusst FEST (Philip: "Chart-
       Breite soll sich nicht ändern, wenn ich TSC toggle" — die Karte bleibt daher IMMER sichtbar,
       showTradeSetupCockpit steuert seitdem nur noch die TSC-Range-Zeichnung auf dem Candlestick-
       Chart selbst, nicht mehr die Karte). -->
  <GoldPreview v-if="goldPreview" />
  <div v-else class="chart-tsc-row">
    <PriceChart
      ref="priceChartRef"
      class="chart-tsc-row-chart"
      :key="currentSymbol"
      :symbol="currentSymbol"
    :current-bar="currentBar"
    :trades="isolatedTrades"
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
    :hovered-trade-target-id="hoveredTradeTargetId"
    :hovered-pin-liquidity-level-key="hoveredPinLiquidityLevelKey"
    :hovered-pin-rsi-divergence-key="hoveredPinRsiDivergenceKey"
    :pinned-ob-zones="pinnedObZones"
    :db-ob-zones="dbObZones"
    :db-trade-setups="dbTradeSetups"
    :db-liquidity-levels-htf="dbLiquidityLevelsHtf"
    :db-daily-pivots="dbDailyPivots"
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
    :show-r-scale="showRScale"
    :show-pip-scale="showPipScale"
    :journal-liquidity-categories="journalLiquidityCategories"
    :invalidation-liquidity-keys="invalidationLiquidityKeys"
    :hovered-invalidation-range-id="hoveredInvalidationRangeId"
    :ranges-period="rangesPeriod"
    :ranges-lookback-hours="rangesLookbackHours"
    :ranges2-period="ranges2Period"
    :ranges2-lookback-hours="ranges2LookbackHours"
    :ranges-fixed-start-active="rangesFixedStartActive"
    :ranges-fixed-start-time="rangesFixedStartTime"
    :show-ranges="showRanges && showH1Structure"
    :show-ranges-metadata="showRangesMetadata"
    :show-m5-structure="showM5Structure"
    :show-m5-trend-phases="showM5TrendPhases"
    :m5-structure-period="m5StructurePeriod"
    :m5-structure2-period="m5Structure2Period"
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
    :annotations="visibleAnnotations"
    :annotations-date="annotationsDate"
    :trade-mode-active="tradeModeActive"
    :measure-mode-active="chartMode === 'measure'"
    :target-mode-active="anyArmStateActive"
    :confirmation-mode-active="confirmationAddTrade != null || rangeConfirmationAddTrade != null || tscBootstrapArmed"
    :confluence-mode-active="confluenceAddTrade != null || rangeConfluenceAddTrade != null"
    :anti-confluence-mode-active="antiConfluenceAddTrade != null || rangeAntiConfluenceAddTrade != null"
    :tsc-range="tscRange"
    @close-ranges-metadata="showRangesMetadata = false"
    @close-debug-metadata="showDebugMetadata = false"
    @close-rsi-divergence-stats="showRsiDivergenceStats = false"
    @select-target="onSelectTarget"
    @select-setup-confirmations="onSelectSetupConfirmations"
    @measure-start="onMeasureStart"
    @measure-done="onMeasureDone"
    @pin-context-menu="onPinContextMenu"
    @add-target-from-picker="onAddTargetFromPicker"
    @add-anti-confluence-from-picker="onAddAntiConfluenceFromPicker"
    />
    <TradeSetupCockpit
      class="chart-tsc-row-tsc"
      :instrument="currentSymbol"
      :now-sec="replayUntil"
      :range="tscRange"
      :from-journal="tscFromJournal"
      :load-error="tscLoadError"
      :trend-chain="trendChain"
      :m5-trend="m5Trend"
      :armed-section="armedTscSection"
      @add-confirmation="onTscAddConfirmationRequest"
      @add-target="onTscAddTargetRequest"
      @add-confluence="onTscAddConfluenceRequest"
      @add-anti-confluence="onTscAddAntiConfluenceRequest"
      @remove-confirmation="onTscRemoveConfirmation"
      @remove-target="onTscRemoveTarget"
      @remove-confluence="onTscRemoveConfluence"
      @remove-anti-confluence="onTscRemoveAntiConfluence"
      @transfer-to-trades="onTscTransferToTrades"
      @request-set-invalidation="onTscSetInvalidationRequest"
      @remove-invalidation="tscRangeId != null && removeInvalidation(tscRangeId, true)"
      @reset="onTscReset"
      @open-target-picker="priceChartRef?.openTargetPicker()"
      @open-anti-confluence-picker="priceChartRef?.openAntiConfluencePicker()"
      @hover-evidence="hoveredCockpitEvidenceItem = $event"
      @hover-target="hoveredCockpitTargetItem = $event"
    />

    <TradeSetupBewertung
      v-if="showTradeSetupBewertung"
      :instrument="currentSymbol"
      :fvg-pips="tscFvgPips"
    />
  </div>

  <aside v-show="!goldPreview" ref="tradesPanelRef" class="trades-panel" :style="{ height: tradesPanelHeight + 'px' }">
    <div class="trades-panel-header">
      <h2 class="trades-panel-title">Trades</h2>
      <TradingAccountSwitcher />
    </div>
    <div class="trades-list">
      <TradesTable
        :trades="trades"
        :pin-trade-ids="pinTradeIds"
        :isolated-dealing-range-id="isolatedDealingRangeId"
        @select="onSelectTrade"
        @edit-request="onEditRequest"
        @hover-trade="onHoverTrade"
        @pin-context-menu="onPinContextMenu"
        @isolate-request="onIsolateTrade"
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
.drawing-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.drawing-toggles {
  padding-left: 12px;
  border-left: 1px solid #2a2e39;
  row-gap: 8px;
}

.symbol-switcher button {
  font-weight: 600;
}

.toggle-group {
  position: relative;
  display: flex;
  gap: 1px;
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

.replay-control .replay-toggle-btn {
  padding: 4px 8px;
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

/* Chart + TSC nebeneinander (Chat 2026-08-28) — .chart-tsc-row-chart landet als Fallthrough-Class
   auf PriceChart.vue's Root (.chart-wrapper), .chart-tsc-row-tsc auf TradeSetupCockpit.vue's Root
   (.tsc-card, die dort auf statische Sidebar-Breite statt des früheren Chart-Overlays umgebaut
   wurde). align-items: stretch (Default) lässt beide dieselbe Höhe wie .chart-wrapper teilen — die
   TSC-Karte scrollt bei Bedarf selbst (siehe .tsc-card: overflow-y). */
.chart-tsc-row {
  display: flex;
  gap: 12px;
}

.chart-tsc-row-chart {
  flex: 1;
  min-width: 0;
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
