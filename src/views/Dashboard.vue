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
const currentBar = useLocalStorageRef("currentBar", "1h");
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
// Eigenständiger Pivot-Toggle (Periode 10) für die Trendanalyse-Diskussion — komplett getrennt
// von showSweptLiquidity (Periode 5, LQ-Sweeps), die davon unverändert bleiben sollen.
const showPivots = useLocalStorageRef("showPivots", false);
const showTradeSetups = useLocalStorageRef("showTradeSetups", true);
// Popup mit den rohen Trend-State-Daten (Swing/Protected-Level, CHoCH, gesammelte Pivots,
// previous-Kette) zum Nachvollziehen der Trendanalyse gegen den Chart — siehe MetadataPanel.vue.
const showMetadata = useLocalStorageRef("showMetadata", false);
// Philips eigener Marktstruktur-Entwurf (siehe test/trendanalyse_vorschlag.ts, trendZigzag.js) —
// verbindet die Pivots seit dem Trend-Ursprung der Reihe nach mit Linien, zum Debuggen/Erklären.
const showZigzag = useLocalStorageRef("showZigzag", false);
// Anzahl vergangener Setups je Richtung, analog zu tradeSetupHistoryCountShort/Long im
// tv-indikator (dort default 5, 0-50) — 0 zeigt nur das gerade aktive/letzte Setup.
const tradeSetupHistoryCount = useLocalStorageRef("tradeSetupHistoryCount", 5);

// "Ranges" — erster Baustein des neuen PA-Analyse-Konzepts (siehe Chat 2026-07-18: weg von der
// verschachtelten Trend-State-Machine, hin zu PA-Analyse/Trendanalyse/Marktstärke als getrennten
// Bausteinen). Lookback-Fenster für die H1-Periode-5-Fraktalsuche, maßgeblich in Stunden
// persistiert (default 168 = 7 Tage) — rangesLookbackDays (unten) ist nur ein Eingabe-Helper,
// der beim Editieren in Stunden umrechnet, kein eigener State.
const rangesLookbackHours = useLocalStorageRef("rangesLookbackHours", 7 * 24);
const rangesLookbackDays = computed({
  get: () => rangesLookbackHours.value / 24,
  set: (days) => { rangesLookbackHours.value = Math.round(days * 24); },
});
// showRanges (Punkt-Marker im Chart, siehe PriceChart.vue) und showRangesMetadata (JSON-Panel)
// sind bewusst getrennte Toggles — Philip will Ranges anzeigen können, ohne dafür das
// Metadaten-Panel offen zu haben (siehe Chat: "man kann ranges nicht einzelnd toggeln").
const showRanges = useLocalStorageRef("showRanges", false);
const showRangesMetadata = useLocalStorageRef("showRangesMetadata", false);
// EMA 50/200 auf M5 (siehe Chat: "Trend über EMA + Anzahl protected highs/lows") — ein Toggle für
// beide Linien zusammen, keine separaten Schalter je Periode (nicht verlangt).
const showEma = useLocalStorageRef("showEma", false);
// Style-Modal (Farben aller Chart-Indikatoren, siehe StyleModal.vue/chartColors.js) — reiner
// Öffnen/Schließen-Zustand, NICHT in localStorage (die Farben selbst persistieren bereits über
// den chartColors-Singleton, das Modal muss nicht offen bleiben).
const showStyleModal = ref(false);

// Replay-Modus (siehe Chat 2026-07-19): Chart + alle Indikatoren zeigen nur Daten bis zu diesem
// Zeitpunkt, während im Hintergrund ganz normal weitergeholt wird (siehe PriceChart.vue:
// clipReplay) — zum visuellen Prüfen des Ranges-Algos (oder jedes anderen Indikators), ohne
// dabei schon die "Zukunft" zu sehen. Jetzt (siehe Chat 2026-07-19) genau wie Symbol/Timeframe
// persistiert, damit das aktuelle Testszenario nicht bei jedem Reload zurückspringt — Default
// hier ist bewusst schon auf den Start des Long-Setup-Testszenarios gesetzt (02.07.2026 19:00,
// kurz nach pivot5 in gbp_h1_uptrend_LQ_sweep_long_setup.ts).
// replayTime (der eingestellte Zeitpunkt) und replayActive (Toggle) sind bewusst getrennt — der
// "⏮ Replay bis"-Button schaltet nur zwischen live/replay um, ohne den eingestellten Zeitpunkt im
// Datumsfeld daneben zu löschen (siehe Chat: "verschwinden aber die eingestellten datetime daten
// im input daneben nicht"). replayUntil (an PriceChart durchgereicht) ist nur die Kombination.
const replayTime = useLocalStorageRef("replayTime", 1783011600); // 02.07.2026 19:00 (Berlin)
const replayActive = useLocalStorageRef("replayActive", true);
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

// Toolbar wurde zu voll (siehe Chat) -> Liquidity-Sweeps unter "Liquidität", Pivots+Metadaten
// unter "Trend" als Dropdown. Reiner UI-Zustand, bewusst NICHT in localStorage (anders als die
// Toggles selbst) — welches Dropdown gerade offen ist, ist keine Einstellung, die überdauern muss.
const liquidityMenuOpen = ref(false);
const trendMenuOpen = ref(false);
const rangesMenuOpen = ref(false);
function closeMenusOutside(e) {
  if (!e.target.closest?.(".toggle-group")) {
    liquidityMenuOpen.value = false;
    trendMenuOpen.value = false;
    rangesMenuOpen.value = false;
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

      <button :class="{ active: showTradeSetups }" @click="showTradeSetups = !showTradeSetups">
        Trade-Setups
      </button>
      <input
        v-if="showTradeSetups"
        v-model.number="tradeSetupHistoryCount"
        type="number"
        min="0"
        max="50"
        class="trade-setup-history-count"
        title="Anzahl vergangener Trade-Setups je Richtung"
      />

      <div class="toggle-group">
        <button :class="{ active: trendMenuOpen }" @click="trendMenuOpen = !trendMenuOpen">
          Trend ▾
        </button>
        <div v-if="trendMenuOpen" class="toggle-dropdown">
          <button :class="{ active: showPivots }" @click="showPivots = !showPivots">Pivots</button>
          <button :class="{ active: showZigzag }" @click="showZigzag = !showZigzag">Zigzag</button>
          <button :class="{ active: showMetadata }" @click="showMetadata = !showMetadata">Metadaten</button>
        </div>
      </div>

      <div class="toggle-group">
        <button :class="{ active: showRanges }" @click="showRanges = !showRanges">
          Ranges
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
          <button :class="{ active: showRangesMetadata }" @click="showRangesMetadata = !showRangesMetadata">
            Metadaten
          </button>
        </div>
      </div>

      <button :class="{ active: showEma }" @click="showEma = !showEma">
        EMA
      </button>

      <button :class="{ active: showLiquidityDebug }" @click="showLiquidityDebug = !showLiquidityDebug">
        Debug
      </button>

      <button :class="{ active: showStyleModal }" @click="showStyleModal = !showStyleModal">
        🎨 Style
      </button>

      <div class="toggle-group replay-control" :class="{ active: replayActive }">
        <button
          class="replay-toggle-btn"
          :class="{ active: replayActive }"
          title="Replay an/aus — Datum bleibt beim Ausschalten stehen"
          @click="replayActive = !replayActive"
        >
          ⏮ Replay bis
        </button>
        <input v-model="replayInputValue" type="datetime-local" class="replay-input" title="Chart+Indikatoren nur bis zu diesem Zeitpunkt anzeigen" />
        <button class="replay-step-btn" title="Eine Kerze weiter (aktueller Timeframe)" @click="stepReplayForward">
          +1 Kerze ▶|
        </button>
      </div>
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
    :show-pivots="showPivots"
    :show-liquidity-debug="showLiquidityDebug"
    :show-trade-setups="showTradeSetups"
    :trade-setup-history-count="tradeSetupHistoryCount"
    :show-zigzag="showZigzag"
    :show-metadata="showMetadata"
    :ranges-lookback-hours="rangesLookbackHours"
    :show-ranges="showRanges"
    :show-ranges-metadata="showRangesMetadata"
    :show-ema="showEma"
    :replay-until="replayUntil"
    @close-metadata="showMetadata = false"
    @close-ranges-metadata="showRangesMetadata = false"
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
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #131722;
  border-bottom: 1px solid #2a2e39;
}

.symbol-switcher,
.timeframe-switcher,
.drawing-toggles {
  display: flex;
  gap: 4px;
}

.drawing-toggles {
  padding-left: 12px;
  border-left: 1px solid #2a2e39;
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

.trade-setup-history-count {
  width: 40px;
  margin-left: 4px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 3px 4px;
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
