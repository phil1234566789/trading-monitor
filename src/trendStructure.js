// Marktstruktur-Erkennung (Swing High/Low, BOS/CHoCH) für den geplanten Trend-Indikator,
// siehe trading/marktstruktur.md. Erster Baustein: das Analyse-Fenster für die M5-
// Strukturerkennung sinnvoll begrenzen (siehe computeStructureAnchorTime).
import { detectLiquidityLevels, LiquidityLinePrimitive } from "./liquidity.js";

const H1_FRACTAL_PERIOD = 10; // wie TRADE_SETUP_H1_FRACTAL_PERIOD in PriceChart.vue
const ANCHOR_FALLBACK_PIVOT_COUNT = 3;

// Ohne Anker könnte ein uralter, nie geswepter M5-Pivot (z.B. von vor Jahren) fälschlich als
// aktuelles Swing High/Low gelten. Anker = pivotTime des zuletzt gebrochenen H1-Pivots
// (Periode 10, highs+lows zusammen) — ein gebrochenes H1-Level markiert einen echten
// strukturellen Reset, alles davor ist laut Marktstruktur-Lehre ohnehin nicht mehr die
// aktuell gültige Struktur. Fallback (noch kein H1-Pivot im geladenen Fenster gebrochen):
// ältester der letzten 3 H1-Pivots (chronologisch, highs+lows gemischt).
// Gibt null zurück, wenn nicht mal genug H1-Historie für einen einzigen Pivot vorliegt.
export function computeStructureAnchorTime(h1Candles) {
  const { highs, lows } = detectLiquidityLevels(h1Candles, H1_FRACTAL_PERIOD);
  const allPivots = [...highs, ...lows];
  if (allPivots.length === 0) return null;

  const lastBroken = allPivots
    .filter((p) => p.touched)
    .sort((a, b) => b.touchedTime - a.touchedTime)[0];
  if (lastBroken) return lastBroken.pivotTime;

  const newest3 = [...allPivots].sort((a, b) => b.pivotTime - a.pivotTime).slice(0, ANCHOR_FALLBACK_PIVOT_COUNT);
  return newest3[newest3.length - 1].pivotTime;
}

const M5_FRACTAL_PERIOD = 5; // wie LIQUIDITY_FRACTAL_PERIOD / TRADE_SETUP_M5_FRACTAL_PERIOD in PriceChart.vue

// M5-Pivots ab dem Anker, chronologisch — alles davor ist laut computeStructureAnchorTime nicht
// mehr die aktuell gültige Struktur (siehe dort).
function boundedM5Pivots(m5Candles, anchorTime) {
  const { highs, lows } = detectLiquidityLevels(m5Candles, M5_FRACTAL_PERIOD);
  return {
    highs: highs.filter((p) => p.pivotTime >= anchorTime).sort((a, b) => a.pivotTime - b.pivotTime),
    lows: lows.filter((p) => p.pivotTime >= anchorTime).sort((a, b) => a.pivotTime - b.pivotTime),
  };
}

// Baut die M5-Trend-Historie (verkettet über `previous`), siehe trading/marktstruktur.md.
// Batch-Berechnung über das geladene Kerzen-Fenster (analog zu liquidity.js/tradeSetup.js)
// statt bar-für-bar-Streaming-State — läuft chronologisch vom Anker aus vorwärts und
// verfolgt dabei pro Trend-Abschnitt:
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
// verrauschten Daten auch einen kurzlebigen, unbedeutenden Mini-Abschnitt erzeugen (siehe Chat:
// die Kette wird dadurch ggf. länger/kleinteiliger als ein Mensch sie ziehen würde). Gültige,
// aber uninteressante Abschnitte einfach ignorieren, indem man `previous` weiterverfolgt.
export function buildTrendState(m5Candles, h1Candles) {
  const anchorTime = computeStructureAnchorTime(h1Candles);
  if (anchorTime == null) return null;

  const { highs, lows } = boundedM5Pivots(m5Candles, anchorTime);
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
  // Level verlieren, das den Trend eigentlich gültig hält (siehe Testlauf: ohne Übernahme
  // verschwindet 1.34805 spurlos aus der Kette).
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

  for (const c of m5Candles) {
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

const SWING_HIGH_COLOR = "rgba(255, 23, 68, 0.9)"; // Struktur-Grenze oben — bricht sie, ist der Trend vorbei
const SWING_LOW_COLOR = "rgba(0, 230, 118, 0.9)"; // Struktur-Grenze unten
const PROTECTED_COLOR = "rgba(186, 85, 255, 0.9)"; // nähere Gegen-Grenze, deren Bruch den CHoCH auslöst
const CHOCH_COLOR = "rgba(255, 193, 7, 0.95)"; // Level, an dem der CHoCH tatsächlich ausgelöst hat
const LINE_WIDTH = 2;

function trendLineItem(pivot, endTime, roleLabel, color, formatPrice) {
  const label = formatPrice ? `${roleLabel} ${formatPrice(pivot.price)}` : roleLabel;
  return {
    level: { price: pivot.price, pivotTime: pivot.pivotTime, endTime },
    options: { color, lineWidth: LINE_WIDTH, label, labelSide: "end" },
  };
}

// Zeichnet den aktuellen Trend-Zustand (nur den offenen, aktuellsten Abschnitt — nicht die
// `previous`-Kette) als Linien mit Preis-Label auf den Chart, siehe "Trendanalyse"-Toggle im
// Dashboard. `candles` = die gerade ANGEZEIGTEN Kerzen (nicht zwingend M5!), nur fürs Snapping
// der Linien-Endpunkte auf eine gültige Bar-Zeit — analog zu den Trade-Setup-Linien in
// PriceChart.vue, die aus demselben Grund ebenfalls `allCandles` statt der M5-Erkennungs-
// Kerzen verwenden.
export function renderTrendState(series, trendState, existingPrimitives, candles) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!trendState || candles.length === 0) return;

  const precision = 5; // GBPUSD/EURUSD — Trendanalyse gibt's aktuell nur für Forex
  const formatPrice = (price) => price.toFixed(precision);
  const nowTime = candles[candles.length - 1].time;

  const items = [];
  if (trendState.swingHigh) items.push(trendLineItem(trendState.swingHigh, nowTime, "Swing High", SWING_HIGH_COLOR, formatPrice));
  if (trendState.swingLow) items.push(trendLineItem(trendState.swingLow, nowTime, "Swing Low", SWING_LOW_COLOR, formatPrice));
  if (trendState.protectedHigh) {
    items.push(trendLineItem(trendState.protectedHigh, nowTime, "Protected High", PROTECTED_COLOR, formatPrice));
  }
  if (trendState.protectedLow) {
    items.push(trendLineItem(trendState.protectedLow, nowTime, "Protected Low", PROTECTED_COLOR, formatPrice));
  }
  if (trendState.choch) {
    items.push(trendLineItem(trendState.choch, trendState.choch.brokenAt, "CHoCH", CHOCH_COLOR, formatPrice));
  }

  for (const { level, options } of items) {
    const primitive = new LiquidityLinePrimitive(level, options, candles);
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
