// Ursprünglich refreshCockpitInternal + cockpitState/-Metadata/-NowSec-Refs in PriceChart.vue, per
// Refactoring-Task "Sehr große Dateien refactoren" (Phase 6c, 2026-08-26) hierher verschoben.
// Reine Zustands-Berechnung (kein chart/candleSeries, kein attachPrimitive) — liest
// marketStructureState/currentTradeSetups/focusedTradeSetup als Parameter statt aus der
// PriceChart.vue-Closure, damit dieses Composable keine Kenntnis von deren Herkunft braucht.
import { ref } from "vue";
import { sessions, currentSessionDanger } from "../sessions.js";
import { newsEvents, currentNewsNoGo } from "../newsEvents.js";
import { computeCockpitState } from "../tradeSetupCockpit";
import { pivotForDisplay } from "../marketStructureAnalysis";

export function usePriceChartCockpit() {
  // Rohes CockpitState fürs TSC-Rendering (TradeSetupCockpit.vue) — getrennt von cockpitMetadata,
  // das über pivotForDisplay bereits fürs Debug-Metadaten-Panel aufbereitet ist (formatierte
  // Zeitstrings statt roher pivotTime/touchedTime-Zahlen, die die TSC-Komponente aber für ihre
  // Alters-Berechnung braucht).
  const cockpitState = ref(null);
  const cockpitMetadata = ref(null);
  const cockpitNowSec = ref(undefined);

  // Trade-Setup-Cockpit (siehe Chat 2026-07-19) — reine Zusammenfassung, liest marketStructureState/
  // currentTradeSetups (bzw. focusedTradeSetup, falls gesetzt) — kein eigener Fetch/eigene
  // Erkennung. Wird sowohl von refreshMarketStructureInternal als auch von loadTradeSetupM5/-H1
  // direkt aufgerufen (siehe PriceChart.vue), nicht erst über den nächsten refreshChart() — sonst
  // hinkt die Karte den eigentlich schon fertigen Daten hinterher.
  function refreshCockpit({ showTradeSetupCockpit, candles, replayUntil, symbol, marketStructureState, tradeSetupsForCockpit }) {
    if (!showTradeSetupCockpit || candles.length === 0) {
      cockpitState.value = null;
      cockpitMetadata.value = null;
      return;
    }
    const nowSec = replayUntil ?? Math.floor(Date.now() / 1000);
    // sessions.danger fürs aktuelle Instrument/JETZT — erster automatischer No-Go/Anti-Confluence-
    // Input (siehe computeCockpitState in tradeSetupCockpit.ts). Gleicher instrument-Filter +
    // tzOffsetMinutes wie refreshSessionsInternal (PriceChart.vue), sonst würde z.B. eine
    // GBPUSD-Sperrzeit auch EURUSD sperren bzw. die Sommer-/Winterzeit-Umstellung falsch einfließen.
    const symbolSessions = sessions.filter((s) => s.instrument === symbol);
    const sessionDanger = currentSessionDanger(symbolSessions, nowSec, (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset());
    // News-Events kommen fertig aus der DB (siehe newsEvents.js) — Philip trägt sie per Screenshot
    // ein, hier nur noch der reine "ist gerade eins relevant für dieses Instrument"-Check.
    const newsNoGo = currentNewsNoGo(newsEvents, symbol, nowSec);
    const state = computeCockpitState(marketStructureState, tradeSetupsForCockpit, sessionDanger, newsNoGo);
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

  return { cockpitState, cockpitMetadata, cockpitNowSec, refreshCockpit };
}
