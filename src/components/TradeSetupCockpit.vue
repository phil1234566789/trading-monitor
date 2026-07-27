<script setup>
import { computed } from "vue";
import {
  cardAccentColors,
  trendSetupConfirmation,
  ageSuffix,
  lockedReason,
  NO_GO_COLOR,
  ANTI_CONFLUENCE_COLOR,
} from "../tradeSetupCockpit";
import { cssColor } from "../chartColors.js";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";

// Trade-Setup-Cockpit als echte Vue-Komponente (Chat 2026-07-27: "ich glaub es ist besser ne Vue
// Component draus zu machen") — vorher ein lightweight-charts-Primitive mit eigenem Canvas-Draw
// (siehe tradeSetupCockpit.ts vor diesem Commit). Reine Präsentation: liest CockpitState + die
// Formatierungs-Helper aus tradeSetupCockpit.ts, zeichnet selbst nichts, berechnet selbst nichts
// Fachliches. Fester Platz am rechten Rand, vertikal mittig — der frühere "neben der letzten
// Kerze"-Modus ist bewusst weggefallen (kein sinnvolles Pixel-Tracking der Kerze mehr aus einer
// Vue-Komponente heraus, Philip: "kann damit leben").
const props = defineProps({
  state: { type: Object, default: null },
  nowSec: { type: Number, default: undefined },
  instrument: { type: String, required: true },
  tradeModeActive: { type: Boolean, default: false },
});
const emit = defineEmits(["toggle-trade-mode"]);

const precision = computed(() => pricePrecisionForInstrument(props.instrument));
function formatPrice(price) {
  return fmtPrice(price, precision.value);
}

const accent = computed(() => (props.state ? cardAccentColors(props.state) : null));
const trendConfirm = computed(() => (props.state ? trendSetupConfirmation(props.state) : null));
const lockedText = computed(() => (props.state?.locked ? lockedReason(props.state) : ""));
const hasContent = computed(() => {
  const s = props.state;
  return !!s && (s.h1Trend !== "unknown" || !!s.h1LqSweep || !!s.m5Setup);
});
const h1TrendColor = computed(() => (props.state?.h1Trend === "uptrend" ? cssColor("rangeLow") : cssColor("rangeHigh")));
const h1LqAge = computed(() => {
  const sweep = props.state?.h1LqSweep;
  if (!sweep) return "";
  const touchedTime = sweep.touched ? sweep.touched.touchedTime : undefined;
  return ageSuffix(sweep.pivotTime, touchedTime, props.nowSec);
});
const m5Color = computed(() => {
  const setup = props.state?.m5Setup;
  if (!setup) return "";
  return cssColor(setup.dir === -1 ? "tradeSetupLong" : "tradeSetupShort");
});
const m5Age = computed(() => {
  const setup = props.state?.m5Setup;
  if (!setup) return "";
  return ageSuffix(setup.lsPivotTime, setup.lsTouchedTime, props.nowSec);
});
// "#x" nur bei aktiver Trade-Setups-Historie (setupNumber != null) — matcht den Suffix an der
// OB-Chart-Box (siehe PriceChart.vue: renderTradeSetupsInternal).
const numberSuffix = computed(() => (props.state?.m5Setup?.setupNumber != null ? ` #${props.state.m5Setup.setupNumber}` : ""));
// "#105" nur wenn der TSC gerade auf einen geloggten Trade fokussiert ist (siehe
// tradeIntake.js: fetchTradeSetupForCockpit) — matcht 1:1 die "#<id>"-Box im Chart
// (refreshTradeSetupLinksInternal in PriceChart.vue).
const idSuffix = computed(() => (props.state?.m5Setup?.tradeSetupId != null ? ` #${props.state.m5Setup.tradeSetupId}` : ""));

const cardStyle = computed(() => {
  const a = accent.value;
  return {
    borderColor: a ? a.border : "rgba(120, 123, 134, 0.5)",
    borderWidth: a ? "1.5px" : "1px",
    backgroundImage: a ? `linear-gradient(${a.fill}, ${a.fill})` : "none",
  };
});
</script>

<template>
  <div v-if="state" class="tsc-card" :style="cardStyle">
    <div class="tsc-header">
      <span class="tsc-title">Trade-Setup-Cockpit</span>
      <!-- Icon statt eines Textbuttons (Chat 2026-07-27: "reicht ein Icon"), title = nativer
           Hover-Tooltip. pointer-events: auto trotz pointer-events:none auf der Karte (siehe
           .tsc-card unten) — Klicks außerhalb des Icons sollen weiterhin bis zum Chart
           durchgereicht werden (z.B. eine Trade-Setup-OB-Box unter der Karte anklicken können),
           genau wie beim früheren Positions-Badge. -->
      <button
        class="tsc-trade-mode-btn"
        :class="{ active: tradeModeActive }"
        title="Trade-Modus: Trade-Setup-OB im Chart anklicken, um es als Trade zu übernehmen oder einen bestehenden Trade nachträglich damit zu verknüpfen"
        @click="emit('toggle-trade-mode')"
      >
        🎯
      </button>
    </div>

    <div v-if="state.locked" class="tsc-locked-banner">🚫 KEIN TRADE — {{ lockedText }}</div>

    <div class="tsc-content" :class="{ dim: state.locked }">
      <div v-if="state.h1Trend !== 'unknown'" class="tsc-line" :style="{ color: h1TrendColor }">
        1h {{ state.h1Trend }}{{ state.h1Weakening ? " (schwächelt, BOS)" : "" }}
        <span v-if="trendConfirm" :style="{ color: trendConfirm.color }"> {{ trendConfirm.text }}</span>
      </div>
      <div v-if="state.h1LqSweep" class="tsc-line" :style="{ color: cssColor('rangeLqSweep') }">
        1h LQ-Sweep @ {{ formatPrice(state.h1LqSweep.price) }}{{ h1LqAge }}
      </div>
      <template v-if="state.m5Setup">
        <div class="tsc-line" :style="{ color: m5Color }">
          M5 {{ state.m5Setup.label }} Setup Typ {{ state.m5Setup.pathType }}{{ numberSuffix }}
        </div>
        <div class="tsc-line tsc-indent" :style="{ color: m5Color }">LQ-Sweep @ {{ formatPrice(state.m5Setup.lsPrice) }}{{ m5Age }}</div>
        <div class="tsc-line tsc-indent" :style="{ color: m5Color }">
          M5-OB {{ formatPrice(state.m5Setup.obBottom) }}–{{ formatPrice(state.m5Setup.obTop) }}{{ idSuffix }}
        </div>
      </template>
      <div v-if="!hasContent" class="tsc-line" style="color: rgba(120, 123, 134, 0.9)">keine aktive Analyse</div>
    </div>

    <template v-if="state.antiConfluences.length > 0">
      <div class="tsc-divider"></div>
      <div class="tsc-line tsc-anti-title">Spricht dagegen:</div>
      <div
        v-for="(ac, i) in state.antiConfluences"
        :key="i"
        class="tsc-line tsc-indent"
        :style="{ color: ac.isNoGo ? NO_GO_COLOR : ANTI_CONFLUENCE_COLOR }"
      >
        {{ ac.text }} {{ ac.isNoGo ? "(No-Go)" : `(${ac.weight})` }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.tsc-card {
  position: absolute;
  z-index: 5;
  /* Bug-Report Philip 2026-07-27: "TSC verdeckt die Preis-Y-Achse" — 12px reichte nicht, das
     überlappte die rechte Preisskala von lightweight-charts (die Teil desselben Chart-Canvas ist,
     kein eigenes DOM-Element, dem man ausweichen könnte). Fixer, großzügiger Wert statt die
     tatsächliche Preisskala-Breite zur Laufzeit abzufragen — die TSC läuft ohnehin nur für Forex
     (5 Nachkommastellen, immer ähnlich breite Preis-Labels), kein wirklich variabler Fall.
  */
  right: 70px;
  top: 50%;
  transform: translateY(-50%);
  width: max-content;
  max-width: 320px;
  padding: 16px;
  border-radius: 8px;
  background-color: rgba(19, 23, 34, 0.92);
  border-style: solid;
  font-size: 15px;
  line-height: 24px;
  /* Klicks fallen bis zum Chart durch (z.B. eine OB-Box unter der Karte anklicken), nur das
     Trade-Modus-Icon selbst reagiert (siehe .tsc-trade-mode-btn) — analog zum früheren
     Positions-Badge, das ebenfalls als einziges Element der Karte klickbar war. */
  pointer-events: none;
}

.tsc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tsc-title {
  font-weight: 700;
  color: rgba(209, 212, 220, 0.8);
}

.tsc-trade-mode-btn {
  pointer-events: auto;
  background: transparent;
  border: 1px solid rgba(120, 123, 134, 0.4);
  border-radius: 5px;
  font-size: 13px;
  line-height: 1;
  padding: 3px 5px;
  cursor: pointer;
}

.tsc-trade-mode-btn:hover {
  border-color: #7ea6ff;
}

.tsc-trade-mode-btn.active {
  background: rgba(255, 179, 0, 0.9);
  border-color: rgba(255, 179, 0, 0.9);
}

.tsc-locked-banner {
  color: v-bind(NO_GO_COLOR);
  font-weight: 700;
  margin-top: 2px;
}

.tsc-content.dim {
  opacity: 0.45;
}

.tsc-line {
  white-space: nowrap;
}

.tsc-indent {
  padding-left: 14px;
}

.tsc-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  margin: 10px 0 6px;
}

.tsc-anti-title {
  font-weight: 700;
  color: rgba(209, 212, 220, 0.8);
}
</style>
