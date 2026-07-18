import { snapToBarTime } from "./chartTimeUtils.js";
import type { Pivot, PivotDowntrend, DowntrendState } from "./trendTypes";

// Schrittweise Marktstruktur-Erkennung nach Philips eigenem Entwurf (siehe
// test/trendanalyse_testdriven_modelling.ts, stateSchritt1 -> stateSchritt2 -> stateSchritt3) —
// bewusst simpler als trendStructure.js: ein Pivot nach dem anderen einlesen und in die Struktur
// einordnen. Reversal (Bruch der Gegen-Grenze, also Bruch des swing-high im Downtrend) ist hier
// bewusst noch NICHT behandelt (siehe Datei: "STOPP, schreib den algo erst mal bis hier und
// nicht weiter"). Nur Downtrend implementiert -> Domain-Types (Pivot, DowntrendState, ...) kommen
// jetzt aus src/trendTypes.ts, damit Algo und Testdaten denselben Vertrag benutzen.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function initTrendState({
  trendOrdnung,
  direction,
  high,
  low,
}: {
  trendOrdnung: number;
  direction: "down";
  high: Pivot;
  low: Pivot;
}): DowntrendState {
  return {
    trendOrdnung, // 1 = übergeordneter Trend, je niedriger desto stärker (reicht als chartLabel)
    direction,
    confirmation: "unconfirmed", // Richtung erkennbar, aber ohne Lower-High+Lower-Low noch keine bestätigte Struktur
    range: {
      high: { ...high, type: "swing-high" },
      low: { ...low, type: "swing-low" },
    },
    structure: [], // klassifizierte Struktur-Pivots (lower-high/lower-low/weak-high), siehe applyPivot
    innerStructure: [],
    appliedPivots: [high, low], // chronologisch, roh (unklassifiziert) — Ursprung zählt schon als gelesen
    trendInvalidatingPivot: null, // wird erst beim Reversal (swing-high-Bruch) gesetzt, siehe trendTypes.ts
  };
}

// Prüft, ob zwischen dem (pending) Lower-High und der Bestätigungskerze des neuen Lower-Low
// (Fraktal braucht `fractalPeriod` Kerzen NACH seinem Pivot, siehe buildLevel in liquidity.js)
// irgendeine M5-Kerze per CLOSE unter das alte Low fällt. Falls nicht, war der Move dorthin nicht
// stark genug -> das Lower-High gilt nur als "weak-high" statt als bestätigtes lower-high.
// Ohne Kerzendaten (candles leer) lässt sich das nicht prüfen -> konservativ nicht abwerten.
function closesBelowOldLow(
  candles: Candle[],
  fromTime: number | undefined,
  lowPivotTime: number | undefined,
  oldLowPrice: number,
  fractalPeriod: number,
): boolean {
  if (candles.length === 0 || fromTime == null || lowPivotTime == null) return true;
  const lowIndex = candles.findIndex((c) => c.time === lowPivotTime);
  const confirmIndex = lowIndex === -1 ? candles.length - 1 : Math.min(lowIndex + fractalPeriod, candles.length - 1);
  const confirmTime = candles[confirmIndex].time;
  return candles.some((c) => c.time > fromTime && c.time <= confirmTime && c.close < oldLowPrice);
}

export function applyPivot(
  state: DowntrendState,
  pivot: Pivot,
  { candles = [], fractalPeriod = 10 }: { candles?: Candle[]; fractalPeriod?: number } = {},
): DowntrendState {
  const appliedPivots = [...state.appliedPivots, pivot];
  let { range, structure, confirmation } = state;

  if (pivot.type === "high" && pivot.price < range.high.price) {
    // Pullback unter dem swing-high -> erster Baustein der Struktur. Ob er hält
    // (lower-high) oder nicht (weak-high) entscheidet erst der nächste Lower Low (unten).
    structure = [...structure, { ...pivot, type: "lower-high" }];
  } else if (pivot.type === "low" && pivot.price < range.low.price) {
    const pendingIndex = structure.length - 1;
    const pending = pendingIndex >= 0 ? structure[pendingIndex] : null;
    if (pending && pending.type === "lower-high") {
      const confirmed = closesBelowOldLow(candles, pending.pivotTime, pivot.pivotTime, range.low.price, fractalPeriod);
      structure = [...structure.slice(0, pendingIndex), { ...pending, type: confirmed ? "lower-high" : "weak-high" }];
    }
    structure = [...structure, { ...pivot, type: "lower-low" }];
    // Achtung Domain-Lücke: range.low landet hier als ROHER Pivot (type "low", z.B. bei einem
    // frischen Lower Low direkt aus appliedPivots) statt reklassifiziert — genau wie in Philips
    // eigenem stateSchritt3 (range.low: {..., type: 'low'}). PivotDowntrend erlaubt "low"/"high"
    // aber nicht (bewusst nur klassifizierte Typen laut Philip) -> deshalb der Cast hier. Wenn das
    // so bleiben soll, müsste PivotDowntrend eigentlich "low"/"high" mit aufnehmen oder range
    // bräuchte einen eigenen (breiteren) Typ als PivotDowntrend.
    range = { ...range, low: pivot as PivotDowntrend };
    confirmation = "confirmed"; // Lower-High + Lower-Low -> echte Struktur, nicht nur Richtung
  }
  // sonst: Pivot bricht die Struktur (noch) nicht -> landet nur in appliedPivots (siehe
  // zigzagSegments unten: taucht dann als grauer, noch nicht klassifizierter Tail auf).

  return { ...state, range, structure, confirmation, appliedPivots };
}

export interface ZigzagSegment {
  points: Pivot[];
  color: string;
}

const STRUCTURE_COLOR = "rgba(239, 83, 80, 0.9)"; // rot - bestätigte Struktur (Ursprung + structure[])
const TAIL_COLOR = "rgba(120, 123, 134, 0.9)"; // grau - gelesen, aber noch nicht Teil der Struktur

// Teilt den Zigzag in zwei Segmente für die Zeichnung: die bereits klassifizierte Struktur
// (Ursprung High+Low + jeder structure[]-Eintrag, chronologisch) in Rot, und den noch nicht
// klassifizierten Rest von appliedPivots (Pivots, die weder Range noch Struktur verändert haben)
// in Grau — siehe Chat: "zeichne das zigzack nachdem wir keine rote Struktur-Bestimmung mehr
// haben in grau". Der letzte rote Punkt wird im grauen Segment wiederholt, damit die Linie ohne
// Lücke weiterläuft.
export function zigzagSegments(state: Pick<DowntrendState, "structure" | "appliedPivots">): ZigzagSegment[] {
  const classifiedCount = 2 + state.structure.length;
  const points = state.appliedPivots;
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
// Pivot selbst. Die lightweight-charts-Anbindung (Primitive/PaneView/Renderer) bleibt bewusst
// locker getypt (any) — das ist reines Chart-Rendering-Glue, nicht die Domain-Logik oben.
interface RenderOptions {
  color: string;
  lineWidth: number;
  showLabels: boolean;
  formatPrice?: (price: number) => string;
}

class ZigzagRenderer {
  private _points: any[];
  private _options: RenderOptions;

  constructor(points: any[], options: RenderOptions) {
    this._points = points; // [{x,y,label}] in Pane-Koordinaten, siehe ZigzagPaneView.update()
    this._options = options;
  }

  draw(target: any) {
    const pts = this._points.filter((p) => p.x !== null && p.y !== null);
    if (pts.length === 0) return;

    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const toX = (x: number) => Math.round(x * scope.horizontalPixelRatio);
      const toY = (y: number) => Math.round(y * scope.verticalPixelRatio);

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
  private _source: ZigzagPrimitive;
  private _points: any[];

  constructor(source: ZigzagPrimitive) {
    this._source = source;
    this._points = [];
  }

  update() {
    const series = this._source._series;
    const timeScale = this._source._chart.timeScale();
    const candles = this._source._candles;
    const formatPrice = this._source._options.formatPrice;

    this._points = this._source._pivots.map((p) => {
      const barTime = p.pivotTime != null ? snapToBarTime(candles, p.pivotTime) : null;
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
  _pivots: Pivot[]; // chronologisch, siehe zigzagSegments()
  _options: RenderOptions;
  _candles: Candle[];
  _paneViews: ZigzagPaneView[];
  _chart: any;
  _series: any;

  constructor(pivots: Pivot[], options: RenderOptions, candles: Candle[]) {
    this._pivots = pivots;
    this._options = options;
    this._candles = candles;
    this._paneViews = [new ZigzagPaneView(this)];
    this._chart = null;
    this._series = null;
  }

  attached({ chart, series, requestUpdate }: { chart: any; series: any; requestUpdate: () => void }) {
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
export function renderZigzag(
  series: any,
  segments: ZigzagSegment[],
  existingPrimitives: ZigzagPrimitive[],
  candles: Candle[],
  options: { lineWidth?: number; showLabels?: boolean; formatPrice?: (price: number) => string } = {},
) {
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
