// Ursprünglich lokale refreshEmaInternal/refreshRsiInternal/refreshRsiDivergenceInternal (inkl. der
// EMA/RSI-Series-Anlage aus onMounted und den Style-Watcher-Zeilen) in PriceChart.vue, per
// Refactoring-Task "Sehr große Dateien refactoren" (Phase 6b, 2026-08-25) hierher verschoben —
// zweite (bewusst komplexere, siehe PLAN-large-file-refactor.md) Gruppe der Zeichen-Orchestrierung.
// Anders als Sessions/News (Phase 6a) berühren ema50Series/rsiSeries mehrere Stellen in
// PriceChart.vue (onMounted-Anlage, onUnmounted-Teardown, chartColors-/chartLineWidths-Watcher) —
// deshalb ein Lifecycle-Objekt (create/dispose) statt reiner Zeichenfunktionen, und
// applyColorOptions/applyLineWidthOptions als Gegenstück zu den beiden Style-Watchern.
// divergencePriceLinePrimitives wird zusätzlich außerhalb dieser Datei gebraucht (Klick-Hittest in
// priceChartHitTest.js, Pin-Kontextmenü in PriceChart.vue) — deshalb als Array-Referenz direkt
// zurückgegeben (wird hier per push/length=0 mutiert, nie neu zugewiesen, bleibt also für den
// Aufrufer immer aktuell, ohne dass er sie bei jedem Refresh neu abfragen müsste).
import { LineSeries, LineStyle } from "lightweight-charts";
import { computeEma } from "../ema.js";
import { computeRsi, detectRsiDivergence, detectRsiDivergenceHistory, DEFAULT_RSI_PERIOD, DEFAULT_DIVERGENCE_LOOKBACK_BARS } from "../rsi.js";
import { DivergenceLinePrimitive, mergePinnedDivergences } from "../rsiRendering.js";
import { classifyDivergenceOutcome, DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS } from "../rsiDivergenceOutcome.js";
import { cssColor } from "../chartColors.js";
import { lineWidth } from "../chartLineWidths.js";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";

// EMA 50/200 auf M5 (siehe Chat: Philips "Trend über EMA + Anzahl protected highs/lows"-Idee) —
// läuft auf trendAnalysisM5Candles (dieselbe M5-Historie wie der Zigzag-Algo), kein eigener Fetch
// nötig, siehe loadTradeSetupM5 (PriceChart.vue).
const EMA_PERIOD_FAST = 50;
const EMA_PERIOD_SLOW = 200;

// RSI(14)-Panel (Chat 2026-08-11) — eigene Pane unterhalb des Candlestick-Charts, direkt Pane 1
// (Pane 0 ist die Candlestick-Pane selbst).
const RSI_PANE_INDEX = 1;

// lightweight-charts' native LineSeries-Option lineWidth erwartet eine kleine Ganzzahl (1-4), anders
// als die Linienstärke unserer eigenen Primitives (liquidity.js/marketStructureAnalysis.ts/...), die
// jeden positiven Zahlenwert akzeptieren — daher hier gerundet+geclampt, nur für EMA/RSI (die
// einzigen nativen Serien mit konfigurierbarer Linienstärke, siehe chartLineWidths.js).
function nativeLineWidth(key) {
  return Math.min(4, Math.max(1, Math.round(lineWidth(key))));
}

export function usePriceChartRsi() {
  let chart = null;
  let candleSeries = null;
  let ema50Series = null;
  let ema200Series = null;
  let rsiSeries = null;
  let rsiOverboughtLine = null;
  let rsiOversoldLine = null;
  const divergencePriceLinePrimitives = []; // Preis-Bein der Divergenz-Konnektoren, an candleSeries
  const divergenceRsiLinePrimitives = []; // RSI-Bein, an rsiSeries
  const divergenceOutcomeDebugPrimitives = []; // Struktur-Marken-Linien fürs Outcome-Debug, an candleSeries

  // Aufgerufen aus PriceChart.vue: onMounted, direkt nach candleSeries-Anlage.
  function create(chartInstance, candleSeriesInstance) {
    chart = chartInstance;
    candleSeries = candleSeriesInstance;
    // EMA 50/200 (M5) direkt in der Candlestick-Pane (keine eigene Pane) — sichtbar erst
    // sobald refreshEma Daten reinschreibt (siehe watch(showEma), PriceChart.vue).
    ema50Series = chart.addSeries(LineSeries, {
      color: cssColor("emaFast"),
      lineWidth: nativeLineWidth("emaFast"),
      priceLineVisible: false,
      lastValueVisible: false,
      // Chat 2026-07-25: "wenn der EMA an ist, dann fokusiert die Maus den EMA, anstatt die
      // Candles" — der Magnet-Crosshair (Default) snappt sonst auf den Datenpunkt der Serie, die
      // dem Mauszeiger am nächsten ist, und das ist bei einer glatten EMA-Linie oft eher die EMA
      // selbst als die Kerze. crosshairMarkerVisible:false nimmt die EMA-Serien komplett aus der
      // Magnet-Berechnung raus, Fokus bleibt auf den Kerzen.
      crosshairMarkerVisible: false,
      // Kein title: lightweight-charts zeigt den title-Text als eigenes Label neben der
      // Preisskala an, AUCH wenn lastValueVisible false ist (Bug-Report Philip 2026-07-26: "EMA
      // 200/50 zeigt mir rechts neben der Price-Y-Skala Labels an, brauch ich nicht").
    });
    ema200Series = chart.addSeries(LineSeries, {
      color: cssColor("emaSlow"),
      lineWidth: nativeLineWidth("emaSlow"),
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    // RSI(14)-Panel (Chat 2026-08-11) — Series+Pane werden erst bei refreshRsi() angelegt (siehe
    // dort), nicht hier fest verdrahtet: ein permanent existierendes, nur leer-genulltes RSI-Panel
    // hat sich beim Testen nicht sauber mit dem Stretch-Factor der Pane vertragen (setHeight(0) auf
    // einer zusätzlichen Pane verzerrte die eigene 0.25-Stretch-Aufteilung) — echtes
    // chart.removePane() beim Ausschalten umgeht das komplett, der Chart ist dann wieder exakt im
    // alten 1-Pane-Zustand.
  }

  // Aufgerufen aus PriceChart.vue: onUnmounted. Kein eigenes chart.removeSeries/-removePane nötig —
  // chart?.remove() (PriceChart.vue) reißt beim Unmount ohnehin den kompletten Chart samt aller
  // Series/Panes auf einmal ab, hier wird nur (wie vorher) referenced nachgezogen, damit kein noch
  // laufender Async-Callback auf eine disposed Series zugreift.
  function dispose() {
    chart = null;
    candleSeries = null;
    ema50Series = null;
    ema200Series = null;
    rsiSeries = null;
    rsiOverboughtLine = null;
    rsiOversoldLine = null;
  }

  // EMA-Sichtbarkeit: nur bei showEma=true UND currentBar==="5m" — auf einem gröberen Timeframe
  // (z.B. 1h) teilt sich die EMA-LineSeries die Zeitachse mit der 1h-Candlestick-Serie, und die viel
  // dichteren M5-Zeitpunkte quetschen dort die Kerzen zusammen (siehe Chat: "candles werden ganz
  // komisch dünn, wenn man den EMA anschaltet"). m5CandlesClipped = bereits clipReplay-gefiltertes
  // trendAnalysisM5Candles (PriceChart.vue).
  function refreshEma(m5CandlesClipped, { showEma, currentBar }) {
    if (!showEma || currentBar !== "5m" || m5CandlesClipped.length === 0) {
      ema50Series?.setData([]);
      ema200Series?.setData([]);
      return;
    }
    ema50Series?.setData(computeEma(m5CandlesClipped, EMA_PERIOD_FAST));
    ema200Series?.setData(computeEma(m5CandlesClipped, EMA_PERIOD_SLOW));
  }

  // RSI(14) — anders als EMA bewusst auf dem gerade angezeigten Chart-Timeframe (candles = bereits
  // clipReplay-gefiltertes allCandles), kein eigener Fetch nötig.
  function refreshRsi(candles, showRsi) {
    if (!chart) return;
    if (!showRsi) {
      if (rsiSeries) {
        chart.removeSeries(rsiSeries);
        chart.removePane(RSI_PANE_INDEX);
        rsiSeries = null;
        rsiOverboughtLine = null;
        rsiOversoldLine = null;
      }
      return;
    }
    if (!rsiSeries) {
      rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: cssColor("rsi"),
          lineWidth: nativeLineWidth("rsi"),
          priceLineVisible: false,
          lastValueVisible: true,
          title: "RSI(14)",
          // Feste 0-100-Skala statt Auto-Zoom auf die sichtbare Spanne — sonst würde ein RSI, der
          // z.B. nur zwischen 55 und 65 pendelt, die Y-Achse voll ausfüllen und wie ein extremer
          // Ausschlag aussehen, obwohl er nahe der Mitte liegt (klassische Oszillator-Darstellung
          // braucht die volle 0-100-Referenz).
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        },
        RSI_PANE_INDEX,
      );
      // Default-Scale-Margins (10% oben/unten) würden die 0-100-Skala zusätzlich aufblähen (Achse
      // zeigte 0-120 statt 0-100) — hier eng gehalten, RSI-Linie darf ruhig nah an den Panerand.
      rsiSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });
      // Stretch-Factor statt fixer Pixel-Höhe für die RSI-Pane relativ zur Candlestick-Pane.
      chart.panes()[RSI_PANE_INDEX]?.setStretchFactor(0.25);
      rsiOverboughtLine = rsiSeries.createPriceLine({ price: 70, color: cssColor("rsi"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
      rsiOversoldLine = rsiSeries.createPriceLine({ price: 30, color: cssColor("rsi"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });
    }
    const points = computeRsi(candles, DEFAULT_RSI_PERIOD)
      .filter((p) => p.rsi != null)
      .map((p) => ({ time: p.time, value: p.rsi }));
    rsiSeries.setData(points);
  }

  // Divergenz-Konnektoren (Chat 2026-08-11) — läuft NACH refreshRsi (siehe refreshChart() in
  // PriceChart.vue), damit rsiSeries bei showRsi+showRsiDivergence schon existiert. Zwei
  // Primitive-Instanzen pro gefundener Divergenz (Preis-Bein an candleSeries, RSI-Bein an rsiSeries,
  // siehe rsiRendering.js) statt einer einzigen über beide Panes hinweg — lightweight-charts'
  // Primitives hängen immer an genau einer Series/Pane.
  //
  // showRsiDivergenceHistory (Chat 2026-08-11, zweite Runde) läuft ZUSÄTZLICH zu showRsiDivergence,
  // ersetzt es nicht — beide zusammen zeichnen dieselbe "aktuelle" Divergenz zwar doppelt (die
  // Historie endet strukturell auf demselben letzten Ereignis), das ist aber nur dieselbe Linie
  // zweimal übereinander, kein sichtbarer Unterschied.
  // Gepinnte Divergenz zusätzlich zur Live-/Historie-Liste rendern (Task "Pin-Kontext: gepinnte
  // Objekte direkt rendern") — bewusst NUR bei exaktem Zeit-Treffer (kein Snap-Toleranz wie bei
  // Zonen/Leveln): rsi_divergence speichert keine eigene Timeframe-Spalte (siehe pinContext.js), ein
  // exakter Treffer von fromTime/toTime auf eine aktuell geladene Kerze ist der einzige verfügbare
  // Proxy dafür, dass der Chart gerade auf demselben Timeframe steht, auf dem die Divergenz erkannt
  // wurde (Philip 2026-08-18, bestätigt: RSI-Werte sind timeframe-abhängig, ANDERS als Zonen/Level
  // bewusst NICHT timeframe-entkoppeln) — ein M5-Zeitstempel trifft auf einem 1H-Chart so gut wie nie
  // exakt eine Kerzenzeit.
  //
  // candles = bereits clipReplay-gefiltertes allCandles. props = Component-Props von PriceChart.vue
  // (nur die showRsi*/pinnedRsiDivergences/pinRsiDivergenceKeys/hoveredPinRsiDivergenceKey-Felder
  // werden gelesen). rsiDivergenceStatsData = die Ref aus PriceChart.vue fürs Statistik-Panel.
  function refreshDivergence(candles, symbol, props, rsiDivergenceStatsData) {
    for (const p of divergencePriceLinePrimitives) candleSeries.detachPrimitive(p);
    divergencePriceLinePrimitives.length = 0;
    for (const p of divergenceRsiLinePrimitives) rsiSeries?.detachPrimitive(p);
    divergenceRsiLinePrimitives.length = 0;
    for (const p of divergenceOutcomeDebugPrimitives) candleSeries.detachPrimitive(p);
    divergenceOutcomeDebugPrimitives.length = 0;

    // needsDrawing/needsStats bewusst getrennt (Korrektur Philip, vierte Runde: "die liste soll alle
    // divergenzen anzeigen, die durch die historie eh schon berechnet sind" — das Statistik-Panel
    // hängt NICHT an showRsiDivergence/-History/rsiDivergenceHistoryCount, das sind reine
    // Chart-Zeichnungs-Toggles/-Caps. Erste Version dieses Panels hatte fälschlich dieselbe Menge
    // wiederverwendet ("was gerade im Chart sichtbar ist"), das war nicht gemeint.
    const needsDrawing =
      (props.showRsiDivergence || props.showRsiDivergenceHistory || props.pinnedRsiDivergences.length > 0) && props.showRsi && !!rsiSeries;
    const needsStats = props.showRsiDivergenceStats && props.showRsi;
    if (!needsDrawing && !needsStats) {
      rsiDivergenceStatsData.value = null;
      return;
    }

    if (candles.length === 0) {
      rsiDivergenceStatsData.value = null;
      return;
    }
    const precision = pricePrecisionForInstrument(symbol);

    if (needsDrawing) {
      const drawnDivergences = mergePinnedDivergences(
        [
          ...(props.showRsiDivergence ? detectRsiDivergence(candles) : []),
          ...(props.showRsiDivergenceHistory ? detectRsiDivergenceHistory(candles, undefined, undefined, props.rsiDivergenceHistoryCount) : []),
        ],
        props.pinnedRsiDivergences,
        candles,
      );

      for (const d of drawnDivergences) {
        const colorKey = d.type === "bearish" ? "divergenceBearish" : "divergenceBullish";
        const label = `${d.type === "bearish" ? "▽" : "△"} ${fmtPrice(d.fromPrice, precision)} → ${fmtPrice(d.toPrice, precision)}`;
        // Pin-Kontext (Chat 2026-08-17) — derselbe "type|fromTime|toTime"-Schlüssel wie
        // findNearbyPinCandidates' candidateKey für kind='rsi_divergence' (siehe pinContext.js:
        // rsiDivergenceEntryNaturalKey), hier direkt aus den rohen rsi.js-Unix-Sekunden gebaut.
        const divergenceKey = `${d.type}|${d.fromTime}|${d.toTime}`;
        const inPinContext = props.pinRsiDivergenceKeys?.has(divergenceKey) ?? false;
        const isSelectedPin = props.hoveredPinRsiDivergenceKey != null && props.hoveredPinRsiDivergenceKey === divergenceKey;
        const primOpts = {
          color: cssColor(colorKey),
          lineWidth: lineWidth(colorKey),
          label,
          inPinContext,
          pinColor: cssColor("pin"),
          isSelectedPin,
          hoverColor: cssColor("tradeHover"),
        };

        const pricePrimitive = new DivergenceLinePrimitive({ time: d.fromTime, price: d.fromPrice }, { time: d.toTime, price: d.toPrice }, primOpts, candles, d);
        candleSeries.attachPrimitive(pricePrimitive);
        divergencePriceLinePrimitives.push(pricePrimitive);

        const rsiPrimitive = new DivergenceLinePrimitive({ time: d.fromTime, price: d.fromRsi }, { time: d.toTime, price: d.toRsi }, primOpts, candles, d);
        rsiSeries.attachPrimitive(rsiPrimitive);
        divergenceRsiLinePrimitives.push(rsiPrimitive);
      }

      // Outcome-Debug — zeichnet für jede oben schon gezeichnete Divergenz die Struktur-Marke aus
      // classifyDivergenceOutcome: grün bis zum Bruch-Zeitpunkt bei "hit", rot bis zum geprüften
      // Fensterende bei "miss", grau bei "pending" (noch nicht genug Kerzen danach geladen). Bewusst
      // literale Farben statt chartColors-Tokens — reine Wegwerf-Debug-Ansicht (siehe
      // rsiDivergenceOutcome.js-Kommentar "wir basteln gerade"), kein Style-Modal-Eintrag für etwas,
      // das übermorgen wieder rausfliegen kann. Bleibt bewusst an denselben Chart-Toggles/-Cap wie
      // die Linien selbst (zeigt Outcomes für das, was gerade gezeichnet ist), anders als die
      // Statistik unten.
      if (props.showRsiDivergenceOutcomeDebug) {
        const OUTCOME_COLOR = { hit: "#26a69a", miss: "#ef5350", pending: "#787b86" };
        for (const d of drawnDivergences) {
          const result = classifyDivergenceOutcome(candles, d);
          if (result.structureLevel == null) continue;
          const color = OUTCOME_COLOR[result.outcome] ?? "#787b86";
          const endTime = result.outcome === "hit" ? result.breakTime : result.windowEndTime;
          const label =
            result.outcome === "hit"
              ? `HIT (${result.barsToBreak} Bars) · Struktur ${fmtPrice(result.structureLevel, precision)}`
              : `${result.outcome.toUpperCase()} · Struktur ${fmtPrice(result.structureLevel, precision)}`;
          const debugPrimitive = new DivergenceLinePrimitive(
            { time: result.structureTime, price: result.structureLevel },
            { time: endTime, price: result.structureLevel },
            { color, lineWidth: 1.5, label },
            candles,
          );
          candleSeries.attachPrimitive(debugPrimitive);
          divergenceOutcomeDebugPrimitives.push(debugPrimitive);
        }
      }
    }

    // Statistik-Panel — IMMER die volle, von der Historie-Erkennung gelieferte Menge (maxCount=
    // Infinity, siehe collectDivergenceHistory: .slice(-Infinity) ergibt das komplette Array), nicht
    // die evtl. viel kleinere rsiDivergenceHistoryCount-Chart-Anzeige-Grenze und unabhängig davon, ob
    // die Chart-Toggles selbst an sind — nur showRsi (RSI-Berechnung nötig) und der Statistik-Toggle
    // selbst zählen.
    rsiDivergenceStatsData.value = needsStats
      ? {
          divergences: detectRsiDivergenceHistory(candles, undefined, undefined, Infinity).map((d) => ({
            ...d,
            ...classifyDivergenceOutcome(candles, d),
          })),
          lookbackBars: DEFAULT_DIVERGENCE_LOOKBACK_BARS,
          lookforwardBars: DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS,
        }
      : null;
  }

  // Gegenstück zum chartColors-Watcher (PriceChart.vue) — Serien-OPTIONEN (nicht Daten) werden von
  // refreshChart() nicht angefasst, deshalb hier explizit.
  function applyColorOptions() {
    ema50Series?.applyOptions({ color: cssColor("emaFast") });
    ema200Series?.applyOptions({ color: cssColor("emaSlow") });
    rsiSeries?.applyOptions({ color: cssColor("rsi") });
    rsiOverboughtLine?.applyOptions({ color: cssColor("rsi") });
    rsiOversoldLine?.applyOptions({ color: cssColor("rsi") });
  }

  // Gegenstück zum chartLineWidths-Watcher (PriceChart.vue), analog zu applyColorOptions.
  function applyLineWidthOptions() {
    ema50Series?.applyOptions({ lineWidth: nativeLineWidth("emaFast") });
    ema200Series?.applyOptions({ lineWidth: nativeLineWidth("emaSlow") });
    rsiSeries?.applyOptions({ lineWidth: nativeLineWidth("rsi") });
  }

  return {
    create,
    dispose,
    refreshEma,
    refreshRsi,
    refreshDivergence,
    applyColorOptions,
    applyLineWidthOptions,
    // Array-Referenz (nicht per Funktion), siehe Kopfkommentar — Klick-Hittest (priceChartHitTest.js)
    // und Pin-Kontextmenü (PriceChart.vue: findNearbyPinCandidates/hasNearbyPinCandidate) lesen sie
    // direkt.
    divergencePriceLinePrimitives,
  };
}
