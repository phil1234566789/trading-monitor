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
import { TIMEFRAMES } from "../timeframes.js";
import { berlinDateStrFor } from "../backtestExport.js";
import { fetchTrades } from "../trades.js";
import { fetchTradeSetupForCockpit, linkTradeToSetup, directionForSetup, addTargetToTrade } from "../tradeIntake.js";
import { fetchPoiZones } from "../poiZones.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { useSessionStorageRef } from "../composables/useSessionStorageRef.js";
import { useClaudeAnnotations } from "../composables/useClaudeAnnotations.js";

// Trades/POI-Zonen (ob_zones) gibt es aktuell nur für BTC-USDT — die Forex-OB-Erkennung
// läuft (noch) nicht über diese Codebase, sondern soll später per TradingView-Webhook
// kommen (siehe PLAN-notifications.md). Für GBPUSD/EURUSD bleiben beide Listen also leer.
const SYMBOLS = ["GBPUSD", "EURUSD", "BTC-USDT"];
const POLL_MS = 12_000;

// Toggle-Zustand persistiert in localStorage (siehe useLocalStorageRef), damit ein Reload nicht
// jedes Mal auf die Default-Werte zurückspringt — die Defaults hier gelten nur beim allerersten
// Aufruf (noch nichts im localStorage). Symbol/Timeframe waren früher reine (nicht-persistierte)
// refs — beim Ranges-Algo-Testen mit Replay (siehe Chat 2026-07-19) nervt ein Reset auf 5m/GBPUSD
// bei jedem Reload aber, deshalb jetzt genau wie die Toggles persistiert. Defaults hier bewusst
// aufs aktuelle Testszenario gesetzt (GBP 1h) statt auf die alten Werte.
const currentSymbol = useLocalStorageRef("currentSymbol", "GBPUSD");
// currentBar bewusst sessionStorage statt localStorage (siehe Chat 2026-07-19: "ich hab zwei Tabs
// offen, eins im M5 und eins im 1h") — sessionStorage ist pro Tab isoliert, localStorage wäre
// tab-übergreifend geteilt und würde die beiden Tabs gegenseitig auf denselben TF zwingen.
const currentBar = useSessionStorageRef("currentBar", "1h");
// Historische (bereits angetestete) OB-Zonen standardmäßig ausgeblendet, um den Chart
// übersichtlich zu halten — analog zum "Historische OBs"-Toggle im tv-indikator-Projekt
// (dort default auch aus). Ein einzelner Schalter statt pro-Timeframe (4H/1H getrennt wie
// dort), weil hier ohnehin nur "schon getestet ja/nein" existiert, kein Nearest-3-Ranking.
const showHistoricalObs = useLocalStorageRef("showHistoricalObs", false);
// Genereller OBs-An/Aus-Schalter (Chat 2026-07-25: "nicht nur historische Obs an- und ausschalten
// ... sondern auch OBs") — vorher gab es nur showHistoricalObs, dessen Button aber irreführend
// schlicht "OBs" hieß, obwohl er nur die bereits angetesteten Zonen aus-/einblendete. Jetzt analog
// zu showLiquidity/showSweptLiquidity: "OBs" schaltet ALLE Order-Blocks komplett aus, "Historische
// OBs" (Untermenü, wie Liquidity-Sweeps bei Liquidität) bleibt der Filter für bereits angetestete.
const showOrderBlocks = useLocalStorageRef("showOrderBlocks", true);
const showLiquidity = useLocalStorageRef("showLiquidity", true);
// Debug-Hilfsmittel für die Trend-Indikator-Entwicklung: Preise an den Pivot-Linien
// einblenden und die aktuell ausgeblendeten (bereits gesweepten) Liquiditäts-Level
// mitanzeigen. Beide default aus, um den Chart im Normalbetrieb nicht zuzumüllen.
const showLiquidityDebug = useLocalStorageRef("showLiquidityDebug", false);
const showSweptLiquidity = useLocalStorageRef("showSweptLiquidity", false);
const showTradeSetups = useLocalStorageRef("showTradeSetups", true);
// Ein/Ausblenden der eigenen geloggten Trades (Entry/Exit-Marker + verlinkte M5-OB/FVG-Box) —
// Chat 2026-07-27: eigener Toggle, unabhängig von showTradeSetups (siehe Kommentar im Template).
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
// Claude-Antwort-Import (siehe claudeAnnotations.js, trading/backtest-instructions.md) — Button
// + Modal leben jetzt global in App.vue (neben "Backtest-Daten"), der geteilte Zustand kommt aus
// useClaudeAnnotations.js (Modul-Singleton, wie useStatusBar.js). claudeAnnotationsDate ist
// weiterhin hier lokal, weil es den Replay-Zeitpunkt braucht (den nur Dashboard.vue kennt) — löst
// die "HH:mm"-Zeitangaben der Annotationen auf (gleiche Herleitung wie in BacktestExportModal.vue,
// damit Export und Import denselben Tag meinen). visibleClaudeAnnotations blendet die Liste aus,
// wenn der Toggle in App.vue aus ist, ohne die geparsten Annotationen selbst zu verwerfen.
const { annotations: claudeAnnotations, visible: claudeAnnotationsVisible } = useClaudeAnnotations();
const visibleClaudeAnnotations = computed(() => (claudeAnnotationsVisible.value ? claudeAnnotations.value : []));
const claudeAnnotationsDate = computed(() =>
  replayActive.value ? berlinDateStrFor(replayTime.value) : berlinDateStrFor(Math.floor(Date.now() / 1000)),
);
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
// Retrofit-Verknüpfung (Chat 2026-07-27: "gibst du mir die Möglichkeit, das im Nachhinein
// zuzuordnen?") — TradesTable.vue's 🔗-Button armt hierüber "der nächste OB-Klick im Trade-Modus
// verknüpft DIESEN Trade" statt ein neues Trade-Übernahme-Formular zu öffnen.
const linkTargetTrade = ref(null);
// Ziel hinzufügen (Chat 2026-07-27: "wie wärs, wenn wir ermöglichen, einem Trade ein Target
// hinzuzufügen ... die Linien klickbar machen") — TradesTable.vue's "+"-Button armt hierüber "der
// nächste Klick auf eine Liquiditäts-Linie im Trade-Modus fügt DIESEM Trade das Level als Ziel
// hinzu". Eigener Modus statt denselben linkTargetTrade wiederzuverwenden, weil beide gleichzeitig
// den Klick-Handler in PriceChart.vue umschalten (Setup-OB vs. LQ-Linie, siehe targetModeActive) —
// nur eines der beiden kann gerade "scharf" sein, siehe die beiden onXRequest-Funktionen unten.
const targetAddTrade = ref(null);
function onLinkRequest(t) {
  linkTargetTrade.value = t;
  targetAddTrade.value = null;
  tradeModeActive.value = true;
}
function onAddTargetRequest(t) {
  targetAddTrade.value = t;
  linkTargetTrade.value = null;
  tradeModeActive.value = true;
}
// Verlassen des Trade-Modus räumt eine noch "scharfe" Verknüpfung/Ziel-Anfrage mit ab — sonst würde
// ein späteres Wieder-Reinklicken in den Trade-Modus (für einen ganz anderen Zweck) unerwartet den
// alten Trade verknüpfen/beschenken.
watch(tradeModeActive, (active) => {
  if (!active) {
    linkTargetTrade.value = null;
    targetAddTrade.value = null;
  }
});
// target: {kind, price, sourceTime, touchedTime} — siehe PriceChart.vue: findClickedTarget (Pivot
// oder OB, Chat 2026-07-28).
async function onSelectTarget(target) {
  if (!targetAddTrade.value) return;
  const trade = targetAddTrade.value;
  targetAddTrade.value = null;
  const ok = await addTargetToTrade(trade.id, target);
  if (ok) refreshTrades();
}
async function onSelectSetup(setup) {
  if (linkTargetTrade.value) {
    const trade = linkTargetTrade.value;
    linkTargetTrade.value = null;
    // Richtung muss passen — sonst tippt ein Klick daneben eine falsche Verknüpfung rein, ohne
    // dass es auffällt (kein eigenes Modal hier, das man sonst als Rückfrage nutzen könnte).
    if (directionForSetup(setup) !== trade.direction) {
      console.error("Setup-Richtung passt nicht zum Trade (", trade.direction, "vs.", directionForSetup(setup), ") — keine Verknüpfung vorgenommen.");
      return;
    }
    const ok = await linkTradeToSetup(trade.id, currentSymbol.value, setup);
    if (ok) refreshTrades();
    return;
  }
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
const INDIKATOREN_REFS = [showSessions, showEma, showLiquidity, showSweptLiquidity, showOrderBlocks, showHistoricalObs];
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
    showSessions.value = true;
    showEma.value = false;
    showLiquidity.value = true;
    showSweptLiquidity.value = false;
    showOrderBlocks.value = true;
    showHistoricalObs.value = false;
  }
}
function closeMenusOutside(e) {
  if (!e.target.closest?.(".toggle-group")) {
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
const isBtc = computed(() => currentSymbol.value === "BTC-USDT");
const { data: trades, refresh: refreshTrades } = usePolledFetch(
  () => fetchTrades(currentSymbol.value),
  { intervalMs: POLL_MS },
);
const { data: poiZones, refresh: refreshPoiZones } = usePolledFetch(
  () => (isBtc.value ? fetchPoiZones(currentSymbol.value) : []),
  { intervalMs: POLL_MS },
);
// Symbolwechsel soll sofort auf "leer" (bzw. zurück auf BTC-Daten) springen, statt bis zu
// POLL_MS lang die Trades/Zonen des vorherigen Symbols über dem neuen Chart hängen zu lassen.
watch(currentSymbol, () => {
  refreshTrades();
  refreshPoiZones();
});
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
          <div class="toggle-dropdown-row">
            <button :class="{ active: showSessions }" @click="showSessions = !showSessions">
              Sessions
            </button>
            <button class="toggle-caret" title="Sessions verwalten" @click="showSessionsModal = true">
              ⚙
            </button>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <button :class="{ active: showEma }" @click="showEma = !showEma">
            EMA
          </button>

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
            </div>
          </div>

          <div class="toggle-dropdown-divider"></div>

          <div class="toggle-group">
            <button :class="{ active: showOrderBlocks }" @click="showOrderBlocks = !showOrderBlocks">
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
            <div v-if="obsMenuOpen" class="toggle-dropdown">
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
          <!-- Bewusst NICHT an showTradeSetups (den Toggle oben) gekoppelt (Chat 2026-07-27:
               "ich hab Trade-Setups ausgeblendet, aber die OB des Shorts wurde nicht angezeigt")
               — geloggte Trades sind kein Live-Erkennungs-Rauschen, sollen also unabhängig davon
               ein-/ausblendbar bleiben. -->
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

      <button :class="{ active: showEma }" @click="showEma = !showEma">
        EMA
      </button>

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
        <span v-if="linkTargetTrade" class="trade-link-armed">🔗 nächster Klick verknüpft Trade #{{ linkTargetTrade.id }}</span>
        <span v-if="targetAddTrade" class="trade-link-armed">🎯 nächster Klick auf Pivot/OB fügt Trade #{{ targetAddTrade.id }} ein Target hinzu</span>
      </div>

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
    @request-link="onLinkRequest(editingTrade)"
    @request-add-target="onAddTargetRequest(editingTrade)"
  />

  <PriceChart
    ref="priceChartRef"
    :key="currentSymbol"
    :symbol="currentSymbol"
    :current-bar="currentBar"
    :trades="trades"
    :show-trades="showTrades"
    :poi-zones="poiZones"
    :show-order-blocks="showOrderBlocks"
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
    :show-news="showNews"
    :show-sessions="showSessions"
    :show-trade-setup-cockpit="showTradeSetupCockpit"
    :replay-until="replayUntil"
    :show-debug-metadata="showDebugMetadata"
    :claude-annotations="visibleClaudeAnnotations"
    :claude-annotations-date="claudeAnnotationsDate"
    :trade-mode-active="tradeModeActive"
    :target-mode-active="targetAddTrade != null"
    @close-ranges-metadata="showRangesMetadata = false"
    @close-debug-metadata="showDebugMetadata = false"
    @select-setup="onSelectSetup"
    @select-target="onSelectTarget"
    @toggle-trade-mode="tradeModeActive = !tradeModeActive"
  />

  <aside class="trades-panel">
    <h2 class="trades-panel-title">Trades</h2>
    <div class="trades-list">
      <TradesTable :trades="trades" @select="onSelectTrade" @edit-request="onEditRequest" />
    </div>
    <TradeStats :trades="trades" />
  </aside>
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

.toggle-dropdown-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toggle-dropdown-row button:first-child {
  flex: 1;
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
  max-height: 320px;
  background: #1e222d;
  border-top: 1px solid #2a2e39;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}

.trades-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.trades-list {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}
</style>
