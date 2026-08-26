// Trade-Setup-Zeichnung (LS-/Fraktal-Linien + OB-Box) — ursprünglich renderTradeSetupsInternal in
// PriceChart.vue, per Refactoring-Task "Sehr große Dateien refactoren" (Phase 6h, 2026-08-26)
// hierher verschoben. Reine Zeichenfunktion, kein Fetch/keine Erkennung (siehe
// usePriceChartTradeSetups.js, Phase 6f, für tradeSetupsMetadata) — liest die Setups als Parameter
// statt eigenen Zustand zu besitzen, außer den candleSeries-Primitives selbst. Braucht trotzdem ein
// create(candleSeries)/dispose()-Lifecycle wie die anderen Zeichen-Composables, weil direkt auf
// candleSeries gezeichnet wird (kein chart-Objekt nötig, anders als z.B.
// usePriceChartClaudeAnnotations.js — deshalb hier nur ein Parameter statt zwei).
import { LiquidityLinePrimitive, bullBearLabelSide, formatLsLabel } from "../liquidity.js";
import { OrderBlockPrimitive } from "../orderBlocks.js";
import { tradeSetupObBoxBounds } from "../tradeSetup.js";
import { cssColor, cssColorScaled } from "../chartColors.js";
import { lineWidth } from "../chartLineWidths.js";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { TRADE_SETUP_OB_WIDTH_SEC, TRADE_SETUP_OB_FILL_RATIO, TRADE_SETUP_OB_BORDER_RATIO } from "../priceChartConstants.js";

export function usePriceChartTradeSetupDrawing() {
  let candleSeries = null;
  let tradeSetupPrimitives = [];

  function create(candleSeriesInstance) {
    candleSeries = candleSeriesInstance;
  }
  function dispose() {
    candleSeries = null;
  }

  // tradeSetups = tradeSetupsMetadata.value (usePriceChartTradeSetups.js) — enthält IMMER beide
  // Richtungen (siehe dort), showTradeSetupsShort/-Long filtern hier NUR das Zeichnen. candles =
  // bereits clipReplay-gefiltertes allCandles.
  function refresh(tradeSetups, { candles, showTradeSetups, showTradeSetupsShort, showTradeSetupsLong, showLiquidityDebug, replayUntil, symbol }) {
    for (const p of tradeSetupPrimitives) candleSeries.detachPrimitive(p);
    tradeSetupPrimitives.length = 0;
    if (!showTradeSetups) return;
    // Preis-Labels an Fraktal-/LS-Linie, nur bei aktivem Debug-Toggle (Chat 2026-07-26: "ich tu mir
    // schwer beim debuggen ... bitte die Preiszahlen hinschreiben") — dasselbe Muster wie die
    // allgemeinen Liquiditäts-Level (siehe refreshLiquidityInternal in PriceChart.vue: debugPrices/
    // formatPrice).
    const precision = pricePrecisionForInstrument(symbol);
    const formatPrice = (price) => fmtPrice(price, precision);
    // Für formatLsLabel (Tier-Präfix + Alter am LS-Label, Chat 2026-07-28) — dieselbe Referenzzeit
    // wie die "1h LQ-Sweep"-Linie (usePriceChartMarketStructure.js), damit LS-Linie und LQ-Sweep bei
    // identischem Pivot exakt denselben Label-Text zeigen (siehe collectH1LqLevels: oft derselbe
    // Pivot).
    const nowSec = replayUntil ?? Math.floor(Date.now() / 1000);

    for (const setup of tradeSetups) {
      if (replayUntil != null && setup.fractal.pivotTime > replayUntil) continue;
      if (setup.dir === 1 && !showTradeSetupsShort) continue;
      if (setup.dir === -1 && !showTradeSetupsLong) continue;
      const key = setup.dir === 1 ? "tradeSetupShort" : "tradeSetupLong";
      const lsColor = cssColor(key);
      const { top, bottom } = tradeSetupObBoxBounds(setup);

      const fractalLine = new LiquidityLinePrimitive(
        setup.fractal,
        {
          color: cssColor("tradeSetupProtected"),
          lineWidth: lineWidth("tradeSetupProtected"),
          // Bei Path B ist fractal === ls (identischer Pivot, siehe pathType in tradeSetup.js) — die
          // Linie liegt exakt auf der LS-Linie darunter, ein eigenes Preislabel hier wäre nur eine
          // zweite Kopie desselben Preises an derselben Stelle (Bug-Report Philip 2026-07-27: "Label
          // des LQ-Sweeps ist immer noch doppelt"). Nur bei Path A anzeigen, wo fractal ein eigener,
          // vom LS verschiedener Pivot ist.
          // "PP "-Präfix + Positionierung wie bei der LS-Linie (Chat 2026-07-27: "genauso behandeln
          // wie die LS") — selbe end-above/end-below-Logik + Präfix-Zahlformat.
          label: showLiquidityDebug && setup.pathType !== "B" ? `PP ${formatPrice(setup.fractal.price)}` : null,
          labelSide: bullBearLabelSide(setup.dir === 1),
        },
        candles,
      );
      const lsLine = new LiquidityLinePrimitive(
        setup.ls,
        {
          color: lsColor,
          lineWidth: lineWidth(key),
          // "LS "-Präfix (Chat 2026-07-27: "extra Label vor den Preis, 1.3306 -> LS 1.3306") — sonst
          // bei Path A nicht von der protected-Fraktal-Linie darüber unterscheidbar, beide zeigen
          // sonst nur eine nackte Zahl. Seit Chat 2026-07-28 zusätzlich Tier-Präfix + Alter
          // (formatLsLabel, liquidity.js) — identisches Format wie die "1h LQ-Sweep"-Linie in
          // marketStructureAnalysis.ts, damit beide beim Überlappen (oft derselbe Pivot, siehe
          // collectH1LqLevels) lesbar bleiben statt zwei leicht unterschiedliche Strings übereinander.
          label: showLiquidityDebug ? formatLsLabel(formatPrice(setup.ls.price), setup.ls.pivotTime, nowSec, setup.ls.touchedTime) : null,
          // "end-above"/"end-below" statt Default "start" (Chat 2026-07-27: "muss ständig sau weit
          // nach links scrollen") — der M5-LQ-Sweep-Pivot liegt oft weit links vom aktuellen
          // Kerzenrand, das Preislabel soll trotzdem am rechten (aktuellen) Ende der Linie stehen.
          // Über/unter statt AUF der Linie — Short oben, Long unten, rein zur visuellen
          // Unterscheidung.
          labelSide: bullBearLabelSide(setup.dir === 1),
        },
        candles,
      );
      // Nummer-Suffix (Chat 2026-07-27: "damit ich die Nummer sofort zuordnen kann", siehe
      // computeTradeSetups in usePriceChartTradeSetups.js) — nur gesetzt, wenn Trade-Setups-Historie
      // aktiv ist (mehrere Boxen je Richtung gleichzeitig sichtbar), sonst überflüssig.
      const numberSuffix = setup.setupNumber != null ? ` #${setup.setupNumber}` : "";
      // "Long"/"Short" + Pfad-Kürzel + Nummer als erste Zeile (A = eigenes bestätigtes Protected-
      // Pivot, B = fractal===ls, siehe pathType in tradeSetup.js). Danach je eine Zeile Oberkante/
      // Unterkante der OB, NUR im Debug-Modus, untereinander statt mit "/" getrennt (Bug-Report
      // Philip: "dann weiß ich, dass die obere Zahl für die Oberkante ist"). NUR hier angehängt,
      // NICHT in setup.label — die TSC-Karte baut ihren eigenen "Typ A/B #x"-Text separat aus
      // pathType/setupNumber.
      const obLabelLines = [`${setup.label} ${setup.pathType}${numberSuffix}`];
      if (showLiquidityDebug) obLabelLines.push(formatPrice(top), formatPrice(bottom));
      const obBox = new OrderBlockPrimitive(
        // touched: true erzwingt die feste Box-Breite, siehe Kommentar bei
        // refreshTradeSetupLinksInternal (PriceChart.vue).
        { top, bottom, startTime: setup.obStartTime, endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC, touched: true },
        {
          fillColor: cssColorScaled(key, TRADE_SETUP_OB_FILL_RATIO),
          borderColor: cssColorScaled(key, TRADE_SETUP_OB_BORDER_RATIO),
          borderWidth: lineWidth(key),
          textColor: "rgba(255, 255, 255, 0.9)",
          // ZoneRenderer (orderBlocks.js) unterstützt mehrzeilige Labels per "\n" (seit diesem
          // Chat) — vorher war das immer genau eine Zeile.
          label: obLabelLines.join("\n"),
        },
        candles,
      );

      for (const primitive of [fractalLine, lsLine, obBox]) {
        candleSeries.attachPrimitive(primitive);
        tradeSetupPrimitives.push(primitive);
      }
    }
  }

  return { create, dispose, refresh };
}
