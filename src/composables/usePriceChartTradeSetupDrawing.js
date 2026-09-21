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
import { rScaleLevels } from "../rScale.js";
import { rQuote } from "../rScaleQuotes.js";
import { RScalePrimitive } from "../rScaleRendering.js";
import { cssColor, cssColorScaled } from "../chartColors.js";
import { lineWidth } from "../chartLineWidths.js";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { toPips } from "../pipConfig.js";
import { TRADE_SETUP_OB_WIDTH_SEC, TRADE_SETUP_OB_FILL_RATIO, TRADE_SETUP_OB_BORDER_RATIO } from "../priceChartConstants.js";

// Deckkraft der Nebensweep-Linien, relativ zur LS-Linie desselben Setups.
const NEBEN_SWEEP_ALPHA_RATIO = 0.55;

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
  function refresh(tradeSetups, { candles, showTradeSetups, showTradeSetupsShort, showTradeSetupsLong, showRScale, showLiquidityDebug, replayUntil, symbol }) {
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
      // obStartTime statt fractal.pivotTime als Replay-Cutoff: der bestätigende OB markiert den
      // Zeitpunkt, an dem das Setup überhaupt existiert — dieselbe Regel wie die Sortierung in
      // getTradeSetups (db.ts).
      if (replayUntil != null && setup.obStartTime > replayUntil) continue;
      if (setup.dir === 1 && !showTradeSetupsShort) continue;
      if (setup.dir === -1 && !showTradeSetupsLong) continue;
      const key = setup.dir === 1 ? "tradeSetupShort" : "tradeSetupLong";
      const lsColor = cssColor(key);
      // Die gezeichnete Box IST die von widenObForSweep aufgezogene OB-Box (siehe tradeSetup.js) —
      // ihre ferne Kante ist zugleich die Invalidierung des Setups.
      const top = setup.obTop;
      const bottom = setup.obBottom;

      const fractalLine = new LiquidityLinePrimitive(
        setup.fractal,
        {
          color: cssColor("tradeSetupProtected"),
          lineWidth: lineWidth("tradeSetupProtected"),
          // Ohne eigenes bestätigtes Fraktal fällt `fractal` auf `ls` zurück (siehe tradeSetup.js) —
          // die Linie liegt dann exakt auf der LS-Linie darunter, ein eigenes Preislabel wäre nur
          // eine zweite Kopie desselben Preises an derselben Stelle (Bug-Report Philip 2026-07-27:
          // "Label des LQ-Sweeps ist immer noch doppelt"). Direkt am Objekt geprüft statt über
          // pathType, das seit 2026-09-20 nichts mehr steuert.
          // "PP "-Präfix + Positionierung wie bei der LS-Linie (Chat 2026-07-27: "genauso behandeln
          // wie die LS") — selbe end-above/end-below-Logik + Präfix-Zahlformat.
          label: showLiquidityDebug && setup.fractal !== setup.ls ? `PP ${formatPrice(setup.fractal.price)}` : null,
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
      // Die übrigen abgeräumten Level desselben OB (Philip 21.09.2026: "Je mehr Bestätigungs-
      // LQ-Sweeps desto besser") — dünner, blasser und stumm, weil nur der älteste die Qualität
      // trägt und 5-9 volle LS-Labels je Setup den Chart zustellen würden.
      const nebenSweepLines = (setup.sweeps ?? []).slice(1).map(
        (sw) =>
          new LiquidityLinePrimitive(
            sw.level,
            {
              color: cssColorScaled(key, NEBEN_SWEEP_ALPHA_RATIO),
              lineWidth: Math.max(1, lineWidth(key) - 1),
              label: null,
              labelSide: bullBearLabelSide(setup.dir === 1),
            },
            candles,
          ),
      );

      // Nummer-Suffix (Chat 2026-07-27: "damit ich die Nummer sofort zuordnen kann", siehe
      // computeTradeSetups in usePriceChartTradeSetups.js) — nur gesetzt, wenn Trade-Setups-Historie
      // aktiv ist (mehrere Boxen je Richtung gleichzeitig sichtbar), sonst überflüssig.
      const numberSuffix = setup.setupNumber != null ? ` #${setup.setupNumber}` : "";
      // "Long"/"Short" + Nummer als erste Zeile. Das Pfad-Kürzel ("A"/"B") ist hier am 20.09.2026
      // rausgeflogen — Philip: "fachlich gesehen ist mir scheissegal, ob Path A oder B. Ich brauche
      // diese Info nicht." Danach je eine Zeile Oberkante/Unterkante der OB, NUR im Debug-Modus,
      // untereinander statt mit "/" getrennt (Bug-Report Philip: "dann weiß ich, dass die obere
      // Zahl für die Oberkante ist").
      const obLabelLines = [`${setup.label}${numberSuffix}`];
      if (showLiquidityDebug) obLabelLines.push(formatPrice(top), formatPrice(bottom));
      const obBox = new OrderBlockPrimitive(
        // touched: true erzwingt die feste Box-Breite, siehe Kommentar bei
        // refreshTradeSetupLinksInternal (PriceChart.vue). instrument/direction/setup zusätzlich auf
        // der Zone (nicht fürs Rendering gebraucht) — findNearbyPinCandidates (priceChartHitTest.js)
        // liest sie für den "tsc_setup"-Pin-Kandidaten (Task "Pin-Kontext: live erkannte Trade-Setup-
        // Box pinnen können"), da diese Box anders als die Trade-Setup-Link-Box noch keine
        // trade_setups.id hat (findOrCreateTradeSetupId legt sie erst beim tatsächlichen Pinnen an).
        {
          top,
          bottom,
          startTime: setup.obStartTime,
          endTime: setup.obStartTime + TRADE_SETUP_OB_WIDTH_SEC,
          touched: true,
          instrument: symbol,
          direction: setup.dir === 1 ? "short" : "long",
          setup,
        },
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

      // R-Skala (PLAN-dr-statistik-ui.md, Stufe 1) — Lineal am OB-Startzeitpunkt, siehe
      // rScaleRendering.js. Ein Primitive für alle Marken zusammen.
      // Quote je Marke (Stufe 2): die historische Trefferquote hängt am Risiko-BAND der Range,
      // nicht an der R-Stufe allein — siehe rScaleQuotes.js (null außerhalb von GBPUSD). Dafür
      // zählt bandRisk (strukturell), nicht das auf STOPP_DECKEL_PIPS gedeckelte risk der Marken.
      const { anchorPrice, levels, bandRisk } = showRScale ? rScaleLevels(setup) : { levels: [] };
      const riskPips = toPips(bandRisk ?? 0);
      const rScale = levels.length
        ? [
            new RScalePrimitive(
              {
                startTime: setup.obStartTime,
                anchorPrice,
                levels: levels.map((l) => ({ ...l, quote: rQuote(symbol, riskPips, l.r) })),
              },
              candles,
            ),
          ]
        : [];

      for (const primitive of [fractalLine, lsLine, ...nebenSweepLines, obBox, ...rScale]) {
        candleSeries.attachPrimitive(primitive);
        tradeSetupPrimitives.push(primitive);
      }
    }
  }

  // tradeSetupPrimitives zusätzlich exponiert (Task "Pin-Kontext: live erkannte Trade-Setup-Box
  // pinnen können") — analog zu divergencePriceLinePrimitives in usePriceChartRsi.js, wird von
  // PriceChart.vue (pinPrimitivesBag) für findNearbyPinCandidates gebraucht. Bleibt dieselbe
  // Array-Referenz über refresh()-Aufrufe hinweg (nur .length=0 + .push, nie neu zugewiesen).
  return { create, dispose, refresh, tradeSetupPrimitives };
}
