import { snapToBarTime } from "./chartTimeUtils.js";

// Schrittweise Marktstruktur-Erkennung nach Philips eigenem Entwurf (siehe
// test/trendanalyse_vorschlag.ts, stateSchritt1 -> stateSchritt2 -> stateSchritt3) — bewusst
// simpler als trendStructure.js: ein Pivot nach dem anderen einlesen und in die Struktur
// einordnen. Reversal (Bruch der Gegen-Grenze, also Bruch des swing-high im Downtrend) ist hier
// bewusst noch NICHT behandelt (siehe Datei: "STOPP, schreib den algo erst mal bis hier und
// nicht weiter").
//
// Pivot-Form (übernimmt Philips eigene Typisierung aus trendanalyse_vorschlag.ts):
// { price, type: "high"|"low"|"swing-high"|"swing-low"|"lower-high"|"lower-low"|"weak-high",
//   touched: false | { price, touchedAt }, pivotAt, pivotTime }
// pivotTime (Unix-Sekunden) ist nur intern für Rendering + Kerzen-Lookup nötig, siehe
// PriceChart.vue (pivotForDisplay strippt es wieder raus fürs Metadaten-Panel).

export function initTrendState({ trendOrdnung, direction, high, low }) {
  return {
    trendOrdnung, // 1 = übergeordneter Trend, je niedriger desto stärker (reicht als chartLabel)
    direction,
    trendState: "unconfirmed", // Richtung erkennbar, aber ohne Lower-High+Lower-Low noch keine bestätigte Struktur
    range: {
      high: { ...high, type: "swing-high" },
      low: { ...low, type: "swing-low" },
    },
    struktur: [], // klassifizierte Struktur-Pivots (lower-high/lower-low/weak-high), siehe applyPivot
    unterStruktur: [],
    gelesenePivots: [high, low], // chronologisch, roh (unklassifiziert) — Ursprung zählt schon als gelesen
  };
}

// Prüft, ob zwischen dem (pending) Lower-High und der Bestätigungskerze des neuen Lower-Low
// (Fraktal braucht `fractalPeriod` Kerzen NACH seinem Pivot, siehe buildLevel in liquidity.js)
// irgendeine M5-Kerze per CLOSE unter das alte Low fällt. Falls nicht, war der Move dorthin nicht
// stark genug -> das Lower-High gilt nur als "weak-high" statt als bestätigtes lower-high.
// Ohne Kerzendaten (candles leer) lässt sich das nicht prüfen -> konservativ nicht abwerten.
function closesBelowOldLow(candles, fromTime, lowPivotTime, oldLowPrice, fractalPeriod) {
  if (candles.length === 0) return true;
  const lowIndex = candles.findIndex((c) => c.time === lowPivotTime);
  const confirmIndex = lowIndex === -1 ? candles.length - 1 : Math.min(lowIndex + fractalPeriod, candles.length - 1);
  const confirmTime = candles[confirmIndex].time;
  return candles.some((c) => c.time > fromTime && c.time <= confirmTime && c.close < oldLowPrice);
}

export function applyPivot(state, pivot, { candles = [], fractalPeriod = 10 } = {}) {
  const gelesenePivots = [...state.gelesenePivots, pivot];
  let { range, struktur, trendState } = state;

  if (state.direction === "down") {
    if (pivot.type === "high" && pivot.price < range.high.price) {
      // Pullback unter dem swing-high -> erster Baustein der Struktur. Ob er hält
      // (lower-high) oder nicht (weak-high) entscheidet erst der nächste Lower Low (unten).
      struktur = [...struktur, { ...pivot, type: "lower-high" }];
    } else if (pivot.type === "low" && pivot.price < range.low.price) {
      const pendingIndex = struktur.length - 1;
      const pending = pendingIndex >= 0 ? struktur[pendingIndex] : null;
      if (pending && pending.type === "lower-high") {
        const confirmed = closesBelowOldLow(candles, pending.pivotTime, pivot.pivotTime, range.low.price, fractalPeriod);
        struktur = [...struktur.slice(0, pendingIndex), { ...pending, type: confirmed ? "lower-high" : "weak-high" }];
      }
      struktur = [...struktur, { ...pivot, type: "lower-low" }];
      range = { ...range, low: pivot };
      trendState = "confirmed"; // Lower-High + Lower-Low -> echte Struktur, nicht nur Richtung
    }
  }
  // sonst: Pivot bricht die Struktur (noch) nicht -> landet nur in gelesenePivots (siehe
  // zigzagSegments unten: taucht dann als grauer, noch nicht klassifizierter Tail auf).

  return { ...state, range, struktur, trendState, gelesenePivots };
}

const STRUCTURE_COLOR = "rgba(239, 83, 80, 0.9)"; // rot - bestätigte Struktur (Ursprung + struktur[])
const TAIL_COLOR = "rgba(120, 123, 134, 0.9)"; // grau - gelesen, aber noch nicht Teil der Struktur

// Teilt den Zigzag in zwei Segmente für die Zeichnung: die bereits klassifizierte Struktur
// (Ursprung High+Low + jeder struktur[]-Eintrag, chronologisch) in Rot, und den noch nicht
// klassifizierten Rest von gelesenePivots (Pivots, die weder Range noch Struktur verändert haben)
// in Grau — siehe Chat: "zeichne das zigzack nachdem wir keine rote Struktur-Bestimmung mehr
// haben in grau". Der letzte rote Punkt wird im grauen Segment wiederholt, damit die Linie ohne
// Lücke weiterläuft.
export function zigzagSegments(state) {
  const classifiedCount = 2 + state.struktur.length;
  const points = state.gelesenePivots;
  const structurePoints = points.slice(0, classifiedCount);
  const tailPoints = points.slice(Math.max(classifiedCount - 1, 0));
  return [
    { points: structurePoints, color: STRUCTURE_COLOR },
    { points: tailPoints.length > 1 ? tailPoints : [], color: TAIL_COLOR },
  ];
}

// --- Zeichnung: Verbindungslinien von Pivot zu Pivot (siehe Chat) ------------------------------
// Anders als die horizontalen Level-Linien in liquidity.js: hier wird jeder Punkt direkt mit dem
// nächsten verbunden (Zickzack durch die Struktur), plus ein kleiner Punkt + Preis-Label an jedem
// Pivot selbst.
class ZigzagRenderer {
  constructor(points, options) {
    this._points = points; // [{x,y,label}] in Pane-Koordinaten, siehe ZigzagPaneView.update()
    this._options = options;
  }

  draw(target) {
    const pts = this._points.filter((p) => p.x !== null && p.y !== null);
    if (pts.length === 0) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const toX = (x) => Math.round(x * scope.horizontalPixelRatio);
      const toY = (y) => Math.round(y * scope.verticalPixelRatio);

      if (pts.length > 1) {
        ctx.strokeStyle = this._options.color;
        ctx.lineWidth = this._options.lineWidth;
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.y));
          else ctx.lineTo(toX(p.x), toY(p.y));
        });
        ctx.stroke();
      }

      const dotRadius = 3 * scope.horizontalPixelRatio;
      pts.forEach((p) => {
        const x = toX(p.x);
        const y = toY(p.y);
        ctx.fillStyle = this._options.color;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        if (this._options.showLabels && p.label) {
          ctx.font = `${Math.round(10 * scope.verticalPixelRatio)}px sans-serif`;
          ctx.textBaseline = "bottom";
          ctx.textAlign = "left";
          ctx.fillText(p.label, x + 6 * scope.horizontalPixelRatio, y - 4 * scope.verticalPixelRatio);
        }
      });
    });
  }

  get points() {
    return this._points;
  }
}

class ZigzagPaneView {
  constructor(source) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;
    const formatPrice = this._source._options.formatPrice;

    this._points = this._source._pivots.map((p) => {
      const barTime = snapToBarTime(candles, p.pivotTime);
      return {
        x: barTime != null ? timeScale.timeToCoordinate(barTime) : null,
        y: series.priceToCoordinate(p.price),
        label: formatPrice ? formatPrice(p.price) : null,
      };
    });
  }

  renderer() {
    return new ZigzagRenderer(this._points, this._source._options);
  }
}

export class ZigzagPrimitive {
  constructor(pivots, options, candles) {
    this._pivots = pivots; // [{price, pivotTime}, ...] chronologisch, siehe zigzagSegments()
    this._options = options;
    this._candles = candles;
    this._paneViews = [new ZigzagPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    requestUpdate(); // siehe LiquidityLinePrimitive — sonst haengt ein Primitive-Wechsel in der Luft
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }
}

const DEFAULT_LINE_WIDTH = 2;

// Ersetzt existingPrimitives komplett durch die aktuellen Zickzack-Segmente (siehe
// zigzagSegments) — analog zu renderLiquidityLevels in liquidity.js. Ein Primitive je Segment,
// damit jedes seine eigene Farbe (Rot = Struktur, Grau = noch unklassifizierter Tail) bekommt.
export function renderZigzag(series, segments, existingPrimitives, candles, options = {}) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  if (!segments || candles.length === 0) return;

  for (const segment of segments) {
    if (!segment.points || segment.points.length === 0) continue;
    const primitive = new ZigzagPrimitive(
      segment.points,
      {
        color: segment.color,
        lineWidth: options.lineWidth ?? DEFAULT_LINE_WIDTH,
        showLabels: options.showLabels ?? false,
        formatPrice: options.formatPrice,
      },
      candles,
    );
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
