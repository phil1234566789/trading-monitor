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
import { detectLiquidityLevels } from "../liquidity.js";
import { collectH1LqLevels } from "../marketStructureRendering";
import { detectSetupObs, detectTradeSetups } from "../tradeSetup.js";
import { sessions, isForbiddenAt } from "../sessions.js";
import {
  TRADE_SETUP_M5_FRACTAL_PERIOD,
  TRADE_SETUP_M5_CANDLE_COUNT,
  TRADE_SETUP_GRACE_SEC,
  TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
  TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
  TRADE_SETUP_LS_MAX_DISTANCE_M5,
  TRADE_SETUP_OB_MAX_DELAY_SEC,
  TRADE_SETUP_LOOKBACK_SEC,
  TREND_ANALYSIS_CANDLE_COUNT,
} from "../priceChartConstants.js";
import { fetchInitialCandles as fetchInitialForexCandles, fetchOlderCandles as fetchOlderForexCandles } from "../forexCandles.js";
import { fetchCandlesCached } from "../candleCache.js";
import { REPLAY_LOOKAHEAD_SEC } from "../timeframes.js";

export function usePriceChartTradeSetups() {
  let m5Candles = [];
  let trendAnalysisM5Candles = [];
  let fetchSeq = 0;

  const tradeSetupsMetadata = ref([]);

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
  function computeTradeSetups({ candles, marketStructureState, symbol, tradeSetupHistoryCount }) {
    if (candles.length === 0) {
      tradeSetupsMetadata.value = [];
      return;
    }
    const { highs: m5Highs, lows: m5Lows } = detectLiquidityLevels(candles, TRADE_SETUP_M5_FRACTAL_PERIOD);
    // H1-Level kommen seit Chat 2026-07-28 aus marketStructureState.structurePivots statt einer
    // eigenen H1-Fraktal-Erkennung — kann leer sein, solange marketStructureState noch nicht
    // geladen ist; Path A/B finden dann übergangsweise nur M5-basierte Setups, kein Absturz.
    const h1Highs = collectH1LqLevels(marketStructureState, 1);
    const h1Lows = collectH1LqLevels(marketStructureState, -1);
    const setupObs = detectSetupObs(candles);
    const params = {
      graceSec: TRADE_SETUP_GRACE_SEC,
      lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
      lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
      maxDistanceM5: TRADE_SETUP_LS_MAX_DISTANCE_M5,
      maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
      obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
      nowTime: candles[candles.length - 1].time,
    };
    // n zählt die GESAMTE Anzahl gezeigter Setups je Richtung (kein separates "Live"-Setup, siehe
    // detectTradeSetups). n=0 zeigt nichts (slice(-0) wäre sonst das GANZE Array, daher der
    // Sonderfall).
    const n = Math.max(0, tradeSetupHistoryCount);
    const takeLast = (arr) => (n === 0 ? [] : arr.slice(-n));
    // Setups, deren bestätigende M5-OB in einer "forbidden"-Session entstanden ist, direkt raus
    // (z.B. Asia/Spread Hour, siehe isForbiddenAt in sessions.js) statt nur als TSC-No-Go
    // anzuzeigen. obStartTime statt fractal.pivotTime, weil der OB der früheste plausible
    // Entry-Zeitpunkt ist. VOR takeLast gefiltert, sonst würde ein rausgefiltertes Setup einen
    // History-Platz "verbrauchen".
    const symbolSessions = sessions.filter((s) => s.instrument === symbol);
    const tzOffsetMinutes = (utcSec) => -new Date(utcSec * 1000).getTimezoneOffset();
    const notForbidden = (s) => !isForbiddenAt(symbolSessions, s.obStartTime, tzOffsetMinutes);
    // IMMER beide Richtungen berechnen (unabhängig von showTradeSetupsLong/-Short, siehe Chat
    // 2026-07-19: "TSC soll den aktuellsten und wahren Stand anzeigen") — die Long/Short-Toggles
    // filtern erst beim ZEICHNEN (renderTradeSetupsInternal in PriceChart.vue).
    const shorts = takeLast(detectTradeSetups(1, m5Highs, h1Highs, m5Highs, setupObs, params, candles).filter(notForbidden));
    const longs = takeLast(detectTradeSetups(-1, m5Lows, h1Lows, m5Lows, setupObs, params, candles).filter(notForbidden));
    tradeSetupsMetadata.value = [
      ...shorts.map((s, i) => ({ ...s, label: "Short", setupNumber: n > 1 ? i + 1 : null })),
      ...longs.map((s, i) => ({ ...s, label: "Long", setupNumber: n > 1 ? i + 1 : null })),
    ];
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

  return { tradeSetupsMetadata, getM5Candles, getTrendAnalysisM5Candles, computeTradeSetups, fetchM5Candles };
}
