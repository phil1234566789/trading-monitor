<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import PriceChart from "../components/PriceChart.vue";
import TradesTable from "../components/TradesTable.vue";
import TradeStats from "../components/TradeStats.vue";
import StyleModal from "../components/StyleModal.vue";
import { TIMEFRAMES } from "../timeframes.js";
import { fetchTrades } from "../trades.js";
import { fetchPoiZones } from "../poiZones.js";
import { usePolledFetch } from "../composables/usePolledFetch.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { useSessionStorageRef } from "../composables/useSessionStorageRef.js";

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
const showLiquidity = useLocalStorageRef("showLiquidity", true);
// Debug-Hilfsmittel für die Trend-Indikator-Entwicklung: Preise an den Pivot-Linien
// einblenden und die aktuell ausgeblendeten (bereits gesweepten) Liquiditäts-Level
// mitanzeigen. Beide default aus, um den Chart im Normalbetrieb nicht zuzumüllen.
const showLiquidityDebug = useLocalStorageRef("showLiquidityDebug", false);
const showSweptLiquidity = useLocalStorageRef("showSweptLiquidity", false);
const showTradeSetups = useLocalStorageRef("showTradeSetups", true);
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
// Trade-Setup-Cockpit (siehe Chat 2026-07-19: "wir wollen jetzt step by step alles
// zusammenstöpseln") — bündelt H1-Range-Analyse + M5-Trade-Setups in einer Karte im Chart.
// tradeSetupCockpitAtCandle ist der Positions-Toggle (fester Platz vs. neben der letzten Kerze).
const showTradeSetupCockpit = useLocalStorageRef("showTradeSetupCockpit", true);
const tradeSetupCockpitAtCandle = useLocalStorageRef("tradeSetupCockpitAtCandle", false);
// Abstand zur letzten Kerze im "neben Kerze"-Modus, konfigurierbar (siehe Chat 2026-07-19: "etwas
// zu eng, am besten Abstand konfigurabel machen") — siehe tradeSetupCockpit.ts: DEFAULT_CANDLE_OFFSET.
const tradeSetupCockpitCandleOffset = useLocalStorageRef("tradeSetupCockpitCandleOffset", 24);
// Style-Modal (Farben aller Chart-Indikatoren, siehe StyleModal.vue/chartColors.js) — reiner
// Öffnen/Schließen-Zustand, NICHT in localStorage (die Farben selbst persistieren bereits über
// den chartColors-Singleton, das Modal muss nicht offen bleiben).
const showStyleModal = ref(false);
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
// "+1 Kerze"-Button: den Zeitpunkt der nächsten geladenen Kerze im aktuellen Timeframe holt
// PriceChart.vue (kennt allCandles, siehe defineExpose dort) — replayTime/-Active gehören hierher,
// nicht in die Kind-Komponente (fließt nur als Prop nach unten). Aus Live heraus (noch kein
// Zeitpunkt gesetzt) springt der erste Klick auf die älteste geladene Kerze (siehe nextReplayTime)
// und aktiviert Replay gleich mit — sonst würde der Klick unsichtbar ins Leere laufen.
const priceChartRef = ref(null);
function stepReplayForward() {
  const next = priceChartRef.value?.nextReplayTime(replayTime.value);
  if (next != null) {
    replayTime.value = next;
    replayActive.value = true;
  }
}

// Toolbar wurde zu voll (siehe Chat) -> Liquidity-Sweeps unter "Liquidität", Periode/Lookback
// unter "Structure" als Dropdown. Reiner UI-Zustand, bewusst NICHT in localStorage (anders als die
// Toggles selbst) — welches Dropdown gerade offen ist, ist keine Einstellung, die überdauern muss.
const liquidityMenuOpen = ref(false);
const rangesMenuOpen = ref(false);
const tradeSetupsMenuOpen = ref(false);
const debugMenuOpen = ref(false);
function closeMenusOutside(e) {
  if (!e.target.closest?.(".toggle-group")) {
    liquidityMenuOpen.value = false;
    rangesMenuOpen.value = false;
    tradeSetupsMenuOpen.value = false;
    debugMenuOpen.value = false;
  }
}
onMounted(() => window.addEventListener("click", closeMenusOutside));
onUnmounted(() => window.removeEventListener("click", closeMenusOutside));
const isBtc = computed(() => currentSymbol.value === "BTC-USDT");
const { data: trades, refresh: refreshTrades } = usePolledFetch(
  () => (isBtc.value ? fetchTrades(currentSymbol.value) : []),
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
      <button :class="{ active: showHistoricalObs }" @click="showHistoricalObs = !showHistoricalObs">
        Historische OBs
      </button>

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

      <div class="toggle-group">
        <button :class="{ active: showTradeSetups }" @click="showTradeSetups = !showTradeSetups">
          Trade-Setups
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
          <button :class="{ active: showTradeSetupsLong }" @click="showTradeSetupsLong = !showTradeSetupsLong">
            Long
          </button>
          <button :class="{ active: showTradeSetupsShort }" @click="showTradeSetupsShort = !showTradeSetupsShort">
            Short
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
          <button :class="{ active: tradeSetupCockpitAtCandle }" @click="tradeSetupCockpitAtCandle = !tradeSetupCockpitAtCandle">
            TSC neben Kerze
          </button>
          <label v-if="tradeSetupCockpitAtCandle" class="ranges-lookback-field">
            Abstand
            <input
              v-model.number="tradeSetupCockpitCandleOffset"
              type="number"
              min="0"
              class="ranges-lookback-input"
              title="Abstand (Pixel) zwischen letzter Kerze und TSC-Karte im Modus 'Neben Kerze'"
            />
          </label>
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
            />
          </label>
        </div>
      </div>

      <button :class="{ active: showEma }" @click="showEma = !showEma">
        EMA
      </button>

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
        <button class="replay-step-btn" title="+1 Kerze" @click="stepReplayForward">
          ▶|
        </button>
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

  <PriceChart
    ref="priceChartRef"
    :key="currentSymbol"
    :symbol="currentSymbol"
    :current-bar="currentBar"
    :trades="trades"
    :poi-zones="poiZones"
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
    :show-ranges="showRanges"
    :show-ranges-metadata="showRangesMetadata"
    :show-ema="showEma"
    :show-trade-setup-cockpit="showTradeSetupCockpit"
    :trade-setup-cockpit-at-candle="tradeSetupCockpitAtCandle"
    :trade-setup-cockpit-candle-offset="tradeSetupCockpitCandleOffset"
    :replay-until="replayUntil"
    :show-debug-metadata="showDebugMetadata"
    @close-ranges-metadata="showRangesMetadata = false"
    @toggle-tsc-position="tradeSetupCockpitAtCandle = !tradeSetupCockpitAtCandle"
    @close-debug-metadata="showDebugMetadata = false"
  />

  <aside class="trades-panel">
    <h2 class="trades-panel-title">Trades</h2>
    <div class="trades-list">
      <TradesTable :trades="trades" />
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

.symbol-switcher button,
.timeframe-switcher button,
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
