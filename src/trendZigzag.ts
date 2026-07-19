import { snapToBarTime } from "./chartTimeUtils.js";
import type { Pivot } from "./range.type";

// Der ursprüngliche Zigzag-Trendalgorithmus (initTrendState/applyPivot/zigzagSegments, Philips
// erster Versuch den Trend-Algo zu bauen, siehe test/tdd_mit_claude.ts) ist seit Chat 2026-07-20
// gelöscht — abgelöst durch marketStructureAnalysis.ts (vormals rangeAnalysis.ts). Was hier
// bleibt, ist reines Chart-Rendering-Glue (Punkte per Linie verbinden, Punkt+Preis-Label je
// Pivot) — wird weiterhin für die Ranges-Debug-Marker gebraucht (siehe PriceChart.vue:
// refreshRangesMarkersInternal), unabhängig vom eigentlichen Trend-Algorithmus.

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ZigzagSegment {
  points: Pivot[];
  color: string;
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
  dotRadius?: number; // Basis-Radius in CSS-Pixeln (vor pixelRatio-Skalierung), Default 3 — siehe
  // Ranges-Periode-2-Debug-Marker (Chat 2026-07-19): sollen kleiner sein als die Periode-5-Marker.
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

      const dotRadius = (this._options.dotRadius ?? 3) * scope.horizontalPixelRatio;
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
  _pivots: Pivot[]; // chronologisch
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

// Ersetzt existingPrimitives komplett durch die aktuellen Zickzack-Segmente — analog zu
// renderLiquidityLevels in liquidity.js. Ein Primitive je Segment, damit jedes seine eigene
// Farbe bekommt (z.B. Periode-5 vs. Periode-2 Ranges-Debug-Marker).
export function renderZigzag(
  series: any,
  segments: ZigzagSegment[],
  existingPrimitives: ZigzagPrimitive[],
  candles: Candle[],
  options: { lineWidth?: number; showLabels?: boolean; formatPrice?: (price: number) => string; dotRadius?: number } = {},
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
        dotRadius: options.dotRadius,
      },
      candles,
    );
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
