// Ursprünglich lokale refreshSessionsInternal/refreshNewsMarkersInternal in PriceChart.vue, per
// Refactoring-Task "Sehr große Dateien refactoren" (Phase 6, 2026-08-25) hierher verschoben — erste,
// isolierteste Gruppe der eigentlichen Zeichen-Orchestrierung (im Gegensatz zu Phase 1-5 lässt sich
// das hier NICHT mehr sinnvoll mit Vitest unit-testen, da candleSeries.attachPrimitive() echtes
// lightweight-charts-Canvas-Verhalten braucht — Absicherung läuft über manuellen Chart-Check statt
// automatisierter Tests, siehe PLAN-large-file-refactor.md). sessionPrimitives/newsMarkerPrimitives
// leben jetzt in der Closure dieses Composables statt in PriceChart.vue — werden nirgendwo sonst
// referenziert (kein Pin-Kontext/Klick-Hittest auf Sessions/News-Marker), daher unproblematisch,
// sie hier komplett zu kapseln statt sie zurückzugeben.
import { sessions, renderSessions } from "../sessions.js";
import { newsEvents, newsEventsForInstrument } from "../newsEvents.js";
import { renderNewsMarkers, isSameBerlinDay } from "../newsMarkers.js";

export function usePriceChartSessionsAndNews() {
  let sessionPrimitives = [];
  let newsMarkerPrimitives = [];

  // Sessions-Hintergrundbänder (Chat 2026-07-22) — tzOffsetMinutes kommt aus der Browser-Lokalzeit
  // (-getTimezoneOffset() dreht JS' vorzeichenverkehrtes Offset ins übliche "UTC+X"-Format), passend
  // zur restlichen Chart-Zeitachse. Läuft auf den gerade angezeigten (bereits clipReplay-gefilterten)
  // Kerzen, nicht auf einem der Analyse-spezifischen Kerzen-Arrays (rangesH1Candles etc.).
  function refreshSessions(candleSeries, candles, { showSessions, currentBar, symbol }) {
    if (!candleSeries) return; // watch(sessions) kann vor dem ersten Chart-Mount feuern (Store lädt schon bei Modul-Import)
    // Sessions sind seit Chat 2026-07-25 pro Asset getrennt (siehe sessions.js) — nur die des
    // gerade angezeigten Symbols rendern, nicht die anderer Instrumente.
    const symbolSessions = sessions.filter((s) => s.instrument === symbol);
    // Auf 4h/1D-Kerzen liegen mehrere Sessions in einer einzigen Kerze, die Bänder werden zu
    // bedeutungslosem Gematsche — Dashboard.vue disabled den Toggle-Button dafür bereits
    // (sessionsDisabled), hier zusätzlich gegen currentBar geprüft, analog zu refreshEmaInternal
    // (Chat 2026-07-31: "genauso wie bei EMA").
    const sessionsAllowedHere = currentBar !== "4h" && currentBar !== "1D";
    renderSessions(candleSeries, showSessions && sessionsAllowedHere ? symbolSessions : [], sessionPrimitives, candles, {
      // Funktion statt fixer Zahl (Bug-Report Philip 2026-07-22: Zeitumstellung) — allCandles kann
      // per Lazy-Load Monate zurückreichen, ein einzelner "jetzt"-Offset wäre für Kerzen auf der
      // anderen Seite einer Sommer-/Winterzeit-Umstellung eine Stunde daneben. sessionOccurrences
      // fragt diese Funktion PRO TAG einzeln ab (siehe sessions.js: localMidnightUtc).
      tzOffsetMinutes: (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset(),
    });
  }

  // Vertikale News-Marker (Chat 2026-07-26) — News-Events gibt es nur für EUR/GBP/USD, siehe
  // newsEvents.js.
  function refreshNewsMarkers(candleSeries, candles, { showNews, symbol, replayUntil }) {
    if (!candleSeries) return; // watch(newsEvents) kann vor dem ersten Chart-Mount feuern (Store lädt schon bei Modul-Import)
    let relevant = showNews ? newsEventsForInstrument(newsEvents, symbol) : [];
    // Zukünftige Termine bis zum Ende des aktuellen/Replay-Tages zeigen, weiter Entferntes ausblenden
    // (Bug-Report Philip 2026-07-30: "ich muss die Linie vorher sehen, pro Tag reicht" — löst den
    // pauschalen Replay-Filter vom 2026-07-26 ab, der ALLE zukünftigen Termine versteckte, weil sie
    // die Sicht auf die aktuelle Replay-Kerze verdeckten; ein Termin vom selben Tag verdeckt nichts,
    // der ist ja gerade der Punkt). newsMarkers.js zeichnet die Linie jetzt auch über die letzte
    // geladene Kerze hinaus (siehe dort: extrapolatedX) — das hier ist nur die Scope-Entscheidung,
    // wie weit im Voraus das noch sinnvoll ist: nächste Woche würde über eine Wochenend-Lücke hinweg
    // extrapoliert und läge potenziell sichtbar daneben.
    const nowSec = replayUntil ?? Math.floor(Date.now() / 1000);
    relevant = relevant.filter((e) => e.eventTime <= nowSec || isSameBerlinDay(e.eventTime, nowSec));
    renderNewsMarkers(candleSeries, relevant, newsMarkerPrimitives, candles);
  }

  return { refreshSessions, refreshNewsMarkers };
}
