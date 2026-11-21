// Trade-Setup-Erkennung (Liquidity-Sweep + Fraktal + M5-OB, siehe tv-indikator/src/
// tradesetup.pine) + der M5-Polling-Loop, der sie mit frischen Kerzen füttert — ursprünglich
// computeTradeSetups/loadTradeSetupM5/fetchTrendAnalysisM5History in PriceChart.vue, per
// Refactoring-Task "Sehr große Dateien refactoren" (Phase 6f, 2026-08-26) hierher verschoben.
// tradeSetupsMetadata ersetzt das bisherige DOPPELTE currentTradeSetups(let)+tradeSetupsMetadata
// (ref) in PriceChart.vue — beide wurden dort bei jeder Zuweisung synchron gesetzt, waren also
// immer identisch; jetzt EIN Ref als einzige Quelle, von PriceChart.vue überall dort gelesen, wo
// vorher currentTradeSetups stand (Hittest/Zeichnung/TSC-Cockpit).
//
// m5Candles/trendAnalysisM5Candles bleiben bewusst reine Closure-Variablen (wie chart/candleSeries
// in PriceChart.vue selbst) statt Refs — werden nur lesend gebraucht (getM5Candles/
// getTrendAnalysisM5Candles), nie im Template gebunden.
//
// Die Refresh-Kaskade nach jedem erfolgreichen Fetch (EMA/Cockpit/POI-Zonen/Zeichnung neu
// anstoßen) bleibt bewusst in PriceChart.vue (dort: loadTradeSetupM5Internal) — die betroffenen
// Refreshs gehören zu anderen, bereits eigenständigen Features/Composables; eine Vermischung hier
// würde zirkuläre Abhängigkeiten zwischen den Composables erzeugen. scheduleNextTradeSetupM5Poll
// bleibt aus demselben Grund ebenfalls dort (hängt an withPollRetries + chart-alive-Check).
import { ref } from "vue";
import { setup1Inputs, setup1H1Levels, detectSetup1 } from "../setup1Detection.js";
import { TRADE_SETUP_DETECTOR_VERSION, hasUninterruptedSweepReaction } from "../tradeSetup.js";
import { setup1Configuration } from '../../supabase/functions/_shared/tradeSetupProvenance.js';
import { mergeDbTradeSetups } from "../tradeSetups.js";
import { setupInvalidationTarget } from "../setupInvalidationTarget.js";
import { sessions } from "../sessions.js";
import { markIgnored } from "../ignoredCandles.js";
import {
  TRADE_SETUP_M5_FRACTAL_PERIOD,
  TRADE_SETUP_M5_CANDLE_COUNT,
  TREND_ANALYSIS_CANDLE_COUNT,
} from "../priceChartConstants.js";
import { fetchInitialCandles as fetchInitialForexCandles, fetchOlderCandles as fetchOlderForexCandles } from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import { REPLAY_LOOKAHEAD_SEC } from "../timeframes.js";

export function usePriceChartTradeSetups({ evaluateCandidates, onEvaluated, sweepSourceProfile } = {}) {
  let m5Candles = [];
  let trendAnalysisM5Candles = [];
  let fetchSeq = 0;
  let computedInputKey = null;
  let computationRevision = 0;

  const tradeSetupsMetadata = ref([]);
  // Stand der sichtbaren Setups. Während Poll/Worker-Neuberechnung bleibt er stehen (sonst flackert
  // die Zeichnung); geleert wird nur bei Symbolwechsel oder Rücksprung, damit kein Zukunftswissen erscheint.
  let shown = null;
  const holdsFor = (symbol, at) => shown?.symbol === symbol && Number.isFinite(at) && Number.isFinite(shown.at) && at >= shown.at;
  function clearUnlessHeld(symbol, at) {
    if (holdsFor(symbol, at)) return;
    shown = null;
    tradeSetupsMetadata.value = [];
  }

  function getM5Candles() {
    return m5Candles;
  }
  function getTrendAnalysisM5Candles() {
    return trendAnalysisM5Candles;
  }

  // Erkennung läuft nur, wenn sich M5-Kerzen oder marketStructureState geändert haben (siehe
  // PriceChart.vue: computeTradeSetupsInternal-Aufrufstellen) — tradeSetupsMetadata bleibt über
  // Refreshs hinweg stehen, nur die Zeichnung (renderTradeSetupsInternal) läuft bei jedem Chart-
  // Refresh neu. Zeigt die letzten `tradeSetupHistoryCount` Setups JE Richtung, nicht nur das
  // aktive. candles = bereits clipReplay-gefiltertes m5Candles (siehe getM5Candles).
  function computeTradeSetups({ candles, marketStructureState, symbol, tradeSetupHistoryCount, dbTradeSetups = [], policyContext = null }) {
    if (candles.length === 0) {
      computationRevision++;
      computedInputKey = null;
      shown = null;
      tradeSetupsMetadata.value = [];
      return;
    }
    // Einmal markiert fuer Fraktale UND die bestaetigende FVG — die beiden Erkennungen lesen das
    // Flag unterschiedlich (siehe markIgnoredCandles), brauchen aber denselben Kerzensatz.
    const kerzen = markIgnored(candles, symbol);
    const symbolSessions = sessions.filter((s) => s.instrument === symbol);
    // H1-/M5-Lader und DB-Poll können denselben Stand liefern. Innenkorrekturen bleiben relevant.
    // Parameter/Schwelle folgen aus Symbol und Kerzen, stecken also schon im Schlüssel.
    const inputKey = JSON.stringify([symbol, kerzen, marketStructureState, dbTradeSetups,
      tradeSetupHistoryCount, symbolSessions, policyContext]);
    if (inputKey === computedInputKey) return;
    const request=++computationRevision;
    const inputs = setup1Inputs(symbol, kerzen, { sweepSourceProfile });
    const { params, minGap, setupObs, m5Highs, m5Lows, clean: kerzenOhneIgnorierte } = inputs;
    // H1-Level kommen seit Chat 2026-07-28 aus marketStructureState.structurePivots — kann leer sein,
    // solange marketStructureState noch nicht geladen ist; dann übergangsweise nur M5-Setups.
    const h1 = setup1H1Levels(marketStructureState);
    const { shorts, longs } = detectSetup1(inputs, h1.highs, h1.lows);
    // n zählt die GESAMTE Anzahl gezeigter Setups je Richtung (kein separates "Live"-Setup, siehe
    // detectTradeSetups). n=0 zeigt nichts (slice(-0) wäre sonst das GANZE Array, daher der
    // Sonderfall).
    const n = Math.max(0, tradeSetupHistoryCount);
    const takeLast = (arr) => (n === 0 ? [] : arr.slice(-n));
    // Kein Ausblenden nach forbidden-Session: Setups mit OB in Asia sollen sichtbar und für TS1.1
    // bewertbar bleiben, wie poi-watcher sie auch speichert.
    const detectionConfiguration = setup1Configuration({ instrument: symbol, params,
      minGap, sessions: symbolSessions,
      m5FractalPeriod: TRADE_SETUP_M5_FRACTAL_PERIOD, m5Window: TRADE_SETUP_M5_CANDLE_COUNT,
      h1Source: 'marketStructurePivots' });
    // Alte DB-Treffer dürfen die inzwischen widerlegte Sweep-Reaktion nicht zurück in den Chart mischen.
    const keep = (s) => hasUninterruptedSweepReaction(s, setupObs, kerzenOhneIgnorierte);
    // IMMER beide Richtungen berechnen (unabhängig von showTradeSetupsLong/-Short, siehe Chat
    // 2026-07-19: "TSC soll den aktuellsten und wahren Stand anzeigen") — die Long/Short-Toggles
    // filtern erst beim ZEICHNEN (renderTradeSetupsInternal in PriceChart.vue).
    // Die persistierten Setups (Task "Chart zeichnet die persistierten Trade-Setups", siehe
    // tradeSetups.js) dazu, BEVOR keep/takeLast greifen — sonst wäre die Historie-Begrenzung
    // wirkungslos. Symbol-Filter, weil der Poll nach einem Symbolwechsel kurz noch die Setups des
    // vorherigen Instruments hält (gleicher Grund wie filterDbObZones).
    const dbFor = (dir) => dbTradeSetups.filter((s) => s.instrument === symbol && s.dir === dir);
    const merged = [
      ...mergeDbTradeSetups(shorts, dbFor(1)),
      ...mergeDbTradeSetups(longs, dbFor(-1)),
    ].filter(keep).map(s => s.fromDb ? s : { ...s, instrument:symbol, detectorVersion: TRADE_SETUP_DETECTOR_VERSION, detectionConfiguration });
    // Neue Policies prüfen auch DB-Treffer vor der Historie; verworfene Treffer dürfen keinen Platz belegen.
    const candidates = evaluateCandidates ? evaluateCandidates(merged, policyContext) : merged;
    const apply = rows => {
      const shorts = takeLast(rows.filter(s => s.dir === 1));
      const longs = takeLast(rows.filter(s => s.dir === -1));
      tradeSetupsMetadata.value = [
      ...shorts.map((s, i) => ({ ...s, invalidationTarget: setupInvalidationTarget(s, m5Highs, symbol), label: "Short", setupNumber: n > 1 ? i + 1 : null })),
      ...longs.map((s, i) => ({ ...s, invalidationTarget: setupInvalidationTarget(s, m5Lows, symbol), label: "Long", setupNumber: n > 1 ? i + 1 : null })),
      ];
      shown = { symbol, at: policyContext?.evaluatedAt };
    };
    computedInputKey = inputKey;
    if(candidates?.then){
      clearUnlessHeld(symbol, policyContext?.evaluatedAt);
      return candidates.then(rows=>{
        if(computationRevision!==request)return;
        apply(rows);onEvaluated?.();
      });
    }
    apply(candidates);
  }

  // TREND_ANALYSIS_CANDLE_COUNT (2000) liegt über dem Edge-Function-Limit pro Request (1000, siehe
  // forexCandles.js) -> seitenweise rückwärts nachladen, analog zu fetchAllSince im
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

  // M5-Kerzen für die Trade-Setup-Erkennung — unabhängig vom aktuell gewählten Chart-Timeframe, da
  // ein Setup immer auf M5-Fraktal + M5-OB basiert, egal welchen Timeframe der Nutzer gerade
  // anschaut. Holt bei aktivem EMA-Toggle zusätzlich die größere M5-Historie für die
  // EMA-Berechnung (TREND_ANALYSIS_CANDLE_COUNT) — nur dann, um unnötige cTrader-Connects zu
  // vermeiden. Hängt hier dran (nicht an einem dritten eigenen Poller), weil EMA ohnehin
  // M5-Kerzen braucht und dieser Poll schon läuft — inhaltlich hat EMA nichts mit Trade-Setups zu
  // tun. NUR der Fetch + die Zuweisung an die Closure-Variablen — der Aufrufer (PriceChart.vue:
  // loadTradeSetupM5) löst bei applied:true danach computeTradeSetups() + alle abhängigen
  // Refreshs aus. Rückgabe {ok, applied} statt eines einzelnen Booleans, damit withPollRetries
  // (ok) und die Kaskaden-Entscheidung (applied) unabhängig bleiben — ein durch einen neueren
  // Fetch überholter Aufruf ist kein Fehler (ok:true), soll aber auch keine Kaskade mit veralteten
  // Daten anstoßen (applied:false).
  async function fetchM5Candles({ symbol, toMs, showEma }) {
    const seq = ++fetchSeq;
    try {
      const fetches = [fetchCandlesCached(fetchInitialForexCandles, symbol, "5m", TRADE_SETUP_M5_CANDLE_COUNT, toMs, REPLAY_LOOKAHEAD_SEC)];
      if (showEma) {
        fetches.push(
          fetchCandlesCached(
            (sym, bar, count, ms) => fetchTrendAnalysisM5History(sym, count, ms),
            symbol,
            "5m",
            TREND_ANALYSIS_CANDLE_COUNT,
            toMs,
            REPLAY_LOOKAHEAD_SEC,
          ),
        );
      }
      const [m5, trendM5] = await Promise.all(fetches);
      // Out-of-Order-Guard: ok:true (kein Fehler, withPollRetries soll NICHT erneut versuchen),
      // aber applied:false — ein neuerer Fetch ist bereits unterwegs und wird die Refresh-Kaskade
      // selbst auslösen, wenn ER fertig ist; hier weder die (veralteten) Kerzen übernehmen noch
      // den Aufrufer zur Kaskade anstoßen.
      if (seq !== fetchSeq) return { ok: true, applied: false };
      m5Candles = m5;
      if (trendM5) trendAnalysisM5Candles = trendM5;
      return { ok: true, applied: true };
    } catch (err) {
      console.error("Trade-Setup-M5-Kerzen fehlgeschlagen:", err);
      return { ok: false, applied: false };
    }
  }

  // Ohne Scope (z.B. dispose) immer leeren; mit Scope bleibt ein gleicher/späterer Stand sichtbar.
  function invalidate(scope={}){computationRevision++;computedInputKey=null;clearUnlessHeld(scope.symbol,scope.evaluatedAt);}
  return { tradeSetupsMetadata, getM5Candles, getTrendAnalysisM5Candles, computeTradeSetups, fetchM5Candles, invalidate, holdsFor };
}
