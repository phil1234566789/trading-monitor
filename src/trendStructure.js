// Marktstruktur-Erkennung (Swing High/Low, BOS/CHoCH) für den geplanten Trend-Indikator, siehe
// trading/marktstruktur.md und buildNestedTrendStructure weiter unten für die verschachtelte
// Über-/Unterstruktur (äußerer Rahmen + M5-"unterstruktur" darin, beides aus derselben M5-Kette
// abgeleitet — kein separates H1-Fraktal (mehr), siehe Chat: "ich trade im M5 chart". H1-Pivots
// sind als spätere Ausbaustufe gedacht, um automatisch einen sinnvollen Startpunkt/Anker zu
// finden (aktuell übernimmt das ein fest vorgegebener anchorTime, siehe PriceChart.vue).
import { detectLiquidityLevels, LiquidityLinePrimitive } from "./liquidity.js";

const M5_FRACTAL_PERIOD = 5; // wie LIQUIDITY_FRACTAL_PERIOD / TRADE_SETUP_M5_FRACTAL_PERIOD in PriceChart.vue

// Pivots ab `anchorTime`, chronologisch.
function boundedPivots(candles, anchorTime, fractalPeriod) {
  const { highs, lows } = detectLiquidityLevels(candles, fractalPeriod);
  return {
    highs: highs.filter((p) => p.pivotTime >= anchorTime).sort((a, b) => a.pivotTime - b.pivotTime),
    lows: lows.filter((p) => p.pivotTime >= anchorTime).sort((a, b) => a.pivotTime - b.pivotTime),
  };
}

// Baut die Trend-Historie (verkettet über `previous`) auf EINER Zeitebene, siehe
// trading/marktstruktur.md. Batch-Berechnung über das geladene Kerzen-Fenster (analog zu
// liquidity.js/tradeSetup.js) statt bar-für-bar-Streaming-State — läuft chronologisch vom
// Anker aus vorwärts und verfolgt dabei pro Trend-Abschnitt:
//
// - swingHigh/swingLow: die Struktur-Grenzen des Trends. Im Downtrend läuft swingLow mit jedem
//   neuen, per Kerzenabschluss bestätigten tieferen Tief weiter ("Bestätigung" laut Doku),
//   während swingHigh als laufendes Maximum aller Pivot-Hochs seit Beginn dieses Abschnitts
//   mitwächst — ein Schlusskurs darüber ist die eigentliche Invalidierung (spiegelverkehrt im
//   Uptrend). Ein Bruch beendet den Abschnitt und startet sofort den nächsten (Bootstrap direkt
//   ab der Bruchkerze, siehe unten) — verkettet über `previous`, beliebig weit zurückverfolgbar.
// - protectedHigh/protectedLow: das jeweils höchste Pivot-Hoch (bzw. tiefste Pivot-Tief) SEIT
//   dem letzten swingLow/swingHigh-Update — das ist die nähere, "geschützte" Gegen-Grenze, deren
//   Bruch per Kerzenabschluss einen CHoCH auslöst (siehe Protected High/Low in der Doku), OHNE
//   dass der Trend selbst schon kippt. Ein neues, tieferes/höheres Swing-Level entwertet einen
//   offenen CHoCH-Kandidaten wieder (Verstärkung statt Umkehr).
// - Nur Kerzenabschlüsse zählen als Bruch, keine Wick-Durchbrüche ("Erst Kerzenabschluss zählt
//   als Ausbruch" — anders als das wick-basierte `touched` in liquidity.js, das dort für die
//   Liquiditäts-Sweep-Visualisierung gilt, hier aber nicht die richtige Regel ist).
//
// Der Bootstrap eines neuen Abschnitts (nach Anker ODER nach einer Umkehr) sucht einfach den
// erstbesten Kerzenabschluss, der das seither laufende Pivot-Hoch/-Tief bricht — das kann auf
// verrauschten Daten auch einen kurzlebigen, unbedeutenden Mini-Abschnitt erzeugen. Gültige,
// aber uninteressante Abschnitte einfach ignorieren, indem man `previous` weiterverfolgt.
//
// `anchorTime` (Pflicht) legt fest, wie weit zurück gesucht wird — ein bewusst gewählter,
// fester Zeitpunkt (siehe buildNestedTrendStructure/PriceChart.vue), bis das später mal
// automatisch aus H1-Pivots hergeleitet wird.
export function buildTrendState(candles, { anchorTime, fractalPeriod = M5_FRACTAL_PERIOD } = {}) {
  if (anchorTime == null || candles.length === 0) return null;

  const { highs, lows } = boundedPivots(candles, anchorTime, fractalPeriod);
  if (highs.length === 0 || lows.length === 0) return null; // nicht genug Struktur seit dem Anker

  let hi = 0;
  let lo = 0;
  let runningHigh = null; // laufendes Pivot-Hoch-Maximum seit Beginn des aktuellen Abschnitts
  let runningLow = null; // laufendes Pivot-Tief-Minimum seit Beginn des aktuellen Abschnitts
  let previous = null; // zuletzt ABGESCHLOSSENER Abschnitt, für die previous-Kette
  let seg = null; // aktueller (offener) Abschnitt, oder null vor dem ersten BOS

  function admitPivotsUpTo(time) {
    while (hi < highs.length && highs[hi].pivotTime <= time) {
      const p = highs[hi++];
      if (!runningHigh || p.price > runningHigh.price) runningHigh = p;
      if (seg) seg.pivotHighs.push(p);
    }
    while (lo < lows.length && lows[lo].pivotTime <= time) {
      const p = lows[lo++];
      if (!runningLow || p.price < runningLow.price) runningLow = p;
      if (seg) seg.pivotLows.push(p);
    }
  }

  function startSegment(direction, swingHigh, swingLow, confirmedAt) {
    seg = { direction, swingHigh, swingLow, confirmedAt, choch: null, invalidatedAt: null, pivotHighs: [], pivotLows: [], previous };
  }

  // Beim Umschwung übernimmt die neue Struktur die gerade gebrochene Grenze DIREKT als eigene
  // fixe Seite — sie bleibt strukturell relevant (siehe Protected High/Low in der Doku: das
  // Tief/Hoch vor dem Umschwung wird "geschützt"). Nur die jeweils andere, "laufende" Seite
  // (neue Tiefs im kommenden Downtrend / neue Hochs im kommenden Uptrend) startet frisch bei
  // null. Ohne diese Übernahme würde jede Umkehr komplett neu bootstrappen und dabei genau das
  // Level verlieren, das den Trend eigentlich gültig hält.
  function closeSegment(invalidatedAt) {
    seg.invalidatedAt = invalidatedAt;
    seg.protectedHigh = seg.direction === "down" ? seg.protectedHigh ?? null : null;
    seg.protectedLow = seg.direction === "up" ? seg.protectedLow ?? null : null;
    previous = seg;

    if (seg.direction === "down") {
      runningHigh = null;
      startSegment("up", null, seg.swingLow, invalidatedAt);
    } else {
      runningLow = null;
      startSegment("down", seg.swingHigh, null, invalidatedAt);
    }
  }

  for (const c of candles) {
    if (c.time < anchorTime) continue;
    admitPivotsUpTo(c.time);

    if (!seg) {
      // Bootstrap: der erste Kerzenabschluss, der das laufende Pivot-Hoch bzw. -Tief seit
      // Anker/letzter Umkehr bricht, legt Richtung + initiales SwingHigh/SwingLow fest (siehe
      // Beispiel Philip: swing-high-fractal + swing-low-fractal, dann Bruch des Lows -> "ab da
      // gilt der Downtrend").
      if (runningHigh && c.close > runningHigh.price) {
        startSegment("up", runningHigh, runningLow, c.time);
      } else if (runningLow && c.close < runningLow.price) {
        startSegment("down", runningHigh, runningLow, c.time);
      }
      continue;
    }

    if (seg.direction === "down") {
      // swingHigh/swingLow können direkt nach einem Umschwung (bzw. beim allerersten Bootstrap)
      // noch null sein, bis die jeweils "laufende" Seite ihren ersten Pivot bekommt.
      if (runningHigh && (!seg.swingHigh || runningHigh.price > seg.swingHigh.price)) seg.swingHigh = runningHigh;
      if (runningLow && (!seg.swingLow || runningLow.price < seg.swingLow.price)) {
        seg.swingLow = runningLow; // neues, tieferes Tief -> Verstärkung, entwertet einen offenen CHoCH
        seg.choch = null;
      }
      if (seg.swingLow) {
        seg.protectedHigh = seg.pivotHighs.reduce(
          (best, p) => (p.pivotTime > seg.swingLow.pivotTime && (!best || p.price > best.price) ? p : best),
          null,
        );
      }

      if (seg.swingHigh && c.close > seg.swingHigh.price) {
        closeSegment(c.time);
        continue;
      }
      if (seg.protectedHigh && !seg.choch && c.close > seg.protectedHigh.price) {
        seg.choch = { price: seg.protectedHigh.price, pivotTime: seg.protectedHigh.pivotTime, brokenAt: c.time };
      }
    } else {
      // seg.direction === "up", spiegelverkehrt
      if (runningLow && (!seg.swingLow || runningLow.price < seg.swingLow.price)) seg.swingLow = runningLow;
      if (runningHigh && (!seg.swingHigh || runningHigh.price > seg.swingHigh.price)) {
        seg.swingHigh = runningHigh;
        seg.choch = null;
      }
      if (seg.swingHigh) {
        seg.protectedLow = seg.pivotLows.reduce(
          (best, p) => (p.pivotTime > seg.swingHigh.pivotTime && (!best || p.price < best.price) ? p : best),
          null,
        );
      }

      if (seg.swingLow && c.close < seg.swingLow.price) {
        closeSegment(c.time);
        continue;
      }
      if (seg.protectedLow && !seg.choch && c.close < seg.protectedLow.price) {
        seg.choch = { price: seg.protectedLow.price, pivotTime: seg.protectedLow.pivotTime, brokenAt: c.time };
      }
    }
  }

  if (!seg) return previous ? { direction: "consolidation", anchorTime, previous } : { direction: "consolidation", anchorTime };

  return {
    direction: seg.direction,
    anchorTime,
    confirmedAt: seg.confirmedAt,
    invalidatedAt: seg.invalidatedAt,
    swingHigh: seg.swingHigh,
    swingLow: seg.swingLow,
    protectedHigh: seg.direction === "down" ? seg.protectedHigh ?? null : null,
    protectedLow: seg.direction === "up" ? seg.protectedLow ?? null : null,
    choch: seg.choch,
    pivotHighs: seg.pivotHighs,
    pivotLows: seg.pivotLows,
    previous: seg.previous,
  };
}

// Höchster/tiefster Pivot eines Feldes (swingHigh/swingLow) über eine GANZE M5-Kette hinweg
// (nicht nur den aktuellen Abschnitt) — für die äußere Struktur-Grenze GEGEN die aktuelle
// Richtung (siehe buildNestedTrendStructure): "die größte Hürde, die über die gesamte
// verfolgte Historie hinweg noch nicht gebrochen wurde".
function extremeAcrossChain(chain, field, isBetter) {
  let best = null;
  for (const seg of chain) {
    const p = seg[field];
    if (p && (!best || isBetter(p.price, best.price))) best = p;
  }
  return best;
}

// Baut die verschachtelte Marktstruktur direkt aus EINER M5-Kette (siehe Chat: "die 1h-Pivots
// brauchen wir nur später, um automatisch einen Startpunkt zu finden — für jetzt reicht ein
// fester Anker"). Kein separates H1-Fraktal mehr (frühere Version, verworfen, siehe Git-Historie
// falls interessant) — stattdessen wird die äußere Struktur aus der M5-Kette selbst abgeleitet:
//
// - direction (außen) = direction des aktuellsten M5-Abschnitts (unterstruktur[0])
// - die "laufende" Grenze in dieser Richtung (swingLow bei down, swingHigh bei up) = die des
//   aktuellsten Abschnitts — "wie weit ist die aktuelle Bewegung schon gekommen"
// - die Gegen-Grenze (swingHigh bei down, swingLow bei up) = der extremste Wert über die
//   GESAMTE Kette hinweg — "die größte Hürde, die noch nicht gebrochen wurde", auch wenn sie
//   aus einem älteren, strukturell andersartigen (z.B. bullischen) Abschnitt stammt.
//
// `maxUnterstruktur` begrenzt die zurückgegebene Kette (default 2, siehe Chat: "mach ZWEI
// Unterstrukturen rein" — fürs Debuggen erstmal überschaubar halten statt der ganzen Historie).
export function buildNestedTrendStructure(m5Candles, { anchorTime, maxUnterstruktur = 2 } = {}) {
  const m5State = buildTrendState(m5Candles, { anchorTime, fractalPeriod: M5_FRACTAL_PERIOD });
  if (!m5State || m5State.direction === "consolidation") return m5State;

  const chain = [];
  let s = m5State;
  while (s) {
    const { previous, ...rest } = s; // previous durch die Array-Reihenfolge ersetzt, nicht doppelt mitschleppen
    chain.push(rest);
    s = previous;
  }

  const direction = chain[0].direction;
  const swingHigh = direction === "down" ? extremeAcrossChain(chain, "swingHigh", (a, b) => a > b) : chain[0].swingHigh;
  const swingLow = direction === "down" ? chain[0].swingLow : extremeAcrossChain(chain, "swingLow", (a, b) => a < b);

  return { direction, swingHigh, swingLow, unterstruktur: chain.slice(0, maxUnterstruktur) };
}

const SWING_HIGH_COLOR = "rgba(255, 23, 68, 0.9)"; // Struktur-Grenze oben — bricht sie, ist der Trend vorbei
const SWING_LOW_COLOR = "rgba(0, 230, 118, 0.9)"; // Struktur-Grenze unten
const PROTECTED_COLOR = "rgba(186, 85, 255, 0.9)"; // nähere Gegen-Grenze, deren Bruch den CHoCH auslöst
const CHOCH_COLOR = "rgba(255, 193, 7, 0.95)"; // Level, an dem der CHoCH tatsächlich ausgelöst hat
const OUTER_LINE_WIDTH = 3; // dicker als die Unterstruktur -> optisch klar der übergeordnete Rahmen
const M5_LINE_WIDTH = 2;
const MAX_M5_ALPHA = 0.55; // Deckkraft der aktuellen M5-Unterstruktur (immer noch klar dem äußeren Rahmen untergeordnet)
const MIN_M5_ALPHA = 0.12; // Deckkraft-Untergrenze für weit zurückliegende M5-Abschnitte

function dimColor(rgba, alpha) {
  return rgba.replace(/[\d.]+\)$/, `${alpha})`);
}

// Je weiter zurück ein M5-Unterstruktur-Abschnitt liegt, desto blasser — linear abnehmend bis
// zur Untergrenze, damit lange Ketten nicht alle gleich laut schreien.
function alphaForDepth(depth) {
  return Math.max(MIN_M5_ALPHA, MAX_M5_ALPHA - depth * 0.1);
}

// "aktuell" / "davor" / "davor-davor" / "3x davor" — greift Philips eigene Terminologie aus dem
// Chat auf. depth 0 = der aktuelle, offene M5-Abschnitt.
export function chainLabel(depth) {
  if (depth === 0) return "aktuell";
  if (depth === 1) return "davor";
  if (depth === 2) return "davor-davor";
  return `${depth}x davor`;
}

function trendLineItem(pivot, endTime, roleLabel, color, lineWidth, formatPrice) {
  const label = formatPrice ? `${roleLabel} ${formatPrice(pivot.price)}` : roleLabel;
  return {
    level: { price: pivot.price, pivotTime: pivot.pivotTime, endTime },
    options: { color, lineWidth, label, labelSide: "end" },
  };
}

// Baut die Linien-Items für EINEN Trend-Abschnitt (H1-Rahmen oder eine M5-Unterstruktur-Stufe).
function segmentItems(segment, endTime, formatPrice, { alpha = null, lineWidth = M5_LINE_WIDTH, prefix = "" } = {}) {
  const color = (c) => (alpha != null ? dimColor(c, alpha) : c);
  const items = [];
  // Pfeile fürs schnellere Erkennen im Gewühl der anderen Chart-Zeichnungen (Pfeilrichtung
  // passend zur Farblogik: rot/▼ = Ablehnung nach unten, grün/▲ = Ablehnung nach oben).
  if (segment.swingHigh) {
    items.push(trendLineItem(segment.swingHigh, endTime, `${prefix}▼ Swing High`, color(SWING_HIGH_COLOR), lineWidth, formatPrice));
  }
  if (segment.swingLow) {
    items.push(trendLineItem(segment.swingLow, endTime, `${prefix}▲ Swing Low`, color(SWING_LOW_COLOR), lineWidth, formatPrice));
  }
  if (segment.protectedHigh) {
    items.push(trendLineItem(segment.protectedHigh, endTime, `${prefix}Protected High`, color(PROTECTED_COLOR), lineWidth, formatPrice));
  }
  if (segment.protectedLow) {
    items.push(trendLineItem(segment.protectedLow, endTime, `${prefix}Protected Low`, color(PROTECTED_COLOR), lineWidth, formatPrice));
  }
  if (segment.choch) {
    items.push(trendLineItem(segment.choch, segment.choch.brokenAt, `${prefix}CHoCH`, color(CHOCH_COLOR), lineWidth, formatPrice));
  }
  return items;
}

// Zeichnet die verschachtelte Struktur (siehe buildNestedTrendStructure): der äußere Rahmen
// dick+hell ("Rahmen "-Präfix), darunter die M5-Unterstruktur zunehmend abgedunkelt ("M5 aktuell"
// / "M5 davor" / ...) — dieselben Abschnitte, die auch das Metadaten-Panel auflistet (siehe
// summarizeNestedTrend in PriceChart.vue), damit Chart und Metadaten 1:1 vergleichbar bleiben.
// `candles` = die gerade ANGEZEIGTEN Kerzen (nicht zwingend M5!), nur fürs Snapping der Linien-
// Endpunkte auf eine gültige Bar-Zeit — analog zu den Trade-Setup-Linien in PriceChart.vue, die
// aus demselben Grund ebenfalls `allCandles` statt der M5-Erkennungs-Kerzen verwenden.
export function renderTrendState(series, trendState, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!trendState || candles.length === 0) return;

  const precision = 5; // GBPUSD/EURUSD — Trendanalyse gibt's aktuell nur für Forex
  const formatPrice = (price) => price.toFixed(precision);
  const nowTime = candles[candles.length - 1].time;

  let items = segmentItems(trendState, nowTime, formatPrice, { lineWidth: OUTER_LINE_WIDTH, prefix: "Rahmen " });

  (trendState.unterstruktur ?? []).forEach((seg, i) => {
    items = items.concat(
      segmentItems(seg, seg.invalidatedAt ?? nowTime, formatPrice, {
        alpha: alphaForDepth(i),
        lineWidth: M5_LINE_WIDTH,
        prefix: `M5 ${chainLabel(i)} `,
      }),
    );
  });

  for (const { level, options } of items) {
    const primitive = new LiquidityLinePrimitive(level, options, candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
